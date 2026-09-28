-- Apenas o Admin Master altera aprovação, plano e validade da assinatura.
alter table public.workspaces
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approved_at timestamptz default now(),
  add column if not exists approved_by uuid references auth.users (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspaces_approval_status_check') then
    alter table public.workspaces add constraint workspaces_approval_status_check
      check (approval_status in ('pending', 'approved', 'rejected', 'suspended'));
  end if;
end $$;

create index if not exists workspaces_approval_status_idx on public.workspaces (approval_status);
create index if not exists workspaces_subscription_status_idx on public.workspaces (subscription_status);

create or replace function private.protect_workspace_control_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not (select private.is_platform_admin()) then
    if new.plan_code is distinct from old.plan_code
       or new.subscription_status is distinct from old.subscription_status
       or new.subscription_started_at is distinct from old.subscription_started_at
       or new.subscription_ends_at is distinct from old.subscription_ends_at
       or new.approval_status is distinct from old.approval_status
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by then
      raise exception 'Somente o Admin Master pode alterar a assinatura ou aprovação';
    end if;
  end if;
  if new.published and (new.approval_status <> 'approved' or new.subscription_status not in ('trial', 'active') or new.subscription_ends_at <= now()) then
    raise exception 'Este espaço ainda não está liberado para publicação';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_workspace_control_fields on public.workspaces;
create trigger protect_workspace_control_fields before update on public.workspaces
for each row execute function private.protect_workspace_control_fields();

drop policy if exists workspaces_select_anon on public.workspaces;
create policy workspaces_select_anon on public.workspaces for select to anon
using (published and approval_status = 'approved' and subscription_status in ('trial', 'active') and subscription_ends_at > now());

drop policy if exists products_select_anon on public.products;
create policy products_select_anon on public.products for select to anon
using (published and exists (select 1 from public.workspaces where id = products.workspace_id and published and approval_status = 'approved' and subscription_status in ('trial', 'active') and subscription_ends_at > now()));
