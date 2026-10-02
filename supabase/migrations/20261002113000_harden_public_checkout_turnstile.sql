-- Toda criação pública de pedido passa pela Edge Function com Turnstile.
revoke all on function private.create_pending_order(uuid, uuid, jsonb, numeric)
  from public, anon, authenticated;
revoke all on function public.create_pending_order(uuid, uuid, jsonb, numeric)
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.create_pending_order(uuid, uuid, jsonb, numeric)
  to service_role;
grant execute on function public.create_pending_order(uuid, uuid, jsonb, numeric)
  to service_role;

create or replace function private.enforce_public_order_workspace_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.workspaces w
    where w.id = new.workspace_id
      and w.published
      and w.approval_status = 'approved'
      and w.subscription_status in ('trial', 'active')
      and w.subscription_ends_at > now()
  ) then
    raise exception 'Vitrine indisponível';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_public_order_workspace_access on public.orders;
create trigger enforce_public_order_workspace_access
before insert on public.orders
for each row execute function private.enforce_public_order_workspace_access();

revoke all on function private.enforce_public_order_workspace_access() from public, anon, authenticated;
grant execute on function private.enforce_public_order_workspace_access() to service_role;
