-- Isenção/cortesia e mensalidade negociada por espaço.
-- A isenção não cria cobrança Pix; a negociação altera apenas o valor futuro
-- e continua sujeita ao comprovante e à aprovação manual do Admin Master.

alter table public.workspaces
  add column if not exists billing_exempt_until timestamptz,
  add column if not exists billing_exempt_reason text,
  add column if not exists billing_exempt_at timestamptz,
  add column if not exists billing_exempt_by uuid references auth.users(id) on delete set null,
  add column if not exists negotiated_monthly_price_cents integer,
  add column if not exists negotiated_price_note text,
  add column if not exists negotiated_price_at timestamptz,
  add column if not exists negotiated_price_by uuid references auth.users(id) on delete set null;

alter table public.workspaces
  drop constraint if exists workspaces_negotiated_monthly_price_check,
  add constraint workspaces_negotiated_monthly_price_check
    check (negotiated_monthly_price_cents is null or negotiated_monthly_price_cents between 100 and 1000000);

create index if not exists workspaces_billing_exempt_until_idx
  on public.workspaces (billing_exempt_until)
  where billing_exempt_until is not null;
create index if not exists workspaces_negotiated_price_idx
  on public.workspaces (negotiated_monthly_price_cents)
  where negotiated_monthly_price_cents is not null;

create or replace function private.request_subscription_payment(
  target_workspace_id uuid, target_plan_code text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  workspace_row public.workspaces%rowtype;
  billing_row public.platform_billing_settings%rowtype;
  new_payment_id uuid := gen_random_uuid();
  base_price_cents integer;
  price_cents integer;
  intent text;
begin
  if current_user_id is null then raise exception 'Autenticação necessária'; end if;
  select * into workspace_row from public.workspaces where id = target_workspace_id for update;
  if not found then raise exception 'Espaço não encontrado'; end if;
  if workspace_row.owner_id <> current_user_id and not (select private.is_platform_admin()) then
    raise exception 'Apenas o proprietário ou o Admin Master pode solicitar a mensalidade';
  end if;
  if workspace_row.approval_status <> 'approved' then raise exception 'Espaço não aprovado'; end if;
  if workspace_row.billing_exempt_until is not null and workspace_row.billing_exempt_until > now() then
    raise exception 'Este espaço possui isenção de cobrança até %', workspace_row.billing_exempt_until::date;
  end if;
  if target_plan_code = 'demo' then raise exception 'O plano Demo não gera cobrança Pix'; end if;
  select monthly_price_cents into base_price_cents from public.platform_plans
  where code = target_plan_code and enabled and code <> 'demo';
  if base_price_cents is null or base_price_cents <= 0 then raise exception 'Plano indisponível'; end if;
  price_cents := coalesce(workspace_row.negotiated_monthly_price_cents, base_price_cents);
  if exists (select 1 from public.subscription_payments where workspace_id = target_workspace_id and status in ('pending', 'proof_sent')) then
    raise exception 'Já existe uma cobrança em aberto para este espaço';
  end if;
  select * into billing_row from public.platform_billing_settings where id = true;
  if not found or (nullif(trim(billing_row.pix_static_code), '') is null and
      (nullif(trim(billing_row.pix_key), '') is null or nullif(trim(billing_row.pix_receiver), '') is null or nullif(trim(billing_row.pix_city), '') is null)) then
    raise exception 'O Pix da plataforma ainda não foi configurado';
  end if;
  intent := case when workspace_row.plan_code is distinct from target_plan_code then 'plan_change' else 'renewal' end;
  insert into public.subscription_payments(id, workspace_id, requested_by, plan_code, previous_plan_code, payment_intent, amount_cents, pix_code, pix_key, pix_receiver, pix_city, reference)
  values (new_payment_id, target_workspace_id, current_user_id, target_plan_code, workspace_row.plan_code, intent, price_cents,
    nullif(trim(billing_row.pix_static_code), ''), nullif(trim(billing_row.pix_key), ''), nullif(trim(billing_row.pix_receiver), ''), nullif(trim(billing_row.pix_city), ''),
    'IMP-' || upper(substr(replace(new_payment_id::text, '-', ''), 1, 10)));
  insert into public.subscription_events(workspace_id, actor_id, payment_id, action, detail)
  values(target_workspace_id, current_user_id, new_payment_id, 'subscription_charge_requested',
    intent || ' plano_anterior=' || coalesce(workspace_row.plan_code, '') || ' plano_solicitado=' || target_plan_code ||
    case when workspace_row.negotiated_monthly_price_cents is not null then ' valor_negociado=true' else '' end);
  return new_payment_id;
end;
$$;

create or replace function private.manage_workspace_billing(
  target_workspace_id uuid,
  action text,
  negotiated_amount_cents integer default null,
  exemption_days integer default null,
  note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  workspace_row public.workspaces%rowtype;
  next_end timestamptz;
  clean_note text := nullif(trim(coalesce(note, '')), '');
  event_detail text;
begin
  if current_user_id is null or not (select private.is_platform_admin()) then
    raise exception 'Apenas o Admin Master pode negociar ou isentar um espaço';
  end if;
  select * into workspace_row from public.workspaces where id = target_workspace_id for update;
  if not found then raise exception 'Espaço não encontrado'; end if;

  if action = 'waive' then
    if exemption_days is null or exemption_days not between 1 and 730 then raise exception 'Informe uma isenção entre 1 e 730 dias'; end if;
    if clean_note is null or char_length(clean_note) < 5 then raise exception 'Informe o motivo da isenção'; end if;
    next_end := greatest(coalesce(workspace_row.subscription_ends_at, now()), now()) + make_interval(days => exemption_days);
    update public.workspaces set
      subscription_status = 'active',
      subscription_started_at = coalesce(subscription_started_at, now()),
      subscription_ends_at = next_end,
      billing_exempt_until = next_end,
      billing_exempt_reason = clean_note,
      billing_exempt_at = now(),
      billing_exempt_by = current_user_id
    where id = target_workspace_id;
    event_detail := 'Isenção/cortesia por ' || exemption_days::text || ' dia(s), até ' || next_end::text || '. Motivo: ' || clean_note;
  elsif action = 'negotiate' then
    if negotiated_amount_cents is null or negotiated_amount_cents not between 100 and 1000000 then raise exception 'Informe um valor negociado entre R$ 1,00 e R$ 10.000,00'; end if;
    if clean_note is null or char_length(clean_note) < 5 then raise exception 'Informe o motivo ou condição da negociação'; end if;
    update public.workspaces set
      negotiated_monthly_price_cents = negotiated_amount_cents,
      negotiated_price_note = clean_note,
      negotiated_price_at = now(),
      negotiated_price_by = current_user_id
    where id = target_workspace_id;
    event_detail := 'Mensalidade negociada para R$ ' || to_char(negotiated_amount_cents / 100.0, 'FM999999990D00') || '. Condição: ' || clean_note;
  elsif action = 'clear_negotiation' then
    update public.workspaces set negotiated_monthly_price_cents = null, negotiated_price_note = null, negotiated_price_at = now(), negotiated_price_by = current_user_id where id = target_workspace_id;
    event_detail := 'Negociação removida; próximas cobranças usam o preço do plano.';
  elsif action = 'clear_exemption' then
    update public.workspaces set billing_exempt_until = null, billing_exempt_reason = null, billing_exempt_at = now(), billing_exempt_by = current_user_id where id = target_workspace_id;
    event_detail := 'Isenção removida; a cobrança volta a seguir o ciclo normal.';
  else
    raise exception 'Ação de cobrança inválida';
  end if;

  insert into public.subscription_events(workspace_id, actor_id, action, detail)
  values(target_workspace_id, current_user_id, 'billing_' || action, event_detail);
  return target_workspace_id;
end;
$$;

create or replace function public.manage_workspace_billing(
  target_workspace_id uuid,
  action text,
  negotiated_amount_cents integer default null,
  exemption_days integer default null,
  note text default null
) returns uuid language sql security invoker set search_path = '' as $$
  select private.manage_workspace_billing(target_workspace_id, action, negotiated_amount_cents, exemption_days, note);
$$;

revoke all on function private.manage_workspace_billing(uuid, text, integer, integer, text) from public, anon, authenticated;
revoke all on function public.manage_workspace_billing(uuid, text, integer, integer, text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.manage_workspace_billing(uuid, text, integer, integer, text) to authenticated;
grant execute on function public.manage_workspace_billing(uuid, text, integer, integer, text) to authenticated;
