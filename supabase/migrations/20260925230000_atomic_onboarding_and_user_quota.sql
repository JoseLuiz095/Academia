-- Um espaço por proprietário no MVP: limita custo e mantém a operação simples.
create unique index workspaces_one_per_owner_idx on public.workspaces (owner_id);

-- Cadastro atômico: nunca deixa um espaço sem o vínculo do proprietário.
revoke insert on public.workspaces from authenticated;

create or replace function public.create_owner_workspace(
  workspace_name text, workspace_slug text, workspace_niche text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Autenticação necessária';
  end if;
  if length(trim(workspace_name)) < 3 or length(trim(workspace_name)) > 80
     or workspace_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or length(workspace_slug) < 3
     or workspace_niche not in ('fitness', 'wellness', 'creator') then
    raise exception 'Dados do espaço inválidos';
  end if;
  insert into public.workspaces (owner_id, name, slug, niche)
  values (current_user_id, trim(workspace_name), workspace_slug, workspace_niche)
  returning id into new_id;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_id, current_user_id, 'owner');
  return new_id;
end;
$$;

revoke all on function public.create_owner_workspace(text, text, text) from public, anon;
grant execute on function public.create_owner_workspace(text, text, text) to authenticated;

create table private.ai_usage_user_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default current_date,
  requests integer not null default 0 check (requests between 0 and 20),
  primary key (user_id, usage_date)
);
alter table private.ai_usage_user_daily enable row level security;

create or replace function private.consume_ai_quota(target_workspace_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not private.is_workspace_member(target_workspace_id) then
    return false;
  end if;

  insert into private.ai_usage_user_daily (user_id, usage_date, requests)
  values (current_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set requests = private.ai_usage_user_daily.requests + 1
  where private.ai_usage_user_daily.requests < 20;
  if not found then return false; end if;

  insert into private.ai_usage_daily (workspace_id, usage_date, requests)
  values (target_workspace_id, current_date, 1)
  on conflict (workspace_id, usage_date)
  do update set requests = private.ai_usage_daily.requests + 1
  where private.ai_usage_daily.requests < 20;
  if not found then
    raise exception 'Limite diário deste espaço atingido';
  end if;
  return true;
end;
$$;
