-- Fluxo de lojistas: aprovação obrigatória, mensalidade Pix manual e lembretes.
drop policy if exists workspaces_insert_owner on public.workspaces;
revoke insert on public.workspaces from authenticated;

drop policy if exists workspaces_select_authenticated on public.workspaces;
create policy workspaces_select_authenticated on public.workspaces
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or private.is_workspace_member(id)
    or (select private.is_platform_admin())
    or (published and approval_status = 'approved'
      and subscription_status in ('trial', 'active') and subscription_ends_at > now())
  );

drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated on public.products
  for select to authenticated
  using (
    private.is_workspace_member(workspace_id)
    or (published and exists (
      select 1 from public.workspaces w where w.id = products.workspace_id
        and w.published and w.approval_status = 'approved'
        and w.subscription_status in ('trial', 'active') and w.subscription_ends_at > now()
    ))
  );

create table if not exists public.platform_billing_settings (
  id boolean primary key default true check (id),
  pix_key text,
  pix_receiver text,
  pix_city text,
  pix_static_code text,
  whatsapp text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.platform_billing_settings(id) values (true) on conflict (id) do nothing;
alter table public.platform_billing_settings enable row level security;
grant select, update on public.platform_billing_settings to authenticated;
create policy platform_billing_settings_read on public.platform_billing_settings
  for select to authenticated using (
    (select private.is_platform_admin()) or exists (
      select 1 from public.workspaces w where w.owner_id = (select auth.uid())
    )
  );
create policy platform_billing_settings_master_update on public.platform_billing_settings
  for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  plan_code text not null check (plan_code in ('starter', 'creator', 'pro')),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'proof_sent', 'paid', 'rejected')),
  pix_code text,
  pix_key text,
  pix_receiver text,
  pix_city text,
  reference text not null unique,
  proof_sent_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text,
  created_at timestamptz not null default now()
);
create unique index if not exists subscription_payments_one_open_per_workspace_idx
  on public.subscription_payments(workspace_id) where status in ('pending', 'proof_sent');
create index if not exists subscription_payments_requested_by_idx on public.subscription_payments(requested_by);
create index if not exists subscription_payments_reviewed_by_idx on public.subscription_payments(reviewed_by);
create index if not exists subscription_payments_created_at_idx on public.subscription_payments(created_at desc);
alter table public.subscription_payments enable row level security;
grant select on public.subscription_payments to authenticated;
create policy subscription_payments_read on public.subscription_payments
  for select to authenticated
  using ((select private.is_platform_admin()) or exists (
    select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())
  ));

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  payment_id uuid references public.subscription_payments(id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists subscription_events_workspace_created_idx
  on public.subscription_events(workspace_id, created_at desc);
create index if not exists subscription_events_actor_id_idx on public.subscription_events(actor_id);
create index if not exists subscription_events_payment_id_idx on public.subscription_events(payment_id);
alter table public.subscription_events enable row level security;
grant select on public.subscription_events to authenticated;
create policy subscription_events_read on public.subscription_events
  for select to authenticated
  using ((select private.is_platform_admin()) or exists (
    select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())
  ));

create table if not exists public.content_reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(trim(title)) between 3 and 180),
  body text not null check (length(trim(body)) between 3 and 4000),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  channel text not null default 'internal' check (channel in ('internal', 'whatsapp')),
  created_at timestamptz not null default now()
);
create index if not exists content_reminders_workspace_schedule_idx
  on public.content_reminders(workspace_id, scheduled_for) where status = 'pending';
alter table public.content_reminders enable row level security;
grant select, insert, update, delete on public.content_reminders to authenticated;
create policy content_reminders_read on public.content_reminders
  for select to authenticated using (private.is_workspace_member(workspace_id));
create policy content_reminders_insert on public.content_reminders
  for insert to authenticated with check (private.is_workspace_member(workspace_id));
create policy content_reminders_update on public.content_reminders
  for update to authenticated using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));
create policy content_reminders_delete on public.content_reminders
  for delete to authenticated using (private.is_workspace_member(workspace_id));

create or replace function private.request_subscription_payment(
  target_workspace_id uuid, target_plan_code text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  workspace_row public.workspaces%rowtype;
  billing_row public.platform_billing_settings%rowtype;
  new_payment_id uuid := gen_random_uuid();
  price_cents integer;
begin
  if current_user_id is null then raise exception 'Autenticação necessária'; end if;
  select * into workspace_row from public.workspaces where id = target_workspace_id for update;
  if not found or workspace_row.owner_id <> current_user_id then
    raise exception 'Apenas o proprietário pode solicitar a mensalidade';
  end if;
  if workspace_row.approval_status <> 'approved' then raise exception 'Espaço não aprovado'; end if;
  price_cents := case target_plan_code when 'starter' then 2900 when 'creator' then 5900 when 'pro' then 9900 else null end;
  if price_cents is null then raise exception 'Plano inválido'; end if;
  if exists (select 1 from public.subscription_payments
    where workspace_id = target_workspace_id and status in ('pending', 'proof_sent')) then
    raise exception 'Já existe uma cobrança em aberto para este espaço';
  end if;
  select * into billing_row from public.platform_billing_settings where id = true;
  if not found or (nullif(trim(billing_row.pix_static_code), '') is null and
      (nullif(trim(billing_row.pix_key), '') is null or
       nullif(trim(billing_row.pix_receiver), '') is null or
       nullif(trim(billing_row.pix_city), '') is null)) then
    raise exception 'O Pix da plataforma ainda não foi configurado';
  end if;
  insert into public.subscription_payments(
    id, workspace_id, requested_by, plan_code, amount_cents,
    pix_code, pix_key, pix_receiver, pix_city, reference
  ) values (
    new_payment_id, target_workspace_id, current_user_id, target_plan_code, price_cents,
    nullif(trim(billing_row.pix_static_code), ''), nullif(trim(billing_row.pix_key), ''),
    nullif(trim(billing_row.pix_receiver), ''), nullif(trim(billing_row.pix_city), ''),
    'IMP-' || upper(substr(replace(new_payment_id::text, '-', ''), 1, 10))
  );
  return new_payment_id;
end;
$$;

create or replace function private.mark_subscription_proof_sent(target_payment_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Autenticação necessária'; end if;
  update public.subscription_payments p set status = 'proof_sent', proof_sent_at = now()
  where p.id = target_payment_id and p.status = 'pending' and exists (
    select 1 from public.workspaces w where w.id = p.workspace_id and w.owner_id = current_user_id
  );
  if not found then raise exception 'Cobrança indisponível ou já informada'; end if;
  return target_payment_id;
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
      reviewed_by = current_user_id, reviewer_note = nullif(trim(reviewer_note), '')
    where id = target_payment_id;
    insert into public.subscription_events(workspace_id, actor_id, payment_id, action, detail)
    values(payment_row.workspace_id, current_user_id, target_payment_id, 'payment_confirmed',
      'Plano ' || payment_row.plan_code || ' renovado até ' || next_end::text);
  elsif decision = 'reject' then
    if length(trim(coalesce(reviewer_note, ''))) < 5 then raise exception 'Informe o motivo da recusa'; end if;
    update public.subscription_payments set status = 'rejected', reviewed_at = now(),
      reviewed_by = current_user_id, reviewer_note = trim(reviewer_note)
    where id = target_payment_id;
    insert into public.subscription_events(workspace_id, actor_id, payment_id, action, detail)
    values(payment_row.workspace_id, current_user_id, target_payment_id, 'payment_rejected', trim(reviewer_note));
  else
    raise exception 'Decisão inválida';
  end if;
  return target_payment_id;
end;
$$;

create or replace function private.manage_workspace_subscription(
  target_workspace_id uuid, action text, plan text default null,
  period_days integer default null, note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  workspace_row public.workspaces%rowtype;
begin
  if current_user_id is null or not (select private.is_platform_admin()) then
    raise exception 'Apenas o Admin Master pode alterar a assinatura';
  end if;
  select * into workspace_row from public.workspaces where id = target_workspace_id for update;
  if not found then raise exception 'Espaço não encontrado'; end if;
  if action = 'suspend' then
    update public.workspaces set approval_status = 'suspended', published = false
    where id = target_workspace_id;
  elsif action = 'restore' then
    update public.workspaces set approval_status = 'approved'
    where id = target_workspace_id;
  elsif action = 'extend' then
    if period_days is null or period_days not between 1 and 365 then raise exception 'Informe de 1 a 365 dias'; end if;
    update public.workspaces set subscription_status = 'active',
      subscription_ends_at = greatest(subscription_ends_at, now()) + make_interval(days => period_days)
    where id = target_workspace_id;
  elsif action = 'change_plan' then
    if plan not in ('starter', 'creator', 'pro') then raise exception 'Plano inválido'; end if;
    update public.workspaces set plan_code = plan where id = target_workspace_id;
  else
    raise exception 'Ação inválida';
  end if;
  insert into public.subscription_events(workspace_id, actor_id, action, detail)
  values(target_workspace_id, current_user_id, action,
    nullif(trim(coalesce(note, '') || ' plano=' || coalesce(plan, '') || ' dias=' || coalesce(period_days::text, '')), ''));
  return target_workspace_id;
end;
$$;

revoke all on function private.request_subscription_payment(uuid, text) from public, anon, authenticated;
revoke all on function private.mark_subscription_proof_sent(uuid) from public, anon, authenticated;
revoke all on function private.review_subscription_payment(uuid, text, text) from public, anon, authenticated;
revoke all on function private.manage_workspace_subscription(uuid, text, text, integer, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.request_subscription_payment(uuid, text) to authenticated;
grant execute on function private.mark_subscription_proof_sent(uuid) to authenticated;
grant execute on function private.review_subscription_payment(uuid, text, text) to authenticated;
grant execute on function private.manage_workspace_subscription(uuid, text, text, integer, text) to authenticated;

create or replace function public.request_subscription_payment(target_workspace_id uuid, target_plan_code text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.request_subscription_payment(target_workspace_id, target_plan_code);
$$;
create or replace function public.mark_subscription_proof_sent(target_payment_id uuid)
returns uuid language sql security invoker set search_path = '' as $$
  select private.mark_subscription_proof_sent(target_payment_id);
$$;
create or replace function public.review_subscription_payment(
  target_payment_id uuid, decision text, reviewer_note text default null
) returns uuid language sql security invoker set search_path = '' as $$
  select private.review_subscription_payment(target_payment_id, decision, reviewer_note);
$$;
create or replace function public.manage_workspace_subscription(
  target_workspace_id uuid, action text, plan text default null,
  period_days integer default null, note text default null
) returns uuid language sql security invoker set search_path = '' as $$
  select private.manage_workspace_subscription(target_workspace_id, action, plan, period_days, note);
$$;
revoke all on function public.request_subscription_payment(uuid, text) from public, anon;
revoke all on function public.mark_subscription_proof_sent(uuid) from public, anon;
revoke all on function public.review_subscription_payment(uuid, text, text) from public, anon;
revoke all on function public.manage_workspace_subscription(uuid, text, text, integer, text) from public, anon;
grant execute on function public.request_subscription_payment(uuid, text) to authenticated;
grant execute on function public.mark_subscription_proof_sent(uuid) to authenticated;
grant execute on function public.review_subscription_payment(uuid, text, text) to authenticated;
grant execute on function public.manage_workspace_subscription(uuid, text, text, integer, text) to authenticated;
