-- Pagamentos automáticos da loja piloto via Asaas, mantendo o Pix manual como fallback.
alter table public.orders
  add column if not exists payment_provider text not null default 'manual_pix',
  add column if not exists payment_status text not null default 'manual_review',
  add column if not exists provider_payment_id text,
  add column if not exists provider_customer_id text,
  add column if not exists payment_external_reference text,
  add column if not exists pix_copy_paste text,
  add column if not exists pix_qr_code text,
  add column if not exists payment_expires_at timestamptz,
  add column if not exists payment_received_at timestamptz,
  add column if not exists payment_last_event_at timestamptz,
  add column if not exists payment_error text;

alter table public.orders
  drop constraint if exists orders_payment_provider_check,
  add constraint orders_payment_provider_check
    check (payment_provider in ('manual_pix', 'asaas')),
  drop constraint if exists orders_payment_status_check,
  add constraint orders_payment_status_check
    check (payment_status in ('manual_review', 'awaiting_payment', 'confirmed', 'overdue', 'cancelled', 'refunded', 'error'));

update public.orders
set payment_status = case when status = 'confirmed' then 'confirmed' when status = 'cancelled' then 'cancelled' else 'manual_review' end
where payment_status = 'manual_review';

create unique index if not exists orders_provider_payment_id_idx
  on public.orders(provider_payment_id)
  where provider_payment_id is not null;
create index if not exists orders_payment_status_idx
  on public.orders(workspace_id, payment_provider, payment_status, created_at desc);

create table if not exists public.asaas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  asaas_event_id text not null unique,
  event_type text not null,
  provider_payment_id text,
  payload jsonb not null,
  processing_status text not null default 'received',
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  constraint asaas_webhook_events_status_check check (processing_status in ('received', 'processed', 'ignored', 'error'))
);

create index if not exists asaas_webhook_events_payment_idx
  on public.asaas_webhook_events(provider_payment_id, created_at desc);
create index if not exists asaas_webhook_events_created_idx
  on public.asaas_webhook_events(created_at desc);

alter table public.asaas_webhook_events enable row level security;
revoke all on public.asaas_webhook_events from public, anon, authenticated;
grant all on public.asaas_webhook_events to service_role;

-- O JSON de cada produto continua sendo compatível com versões antigas.
-- workout_settings.training_days usa 0=domingo até 6=sábado.
