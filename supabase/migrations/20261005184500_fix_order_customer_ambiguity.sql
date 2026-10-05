-- Qualify customer values before updating orders. PostgreSQL otherwise sees
-- the parameter and the orders.customer_* columns as the same identifier.
create or replace function public.create_pending_order(
  target_workspace_id uuid,
  client_request_id uuid,
  cart_items jsonb,
  expected_total numeric,
  customer_name text,
  customer_phone text,
  customer_note text,
  customer_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  customer_name_value text := customer_name;
  customer_phone_value text := customer_phone;
  customer_note_value text := customer_note;
begin
  if customer_name_value is null or length(trim(customer_name_value)) not between 2 and 80
     or customer_phone_value is null or customer_phone_value !~ '^55[0-9]{10,11}$'
     or customer_note_value is not null and length(customer_note_value) > 500
     or customer_consent is not true then
    raise exception 'Informe seus dados e autorize o contato para continuar';
  end if;

  result := private.create_pending_order(target_workspace_id, client_request_id, cart_items, expected_total);

  update public.orders as target_order
  set customer_name = trim(customer_name_value),
      customer_phone = customer_phone_value,
      customer_note = nullif(trim(customer_note_value), ''),
      customer_consent = true
  where target_order.workspace_id = target_workspace_id
    and target_order.request_id = client_request_id;

  return result;
end;
$$;

revoke all on function public.create_pending_order(uuid, uuid, jsonb, numeric, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_pending_order(uuid, uuid, jsonb, numeric, text, text, text, boolean) to service_role;
