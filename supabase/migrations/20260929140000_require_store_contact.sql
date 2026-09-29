-- O checkout público precisa de um contato válido para concluir o pedido.
create or replace function private.require_store_contact()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.published and coalesce(new.whatsapp_number, '') !~ '^55[0-9]{10,11}$' then
    raise exception 'Informe um WhatsApp válido antes de publicar a vitrine';
  end if;
  return new;
end;
$$;

drop trigger if exists require_store_contact on public.workspaces;
create trigger require_store_contact before insert or update on public.workspaces
  for each row execute function private.require_store_contact();
revoke all on function private.require_store_contact() from public, anon, authenticated;
