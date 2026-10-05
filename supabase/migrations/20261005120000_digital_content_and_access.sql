alter table public.products
  add column if not exists category text not null default 'other',
  add column if not exists level text not null default 'all',
  add column if not exists access_mode text not null default 'whatsapp',
  add column if not exists access_days integer not null default 365,
  add column if not exists content jsonb not null default '{"items": []}'::jsonb;

alter table public.products
  drop constraint if exists products_category_check,
  add constraint products_category_check check (category in ('workout', 'diet', 'service', 'physical', 'other')),
  drop constraint if exists products_level_check,
  add constraint products_level_check check (level in ('beginner', 'intermediate', 'advanced', 'all')),
  drop constraint if exists products_access_mode_check,
  add constraint products_access_mode_check check (access_mode in ('whatsapp', 'portal', 'both')),
  drop constraint if exists products_access_days_check,
  add constraint products_access_days_check check (access_days between 1 and 1095),
  drop constraint if exists products_content_object_check,
  add constraint products_content_object_check check (jsonb_typeof(content) = 'object');

create index if not exists products_workspace_category_idx on public.products (workspace_id, category, level);

create table if not exists public.product_access_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  token_hash text not null unique,
  device_hash text,
  first_used_at timestamptz,
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.product_access_tokens enable row level security;
revoke all on public.product_access_tokens from anon, authenticated;

create index if not exists product_access_tokens_order_product_idx
  on public.product_access_tokens (order_id, product_id, created_at desc);
create index if not exists product_access_tokens_expires_idx
  on public.product_access_tokens (expires_at) where revoked_at is null;

create or replace function private.issue_product_access(target_order_id uuid, target_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  order_row public.orders%rowtype;
  product_row public.products%rowtype;
  raw_token text;
  token_expires_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Autenticação necessária';
  end if;

  select * into order_row
  from public.orders
  where id = target_order_id
  for update;

  if not found or order_row.status <> 'confirmed' or not private.is_workspace_member(order_row.workspace_id) then
    raise exception 'O pedido precisa estar confirmado e pertencer ao seu espaço';
  end if;

  select * into product_row
  from public.products
  where id = target_product_id and workspace_id = order_row.workspace_id;

  if not found or product_row.kind <> 'digital' or product_row.access_mode not in ('portal', 'both') then
    raise exception 'Este produto não possui acesso protegido pelo portal';
  end if;

  if not exists (
    select 1 from public.order_items
    where order_id = target_order_id and product_id = target_product_id
  ) then
    raise exception 'Este produto não pertence ao pedido informado';
  end if;

  update public.product_access_tokens
  set revoked_at = now()
  where order_id = target_order_id and product_id = target_product_id and revoked_at is null;

  raw_token := encode(extensions.gen_random_bytes(24), 'hex');
  token_expires_at := now() + make_interval(days => product_row.access_days);

  insert into public.product_access_tokens (order_id, product_id, token_hash, expires_at)
  values (
    target_order_id,
    target_product_id,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    token_expires_at
  );

  return jsonb_build_object(
    'token', raw_token,
    'product_id', product_row.id,
    'product_name', product_row.name,
    'expires_at', token_expires_at
  );
end;
$$;

revoke all on function private.issue_product_access(uuid, uuid) from public;
grant execute on function private.issue_product_access(uuid, uuid) to authenticated;

create or replace function public.issue_product_access(target_order_id uuid, target_product_id uuid)
returns jsonb
language sql
security invoker
set search_path to ''
as $$
  select private.issue_product_access(target_order_id, target_product_id);
$$;

revoke all on function public.issue_product_access(uuid, uuid) from public;
grant execute on function public.issue_product_access(uuid, uuid) to authenticated;
