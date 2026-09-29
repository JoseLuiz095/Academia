-- Confirmação manual do Pix da loja com transição controlada e autoria registrada.
alter table public.orders
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null;

revoke update (status) on public.orders from authenticated;
drop policy if exists orders_update_status_member on public.orders;

create or replace function private.review_store_order(target_order_id uuid, decision text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  order_row public.orders%rowtype;
begin
  if current_user_id is null then raise exception 'Autenticação necessária'; end if;
  select * into order_row from public.orders where id = target_order_id for update;
  if not found or not private.is_workspace_member(order_row.workspace_id) then
    raise exception 'Pedido indisponível para este usuário';
  end if;
  if order_row.status <> 'pending' then raise exception 'Este pedido já foi analisado'; end if;
  if decision = 'confirm' then
    update public.orders set status = 'confirmed', confirmed_at = now(), confirmed_by = current_user_id
    where id = target_order_id;
  elsif decision = 'cancel' then
    update public.orders set status = 'cancelled', cancelled_at = now(), cancelled_by = current_user_id
    where id = target_order_id;
  else
    raise exception 'Decisão inválida';
  end if;
  return target_order_id;
end;
$$;

revoke all on function private.review_store_order(uuid, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.review_store_order(uuid, text) to authenticated;

create or replace function public.review_store_order(target_order_id uuid, decision text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.review_store_order(target_order_id, decision);
$$;
revoke all on function public.review_store_order(uuid, text) from public, anon;
grant execute on function public.review_store_order(uuid, text) to authenticated;
