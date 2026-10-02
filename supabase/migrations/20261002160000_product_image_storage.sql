-- Imagens públicas de catálogo: o arquivo é separado dos dados do produto.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read
  on storage.objects for select to public
  using (bucket_id = 'product-images');

drop policy if exists product_images_member_insert on storage.objects;
create policy product_images_member_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$'
    and private.is_workspace_member(split_part(name, '/', 1)::uuid)
  );

drop policy if exists product_images_member_update on storage.objects;
create policy product_images_member_update
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and private.is_workspace_member(split_part(name, '/', 1)::uuid))
  with check (bucket_id = 'product-images' and private.is_workspace_member(split_part(name, '/', 1)::uuid));

drop policy if exists product_images_member_delete on storage.objects;
create policy product_images_member_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and private.is_workspace_member(split_part(name, '/', 1)::uuid));
