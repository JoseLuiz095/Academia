-- Planos editáveis pelo Master, limites reais no servidor e procedência das tendências.
create table if not exists public.platform_plans (
  code text primary key check (code in ('starter', 'creator', 'pro')),
  name text not null,
  monthly_price_cents integer not null check (monthly_price_cents > 0),
  product_limit integer not null check (product_limit between 1 and 1000),
  ai_daily_limit integer not null check (ai_daily_limit between 1 and 20),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.platform_plans(code, name, monthly_price_cents, product_limit, ai_daily_limit) values
  ('starter', 'Essencial', 2900, 5, 5),
  ('creator', 'Criador', 5900, 30, 12),
  ('pro', 'Crescimento', 9900, 100, 20)
on conflict(code) do nothing;
alter table public.platform_plans enable row level security;
grant select on public.platform_plans to anon, authenticated;
grant update on public.platform_plans to authenticated;
create policy platform_plans_anon_read on public.platform_plans
  for select to anon using (enabled);
create policy platform_plans_authenticated_read on public.platform_plans
  for select to authenticated using (enabled or (select private.is_platform_admin()));
create policy platform_plans_master_update on public.platform_plans
  for update to authenticated using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

alter table public.content_ideas
  add column if not exists trend_sources jsonb not null default '[]'::jsonb,
  add column if not exists trend_checked_at timestamptz;

create or replace function private.request_subscription_payment(
  target_workspace_id uuid, target_plan_code text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  workspace_row public.workspaces%rowtype;
  billing_row public.platform_billing_settings%rowtype;
  new_payment_id uuid := gen_random_uuid();
  price_cents integer;
begin
  if current_user_id is null then raise exception 'Autenticação necessária'; end if;
  select * into workspace_row from public.workspaces where id = target_workspace_id for update;
  if not found or workspace_row.owner_id <> current_user_id then
    raise exception 'Apenas o proprietário pode solicitar a mensalidade';
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
  insert into public.subscription_payments(
    id, workspace_id, requested_by, plan_code, amount_cents,
    pix_code, pix_key, pix_receiver, pix_city, reference
  ) values (
    new_payment_id, target_workspace_id, current_user_id, target_plan_code, price_cents,
    nullif(trim(billing_row.pix_static_code), ''), nullif(trim(billing_row.pix_key), ''),
    nullif(trim(billing_row.pix_receiver), ''), nullif(trim(billing_row.pix_city), ''),
    'IMP-' || upper(substr(replace(new_payment_id::text, '-', ''), 1, 10))
  );
  return new_payment_id;
end;
$$;

create or replace function private.consume_ai_quota(target_workspace_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  daily_limit integer;
begin
  if current_user_id is null or not private.is_workspace_member(target_workspace_id) then return false; end if;
  select p.ai_daily_limit into daily_limit
  from public.workspaces w join public.platform_plans p on p.code = w.plan_code
  where w.id = target_workspace_id and w.approval_status = 'approved'
    and w.subscription_status in ('trial', 'active')
    and w.subscription_ends_at > now() and p.enabled;
  if daily_limit is null then return false; end if;

  insert into private.ai_usage_user_daily(user_id, usage_date, requests)
  values(current_user_id, current_date, 1)
  on conflict(user_id, usage_date) do update
    set requests = private.ai_usage_user_daily.requests + 1
    where private.ai_usage_user_daily.requests < 20;
  if not found then return false; end if;

  insert into private.ai_usage_daily(workspace_id, usage_date, requests)
  values(target_workspace_id, current_date, 1)
  on conflict(workspace_id, usage_date) do update
    set requests = private.ai_usage_daily.requests + 1
    where private.ai_usage_daily.requests < daily_limit;
  if not found then raise exception 'Limite diário do plano atingido'; end if;
  return true;
end;
$$;

create or replace function private.enforce_product_plan_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  max_products integer;
begin
  if current_user_id is null then return new; end if;
  if not private.is_workspace_member(new.workspace_id) then raise exception 'Acesso ao espaço negado'; end if;
  if tg_op = 'UPDATE' and new.workspace_id is distinct from old.workspace_id then
    raise exception 'Não é possível transferir produtos entre espaços';
  end if;
  select p.product_limit into max_products
  from public.workspaces w join public.platform_plans p on p.code = w.plan_code
  where w.id = new.workspace_id and w.approval_status = 'approved'
    and w.subscription_status in ('trial', 'active')
    and w.subscription_ends_at > now() and p.enabled
  for update of w;
  if max_products is null then raise exception 'Assinatura inativa ou espaço não aprovado'; end if;
  if tg_op = 'INSERT' and (select count(*) from public.products where workspace_id = new.workspace_id) >= max_products then
    raise exception 'Limite de produtos do plano atingido';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_product_plan_limit on public.products;
create trigger enforce_product_plan_limit before insert or update on public.products
  for each row execute function private.enforce_product_plan_limit();
revoke all on function private.enforce_product_plan_limit() from public, anon, authenticated;
