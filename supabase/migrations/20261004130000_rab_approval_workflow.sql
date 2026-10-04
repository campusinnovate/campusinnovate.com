create table if not exists public.rab_approval_requests (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.rab_generations(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  requester_name text not null,
  project_name text not null,
  client_name text not null,
  service_family text not null,
  pricing_mode text not null,
  source_file_id text not null,
  source_hash text not null,
  snapshot jsonb not null,
  status text not null default 'pending_coo'
    check (status in ('pending_coo','pending_ceo','revision_requested','rejected','approved')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rab_approval_requests_status_submitted_idx
  on public.rab_approval_requests(status,submitted_at desc);
create index if not exists rab_approval_requests_requester_idx
  on public.rab_approval_requests(requester_user_id,submitted_at desc);
create index if not exists rab_approval_requests_generation_hash_idx
  on public.rab_approval_requests(generation_id,source_hash,submitted_at desc);

create table if not exists public.rab_approval_actions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.rab_approval_requests(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_membership_id uuid not null references public.memberships(id) on delete restrict,
  actor_name text not null,
  actor_position_key text not null check (actor_position_key in ('coo','ceo')),
  decision text not null check (decision in ('approved','revision_requested','rejected')),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists rab_approval_actions_request_idx
  on public.rab_approval_actions(request_id,created_at);

alter table public.rab_approval_requests enable row level security;
alter table public.rab_approval_actions enable row level security;
revoke all on public.rab_approval_requests,public.rab_approval_actions from anon,authenticated,public;
