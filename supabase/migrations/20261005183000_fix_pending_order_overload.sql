-- The appointment-aware overload must require its ninth argument.
-- Otherwise PostgreSQL considers it alongside the eight-argument overload
-- when the wrapper calls create_pending_order, producing "is not unique".
drop function if exists public.create_pending_order(uuid, uuid, jsonb, numeric, text, text, text, boolean, jsonb);

create or replace function public.create_pending_order(
  target_workspace_id uuid,
  client_request_id uuid,
  cart_items jsonb,
  expected_total numeric,
  customer_name text,
  customer_phone text,
  customer_note text,
  customer_consent boolean,
  appointment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  order_row public.orders%rowtype;
  item_row public.order_items%rowtype;
  product_row public.products%rowtype;
  availability_row public.evaluation_availability%rowtype;
  booking_row public.evaluation_bookings%rowtype;
  appointment_product_id uuid;
  appointment_item_id bigint;
  appointment_availability_id uuid;
  appointment_date date;
  appointment_start time;
  appointment_end time;
begin
  result := public.create_pending_order(
    target_workspace_id, client_request_id, cart_items, expected_total,
    customer_name, customer_phone, customer_note, customer_consent
  );

  if appointment is null or appointment = '{}'::jsonb then
    return result;
  end if;
  if jsonb_typeof(appointment) is distinct from 'object'
     or not (appointment ? 'product_id')
     or not (appointment ? 'availability_id')
     or not (appointment ? 'scheduled_date')
     or not (appointment ? 'scheduled_start') then
    raise exception 'Pré-cadastro de avaliação inválido';
  end if;

  appointment_product_id := (appointment->>'product_id')::uuid;
  appointment_availability_id := (appointment->>'availability_id')::uuid;
  appointment_date := (appointment->>'scheduled_date')::date;
  appointment_start := (appointment->>'scheduled_start')::time;

  select * into order_row from public.orders
  where workspace_id = target_workspace_id and request_id = client_request_id;
  select oi.* into item_row from public.order_items oi
  where oi.order_id = order_row.id and oi.product_id = appointment_product_id
  order by oi.id limit 1;
  if not found then raise exception 'A avaliação não está no pedido'; end if;

  select * into product_row from public.products where id = appointment_product_id
    and workspace_id = target_workspace_id and kind = 'service' and booking_enabled and published;
  if not found then raise exception 'Este serviço não aceita agendamento'; end if;

  select * into availability_row from public.evaluation_availability
  where id = appointment_availability_id and product_id = appointment_product_id and active;
  if not found then raise exception 'Este horário não está disponível'; end if;
  if extract(dow from appointment_date)::smallint <> availability_row.weekday
     or appointment_date < current_date
     or appointment_date > current_date + 60
     or appointment_start < availability_row.start_time
     or appointment_start + make_interval(mins => availability_row.slot_minutes) > availability_row.end_time then
    raise exception 'O horário escolhido não está dentro da disponibilidade';
  end if;
  appointment_end := appointment_start + make_interval(mins => availability_row.slot_minutes);

  update public.evaluation_bookings
  set status = 'expired', updated_at = now()
  where product_id = appointment_product_id
    and scheduled_date = appointment_date
    and scheduled_start = appointment_start
    and status = 'payment_pending'
    and hold_expires_at <= now();

  select * into booking_row from public.evaluation_bookings
  where order_id = order_row.id and order_item_id = item_row.id;
  if found then
    if booking_row.scheduled_date <> appointment_date or booking_row.scheduled_start <> appointment_start then
      raise exception 'Este pedido já possui um horário de avaliação';
    end if;
    return result || jsonb_build_object('appointment', jsonb_build_object(
      'id', booking_row.id, 'status', booking_row.status, 'scheduled_date', booking_row.scheduled_date,
      'scheduled_start', booking_row.scheduled_start, 'scheduled_end', booking_row.scheduled_end, 'location', booking_row.location
    ));
  end if;

  insert into public.evaluation_bookings (
    workspace_id, product_id, order_id, order_item_id, availability_id,
    customer_name, customer_phone, scheduled_date, scheduled_start, scheduled_end, location
  ) values (
    target_workspace_id, appointment_product_id, order_row.id, item_row.id, availability_row.id,
    trim(customer_name), customer_phone, appointment_date, appointment_start, appointment_end, availability_row.location
  ) returning * into booking_row;

  return result || jsonb_build_object('appointment', jsonb_build_object(
    'id', booking_row.id, 'status', booking_row.status, 'scheduled_date', booking_row.scheduled_date,
    'scheduled_start', booking_row.scheduled_start, 'scheduled_end', booking_row.scheduled_end, 'location', booking_row.location
  ));
exception
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    raise exception 'Data ou horário de avaliação inválido';
end;
$$;

revoke all on function public.create_pending_order(uuid, uuid, jsonb, numeric, text, text, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.create_pending_order(uuid, uuid, jsonb, numeric, text, text, text, boolean, jsonb) to service_role;
