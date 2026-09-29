-- O Master precisa identificar o solicitante antes de liberar o espaço.
alter table public.workspace_requests add column if not exists owner_email text;

update public.workspace_requests r set owner_email = u.email
from auth.users u where r.owner_id = u.id and r.owner_email is null;

create or replace function private.set_workspace_request_contact()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select email into new.owner_email from auth.users where id = new.owner_id;
  if nullif(trim(coalesce(new.owner_email, '')), '') is null then
    raise exception 'Conta de origem indisponível';
  end if;
  return new;
end;
$$;

drop trigger if exists set_workspace_request_contact on public.workspace_requests;
create trigger set_workspace_request_contact before insert on public.workspace_requests
  for each row execute function private.set_workspace_request_contact();
revoke all on function private.set_workspace_request_contact() from public, anon, authenticated;
