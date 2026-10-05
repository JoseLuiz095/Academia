alter table public.workspaces
  add column if not exists training_document_type text,
  add column if not exists training_document_number text,
  add column if not exists nutrition_document_type text,
  add column if not exists nutrition_document_number text;

alter table public.workspaces
  drop constraint if exists workspaces_training_document_type_check,
  add constraint workspaces_training_document_type_check check (training_document_type is null or training_document_type in ('CREF', 'Registro profissional', 'Outro')),
  drop constraint if exists workspaces_nutrition_document_type_check,
  add constraint workspaces_nutrition_document_type_check check (nutrition_document_type is null or nutrition_document_type in ('CRN', 'Registro profissional', 'Outro'));

create or replace function private.validate_product_professional_credential()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  workspace_row public.workspaces%rowtype;
begin
  if new.published and new.kind = 'digital' and new.category in ('workout', 'diet') then
    select * into workspace_row from public.workspaces where id = new.workspace_id;
    if new.category = 'workout' and (nullif(trim(workspace_row.training_document_type), '') is null or nullif(trim(workspace_row.training_document_number), '') is null) then
      raise exception 'Cadastre o CREF ou registro profissional antes de publicar uma ficha de treino';
    end if;
    if new.category = 'diet' and (nullif(trim(workspace_row.nutrition_document_type), '') is null or nullif(trim(workspace_row.nutrition_document_number), '') is null) then
      raise exception 'Cadastre o CRN ou registro nutricional antes de publicar uma dieta';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_product_professional_credential on public.products;
create trigger validate_product_professional_credential
before insert or update of published, category, kind, workspace_id on public.products
for each row execute function private.validate_product_professional_credential();

create table if not exists public.public_store_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  reporter_name text not null,
  reporter_email text not null,
  reason text not null,
  details text,
  status text not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewer_note text,
  created_at timestamptz not null default now(),
  constraint public_store_reports_status_check check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  constraint public_store_reports_name_check check (length(trim(reporter_name)) between 2 and 100),
  constraint public_store_reports_email_check check (reporter_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint public_store_reports_reason_check check (length(trim(reason)) between 3 and 140),
  constraint public_store_reports_details_check check (details is null or length(details) <= 2000)
);

alter table public.public_store_reports enable row level security;
create policy public_store_reports_master_select on public.public_store_reports
  for select to authenticated using (private.is_platform_admin());
create policy public_store_reports_master_update on public.public_store_reports
  for update to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());
grant select, update on public.public_store_reports to authenticated;

create index if not exists public_store_reports_status_created_idx on public.public_store_reports (status, created_at desc);
create index if not exists public_store_reports_workspace_idx on public.public_store_reports (workspace_id, created_at desc);

create or replace function private.review_public_store_report(target_report_id uuid, decision text, note text default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not private.is_platform_admin() then raise exception 'Acesso restrito ao Admin Master'; end if;
  if decision not in ('reviewing', 'resolved', 'dismissed') then raise exception 'Status de denúncia inválido'; end if;
  update public.public_store_reports
  set status = decision, reviewer_note = nullif(trim(note), ''), reviewed_at = now(), reviewed_by = current_user_id
  where id = target_report_id;
  if not found then raise exception 'Denúncia não encontrada'; end if;
  return target_report_id;
end;
$$;

revoke all on function private.review_public_store_report(uuid, text, text) from public;
grant execute on function private.review_public_store_report(uuid, text, text) to authenticated;

create or replace function public.review_public_store_report(target_report_id uuid, decision text, note text default null)
returns uuid
language sql
security invoker
set search_path to ''
as $$
  select private.review_public_store_report(target_report_id, decision, note);
$$;

revoke all on function public.review_public_store_report(uuid, text, text) from public;
grant execute on function public.review_public_store_report(uuid, text, text) to authenticated;

drop trigger if exists public_store_reports_audit_trigger on public.public_store_reports;
create trigger public_store_reports_audit_trigger
after insert or update or delete on public.public_store_reports
for each row execute function private.record_platform_audit_event();
