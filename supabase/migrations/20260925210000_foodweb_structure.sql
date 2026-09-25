-- Separa a vitrine pública, o painel do criador e o Admin Master.
alter table public.workspaces
  add column description text,
  add column whatsapp_number text,
  add column pix_key text,
  add column pix_receiver text,
  add column pix_city text,
  add column service_cities text,
  add column published boolean not null default false;

alter table public.products
  add column image_url text,
  add column service_area text;

alter table public.content_profiles
  add column preferred_equipment text,
  add column training_methods text,
  add column weekly_frequency text;

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
grant select on public.platform_admins to authenticated;

create policy platform_admins_select_self on public.platform_admins
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.platform_admins
      where user_id = (select auth.uid())
    );
$$;

revoke all on function private.is_platform_admin() from public;
grant execute on function private.is_platform_admin() to authenticated;

create policy workspaces_select_master on public.workspaces
  for select to authenticated using ((select private.is_platform_admin()));

create policy workspaces_select_public on public.workspaces
  for select to anon, authenticated using (published);

create policy products_select_public on public.products
  for select to anon, authenticated
  using (
    published and exists (
      select 1 from public.workspaces
      where id = products.workspace_id and workspaces.published
    )
  );

grant select (id, name, slug, niche, description, whatsapp_number, pix_key, pix_receiver, pix_city, service_cities, published)
  on public.workspaces to anon;
grant select (id, workspace_id, kind, name, description, price, currency, published, image_url, service_area)
  on public.products to anon;

create index products_public_catalog_idx
  on public.products (workspace_id, created_at desc) where published;
create index workspaces_public_slug_idx
  on public.workspaces (slug) where published;

-- Não permite que um membro atribua a si mesmo outro papel.
revoke update, delete on public.workspace_members from authenticated;
drop policy workspace_members_update_self on public.workspace_members;
drop policy workspace_members_insert_owner on public.workspace_members;
create policy workspace_members_insert_owner on public.workspace_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'owner'
    and exists (
      select 1 from public.workspaces
      where id = workspace_id and owner_id = (select auth.uid())
    )
  );
