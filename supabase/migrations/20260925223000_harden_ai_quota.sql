-- A API pública chama um wrapper invoker; a escrita da contagem fica no schema privado.
create or replace function private.consume_ai_quota(target_workspace_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_workspace_member(target_workspace_id) then
    return false;
  end if;

  insert into private.ai_usage_daily (workspace_id, usage_date, requests)
  values (target_workspace_id, current_date, 1)
  on conflict (workspace_id, usage_date)
  do update set requests = private.ai_usage_daily.requests + 1
  where private.ai_usage_daily.requests < 20;

  return found;
end;
$$;

revoke all on function private.consume_ai_quota(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.consume_ai_quota(uuid) to authenticated;

create or replace function public.consume_ai_quota(target_workspace_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.consume_ai_quota(target_workspace_id);
$$;

revoke all on function public.consume_ai_quota(uuid) from public, anon;
grant execute on function public.consume_ai_quota(uuid) to authenticated;

create policy ai_usage_no_direct_access on private.ai_usage_daily
  for all to authenticated using (false) with check (false);
