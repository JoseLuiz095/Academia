-- Dados mínimos para o profissional identificar e atender o pedido.
alter table public.orders
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_note text;

alter table public.orders
  add constraint orders_customer_name_length_check
    check (customer_name is null or length(trim(customer_name)) between 2 and 80),
  add constraint orders_customer_phone_format_check
    check (customer_phone is null or customer_phone ~ '^55[0-9]{10,11}$'),
  add constraint orders_customer_note_length_check
    check (customer_note is null or length(customer_note) <= 500);

create index if not exists orders_customer_phone_idx
  on public.orders(workspace_id, customer_phone);

-- O checkout público continua protegido pela Edge Function e pelo Turnstile.
-- O wrapper apenas acrescenta os dados ao pedido criado pela função canônica.
create or replace function public.create_pending_order(
  target_workspace_id uuid,
  client_request_id uuid,
  cart_items jsonb,
  expected_total numeric,
  customer_name text,
  customer_phone text,
  customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if customer_name is null or length(trim(customer_name)) not between 2 and 80
     or customer_phone is null or customer_phone !~ '^55[0-9]{10,11}$'
     or customer_note is not null and length(customer_note) > 500 then
    raise exception 'Informe nome e WhatsApp válidos para receber o atendimento';
  end if;

  result := private.create_pending_order(target_workspace_id, client_request_id, cart_items, expected_total);

  update public.orders
  set customer_name = trim(customer_name),
      customer_phone = customer_phone,
      customer_note = nullif(trim(customer_note), '')
  where workspace_id = target_workspace_id
    and request_id = client_request_id;

  return result;
end;
$$;

revoke all on function public.create_pending_order(uuid, uuid, jsonb, numeric, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_pending_order(uuid, uuid, jsonb, numeric, text, text, text)
  to service_role;
