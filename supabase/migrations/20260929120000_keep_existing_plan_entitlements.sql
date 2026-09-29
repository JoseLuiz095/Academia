-- Desativar um plano bloqueia novas contratações, não corta assinaturas já ativas.
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
    and w.subscription_status in ('trial', 'active') and w.subscription_ends_at > now();
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
    and w.subscription_status in ('trial', 'active') and w.subscription_ends_at > now()
  for update of w;
  if max_products is null then raise exception 'Assinatura inativa ou espaço não aprovado'; end if;
  if tg_op = 'INSERT' and (select count(*) from public.products where workspace_id = new.workspace_id) >= max_products then
    raise exception 'Limite de produtos do plano atingido';
  end if;
  return new;
end;
$$;

create or replace function private.create_owner_workspace(
  workspace_name text, workspace_slug text, workspace_niche text, workspace_plan text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_request_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Autenticação necessária'; end if;
  if workspace_name is null or workspace_slug is null or workspace_niche is null or workspace_plan is null
     or length(trim(workspace_name)) not between 3 and 80
     or length(workspace_slug) not between 3 and 80
     or workspace_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or workspace_niche not in ('fitness', 'wellness', 'creator')
     or not exists (select 1 from public.platform_plans where code = workspace_plan and enabled) then
    raise exception 'Dados da solicitação inválidos ou plano indisponível';
  end if;
  if exists (select 1 from public.workspaces where owner_id = current_user_id)
     or exists (select 1 from public.workspace_requests where owner_id = current_user_id and status = 'pending') then
    raise exception 'Você já possui um espaço ou uma solicitação pendente';
  end if;
  if exists (select 1 from public.workspaces where slug = workspace_slug)
     or exists (select 1 from public.workspace_requests where slug = workspace_slug and status = 'pending') then
    raise exception 'Este endereço já está em uso';
  end if;
  insert into public.workspace_requests (owner_id, name, slug, niche, plan_code)
  values (current_user_id, trim(workspace_name), workspace_slug, workspace_niche, workspace_plan)
  returning id into new_request_id;
  return new_request_id;
end;
$$;
