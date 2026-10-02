-- Se o Gemini responder, mas o rascunho não puder ser salvo, devolve a cota.
create or replace function private.refund_ai_quota(target_workspace_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  workspace_updated boolean := false;
begin
  if current_user_id is null or not private.is_workspace_member(target_workspace_id) then
    return false;
  end if;

  update private.ai_usage_user_daily
  set requests = requests - 1
  where user_id = current_user_id and usage_date = current_date and requests > 0;

  update private.ai_usage_daily
  set requests = requests - 1
  where workspace_id = target_workspace_id and usage_date = current_date and requests > 0;
  workspace_updated := found;
  return workspace_updated;
end;
$$;

revoke all on function private.refund_ai_quota(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.refund_ai_quota(uuid) to authenticated;

create or replace function public.refund_ai_quota(target_workspace_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.refund_ai_quota(target_workspace_id);
$$;

revoke all on function public.refund_ai_quota(uuid) from public, anon;
grant execute on function public.refund_ai_quota(uuid) to authenticated;
