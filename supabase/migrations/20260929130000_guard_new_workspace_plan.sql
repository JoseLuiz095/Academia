-- A aprovação não pode ativar um plano desabilitado mesmo com a tela desatualizada.
create or replace function private.ensure_enabled_plan_for_new_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.platform_plans where code = new.plan_code and enabled) then
    raise exception 'O plano solicitado não está mais disponível';
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_enabled_plan_for_new_workspace on public.workspaces;
create trigger ensure_enabled_plan_for_new_workspace
  before insert on public.workspaces
  for each row execute function private.ensure_enabled_plan_for_new_workspace();
revoke all on function private.ensure_enabled_plan_for_new_workspace() from public, anon, authenticated;
