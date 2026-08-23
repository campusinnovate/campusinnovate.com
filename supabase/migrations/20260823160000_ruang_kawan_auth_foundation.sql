create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.departments (
  id uuid primary key default extensions.gen_random_uuid(),
  key text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.positions (
  id uuid primary key default extensions.gen_random_uuid(),
  key text not null unique,
  name text not null,
  default_department_id uuid references public.departments(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email extensions.citext not null unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  email extensions.citext not null unique,
  user_id uuid unique references auth.users(id) on delete set null,
  full_name text,
  position_id uuid references public.positions(id),
  department_id uuid references public.departments(id),
  engagement_type text not null check (engagement_type in ('employee', 'freelance', 'contractor', 'intern')),
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended', 'inactive')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default extensions.gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default extensions.gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.member_roles (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (membership_id, role_id)
);

create table public.member_permission_overrides (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  effect text not null check (effect in ('allow', 'deny')),
  granted_by uuid references auth.users(id),
  reason text,
  granted_at timestamptz not null default now(),
  primary key (membership_id, permission_id)
);

create table public.member_scopes (
  id uuid primary key default extensions.gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  scope_type text not null check (scope_type in ('organization', 'department', 'assigned_projects', 'self_only')),
  scope_id uuid,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  unique (membership_id, scope_type, scope_id)
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index memberships_user_id_idx on public.memberships(user_id);
create index member_roles_membership_id_idx on public.member_roles(membership_id);
create index role_permissions_role_id_idx on public.role_permissions(role_id);
create index member_permission_overrides_membership_id_idx on public.member_permission_overrides(membership_id);
create index activity_logs_actor_user_id_idx on public.activity_logs(actor_user_id);
create index activity_logs_created_at_idx on public.activity_logs(created_at desc);

insert into public.departments (key, name) values
  ('executive', 'Executive'), ('operations', 'Operations'), ('technology', 'Technology'),
  ('marketing', 'Marketing'), ('business_development', 'Business Development'),
  ('finance', 'Finance'), ('people_hr', 'People & HR'), ('project_event', 'Project & Event')
on conflict (key) do update set name = excluded.name;

insert into public.positions (key, name, default_department_id)
select v.key, v.name, d.id
from (values
  ('ceo', 'CEO', 'executive'), ('coo', 'COO', 'executive'), ('cto', 'CTO', 'executive'),
  ('social_media_staff', 'Staff Social Media', 'marketing'),
  ('growth_marketing_staff', 'Staff Growth Marketing', 'marketing'),
  ('business_development_staff', 'Staff Business Development', 'business_development'),
  ('project_lead', 'Project Lead', 'project_event'),
  ('finance_staff', 'Staff Finance', 'finance'), ('hr_staff', 'Staff HR', 'people_hr')
) as v(key, name, department_key)
join public.departments d on d.key = v.department_key
on conflict (key) do update set name = excluded.name, default_department_id = excluded.default_department_id;

insert into public.roles (key, name, description) values
  ('system_admin', 'System Admin', 'Mengelola konfigurasi teknis dan hak akses.'),
  ('executive', 'Executive', 'Akses kepemimpinan organisasi.'),
  ('finance_manager', 'Finance Manager', 'Mengelola fungsi Finance.'),
  ('people_hr_manager', 'People & HR Manager', 'Mengelola fungsi People & HR.'),
  ('project_lead', 'Project Lead', 'Mengelola project yang ditugaskan.'),
  ('staff', 'Staff', 'Akses kerja reguler.'),
  ('freelancer', 'Freelancer', 'Akses eksternal terbatas.')
on conflict (key) do update set name = excluded.name, description = excluded.description;

insert into public.permissions (key, name) values
  ('access.manage', 'Kelola akses'), ('people.view', 'Lihat data People & HR'),
  ('people.manage', 'Kelola data People & HR'), ('people.compensation_view', 'Lihat kompensasi'),
  ('finance.view', 'Lihat data Finance'), ('finance.manage', 'Kelola data Finance'),
  ('finance.approve', 'Setujui transaksi Finance'), ('performance.view', 'Lihat performance'),
  ('performance.review', 'Review performance'), ('performance.approve', 'Setujui performance'),
  ('projects.view', 'Lihat project'), ('projects.manage', 'Kelola project')
on conflict (key) do update set name = excluded.name;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'system_admin'
   or (r.key = 'executive' and p.key in ('people.view', 'finance.view', 'performance.view', 'performance.review', 'performance.approve', 'projects.view'))
   or (r.key = 'finance_manager' and p.key in ('finance.view', 'finance.manage', 'finance.approve'))
   or (r.key = 'people_hr_manager' and p.key in ('people.view', 'people.manage', 'people.compensation_view', 'performance.view', 'performance.review'))
   or (r.key = 'project_lead' and p.key in ('projects.view', 'projects.manage'))
   or (r.key in ('staff', 'freelancer') and p.key in ('projects.view', 'performance.view'))
on conflict do nothing;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  insert into public.profiles (user_id, email, full_name, avatar_url)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.raw_user_meta_data->>'avatar_url')
  on conflict (user_id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  update public.memberships
  set user_id = new.id,
      status = case when status = 'invited' then 'active' else status end,
      full_name = coalesce(full_name, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
      updated_at = now()
  where lower(email::text) = lower(new.email);
  return new;
end;
$$;

create trigger on_auth_user_created after insert or update of email, raw_user_meta_data on auth.users
for each row execute procedure public.handle_new_auth_user();

create or replace function public.hook_allow_registered_email(event jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare incoming_email text := lower(event->'user'->>'email');
begin
  if exists (select 1 from public.memberships where lower(email::text) = incoming_email and status in ('invited', 'active')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Email belum didaftarkan untuk Ruang Kawan.'));
end;
$$;

grant execute on function public.hook_allow_registered_email(jsonb) to supabase_auth_admin;
grant select on public.memberships to supabase_auth_admin;
revoke execute on function public.hook_allow_registered_email(jsonb) from authenticated, anon, public;

create or replace function public.get_my_access()
returns table (membership_status text, full_name text, position_name text, department_name text, engagement_type text, roles text[], permissions text[])
language sql stable security definer set search_path = public as $$
  with my_membership as (
    select m.* from public.memberships m where m.user_id = auth.uid() limit 1
  ), my_roles as (
    select array_agg(distinct r.key order by r.key) as role_keys
    from public.member_roles mr join public.roles r on r.id = mr.role_id
    join my_membership m on m.id = mr.membership_id
  ), role_permission_keys as (
    select p.key from public.member_roles mr
    join public.role_permissions rp on rp.role_id = mr.role_id
    join public.permissions p on p.id = rp.permission_id
    join my_membership m on m.id = mr.membership_id
  ), allowed_overrides as (
    select p.key from public.member_permission_overrides mpo
    join public.permissions p on p.id = mpo.permission_id
    join my_membership m on m.id = mpo.membership_id where mpo.effect = 'allow'
  ), denied_overrides as (
    select p.key from public.member_permission_overrides mpo
    join public.permissions p on p.id = mpo.permission_id
    join my_membership m on m.id = mpo.membership_id where mpo.effect = 'deny'
  ), effective_permissions as (
    select key from role_permission_keys union select key from allowed_overrides except select key from denied_overrides
  )
  select m.status, coalesce(m.full_name, pr.full_name), pos.name, d.name, m.engagement_type,
    coalesce(mr.role_keys, '{}'::text[]),
    coalesce((select array_agg(key order by key) from effective_permissions), '{}'::text[])
  from my_membership m
  left join public.profiles pr on pr.user_id = m.user_id
  left join public.positions pos on pos.id = m.position_id
  left join public.departments d on d.id = m.department_id
  cross join my_roles mr;
$$;

grant execute on function public.get_my_access() to authenticated;
revoke execute on function public.get_my_access() from anon, public;

alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.member_roles enable row level security;
alter table public.member_permission_overrides enable row level security;
alter table public.member_scopes enable row level security;
alter table public.activity_logs enable row level security;

create policy "Active members can read departments" on public.departments for select to authenticated
using (exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.status = 'active'));
create policy "Active members can read positions" on public.positions for select to authenticated
using (exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.status = 'active'));
create policy "Users can read their own profile" on public.profiles for select to authenticated using (user_id = auth.uid());
create policy "Users can read their own membership" on public.memberships for select to authenticated using (user_id = auth.uid());
revoke all on public.activity_logs from anon, authenticated;
