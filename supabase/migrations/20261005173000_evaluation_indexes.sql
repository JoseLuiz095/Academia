create index if not exists evaluation_availability_workspace_idx on public.evaluation_availability(workspace_id);
create index if not exists evaluation_bookings_approved_by_idx on public.evaluation_bookings(approved_by);
create index if not exists evaluation_bookings_availability_idx on public.evaluation_bookings(availability_id);
create index if not exists evaluation_schedule_exceptions_workspace_idx on public.evaluation_schedule_exceptions(workspace_id);
