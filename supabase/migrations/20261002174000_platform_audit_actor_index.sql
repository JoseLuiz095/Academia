create index if not exists platform_audit_events_actor_idx
  on public.platform_audit_events(actor_id, created_at desc);
