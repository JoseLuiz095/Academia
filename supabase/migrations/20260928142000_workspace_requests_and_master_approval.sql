-- Cadastro entra como solicitação pendente; somente o Admin Master cria o workspace.
create table if not exists public.workspace_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  slug text not null,
  niche text not null,
  plan_code text not null default 'starter',
  status text not null default 'pending',
  reviewer_note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_requests_niche_check check (niche in ('fitness', 'wellness', 'creator')),
  constraint workspace_requests_plan_check check (plan_code in ('starter', 'creator', 'pro')),
  constraint workspace_requests_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint workspace_requests_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists workspace_requests_one_pending_owner_idx
  on public.workspace_requests (owner_id) where status = 'pending';
create unique index if not exists workspace_requests_pending_slug_idx
  on public.workspace_requests (slug) where status = 'pending';

alter table public.workspace_requests enable row level security;
grant select on public.workspace_requests to authenticated;

drop policy if exists workspace_requests_select on public.workspace_requests;
create policy workspace_requests_select on public.workspace_requests
  for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_platform_admin()));

create or replace function private.create_owner_workspace(
  workspace_name text, workspace_slug text, workspace_niche text, workspace_plan text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
     or workspace_plan not in ('starter', 'creator', 'pro') then
    raise exception 'Dados da solicitação inválidos';
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

create or replace function private.create_owner_workspace(
  workspace_name text, workspace_slug text, workspace_niche text
)
returns uuid language sql security definer set search_path = '' as $$
  select private.create_owner_workspace(workspace_name, workspace_slug, workspace_niche, 'starter');
$$;

create or replace function public.create_owner_workspace(
  workspace_name text, workspace_slug text, workspace_niche text, workspace_plan text
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_owner_workspace(workspace_name, workspace_slug, workspace_niche, workspace_plan);
$$;

create or replace function public.create_owner_workspace(
  workspace_name text, workspace_slug text, workspace_niche text
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_owner_workspace(workspace_name, workspace_slug, workspace_niche, 'starter');
$$;

revoke all on function private.create_owner_workspace(text, text, text, text) from public, anon, authenticated;
revoke all on function private.create_owner_workspace(text, text, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.create_owner_workspace(text, text, text, text) to authenticated;
grant execute on function private.create_owner_workspace(text, text, text) to authenticated;
revoke all on function public.create_owner_workspace(text, text, text, text) from public, anon;
revoke all on function public.create_owner_workspace(text, text, text) from public, anon;
grant execute on function public.create_owner_workspace(text, text, text, text) to authenticated;
grant execute on function public.create_owner_workspace(text, text, text) to authenticated;

create or replace function private.review_workspace_request(
  target_request_id uuid, decision text, reviewer_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.workspace_requests%rowtype;
  new_workspace_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not (select private.is_platform_admin()) then
    raise exception 'Apenas o Admin Master pode revisar solicitações';
  end if;
  select * into request_row from public.workspace_requests where id = target_request_id for update;
  if not found then raise exception 'Solicitação não encontrada'; end if;
  if request_row.status <> 'pending' then raise exception 'Esta solicitação já foi revisada'; end if;
  if decision = 'approve' then
    if exists (select 1 from public.workspaces where owner_id = request_row.owner_id)
       or exists (select 1 from public.workspaces where slug = request_row.slug) then
      raise exception 'O proprietário ou endereço já possui um espaço';
    end if;
    insert into public.workspaces (owner_id, name, slug, niche, plan_code, subscription_status, subscription_started_at, subscription_ends_at, store_settings)
    values (request_row.owner_id, request_row.name, request_row.slug, request_row.niche, request_row.plan_code, 'trial', now(), now() + interval '14 days', '{"theme":"sage","tagline":null,"cta_label":"Conhecer produtos","show_whatsapp":true,"show_pix":true,"show_service_area":true,"show_ai_badge":true}'::jsonb)
    returning id into new_workspace_id;
    insert into public.workspace_members (workspace_id, user_id, role) values (new_workspace_id, request_row.owner_id, 'owner');
    update public.workspace_requests set status = 'approved', reviewer_note = nullif(trim(reviewer_note), ''), reviewed_by = current_user_id, reviewed_at = now(), updated_at = now() where id = target_request_id;
  elsif decision = 'reject' then
    update public.workspace_requests set status = 'rejected', reviewer_note = nullif(trim(reviewer_note), ''), reviewed_by = current_user_id, reviewed_at = now(), updated_at = now() where id = target_request_id;
  else
    raise exception 'Decisão inválida';
  end if;
  return target_request_id;
end;
$$;

revoke all on function private.review_workspace_request(uuid, text, text) from public, anon, authenticated;
grant execute on function private.review_workspace_request(uuid, text, text) to authenticated;
create or replace function public.review_workspace_request(target_request_id uuid, decision text, reviewer_note text default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.review_workspace_request(target_request_id, decision, reviewer_note);
$$;
revoke all on function public.review_workspace_request(uuid, text, text) from public, anon;
grant execute on function public.review_workspace_request(uuid, text, text) to authenticated;
