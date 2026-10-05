create or replace function private.reschedule_evaluation_booking(
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
  if not found then raise exception 'A nova janela de disponibilidade não existe'; end if;
  if extract(dow from target_date)::smallint <> availability_row.weekday or target_date < current_date or target_date > current_date + 60 or target_start < availability_row.start_time or target_start + make_interval(mins => availability_row.slot_minutes) > availability_row.end_time then raise exception 'O novo horário não está dentro da disponibilidade'; end if;
  if exists (select 1 from public.evaluation_schedule_exceptions e where e.product_id = booking_row.product_id and e.exception_date = target_date and e.active) then raise exception 'Esta data está bloqueada por uma exceção de agenda'; end if;
  new_end := target_start + make_interval(mins => availability_row.slot_minutes);
  if exists (select 1 from public.evaluation_bookings b where b.id <> target_booking_id and b.product_id = booking_row.product_id and b.scheduled_date = target_date and b.scheduled_start = target_start and b.status in ('awaiting_approval', 'confirmed')) then raise exception 'Este horário já foi reservado'; end if;
  update public.evaluation_bookings set availability_id = target_availability_id, scheduled_date = target_date, scheduled_start = target_start, scheduled_end = new_end, location = availability_row.location, reviewer_note = nullif(trim(note), ''), updated_at = now() where id = target_booking_id;
  return target_booking_id;
end;
$$;

revoke all on function private.reschedule_evaluation_booking(uuid, uuid, date, time, text) from public, anon, authenticated;
grant execute on function private.reschedule_evaluation_booking(uuid, uuid, date, time, text) to authenticated;

create or replace function public.reschedule_evaluation_booking(
  target_booking_id uuid, target_availability_id uuid, target_date date, target_start time, note text default null
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.reschedule_evaluation_booking(target_booking_id, target_availability_id, target_date, target_start, note);
$$;

revoke all on function public.reschedule_evaluation_booking(uuid, uuid, date, time, text) from public, anon;
grant execute on function public.reschedule_evaluation_booking(uuid, uuid, date, time, text) to authenticated;
