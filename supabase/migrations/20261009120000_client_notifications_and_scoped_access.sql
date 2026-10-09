-- Notificações privadas do espaço e tokens de conteúdo com escopo/versionamento.
-- A leitura do cliente acontece apenas pela Edge Function access-product.

alter table public.product_access_tokens
  add column if not exists access_scope text not null default 'product',
  add column if not exists token_version integer not null default 1,
  add column if not exists label text;

alter table public.product_access_tokens
  drop constraint if exists product_access_tokens_scope_check,
  add constraint product_access_tokens_scope_check check (access_scope in ('product', 'order')),
  drop constraint if exists product_access_tokens_version_check,
  add constraint product_access_tokens_version_check check (token_version between 1 and 9999);

create index if not exists product_access_tokens_scope_idx
  on public.product_access_tokens (product_id, access_scope, created_at desc);

create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  target_token_id uuid references public.product_access_tokens(id) on delete cascade,
  audience text not null default 'all',
  kind text not null default 'general',
  title text not null,
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint client_notifications_audience_check check (audience in ('all', 'product', 'token')),
  constraint client_notifications_kind_check check (kind in ('general', 'workout', 'diet', 'schedule', 'important')),
  constraint client_notifications_title_length check (char_length(trim(title)) between 3 and 120),
  constraint client_notifications_body_length check (char_length(trim(body)) between 3 and 1200),
  constraint client_notifications_product_target_check check (audience <> 'product' or product_id is not null),
  constraint client_notifications_token_target_check check (audience <> 'token' or target_token_id is not null)
);

create index if not exists client_notifications_workspace_created_idx
  on public.client_notifications (workspace_id, created_at desc);
create index if not exists client_notifications_product_idx
  on public.client_notifications (product_id, created_at desc) where product_id is not null;
create index if not exists client_notifications_token_idx
  on public.client_notifications (target_token_id, created_at desc) where target_token_id is not null;

create table if not exists public.client_notification_receipts (
  notification_id uuid not null references public.client_notifications(id) on delete cascade,
  access_token_id uuid not null references public.product_access_tokens(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, access_token_id)
);

alter table public.client_notifications enable row level security;
alter table public.client_notification_receipts enable row level security;
revoke all on public.client_notifications, public.client_notification_receipts from anon, authenticated;
grant select, insert on public.client_notifications to authenticated;

drop policy if exists client_notifications_member_select on public.client_notifications;
create policy client_notifications_member_select on public.client_notifications
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

drop policy if exists client_notifications_member_insert on public.client_notifications;
create policy client_notifications_member_insert on public.client_notifications
  for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists client_notification_receipts_no_direct_access on public.client_notification_receipts;
create policy client_notification_receipts_no_direct_access on public.client_notification_receipts
  for all to anon, authenticated
  using (false)
  with check (false);

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
  next_version integer;
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

  select coalesce(max(token_version), 0) + 1 into next_version
  from public.product_access_tokens
  where order_id = target_order_id and product_id = target_product_id;

  raw_token := encode(extensions.gen_random_bytes(24), 'hex');
  token_expires_at := now() + make_interval(days => product_row.access_days);

  insert into public.product_access_tokens (order_id, product_id, token_hash, expires_at, access_scope, token_version, label)
  values (
    target_order_id,
    target_product_id,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    token_expires_at,
    'product',
    next_version,
    product_row.name
  );

  return jsonb_build_object(
    'token', raw_token,
    'product_id', product_row.id,
    'product_name', product_row.name,
    'access_scope', 'product',
    'token_version', next_version,
    'expires_at', token_expires_at
  );
end;
$$;

revoke all on function private.issue_product_access(uuid, uuid) from public;
grant execute on function private.issue_product_access(uuid, uuid) to authenticated;
