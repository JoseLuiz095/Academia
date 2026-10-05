alter table public.products
  add column if not exists booking_enabled boolean not null default false;

alter table public.products
  drop constraint if exists products_booking_enabled_kind_check,
  add constraint products_booking_enabled_kind_check check (not booking_enabled or kind = 'service');

create table if not exists public.evaluation_availability (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes smallint not null default 60 check (slot_minutes between 15 and 240),
  location text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint evaluation_availability_time_order check (end_time > start_time),
  constraint evaluation_availability_location_check check (length(trim(location)) between 2 and 240)
);

create index if not exists evaluation_availability_product_weekday_idx
  on public.evaluation_availability(product_id, weekday, start_time)
  where active;

create table if not exists public.evaluation_bookings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id bigint references public.order_items(id) on delete set null,
  availability_id uuid not null references public.evaluation_availability(id) on delete restrict,
  customer_name text not null,
  customer_phone text not null,
  scheduled_date date not null,
  scheduled_start time not null,
  scheduled_end time not null,
  location text not null,
  status text not null default 'payment_pending',
  hold_expires_at timestamptz not null default (now() + interval '30 minutes'),
  payment_confirmed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_bookings_status_check check (status in ('payment_pending', 'awaiting_approval', 'confirmed', 'rejected', 'cancelled', 'expired')),
  constraint evaluation_bookings_name_check check (length(trim(customer_name)) between 2 and 80),
  constraint evaluation_bookings_phone_check check (customer_phone ~ '^55[0-9]{10,11}$'),
  constraint evaluation_bookings_note_check check (reviewer_note is null or length(reviewer_note) <= 500),
  constraint evaluation_bookings_time_order check (scheduled_end > scheduled_start)
);

create unique index if not exists evaluation_bookings_active_slot_idx
  on public.evaluation_bookings(product_id, scheduled_date, scheduled_start)
  where status in ('payment_pending', 'awaiting_approval', 'confirmed');
create unique index if not exists evaluation_bookings_order_item_idx
  on public.evaluation_bookings(order_item_id)
  where order_item_id is not null;
create index if not exists evaluation_bookings_workspace_status_idx
  on public.evaluation_bookings(workspace_id, status, scheduled_date, scheduled_start);
create index if not exists evaluation_bookings_order_idx
  on public.evaluation_bookings(order_id);

alter table public.evaluation_availability enable row level security;
alter table public.evaluation_bookings enable row level security;
revoke all on public.evaluation_availability, public.evaluation_bookings from public, anon, authenticated;
grant select on public.evaluation_availability to anon, authenticated;
grant select, insert, update, delete on public.evaluation_availability to authenticated;
grant select, update on public.evaluation_bookings to authenticated;

create policy evaluation_availability_public_select on public.evaluation_availability
  for select to anon
  using (active and exists (
    select 1 from public.products p
    join public.workspaces w on w.id = p.workspace_id
    where p.id = evaluation_availability.product_id
      and p.booking_enabled and p.published and w.published
  ));
create policy evaluation_availability_member_access on public.evaluation_availability
  for all to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy evaluation_bookings_member_select on public.evaluation_bookings
  for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy evaluation_bookings_member_update on public.evaluation_bookings
  for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create or replace function private.get_evaluation_slots(target_product_id uuid, from_date date, to_date date)
returns table (
  availability_id uuid,
  scheduled_date date,
  scheduled_start time,
  scheduled_end time,
  location text
)
language sql
security definer
set search_path = ''
as $$
  with dates as (
    select generated::date as day
    from generate_series(greatest(coalesce(from_date, current_date), current_date), least(coalesce(to_date, current_date + 30), current_date + 60), interval '1 day') generated
  )
  select a.id,
         d.day,
         slot.start_at::time,
         (slot.start_at + make_interval(mins => a.slot_minutes))::time,
         a.location
  from public.evaluation_availability a
  join public.products p on p.id = a.product_id
  join public.workspaces w on w.id = a.workspace_id
  cross join dates d
  cross join lateral generate_series(
    d.day + a.start_time,
    d.day + a.end_time - make_interval(mins => a.slot_minutes),
    make_interval(mins => a.slot_minutes)
  ) slot(start_at)
  where a.product_id = target_product_id
    and a.active
    and p.booking_enabled and p.published and w.published
    and extract(dow from d.day)::smallint = a.weekday
    and not exists (
      select 1
      from public.evaluation_bookings b
      where b.product_id = a.product_id
        and b.scheduled_date = d.day
        and b.scheduled_start = slot.start_at::time
        and (
          b.status in ('awaiting_approval', 'confirmed')
          or (b.status = 'payment_pending' and b.hold_expires_at > now())
        )
    )
  order by d.day, slot.start_at;
$$;

revoke all on function private.get_evaluation_slots(uuid, date, date) from public, anon, authenticated;
grant execute on function private.get_evaluation_slots(uuid, date, date) to anon, authenticated;

create or replace function public.get_evaluation_slots(target_product_id uuid, from_date date, to_date date)
returns table (
  availability_id uuid,
  scheduled_date date,
  scheduled_start time,
  scheduled_end time,
  location text
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_evaluation_slots(target_product_id, from_date, to_date);
$$;

revoke all on function public.get_evaluation_slots(uuid, date, date) from public;
grant execute on function public.get_evaluation_slots(uuid, date, date) to anon, authenticated;

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

create or replace function private.review_store_order(target_order_id uuid, decision text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  order_row public.orders%rowtype;
begin
  if current_user_id is null then raise exception 'Autenticação necessária'; end if;
  select * into order_row from public.orders where id = target_order_id for update;
  if not found or not private.is_workspace_member(order_row.workspace_id) then raise exception 'Pedido indisponível para este usuário'; end if;
  if order_row.status <> 'pending' then raise exception 'Este pedido já foi analisado'; end if;
  if decision = 'confirm' then
    update public.orders set status = 'confirmed', confirmed_at = now(), confirmed_by = current_user_id where id = target_order_id;
    update public.evaluation_bookings set status = 'awaiting_approval', payment_confirmed_at = now(), updated_at = now()
    where order_id = target_order_id and status = 'payment_pending' and hold_expires_at > now();
  elsif decision = 'cancel' then
    update public.orders set status = 'cancelled', cancelled_at = now(), cancelled_by = current_user_id where id = target_order_id;
    update public.evaluation_bookings set status = 'cancelled', updated_at = now()
    where order_id = target_order_id and status in ('payment_pending', 'awaiting_approval');
  else raise exception 'Decisão inválida'; end if;
  return target_order_id;
end;
$$;

create or replace function private.review_evaluation_booking(target_booking_id uuid, decision text, note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  booking_row public.evaluation_bookings%rowtype;
begin
  if current_user_id is null then raise exception 'Autenticação necessária'; end if;
  select * into booking_row from public.evaluation_bookings where id = target_booking_id for update;
  if not found or not private.is_workspace_member(booking_row.workspace_id) then raise exception 'Agendamento indisponível para este usuário'; end if;
  if decision = 'approve' and booking_row.status = 'awaiting_approval' then
    update public.evaluation_bookings set status = 'confirmed', approved_at = now(), approved_by = current_user_id, reviewer_note = nullif(trim(note), ''), updated_at = now() where id = target_booking_id;
  elsif decision = 'reject' and booking_row.status = 'awaiting_approval' then
    update public.evaluation_bookings set status = 'rejected', approved_at = now(), approved_by = current_user_id, reviewer_note = nullif(trim(note), ''), updated_at = now() where id = target_booking_id;
  elsif decision = 'cancel' and booking_row.status in ('payment_pending', 'awaiting_approval', 'confirmed') then
    update public.evaluation_bookings set status = 'cancelled', approved_at = now(), approved_by = current_user_id, reviewer_note = nullif(trim(note), ''), updated_at = now() where id = target_booking_id;
  else raise exception 'Transição de agendamento inválida'; end if;
  return target_booking_id;
end;
$$;

revoke all on function private.review_evaluation_booking(uuid, text, text) from public, anon, authenticated;
grant execute on function private.review_evaluation_booking(uuid, text, text) to authenticated;
create or replace function public.review_evaluation_booking(target_booking_id uuid, decision text, note text default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.review_evaluation_booking(target_booking_id, decision, note);
$$;
revoke all on function public.review_evaluation_booking(uuid, text, text) from public, anon;
grant execute on function public.review_evaluation_booking(uuid, text, text) to authenticated;
