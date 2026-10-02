-- Transparência de uso da IA e pequenos ajustes de segurança/performance.

create policy ai_usage_user_daily_no_direct_access
  on private.ai_usage_user_daily
  for all to authenticated
  using (false)
  with check (false);

create index if not exists orders_cancelled_by_idx
  on public.orders (cancelled_by);
create index if not exists orders_confirmed_by_idx
  on public.orders (confirmed_by);
create index if not exists platform_billing_settings_updated_by_idx
  on public.platform_billing_settings (updated_by);

create or replace function private.get_ai_usage_status(target_workspace_id uuid)
returns table (
  used integer,
  workspace_limit integer,
  user_used integer,
  user_limit integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  plan_limit integer;
begin
  if current_user_id is null or not private.is_workspace_member(target_workspace_id) then
    return;
  end if;

  select p.ai_daily_limit into plan_limit
  from public.workspaces w
  join public.platform_plans p on p.code = w.plan_code
  where w.id = target_workspace_id
    and w.approval_status = 'approved'
    and w.subscription_status in ('trial', 'active')
    and w.subscription_ends_at > now();

  if plan_limit is null then return; end if;

  return query
  select
    coalesce((select d.requests from private.ai_usage_daily d
      where d.workspace_id = target_workspace_id and d.usage_date = current_date), 0),
    plan_limit,
    coalesce((select u.requests from private.ai_usage_user_daily u
      where u.user_id = current_user_id and u.usage_date = current_date), 0),
    20;
end;
$$;

revoke all on function private.get_ai_usage_status(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.get_ai_usage_status(uuid) to authenticated;

create or replace function public.get_ai_usage_status(target_workspace_id uuid)
returns table (
  used integer,
  workspace_limit integer,
  user_used integer,
  user_limit integer
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_ai_usage_status(target_workspace_id);
$$;

revoke all on function public.get_ai_usage_status(uuid) from public, anon;
grant execute on function public.get_ai_usage_status(uuid) to authenticated;
