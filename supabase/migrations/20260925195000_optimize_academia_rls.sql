create index products_created_by_idx on public.products (created_by);
create index content_ideas_created_by_idx on public.content_ideas (created_by);

drop policy profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
  for select to authenticated using (private.is_workspace_member(id) or owner_id = (select auth.uid()));

drop policy workspaces_insert_owner on public.workspaces;
create policy workspaces_insert_owner on public.workspaces
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy workspaces_update_owner on public.workspaces;
create policy workspaces_update_owner on public.workspaces
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member on public.workspace_members
  for select to authenticated using (user_id = (select auth.uid()) or private.is_workspace_member(workspace_id));

drop policy workspace_members_insert_owner on public.workspace_members;
create policy workspace_members_insert_owner on public.workspace_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workspaces where id = workspace_id and owner_id = (select auth.uid()))
  );

drop policy workspace_members_update_self on public.workspace_members;
create policy workspace_members_update_self on public.workspace_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
