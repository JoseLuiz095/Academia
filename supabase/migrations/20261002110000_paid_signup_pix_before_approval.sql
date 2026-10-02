-- Plano pago: o espaço só entra na fila do Admin Master após a declaração
-- explícita de envio do comprovante pelo canal financeiro.

alter table public.workspace_requests
  add column if not exists payment_status text not null default 'not_required',
  add column if not exists payment_amount_cents integer,
  add column if not exists payment_reference text,
  add column if not exists payment_pix_static_code text,
  add column if not exists payment_pix_key text,
  add column if not exists payment_pix_receiver text,
  add column if not exists payment_pix_city text,
  add column if not exists payment_whatsapp text,
  add column if not exists payment_proof_declared_at timestamptz;

alter table public.workspace_requests
  drop constraint if exists workspace_requests_status_check,
  drop constraint if exists workspace_requests_payment_status_check,
  drop constraint if exists workspace_requests_payment_amount_cents_check;

alter table public.workspace_requests
  add constraint workspace_requests_status_check
    check (status in ('payment_pending', 'pending', 'approved', 'rejected')),
  add constraint workspace_requests_payment_status_check
    check (payment_status in ('not_required', 'awaiting_payment', 'proof_sent', 'confirmed', 'rejected')),
  add constraint workspace_requests_payment_amount_cents_check
    check (payment_amount_cents is null or payment_amount_cents > 0);

-- Converte solicitações pagas antigas, caso existam, para o novo passo de Pix.
update public.workspace_requests
set
  status = case when status = 'pending' then 'payment_pending' else status end,
  payment_status = case
    when status = 'approved' then 'confirmed'
    when status = 'rejected' then 'rejected'
    else 'awaiting_payment'
  end
where plan_code <> 'demo' and payment_status = 'not_required';

drop index if exists public.workspace_requests_one_pending_owner_idx;
drop index if exists public.workspace_requests_pending_slug_idx;
create unique index if not exists workspace_requests_one_open_owner_idx
  on public.workspace_requests (owner_id)
  where status in ('payment_pending', 'pending');
create unique index if not exists workspace_requests_open_slug_idx
  on public.workspace_requests (slug)
  where status in ('payment_pending', 'pending');
create unique index if not exists workspace_requests_payment_reference_idx
  on public.workspace_requests (payment_reference)
  where payment_reference is not null;

create or replace function private.prepare_paid_workspace_request(
  p_workspace_name text,
  p_workspace_slug text,
  p_workspace_niche text,
  p_workspace_plan text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_id uuid := gen_random_uuid();
  amount_cents integer;
  billing_row public.platform_billing_settings%rowtype;
begin
  if current_user_id is null then
    raise exception 'Autenticação necessária';
  end if;
  if p_workspace_name is null or p_workspace_slug is null or p_workspace_niche is null or p_workspace_plan is null
    or length(trim(p_workspace_name)) not between 3 and 80
    or length(p_workspace_slug) not between 3 and 80
    or p_workspace_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or p_workspace_niche not in ('fitness', 'wellness', 'creator')
    or p_workspace_plan not in ('starter', 'creator', 'pro') then
    raise exception 'Dados do cadastro ou plano inválidos';
  end if;
  if exists (select 1 from public.workspaces where owner_id = current_user_id)
    or exists (
      select 1 from public.workspace_requests
      where owner_id = current_user_id and status in ('payment_pending', 'pending')
    ) then
    raise exception 'Você já possui um espaço ou um cadastro em andamento';
  end if;
  if exists (select 1 from public.workspaces where slug = p_workspace_slug)
    or exists (
      select 1 from public.workspace_requests
      where slug = p_workspace_slug and status in ('payment_pending', 'pending')
    ) then
    raise exception 'Este endereço já está em uso';
  end if;
  select monthly_price_cents into amount_cents
  from public.platform_plans
  where code = p_workspace_plan and enabled and monthly_price_cents > 0;
  if amount_cents is null then
    raise exception 'Este plano não está disponível para contratação';
  end if;
  select * into billing_row
  from public.platform_billing_settings
  where id = true;
  if not found or (
    nullif(trim(billing_row.pix_static_code), '') is null and (
      nullif(trim(billing_row.pix_key), '') is null
      or nullif(trim(billing_row.pix_receiver), '') is null
      or nullif(trim(billing_row.pix_city), '') is null
    )
  ) or nullif(regexp_replace(coalesce(billing_row.whatsapp, ''), '\D', '', 'g'), '') is null then
    raise exception 'O Pix ou WhatsApp financeiro da plataforma ainda não foi configurado';
  end if;

  insert into public.workspace_requests (
    id, owner_id, name, slug, niche, plan_code, status, payment_status,
    payment_amount_cents, payment_reference, payment_pix_static_code,
    payment_pix_key, payment_pix_receiver, payment_pix_city, payment_whatsapp
  ) values (
    request_id, current_user_id, trim(p_workspace_name), p_workspace_slug,
    p_workspace_niche, p_workspace_plan, 'payment_pending', 'awaiting_payment',
    amount_cents, 'IMP-ENT-' || upper(substr(replace(request_id::text, '-', ''), 1, 10)),
    nullif(trim(billing_row.pix_static_code), ''), nullif(trim(billing_row.pix_key), ''),
    nullif(trim(billing_row.pix_receiver), ''), nullif(trim(billing_row.pix_city), ''),
    regexp_replace(billing_row.whatsapp, '\D', '', 'g')
  );
  return request_id;
end;
$$;

create or replace function public.prepare_paid_workspace_request(
  p_workspace_name text,
  p_workspace_slug text,
  p_workspace_niche text,
  p_workspace_plan text
) returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.prepare_paid_workspace_request(
    p_workspace_name, p_workspace_slug, p_workspace_niche, p_workspace_plan
  );
$$;

revoke all on function private.prepare_paid_workspace_request(text, text, text, text)
  from public, anon, authenticated;
grant execute on function private.prepare_paid_workspace_request(text, text, text, text)
  to authenticated;
revoke all on function public.prepare_paid_workspace_request(text, text, text, text)
  from public, anon;
grant execute on function public.prepare_paid_workspace_request(text, text, text, text)
  to authenticated;

create or replace function private.confirm_paid_workspace_request_proof(
  p_request_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Autenticação necessária';
  end if;
  update public.workspace_requests
  set
    status = 'pending',
    payment_status = 'proof_sent',
    payment_proof_declared_at = now(),
    updated_at = now()
  where id = p_request_id
    and owner_id = current_user_id
    and status = 'payment_pending'
    and payment_status = 'awaiting_payment'
    and plan_code <> 'demo';
  if not found then
    raise exception 'Cadastro indisponível ou comprovante já informado';
  end if;
  return p_request_id;
end;
$$;

create or replace function public.confirm_paid_workspace_request_proof(
  p_request_id uuid
) returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.confirm_paid_workspace_request_proof(p_request_id);
$$;

revoke all on function private.confirm_paid_workspace_request_proof(uuid)
  from public, anon, authenticated;
grant execute on function private.confirm_paid_workspace_request_proof(uuid)
  to authenticated;
revoke all on function public.confirm_paid_workspace_request_proof(uuid)
  from public, anon;
grant execute on function public.confirm_paid_workspace_request_proof(uuid)
  to authenticated;

create or replace function private.review_workspace_request(
  target_request_id uuid,
  decision text,
  reviewer_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.workspace_requests%rowtype;
  new_workspace_id uuid;
  current_user_id uuid := (select auth.uid());
  is_demo boolean;
begin
  if current_user_id is null or not (select private.is_platform_admin()) then
    raise exception 'Apenas o Admin Master pode revisar solicitações';
  end if;
  select * into request_row
  from public.workspace_requests
  where id = target_request_id
  for update;
  if not found then
    raise exception 'Solicitação não encontrada';
  end if;
  if request_row.status <> 'pending' then
    raise exception 'Esta solicitação ainda não está pronta para análise';
  end if;
  is_demo := request_row.plan_code = 'demo';
  if decision = 'approve' then
    if not is_demo and request_row.payment_status <> 'proof_sent' then
      raise exception 'Aguarde o criador declarar o envio do comprovante';
    end if;
    if exists (select 1 from public.workspaces where owner_id = request_row.owner_id)
      or exists (select 1 from public.workspaces where slug = request_row.slug) then
      raise exception 'O proprietário ou endereço já possui um espaço';
    end if;
    insert into public.workspaces (
      owner_id, name, slug, niche, plan_code, subscription_status,
      subscription_started_at, subscription_ends_at, store_settings
    ) values (
      request_row.owner_id, request_row.name, request_row.slug, request_row.niche,
      request_row.plan_code,
      case when is_demo then 'trial' else 'active' end,
      now(),
      case when is_demo then now() + interval '14 days' else now() + interval '30 days' end,
      '{"theme":"sage","tagline":null,"cta_label":"Conhecer produtos","show_whatsapp":true,"show_pix":true,"show_service_area":true,"show_ai_badge":true}'::jsonb
    )
    returning id into new_workspace_id;
    insert into public.workspace_members (workspace_id, user_id, role)
    values (new_workspace_id, request_row.owner_id, 'owner');
    update public.workspace_requests
    set
      status = 'approved',
      payment_status = case when is_demo then 'not_required' else 'confirmed' end,
      reviewer_note = nullif(trim($3), ''),
      reviewed_by = current_user_id,
      reviewed_at = now(),
      updated_at = now()
    where id = target_request_id;
  elsif decision = 'reject' then
    if length(trim(coalesce($3, ''))) < 5 then
      raise exception 'Informe o motivo da recusa';
    end if;
    update public.workspace_requests
    set
      status = 'rejected',
      payment_status = case when is_demo then 'not_required' else 'rejected' end,
      reviewer_note = trim($3),
      reviewed_by = current_user_id,
      reviewed_at = now(),
      updated_at = now()
    where id = target_request_id;
  else
    raise exception 'Decisão inválida';
  end if;
  return target_request_id;
end;
$$;
