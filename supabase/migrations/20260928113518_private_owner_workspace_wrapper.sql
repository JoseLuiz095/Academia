-- A API pública só encaminha a chamada; a escrita privilegiada fica fora do schema exposto.
create function private.create_owner_workspace(
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
  if workspace_name is null or workspace_slug is null or workspace_niche is null
     or length(trim(workspace_name)) not between 3 and 80
     or length(workspace_slug) not between 3 and 80
     or workspace_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
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

revoke all on function private.create_owner_workspace(text, text, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.create_owner_workspace(text, text, text) to authenticated;

create or replace function public.create_owner_workspace(
  workspace_name text, workspace_slug text, workspace_niche text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_owner_workspace(workspace_name, workspace_slug, workspace_niche);
$$;

revoke all on function public.create_owner_workspace(text, text, text) from public, anon;
grant execute on function public.create_owner_workspace(text, text, text) to authenticated;
