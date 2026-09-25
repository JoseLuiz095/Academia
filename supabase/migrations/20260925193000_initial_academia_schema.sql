create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete restrict,
  name text not null,
  slug text not null unique,
  niche text not null default 'fitness',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint workspace_members_role check (role in ('owner', 'staff', 'master_admin'))
);

create table public.content_profiles (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  tone text not null default 'direto, acolhedor e motivador',
  audience text,
  goals text,
  guidelines text,
  forbidden_topics text,
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null,
  name text not null,
  description text,
  price numeric(12,2),
  currency text not null default 'BRL',
  published boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_kind check (kind in ('service', 'digital', 'physical')),
  constraint products_price_nonnegative check (price is null or price >= 0)
);

create table public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  format text not null,
  title text not null,
  hook text,
  body text,
  cta text,
  status text not null default 'draft',
  source text not null default 'manual',
  created_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_ideas_format check (format in ('story', 'post', 'message')),
  constraint content_ideas_status check (status in ('draft', 'review', 'approved', 'archived')),
  constraint content_ideas_source check (source in ('manual', 'ai'))
);

create index workspaces_owner_id_idx on public.workspaces (owner_id);
create index workspace_members_user_id_idx on public.workspace_members (user_id);
create index products_workspace_id_idx on public.products (workspace_id);
create index content_ideas_workspace_id_idx on public.content_ideas (workspace_id);

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.workspace_members
      where workspace_id = target_workspace_id
        and user_id = auth.uid()
    );
$$;

revoke all on function private.is_workspace_member(uuid) from public;
grant execute on function private.is_workspace_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.content_profiles enable row level security;
alter table public.products enable row level security;
alter table public.content_ideas enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.content_profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.content_ideas to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy workspaces_select_member on public.workspaces
  for select to authenticated using (private.is_workspace_member(id) or owner_id = auth.uid());
create policy workspaces_insert_owner on public.workspaces
  for insert to authenticated with check (owner_id = auth.uid());
create policy workspaces_update_owner on public.workspaces
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy workspace_members_select_member on public.workspace_members
  for select to authenticated using (user_id = auth.uid() or private.is_workspace_member(workspace_id));
create policy workspace_members_insert_owner on public.workspace_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
  );
create policy workspace_members_update_self on public.workspace_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy content_profiles_workspace_access on public.content_profiles
  for all to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy products_workspace_access on public.products
  for all to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy content_ideas_workspace_access on public.content_ideas
  for all to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));
