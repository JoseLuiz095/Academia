-- Evita colisão entre o parâmetro reviewer_note e a coluna de mesmo nome.
-- A assinatura é preservada para não quebrar os wrappers públicos existentes.

create or replace function private.review_workspace_request(
  target_request_id uuid, decision text, reviewer_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  request_row public.workspace_requests%rowtype;
  new_workspace_id uuid;
  current_user_id uuid := (select auth.uid());
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
    raise exception 'Esta solicitação já foi revisada';
  end if;
  if decision = 'approve' then
    if exists (select 1 from public.workspaces where owner_id = request_row.owner_id)
       or exists (select 1 from public.workspaces where slug = request_row.slug) then
      raise exception 'O proprietário ou endereço já possui um espaço';
    end if;
    insert into public.workspaces (
      owner_id, name, slug, niche, plan_code, subscription_status,
      subscription_started_at, subscription_ends_at, store_settings
    )
    values (
      request_row.owner_id, request_row.name, request_row.slug, request_row.niche,
      request_row.plan_code, 'trial', now(), now() + interval '14 days',
      '{"theme":"sage","tagline":null,"cta_label":"Conhecer produtos","show_whatsapp":true,"show_pix":true,"show_service_area":true,"show_ai_badge":true}'::jsonb
    )
    returning id into new_workspace_id;
    insert into public.workspace_members (workspace_id, user_id, role)
    values (new_workspace_id, request_row.owner_id, 'owner');
    update public.workspace_requests
    set status = 'approved', reviewer_note = nullif(trim($3), ''), reviewed_by = current_user_id, reviewed_at = now(), updated_at = now()
    where id = target_request_id;
  elsif decision = 'reject' then
    update public.workspace_requests
    set status = 'rejected', reviewer_note = nullif(trim($3), ''), reviewed_by = current_user_id, reviewed_at = now(), updated_at = now()
    where id = target_request_id;
  else
    raise exception 'Decisão inválida';
  end if;
  return target_request_id;
end;
$$;

create or replace function private.review_subscription_payment(
  target_payment_id uuid, decision text, reviewer_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  payment_row public.subscription_payments%rowtype;
  workspace_row public.workspaces%rowtype;
  next_end timestamptz;
begin
  if current_user_id is null or not (select private.is_platform_admin()) then
    raise exception 'Apenas o Admin Master pode revisar pagamentos';
  end if;
  select * into payment_row from public.subscription_payments where id = target_payment_id for update;
  if not found then raise exception 'Cobrança não encontrada'; end if;
  if payment_row.status not in ('pending', 'proof_sent') then raise exception 'Cobrança já revisada'; end if;
  if decision = 'approve' then
    if payment_row.status <> 'proof_sent' then raise exception 'Aguarde o lojista informar o comprovante'; end if;
    select * into workspace_row from public.workspaces where id = payment_row.workspace_id for update;
    if not found then raise exception 'Espaço não encontrado'; end if;
    next_end := greatest(workspace_row.subscription_ends_at, now()) + interval '30 days';
    update public.workspaces set
      plan_code = payment_row.plan_code, subscription_status = 'active',
      subscription_started_at = now(), subscription_ends_at = next_end
    where id = payment_row.workspace_id;
    update public.subscription_payments set status = 'paid', reviewed_at = now(),
      reviewed_by = current_user_id, reviewer_note = nullif(trim($3), '')
    where id = target_payment_id;
    insert into public.subscription_events(workspace_id, actor_id, payment_id, action, detail)
    values(payment_row.workspace_id, current_user_id, target_payment_id, 'payment_confirmed',
      'Plano ' || payment_row.plan_code || ' renovado até ' || next_end::text);
  elsif decision = 'reject' then
    if length(trim(coalesce($3, ''))) < 5 then raise exception 'Informe o motivo da recusa'; end if;
    update public.subscription_payments set status = 'rejected', reviewed_at = now(),
      reviewed_by = current_user_id, reviewer_note = trim($3)
    where id = target_payment_id;
    insert into public.subscription_events(workspace_id, actor_id, payment_id, action, detail)
    values(payment_row.workspace_id, current_user_id, target_payment_id, 'payment_rejected', trim($3));
  else
    raise exception 'Decisão inválida';
  end if;
  return target_payment_id;
end;
$$;
