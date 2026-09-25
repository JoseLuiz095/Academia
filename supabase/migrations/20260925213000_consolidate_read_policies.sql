-- Uma política de leitura por papel/ação evita avaliações RLS duplicadas.
drop policy workspaces_select_member on public.workspaces;
drop policy workspaces_select_master on public.workspaces;
drop policy workspaces_select_public on public.workspaces;

create policy workspaces_select_authenticated on public.workspaces
  for select to authenticated
  using (
    published
    or owner_id = (select auth.uid())
    or private.is_workspace_member(id)
    or (select private.is_platform_admin())
  );

create policy workspaces_select_anon on public.workspaces
  for select to anon using (published);

drop policy products_workspace_access on public.products;
drop policy products_select_public on public.products;

create policy products_select_authenticated on public.products
  for select to authenticated
  using (
    private.is_workspace_member(workspace_id)
    or (published and exists (
      select 1 from public.workspaces
      where id = products.workspace_id and workspaces.published
    ))
  );

create policy products_select_anon on public.products
  for select to anon
  using (
    published and exists (
      select 1 from public.workspaces
      where id = products.workspace_id and workspaces.published
    )
  );

create policy products_insert_member on public.products
  for insert to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy products_update_member on public.products
  for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy products_delete_member on public.products
  for delete to authenticated
  using (private.is_workspace_member(workspace_id));
