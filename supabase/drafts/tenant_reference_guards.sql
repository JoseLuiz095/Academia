-- DRAFT: não está na cadeia de migrations; não executar em produção.
-- Pré-condições: comparar com o esquema remoto, diagnosticar vínculos existentes
-- e revisar a autorização direta de UPDATE de evaluation_bookings separadamente.
-- Não reescreve registros antigos nem altera estados, planos ou pagamentos.
-- Estes triggers protegem novos vínculos; mover os pais entre workspaces ainda
-- exige uma política própria ou FKs compostas antes da consolidação definitiva.

begin;

create or replace function private.guard_client_notification_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Definer é necessário somente porque os tokens não podem ser lidos pelo
  -- navegador. A autorização do remetente continua explícita e o INSERT ainda
  -- passa pela policy de client_notifications.
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
     and ((select auth.uid()) is null or not private.is_workspace_member(new.workspace_id)) then
    raise exception 'Notificação indisponível para este usuário' using errcode = '42501';
  end if;
  if new.product_id is not null and not exists (
    select 1 from public.products p where p.id = new.product_id and p.workspace_id = new.workspace_id
  ) then
    raise exception 'Produto da notificação deve pertencer ao mesmo espaço' using errcode = '23514';
  end if;
  if new.target_token_id is not null and not exists (
    select 1 from public.product_access_tokens t
    join public.orders o on o.id = t.order_id
    join public.products p on p.id = t.product_id
    where t.id = new.target_token_id and o.workspace_id = new.workspace_id
      and p.workspace_id = new.workspace_id
      and (new.product_id is null or new.product_id = t.product_id)
  ) then
    raise exception 'Acesso da notificação deve pertencer ao mesmo espaço e produto' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_client_notification_scope() from public, anon, authenticated;

drop trigger if exists client_notifications_tenant_reference_guard on public.client_notifications;
create trigger client_notifications_tenant_reference_guard
before insert or update of workspace_id, product_id, target_token_id on public.client_notifications
for each row execute function private.guard_client_notification_scope();

create or replace function private.guard_evaluation_availability_scope()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.products p where p.id = new.product_id and p.workspace_id = new.workspace_id
  ) then
    raise exception 'Produto da disponibilidade deve pertencer ao mesmo espaço' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_evaluation_availability_scope() from public, anon, authenticated;

drop trigger if exists evaluation_availability_tenant_reference_guard on public.evaluation_availability;
create trigger evaluation_availability_tenant_reference_guard
before insert or update of workspace_id, product_id on public.evaluation_availability
for each row execute function private.guard_evaluation_availability_scope();

create or replace function private.guard_evaluation_booking_scope()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.orders o where o.id = new.order_id and o.workspace_id = new.workspace_id
  ) or not exists (
    select 1 from public.products p where p.id = new.product_id and p.workspace_id = new.workspace_id
  ) or not exists (
    select 1 from public.evaluation_availability a where a.id = new.availability_id
      and a.workspace_id = new.workspace_id and a.product_id = new.product_id
  ) then
    raise exception 'Pedido, produto e disponibilidade devem pertencer ao mesmo espaço' using errcode = '23514';
  end if;
  if new.order_item_id is not null and not exists (
    select 1 from public.order_items i where i.id = new.order_item_id
      and i.order_id = new.order_id and i.product_id = new.product_id
  ) then
    raise exception 'Item deve pertencer ao pedido e produto do agendamento' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_evaluation_booking_scope() from public, anon, authenticated;

drop trigger if exists evaluation_bookings_tenant_reference_guard on public.evaluation_bookings;
create trigger evaluation_bookings_tenant_reference_guard
before insert or update of workspace_id, product_id, order_id, availability_id, order_item_id on public.evaluation_bookings
for each row execute function private.guard_evaluation_booking_scope();

commit;
