create table if not exists public.marketing_client_email_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null,
  identity_key text not null,
  recipient_email text not null,
  requested_by_membership_id uuid references public.memberships(id) on delete set null,
  provider_message_id text,
  status text not null check (status in ('sending','sent','failed','unknown')),
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (campaign_id, identity_key)
);
create index if not exists marketing_client_email_deliveries_created_idx
  on public.marketing_client_email_deliveries (created_at desc);
create index if not exists marketing_client_email_deliveries_identity_idx
  on public.marketing_client_email_deliveries (identity_key, created_at desc);
alter table public.marketing_client_email_deliveries enable row level security;
revoke all on public.marketing_client_email_deliveries from public, anon, authenticated;
grant all on public.marketing_client_email_deliveries to service_role;