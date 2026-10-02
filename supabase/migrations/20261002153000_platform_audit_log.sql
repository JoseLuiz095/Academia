-- Histórico mínimo das alterações administrativas para facilitar suporte e auditoria.
create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_events_created_idx
  on public.platform_audit_events(created_at desc);
create index if not exists platform_audit_events_workspace_idx
  on public.platform_audit_events(workspace_id, created_at desc);
create index if not exists platform_audit_events_actor_idx
  on public.platform_audit_events(actor_id, created_at desc);

alter table public.platform_audit_events enable row level security;
grant select on public.platform_audit_events to authenticated;
create policy platform_audit_events_master_select
  on public.platform_audit_events
  for select to authenticated
  using (private.is_platform_admin());

create or replace function private.record_platform_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
  old_workspace_id uuid;
  entity_uuid uuid;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    new_workspace_id := case when to_jsonb(new) ? 'workspace_id' then (to_jsonb(new)->>'workspace_id')::uuid else null end;
    entity_uuid := case when to_jsonb(new) ? 'id' then (to_jsonb(new)->>'id')::uuid else null end;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    old_workspace_id := case when to_jsonb(old) ? 'workspace_id' then (to_jsonb(old)->>'workspace_id')::uuid else null end;
    if new_workspace_id is null then new_workspace_id := old_workspace_id; end if;
    if entity_uuid is null then entity_uuid := case when to_jsonb(old) ? 'id' then (to_jsonb(old)->>'id')::uuid else null end; end if;
  end if;

  insert into public.platform_audit_events(actor_id, workspace_id, entity_type, entity_id, action, metadata)
  values (
    (select auth.uid()), new_workspace_id, tg_table_name, entity_uuid, lower(tg_op),
    jsonb_build_object('changed_at', now())
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists platform_audit_workspace_requests on public.workspace_requests;
create trigger platform_audit_workspace_requests
  after insert or update or delete on public.workspace_requests
  for each row execute function private.record_platform_audit_event();

drop trigger if exists platform_audit_subscription_payments on public.subscription_payments;
create trigger platform_audit_subscription_payments
  after insert or update or delete on public.subscription_payments
  for each row execute function private.record_platform_audit_event();

drop trigger if exists platform_audit_workspaces on public.workspaces;
create trigger platform_audit_workspaces
  after insert or update or delete on public.workspaces
  for each row execute function private.record_platform_audit_event();
