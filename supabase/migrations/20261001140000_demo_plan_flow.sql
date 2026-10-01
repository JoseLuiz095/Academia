-- Plano DEMO alinhado ao fluxo FoodWeb/Floriweb: 14 dias, sem cobrança automática.
alter table public.platform_plans drop constraint if exists platform_plans_code_check;
alter table public.platform_plans drop constraint if exists platform_plans_monthly_price_cents_check;
alter table public.platform_plans add constraint platform_plans_code_check check (code in ('demo', 'starter', 'creator', 'pro'));
alter table public.platform_plans add constraint platform_plans_monthly_price_cents_check check (monthly_price_cents >= 0);

insert into public.platform_plans(code, name, monthly_price_cents, product_limit, ai_daily_limit, enabled)
values ('demo', 'Demonstração', 0, 10, 3, true)
on conflict (code) do update set
  name = excluded.name,
  monthly_price_cents = excluded.monthly_price_cents,
  product_limit = excluded.product_limit,
  ai_daily_limit = excluded.ai_daily_limit,
  enabled = excluded.enabled,
  updated_at = now();

alter table public.workspace_requests drop constraint if exists workspace_requests_plan_check;
alter table public.workspace_requests add constraint workspace_requests_plan_check check (plan_code in ('demo', 'starter', 'creator', 'pro'));

alter table public.workspaces drop constraint if exists workspaces_plan_code_check;
alter table public.workspaces add constraint workspaces_plan_code_check check (plan_code in ('demo', 'starter', 'creator', 'pro'));

alter table public.subscription_payments drop constraint if exists subscription_payments_plan_code_check;
alter table public.subscription_payments add constraint subscription_payments_plan_code_check check (plan_code in ('starter', 'creator', 'pro'));
alter table public.subscription_payments drop constraint if exists subscription_payments_previous_plan_code_check;
alter table public.subscription_payments add constraint subscription_payments_previous_plan_code_check check (previous_plan_code is null or previous_plan_code in ('demo', 'starter', 'creator', 'pro'));

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
  if target_plan_code = 'demo' then raise exception 'O plano Demo não gera cobrança Pix'; end if;
  select monthly_price_cents into price_cents from public.platform_plans
  where code = target_plan_code and enabled and code <> 'demo';
  if price_cents is null or price_cents <= 0 then raise exception 'Plano indisponível'; end if;
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
  values(target_workspace_id, current_user_id, new_payment_id, 'subscription_charge_requested', intent || ' plano_anterior=' || coalesce(workspace_row.plan_code, '') || ' plano_solicitado=' || target_plan_code);
  return new_payment_id;
end;
$$;
