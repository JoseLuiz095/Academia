-- O plano Demo também pode iniciar uma solicitação pelo fluxo de primeiros passos.
create or replace function private.create_owner_workspace(
  workspace_name text,
  workspace_slug text,
  workspace_niche text,
  workspace_plan text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_request_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Autenticação necessária';
  end if;
  if workspace_name is null or workspace_slug is null or workspace_niche is null or workspace_plan is null
    or length(trim(workspace_name)) not between 3 and 80
    or length(workspace_slug) not between 3 and 80
    or workspace_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or workspace_niche not in ('fitness', 'wellness', 'creator')
    or workspace_plan not in ('demo', 'starter', 'creator', 'pro') then
    raise exception 'Dados da solicitação inválidos';
  end if;
  if exists (select 1 from public.workspaces where owner_id = current_user_id)
    or exists (
      select 1 from public.workspace_requests
      where owner_id = current_user_id and status in ('payment_pending', 'pending')
    ) then
    raise exception 'Você já possui um espaço ou uma solicitação em andamento';
  end if;
  if exists (select 1 from public.workspaces where slug = workspace_slug)
    or exists (
      select 1 from public.workspace_requests
      where slug = workspace_slug and status in ('payment_pending', 'pending')
    ) then
    raise exception 'Este endereço já está em uso';
  end if;
  insert into public.workspace_requests (owner_id, name, slug, niche, plan_code, status, payment_status)
  values (current_user_id, trim(workspace_name), workspace_slug, workspace_niche, workspace_plan, 'pending', 'not_required')
  returning id into new_request_id;
  return new_request_id;
end;
$$;
