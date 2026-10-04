-- RAB access is restricted to commercial staff. Google tokens and pricing file
-- metadata are handled only by the rab-generator Edge Function's service role.
insert into public.permissions(key,name,description) values
 ('marketing.rab.view','Lihat RAB Generator','Melihat generator dan daftar RAB milik sendiri.'),
 ('marketing.rab.manage','Buat RAB','Menghubungkan Drive dan membuat RAB dari template resmi.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in ('system_admin','executive') and p.key in ('marketing.rab.view','marketing.rab.manage')
on conflict do nothing;

insert into public.position_permissions(position_id,permission_id)
select pos.id,p.id from public.positions pos cross join public.permissions p
where pos.key in ('business_development_staff','ceo','coo')
  and p.key in ('marketing.rab.view','marketing.rab.manage')
on conflict do nothing;

create table if not exists public.rab_google_connections (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 google_subject text not null,
 email text not null,
 encrypted_tokens text not null,
 granted_scopes text[] not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_user_id,google_subject)
);

create table if not exists public.rab_google_oauth_states (
 state_hash text primary key,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 code_verifier text not null,
 expires_at timestamptz not null
);

create table if not exists public.rab_generations (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid references public.rab_google_connections(id) on delete set null,
 project_name text not null,
 client_name text not null,
 pricing_mode text not null,
 template_file_id text not null,
 drive_file_id text unique,
 status text not null default 'pending' check (status in ('pending','ready','failed')),
 error_message text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists rab_generations_owner_created_idx on public.rab_generations(owner_user_id,created_at desc);

alter table public.rab_google_connections enable row level security;
alter table public.rab_google_oauth_states enable row level security;
alter table public.rab_generations enable row level security;
revoke all on public.rab_google_connections,public.rab_google_oauth_states,public.rab_generations from anon,authenticated,public;
