alter table public.orders
  add column if not exists customer_consent boolean not null default false;

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
begin
  if customer_name is null or length(trim(customer_name)) not between 2 and 80
     or customer_phone is null or customer_phone !~ '^55[0-9]{10,11}$'
     or customer_note is not null and length(customer_note) > 500
     or customer_consent is not true then
    raise exception 'Informe seus dados e autorize o contato para continuar';
  end if;

  result := private.create_pending_order(target_workspace_id, client_request_id, cart_items, expected_total);

  update public.orders
  set customer_name = trim(customer_name),
      customer_phone = customer_phone,
      customer_note = nullif(trim(customer_note), ''),
      customer_consent = true
  where workspace_id = target_workspace_id
    and request_id = client_request_id;

  return result;
end;
$$;

revoke all on function public.create_pending_order(uuid, uuid, jsonb, numeric, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.create_pending_order(uuid, uuid, jsonb, numeric, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.create_pending_order(uuid, uuid, jsonb, numeric, text, text, text, boolean)
  to service_role;
