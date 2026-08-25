-- Ruang Kawan: one private Google Spreadsheet widget per member.

create table if not exists public.personal_spreadsheets (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_membership_id uuid not null unique references public.memberships(id) on delete cascade,
  drive_file_id text not null unique,
  drive_file_url text not null,
  embed_url text not null,
  status text not null default 'ready' check (status in ('ready','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.personal_spreadsheets enable row level security;

drop policy if exists "Own private spreadsheet" on public.personal_spreadsheets;
create policy "Own private spreadsheet"
on public.personal_spreadsheets
for select
to authenticated
using (
  owner_membership_id = public.current_membership_id()
  and public.current_user_has_permission('notes.manage_self')
);

revoke all on public.personal_spreadsheets from anon, authenticated;
grant select on public.personal_spreadsheets to authenticated;

