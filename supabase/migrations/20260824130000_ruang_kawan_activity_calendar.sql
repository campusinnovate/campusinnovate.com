-- Ruang Kawan: configurable work sources, unified activity feed, and secure calendar links.

insert into public.permissions (key, name, description) values
  ('activity.view_self', 'Lihat aktivitas sendiri', 'Melihat feed dan kalender aktivitas sendiri.'),
  ('activity.manage_self', 'Kelola aktivitas sendiri', 'Membuat dan memperbarui aktivitas sendiri.'),
  ('activity.view_team', 'Lihat aktivitas tim', 'Melihat aktivitas anggota lain sesuai kebutuhan manajemen.'),
  ('activity.review_team', 'Review aktivitas tim', 'Memberikan review atas aktivitas anggota tim.'),
  ('work_sources.manage', 'Kelola sumber kerja', 'Membuat dan mengatur sumber kerja tanpa perubahan backend.'),
  ('calendar.connect', 'Hubungkan kalender pribadi', 'Menghubungkan Google Calendar milik pengguna.'),
  ('calendar.manage_company', 'Kelola kalender perusahaan', 'Menghubungkan dan mengatur kalender perusahaan.')
on conflict (key) do update set name = excluded.name, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  r.key = 'system_admin'
  or (r.key = 'executive' and p.key in ('activity.view_self', 'activity.manage_self', 'activity.view_team', 'activity.review_team', 'calendar.connect'))
  or (r.key in ('finance_manager', 'people_hr_manager', 'project_lead', 'staff', 'freelancer') and p.key in ('activity.view_self', 'activity.manage_self', 'calendar.connect'))
on conflict do nothing;

create table public.work_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+$'),
  name text not null,
  description text,
  color text not null default '#315c4f' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default 'activity',
  source_kind text not null default 'custom' check (source_kind in ('manual', 'custom', 'system')),
  field_schema jsonb not null default '[]'::jsonb check (jsonb_typeof(field_schema) = 'array'),
  allowed_role_keys text[] not null default '{}'::text[],
  allowed_position_keys text[] not null default '{}'::text[],
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_membership_id uuid not null references public.memberships(id) on delete cascade,
  source_id uuid not null references public.work_sources(id),
  title text not null check (char_length(trim(title)) between 1 and 180),
  activity_date date not null default current_date,
  start_at timestamptz,
  end_at timestamptz,
  activity_type text,
  linked_kpi text,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'done', 'blocked')),
  progress smallint not null default 0 check (progress between 0 and 100),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  detail text,
  output text,
  blocker_risk text,
  next_action text,
  evidence_url text,
  source_record_id text,
  custom_data jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_data) = 'object'),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or start_at is null or end_at > start_at)
);

create table public.google_calendar_connections (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  connection_type text not null check (connection_type in ('personal', 'company')),
  google_account_email extensions.citext,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  granted_scopes text[] not null default '{}'::text[],
  selected_calendar_ids text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, connection_type)
);

create unique index google_calendar_one_company_connection_idx
  on public.google_calendar_connections (connection_type)
  where connection_type = 'company' and is_active;

create table public.google_calendar_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_type text not null check (connection_type in ('personal', 'company')),
  code_verifier text not null,
  return_url text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.activity_calendar_links (
  id uuid primary key default extensions.gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  connection_id uuid not null references public.google_calendar_connections(id) on delete cascade,
  calendar_id text not null,
  google_event_id text not null,
  google_etag text,
  sync_state text not null default 'synced' check (sync_state in ('pending', 'synced', 'error', 'detached')),
  last_error text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, calendar_id, google_event_id),
  unique (activity_id, connection_id, calendar_id)
);

create index activities_owner_date_idx on public.activities(owner_membership_id, activity_date desc);
create index activities_source_date_idx on public.activities(source_id, activity_date desc);
create index activities_status_idx on public.activities(status);
create index activity_calendar_links_activity_idx on public.activity_calendar_links(activity_id);
create index google_calendar_oauth_states_expires_idx on public.google_calendar_oauth_states(expires_at);

insert into public.work_sources (key, name, description, color, icon, source_kind, field_schema, sort_order) values
  ('manual_activity', 'Activity Manual', 'Aktivitas kerja yang dicatat langsung oleh anggota.', '#315c4f', 'activity', 'manual', '[]'::jsonb, 10),
  ('content_plan', 'Content Plan', 'Rencana, produksi, dan publikasi konten.', '#a7673f', 'content', 'system', '[{"key":"channel","label":"Channel","type":"text"},{"key":"content_pillar","label":"Pilar Konten","type":"text"}]'::jsonb, 20),
  ('pipeline_bd', 'Pipeline BD', 'Prospek, tindak lanjut, dan kemajuan business development.', '#3f6591', 'pipeline', 'system', '[{"key":"organization","label":"Organisasi","type":"text"},{"key":"pipeline_stage","label":"Tahap Pipeline","type":"text"},{"key":"deal_value","label":"Nilai Potensi","type":"number"}]'::jsonb, 30),
  ('finance_collection', 'Finance Collection', 'Penagihan, penerimaan, dan tindak lanjut pembayaran.', '#856b30', 'finance', 'system', '[{"key":"counterparty","label":"Pihak Terkait","type":"text"},{"key":"amount","label":"Nilai","type":"number"},{"key":"due_date","label":"Jatuh Tempo","type":"date"}]'::jsonb, 40),
  ('recruitment_hr', 'Recruitment HR', 'Aktivitas rekrutmen dan tindak lanjut kandidat.', '#754d78', 'people', 'system', '[{"key":"candidate","label":"Kandidat","type":"text"},{"key":"recruitment_stage","label":"Tahap Rekrutmen","type":"text"}]'::jsonb, 50)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  icon = excluded.icon,
  source_kind = excluded.source_kind,
  field_schema = excluded.field_schema,
  sort_order = excluded.sort_order;

update public.work_sources set allowed_position_keys = array['social_media_staff', 'growth_marketing_staff', 'ceo', 'coo'] where key = 'content_plan';
update public.work_sources set allowed_position_keys = array['business_development_staff', 'ceo', 'coo'] where key = 'pipeline_bd';
update public.work_sources set allowed_role_keys = array['finance_manager', 'executive', 'system_admin'] where key = 'finance_collection';
update public.work_sources set allowed_role_keys = array['people_hr_manager', 'executive', 'system_admin'] where key = 'recruitment_hr';

create or replace function public.current_membership_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.memberships where user_id = auth.uid() and status = 'active' limit 1;
$$;

create or replace function public.can_access_work_source(target_source_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with me as (
    select m.id, p.key as position_key
    from public.memberships m left join public.positions p on p.id = m.position_id
    where m.user_id = auth.uid() and m.status = 'active'
  ), my_roles as (
    select r.key from public.member_roles mr join public.roles r on r.id = mr.role_id
    join me on me.id = mr.membership_id
  )
  select exists (
    select 1 from public.work_sources ws cross join me
    where ws.id = target_source_id and ws.is_active
      and (
        (cardinality(ws.allowed_role_keys) = 0 and cardinality(ws.allowed_position_keys) = 0)
        or me.position_key = any(ws.allowed_position_keys)
        or exists (select 1 from my_roles where key = any(ws.allowed_role_keys))
        or public.current_user_has_permission('work_sources.manage')
      )
  );
$$;

revoke all on function public.current_membership_id() from public, anon;
grant execute on function public.current_membership_id() to authenticated;
revoke all on function public.can_access_work_source(uuid) from public, anon;
grant execute on function public.can_access_work_source(uuid) to authenticated;

create or replace function public.list_my_work_sources()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ws.id, 'key', ws.key, 'name', ws.name, 'description', ws.description,
    'color', ws.color, 'icon', ws.icon, 'source_kind', ws.source_kind,
    'field_schema', ws.field_schema, 'allowed_role_keys', ws.allowed_role_keys,
    'allowed_position_keys', ws.allowed_position_keys, 'sort_order', ws.sort_order
  ) order by ws.sort_order, ws.name), '[]'::jsonb)
  from public.work_sources ws
  where public.can_access_work_source(ws.id);
$$;

revoke all on function public.list_my_work_sources() from public, anon;
grant execute on function public.list_my_work_sources() to authenticated;

create or replace function public.admin_list_work_sources()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.current_user_has_permission('work_sources.manage') then
    raise exception 'Akses pengelola sumber kerja diperlukan.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(ws) order by ws.sort_order, ws.name) from public.work_sources ws), '[]'::jsonb);
end;
$$;

create or replace function public.admin_save_work_source(
  source_id uuid,
  source_key text,
  source_name text,
  source_description text,
  source_color text,
  source_icon text,
  source_field_schema jsonb,
  source_allowed_role_keys text[],
  source_allowed_position_keys text[],
  source_is_active boolean,
  source_sort_order integer
)
returns uuid language plpgsql security definer set search_path = public as $$
declare saved_id uuid;
begin
  if not public.current_user_has_permission('work_sources.manage') then
    raise exception 'Akses pengelola sumber kerja diperlukan.' using errcode = '42501';
  end if;
  if trim(source_name) = '' then raise exception 'Nama sumber kerja wajib diisi.'; end if;
  if source_key !~ '^[a-z0-9_]+$' then raise exception 'Kode sumber hanya boleh berisi huruf kecil, angka, dan garis bawah.'; end if;
  if jsonb_typeof(coalesce(source_field_schema, '[]'::jsonb)) <> 'array' then raise exception 'Format field tambahan tidak valid.'; end if;
  if source_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Format warna tidak valid.'; end if;

  insert into public.work_sources (id, key, name, description, color, icon, source_kind, field_schema, allowed_role_keys, allowed_position_keys, is_active, sort_order, created_by)
  values (coalesce(source_id, extensions.gen_random_uuid()), source_key, trim(source_name), nullif(trim(source_description), ''), source_color, coalesce(nullif(trim(source_icon), ''), 'activity'), 'custom', coalesce(source_field_schema, '[]'::jsonb), coalesce(source_allowed_role_keys, '{}'::text[]), coalesce(source_allowed_position_keys, '{}'::text[]), source_is_active, source_sort_order, auth.uid())
  on conflict (id) do update set
    name = excluded.name, description = excluded.description, color = excluded.color, icon = excluded.icon,
    field_schema = excluded.field_schema, allowed_role_keys = excluded.allowed_role_keys,
    allowed_position_keys = excluded.allowed_position_keys, is_active = excluded.is_active,
    sort_order = excluded.sort_order, updated_at = now()
  returning id into saved_id;
  return saved_id;
end;
$$;

revoke all on function public.admin_list_work_sources() from public, anon;
grant execute on function public.admin_list_work_sources() to authenticated;
revoke all on function public.admin_save_work_source(uuid, text, text, text, text, text, jsonb, text[], text[], boolean, integer) from public, anon;
grant execute on function public.admin_save_work_source(uuid, text, text, text, text, text, jsonb, text[], text[], boolean, integer) to authenticated;

alter table public.work_sources enable row level security;
alter table public.activities enable row level security;
alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_oauth_states enable row level security;
alter table public.activity_calendar_links enable row level security;

create policy "Members can read available work sources" on public.work_sources for select to authenticated
using (public.can_access_work_source(id));
create policy "Admins can create work sources" on public.work_sources for insert to authenticated
with check (public.current_user_has_permission('work_sources.manage'));
create policy "Admins can update work sources" on public.work_sources for update to authenticated
using (public.current_user_has_permission('work_sources.manage'))
with check (public.current_user_has_permission('work_sources.manage'));

create policy "Members can read permitted activities" on public.activities for select to authenticated
using (
  owner_membership_id = public.current_membership_id()
  or public.current_user_has_permission('activity.view_team')
);
create policy "Members can create own activities" on public.activities for insert to authenticated
with check (
  owner_membership_id = public.current_membership_id()
  and public.current_user_has_permission('activity.manage_self')
  and public.can_access_work_source(source_id)
);
create policy "Members can update own activities" on public.activities for update to authenticated
using (owner_membership_id = public.current_membership_id() and public.current_user_has_permission('activity.manage_self'))
with check (owner_membership_id = public.current_membership_id() and public.can_access_work_source(source_id));
create policy "Members can delete own activities" on public.activities for delete to authenticated
using (owner_membership_id = public.current_membership_id() and public.current_user_has_permission('activity.manage_self'));

-- OAuth tokens and one-time states are intentionally inaccessible from browser roles.
revoke all on public.google_calendar_connections from anon, authenticated;
revoke all on public.google_calendar_oauth_states from anon, authenticated;
revoke all on public.activity_calendar_links from anon, authenticated;

grant select on public.work_sources to authenticated;
grant select, insert, update, delete on public.activities to authenticated;

create or replace function public.get_my_calendar_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'personal', (
      select jsonb_build_object('connected', true, 'email', c.google_account_email, 'selected_calendar_ids', c.selected_calendar_ids, 'updated_at', c.updated_at)
      from public.google_calendar_connections c where c.owner_user_id = auth.uid() and c.connection_type = 'personal' and c.is_active limit 1
    ),
    'company', (
      select jsonb_build_object('connected', true, 'email', c.google_account_email, 'selected_calendar_ids', c.selected_calendar_ids, 'updated_at', c.updated_at)
      from public.google_calendar_connections c where c.connection_type = 'company' and c.is_active limit 1
    )
  );
$$;

revoke all on function public.get_my_calendar_status() from public, anon;
grant execute on function public.get_my_calendar_status() to authenticated;

