-- Pedidos da vitrine: o visitante informa apenas produtos e quantidades.
-- Preços, nomes, total, estado e referência são definidos no banco.
create sequence public.order_reference_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid not null,
  request_items jsonb not null,
  reference text not null unique default ('PED-' || nextval('public.order_reference_seq'::regclass)::text),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  total numeric(12,2) not null check (total >= 0),
  created_at timestamptz not null default now(),
  unique (workspace_id, request_id)
);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity between 1 and 99),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) generated always as (quantity * unit_price) stored
);

create index orders_workspace_created_idx on public.orders (workspace_id, created_at desc);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.orders, public.order_items from public, anon, authenticated;
grant select on public.orders, public.order_items to authenticated;
grant update (status) on public.orders to authenticated;

create policy orders_select_member on public.orders
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy orders_update_status_member on public.orders
  for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy order_items_select_member on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and private.is_workspace_member(orders.workspace_id)
  ));

-- A função interna é a única via de criação pública. A função exposta abaixo
-- executa como invoker; a interna valida integralmente cada pedido anônimo.
create function private.create_pending_order(
  target_workspace_id uuid, client_request_id uuid, cart_items jsonb, expected_total numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry jsonb;
  item_id uuid;
  item_quantity integer;
  canonical jsonb := '{}'::jsonb;
  snapshots jsonb := '[]'::jsonb;
  product_row record;
  existing_row public.orders%rowtype;
  new_row public.orders%rowtype;
  total_amount numeric(12,2) := 0;
begin
  if target_workspace_id is null or client_request_id is null
     or jsonb_typeof(cart_items) is distinct from 'array' then
    raise exception 'Pedido inválido';
  end if;
  if jsonb_array_length(cart_items) not between 1 and 20 then
    raise exception 'O pedido deve conter de 1 a 20 produtos';
  end if;

  for entry in select value from jsonb_array_elements(cart_items) loop
    if jsonb_typeof(entry) is distinct from 'object'
       or jsonb_typeof(entry->'product_id') is distinct from 'string'
       or jsonb_typeof(entry->'quantity') is distinct from 'number' then
      raise exception 'Item do pedido inválido';
    end if;
    item_id := (entry->>'product_id')::uuid;
    item_quantity := (entry->>'quantity')::integer;
    if item_quantity not between 1 and 99 or canonical ? item_id::text then
      raise exception 'Quantidade ou produto duplicado inválido';
    end if;
    canonical := canonical || jsonb_build_object(item_id::text, item_quantity);
  end loop;

  select * into existing_row from public.orders
  where workspace_id = target_workspace_id and orders.request_id = client_request_id;
  if found then
    if existing_row.request_items <> canonical then
      raise exception 'Esta tentativa já foi usada para outro pedido';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', oi.product_name, 'quantity', oi.quantity,
      'unit_price', oi.unit_price, 'line_total', oi.line_total
    ) order by oi.id), '[]'::jsonb)
    into snapshots from public.order_items oi where oi.order_id = existing_row.id;
    return jsonb_build_object('reference', existing_row.reference, 'total', existing_row.total, 'items', snapshots);
  end if;

  if not exists (select 1 from public.workspaces w
                 where w.id = target_workspace_id and w.published) then
    raise exception 'Vitrine indisponível';
  end if;

  for entry in select value from jsonb_array_elements(cart_items) loop
    item_id := (entry->>'product_id')::uuid;
    item_quantity := (entry->>'quantity')::integer;
    select p.name, p.price, p.currency into product_row
    from public.products p
    where p.id = item_id and p.workspace_id = target_workspace_id
      and p.published and p.price is not null;
    if not found or product_row.currency <> 'BRL' then
      raise exception 'Produto indisponível. Atualize a vitrine';
    end if;
    total_amount := total_amount + product_row.price * item_quantity;
    snapshots := snapshots || jsonb_build_array(jsonb_build_object(
      'product_id', item_id, 'name', product_row.name,
      'quantity', item_quantity, 'unit_price', product_row.price,
      'line_total', product_row.price * item_quantity
    ));
  end loop;

  if expected_total is null or total_amount <> expected_total then
    raise exception 'Os valores mudaram. Atualize a vitrine e tente novamente';
  end if;

  insert into public.orders (workspace_id, request_id, request_items, total)
  values (target_workspace_id, client_request_id, canonical, total_amount)
  on conflict (workspace_id, request_id) do nothing
  returning * into new_row;

  if not found then
    select * into existing_row from public.orders
    where workspace_id = target_workspace_id and orders.request_id = client_request_id;
    if existing_row.request_items <> canonical then
      raise exception 'Esta tentativa já foi usada para outro pedido';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', oi.product_name, 'quantity', oi.quantity,
      'unit_price', oi.unit_price, 'line_total', oi.line_total
    ) order by oi.id), '[]'::jsonb)
    into snapshots from public.order_items oi where oi.order_id = existing_row.id;
    return jsonb_build_object('reference', existing_row.reference, 'total', existing_row.total, 'items', snapshots);
  end if;

  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price)
  select new_row.id, (item->>'product_id')::uuid, item->>'name',
         (item->>'quantity')::integer, (item->>'unit_price')::numeric
  from jsonb_array_elements(snapshots) item;

  return jsonb_build_object('reference', new_row.reference, 'total', new_row.total, 'items', snapshots);
end;
$$;

revoke all on function private.create_pending_order(uuid, uuid, jsonb, numeric) from public, anon, authenticated;
grant usage on schema private to anon;
grant execute on function private.create_pending_order(uuid, uuid, jsonb, numeric) to anon, authenticated;

create function public.create_pending_order(
  target_workspace_id uuid, client_request_id uuid, cart_items jsonb, expected_total numeric
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_pending_order(target_workspace_id, client_request_id, cart_items, expected_total);
$$;

revoke all on function public.create_pending_order(uuid, uuid, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.create_pending_order(uuid, uuid, jsonb, numeric) to anon, authenticated;
