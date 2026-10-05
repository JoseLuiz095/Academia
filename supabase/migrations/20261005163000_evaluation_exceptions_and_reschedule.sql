create table if not exists public.evaluation_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  exception_date date not null,
  mode text not null default 'blocked',
  reason text not null default 'Indisponível nesta data',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint evaluation_exception_mode_check check (mode = 'blocked'),
  constraint evaluation_exception_reason_check check (length(trim(reason)) between 2 and 240),
  unique (product_id, exception_date)
);

create index if not exists evaluation_schedule_exceptions_product_date_idx
  on public.evaluation_schedule_exceptions(product_id, exception_date)
  where active;

alter table public.evaluation_schedule_exceptions enable row level security;
revoke all on public.evaluation_schedule_exceptions from public, anon, authenticated;
grant select on public.evaluation_schedule_exceptions to anon, authenticated;
grant select, insert, update, delete on public.evaluation_schedule_exceptions to authenticated;

create policy evaluation_schedule_exceptions_public_select on public.evaluation_schedule_exceptions
  for select to anon
  using (active and mode = 'blocked' and exists (
    select 1 from public.products p
    join public.workspaces w on w.id = p.workspace_id
    where p.id = evaluation_schedule_exceptions.product_id
      and p.booking_enabled and p.published and w.published
  ));

create policy evaluation_schedule_exceptions_member_access on public.evaluation_schedule_exceptions
  for all to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create or replace function private.get_evaluation_slots(target_product_id uuid, from_date date, to_date date)
returns table (availability_id uuid, scheduled_date date, scheduled_start time, scheduled_end time, location text)
language sql security definer set search_path = '' as $$
  with dates as (
    select generated::date as day
    from generate_series(greatest(coalesce(from_date, current_date), current_date), least(coalesce(to_date, current_date + 30), current_date + 60), interval '1 day') generated
  ), candidates as (
    select a.id as availability_id, d.day as scheduled_date, slot.start_at::time as scheduled_start,
      (slot.start_at + make_interval(mins => a.slot_minutes))::time as scheduled_end, a.location
    from public.evaluation_availability a
    join public.products p on p.id = a.product_id
    join public.workspaces w on w.id = a.workspace_id
    cross join dates d
    cross join lateral generate_series(d.day + a.start_time, d.day + a.end_time - make_interval(mins => a.slot_minutes), make_interval(mins => a.slot_minutes)) slot(start_at)
    where a.product_id = target_product_id and a.active and p.booking_enabled and p.published and w.published
      and extract(dow from d.day)::smallint = a.weekday
      and not exists (select 1 from public.evaluation_schedule_exceptions e where e.product_id = a.product_id and e.exception_date = d.day and e.active)
  )
  select c.availability_id, c.scheduled_date, c.scheduled_start, c.scheduled_end, c.location
  from candidates c
  where not exists (
    select 1 from public.evaluation_bookings b
    where b.product_id = target_product_id and b.scheduled_date = c.scheduled_date and b.scheduled_start = c.scheduled_start
      and (b.status in ('awaiting_approval', 'confirmed') or (b.status = 'payment_pending' and b.hold_expires_at > now()))
  )
  order by c.scheduled_date, c.scheduled_start;
$$;

create or replace function public.reschedule_evaluation_booking(
  target_booking_id uuid, target_availability_id uuid, target_date date, target_start time, note text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  booking_row public.evaluation_bookings%rowtype;
  availability_row public.evaluation_availability%rowtype;
  new_end time;
begin
  if current_user_id is null then raise exception 'Autenticação necessária'; end if;
  select * into booking_row from public.evaluation_bookings where id = target_booking_id for update;
  if not found or not private.is_workspace_member(booking_row.workspace_id) then raise exception 'Agendamento indisponível para este usuário'; end if;
  if booking_row.status not in ('awaiting_approval', 'confirmed') then raise exception 'Só é possível reagendar após a confirmação do pagamento'; end if;
  select * into availability_row from public.evaluation_availability where id = target_availability_id and product_id = booking_row.product_id and active;
  if found then
    if extract(dow from target_date)::smallint <> availability_row.weekday or target_date < current_date or target_date > current_date + 60 or target_start < availability_row.start_time or target_start + make_interval(mins => availability_row.slot_minutes) > availability_row.end_time then raise exception 'O novo horário não está dentro da disponibilidade'; end if;
    if exists (select 1 from public.evaluation_schedule_exceptions e where e.product_id = booking_row.product_id and e.exception_date = target_date and e.active) then raise exception 'Esta data está bloqueada por uma exceção de agenda'; end if;
    new_end := target_start + make_interval(mins => availability_row.slot_minutes);
  else raise exception 'A nova janela de disponibilidade não existe';
  end if;
  if exists (select 1 from public.evaluation_bookings b where b.id <> target_booking_id and b.product_id = booking_row.product_id and b.scheduled_date = target_date and b.scheduled_start = target_start and b.status in ('awaiting_approval', 'confirmed')) then raise exception 'Este horário já foi reservado'; end if;
  update public.evaluation_bookings set availability_id = target_availability_id, scheduled_date = target_date, scheduled_start = target_start, scheduled_end = new_end, reviewer_note = nullif(trim(note), ''), updated_at = now() where id = target_booking_id;
  return target_booking_id;
end;
$$;

revoke all on function public.reschedule_evaluation_booking(uuid, uuid, date, time, text) from public, anon;
grant execute on function public.reschedule_evaluation_booking(uuid, uuid, date, time, text) to authenticated;
