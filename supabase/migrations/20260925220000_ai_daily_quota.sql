-- Limite simples para evitar consumo acidental da API Gemini.
create table private.ai_usage_daily (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  usage_date date not null default current_date,
  requests integer not null default 0 check (requests between 0 and 20),
  primary key (workspace_id, usage_date)
);

alter table private.ai_usage_daily enable row level security;

create or replace function public.consume_ai_quota(target_workspace_id uuid)
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

revoke all on function public.consume_ai_quota(uuid) from public;
grant execute on function public.consume_ai_quota(uuid) to authenticated;
