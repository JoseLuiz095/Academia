create policy product_access_tokens_no_direct_access on public.product_access_tokens
  for all to anon, authenticated
  using (false)
  with check (false);

create index if not exists product_access_tokens_product_idx on public.product_access_tokens (product_id);
create index if not exists public_store_reports_product_idx on public.public_store_reports (product_id) where product_id is not null;
create index if not exists public_store_reports_reviewed_by_idx on public.public_store_reports (reviewed_by) where reviewed_by is not null;
