-- Adequação do ciclo de cobrança ao fluxo FoodWeb/Floriweb:
-- alteração de plano gera cobrança; somente o pagamento confirmado altera a assinatura.

alter table public.subscription_payments
  add column if not exists payment_intent text not null default 'renewal'
    check (payment_intent in ('renewal', 'plan_change')),
  add column if not exists previous_plan_code text
    check (previous_plan_code is null or previous_plan_code in ('starter', 'creator', 'pro'));

grant execute on function public.create_pending_order(uuid, uuid, jsonb, numeric) to service_role;

update public.subscription_payments p
set payment_intent = case when p.previous_plan_code is not null and p.previous_plan_code <> p.plan_code then 'plan_change' else 'renewal' end
where p.previous_plan_code is null;

create or replace function private.request_subscription_payment(
  target_workspace_id uuid, target_plan_code text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  workspace_row public.workspaces%rowtype;
  billing_row public.platform_billing_settings%rowtype;
  new_payment_id uuid := gen_random_uuid();
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
  select monthly_price_cents into price_cents from public.platform_plans
  where code = target_plan_code and enabled;
  if price_cents is null then raise exception 'Plano indisponível'; end if;
  if exists (select 1 from public.subscription_payments
    where workspace_id = target_workspace_id and status in ('pending', 'proof_sent')) then
    raise exception 'Já existe uma cobrança em aberto para este espaço';
  end if;
  select * into billing_row from public.platform_billing_settings where id = true;
  if not found or (nullif(trim(billing_row.pix_static_code), '') is null and
      (nullif(trim(billing_row.pix_key), '') is null or
       nullif(trim(billing_row.pix_receiver), '') is null or
       nullif(trim(billing_row.pix_city), '') is null)) then
    raise exception 'O Pix da plataforma ainda não foi configurado';
  end if;
  intent := case when workspace_row.plan_code is distinct from target_plan_code then 'plan_change' else 'renewal' end;
  insert into public.subscription_payments(
    id, workspace_id, requested_by, plan_code, previous_plan_code, payment_intent, amount_cents,
    pix_code, pix_key, pix_receiver, pix_city, reference
  ) values (
    new_payment_id, target_workspace_id, current_user_id, target_plan_code, workspace_row.plan_code, intent, price_cents,
    nullif(trim(billing_row.pix_static_code), ''), nullif(trim(billing_row.pix_key), ''),
    nullif(trim(billing_row.pix_receiver), ''), nullif(trim(billing_row.pix_city), ''),
    'IMP-' || upper(substr(replace(new_payment_id::text, '-', ''), 1, 10))
  );
  insert into public.subscription_events(workspace_id, actor_id, payment_id, action, detail)
  values(target_workspace_id, current_user_id, new_payment_id, 'subscription_charge_requested',
    intent || ' plano_anterior=' || coalesce(workspace_row.plan_code, '') || ' plano_solicitado=' || target_plan_code);
  return new_payment_id;
end;
$$;

create or replace function private.manage_workspace_subscription(
  target_workspace_id uuid, action text, plan text default null,
  period_days integer default null, note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  workspace_row public.workspaces%rowtype;
begin
  if current_user_id is null or not (select private.is_platform_admin()) then
    raise exception 'Apenas o Admin Master pode alterar a assinatura';
  end if;
  select * into workspace_row from public.workspaces where id = target_workspace_id for update;
  if not found then raise exception 'Espaço não encontrado'; end if;
  if action = 'suspend' then
    update public.workspaces set approval_status = 'suspended', published = false where id = target_workspace_id;
  elsif action = 'restore' then
    update public.workspaces set approval_status = 'approved' where id = target_workspace_id;
  elsif action = 'extend' then
    if period_days is null or period_days not between 1 and 365 then raise exception 'Informe de 1 a 365 dias'; end if;
    update public.workspaces set subscription_status = 'active',
      subscription_ends_at = greatest(subscription_ends_at, now()) + make_interval(days => period_days)
    where id = target_workspace_id;
  elsif action = 'change_plan' then
    raise exception 'Alteração de plano deve gerar uma cobrança Pix. Use a opção de gerar cobrança.';
  else
    raise exception 'Ação inválida';
  end if;
  insert into public.subscription_events(workspace_id, actor_id, action, detail)
  values(target_workspace_id, current_user_id, action,
    nullif(trim(coalesce(note, '') || ' plano=' || coalesce(plan, '') || ' dias=' || coalesce(period_days::text, '')), ''));
  return target_workspace_id;
end;
$$;
