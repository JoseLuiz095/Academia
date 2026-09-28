-- Evolução simples de assinatura e personalização da vitrine por workspace.
-- A cobrança continua manual no MVP; estas colunas centralizam o estado exibido no painel.
alter table public.workspaces
  add column if not exists plan_code text not null default 'starter',
  add column if not exists subscription_status text not null default 'trial',
  add column if not exists subscription_started_at timestamptz not null default now(),
  add column if not exists subscription_ends_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists store_settings jsonb not null default '{"theme":"sage","tagline":null,"cta_label":"Conhecer produtos","show_whatsapp":true,"show_pix":true,"show_service_area":true,"show_ai_badge":true}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspaces_plan_code_check') then
    alter table public.workspaces add constraint workspaces_plan_code_check
      check (plan_code in ('starter', 'creator', 'pro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workspaces_subscription_status_check') then
    alter table public.workspaces add constraint workspaces_subscription_status_check
      check (subscription_status in ('trial', 'active', 'past_due', 'cancelled'));
  end if;
end $$;

create index if not exists workspaces_subscription_ends_idx
  on public.workspaces (subscription_ends_at);

grant select (id, name, slug, niche, description, whatsapp_number, pix_key, pix_receiver, pix_city, service_cities, published, store_settings)
  on public.workspaces to anon;
