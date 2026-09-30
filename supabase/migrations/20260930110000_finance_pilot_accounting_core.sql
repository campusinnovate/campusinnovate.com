-- Additive Finance PRD pilot. Existing Finance tables and records remain untouched.

insert into public.permissions(key,name,description) values
  ('finance_next.view','Lihat Finance Pilot','Melihat pilot buku besar dan jurnal berpasangan.'),
  ('finance_next.manage','Kelola Finance Pilot','Menyiapkan dan memposting jurnal rutin di Finance Pilot.'),
  ('finance_next.approve','Setujui Finance Pilot','Menyetujui penutupan atau pembukaan kembali periode Finance Pilot.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on
  (r.key='system_admin' and p.key in ('finance_next.view','finance_next.manage','finance_next.approve')) or
  (r.key='finance_manager' and p.key in ('finance_next.view','finance_next.manage')) or
  (r.key='executive' and p.key in ('finance_next.view','finance_next.approve'))
on conflict do nothing;

create table if not exists public.finance_next_service_lines(
  service_line_key text primary key,
  label text not null unique,
  revenue_account_code text references public.finance_coa(code),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.finance_next_service_lines(service_line_key,label,revenue_account_code) values
 ('event_management','Event Management','1000'),
 ('digital_system','Digital System','1000'),
 ('coreva','COREVA','1001'),
 ('program_development','Program Development','1000'),
 ('stripmate','Stripmate','1001'),
 ('creative_media_production','Creative & Media Production','1000')
on conflict(service_line_key) do nothing;

create table if not exists public.finance_next_periods(
  period_month date primary key check(period_month=date_trunc('month',period_month)::date),
  status text not null default 'open' check(status in ('open','close_requested','closed','reopen_requested')),
  requested_action text check(requested_action in ('close','reopen')),
  requested_by_membership_id uuid references public.memberships(id),
  reviewed_by_membership_id uuid references public.memberships(id),
  requested_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_next_journal_entries(
  id uuid primary key default extensions.gen_random_uuid(),
  entry_date date not null,
  description text not null check(length(trim(description)) between 1 and 500),
  status text not null default 'posted' check(status in ('posted','reversed')),
  source_type text,
  source_id text,
  created_by_membership_id uuid not null references public.memberships(id),
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(source_type,source_id)
);

create table if not exists public.finance_next_journal_lines(
  id uuid primary key default extensions.gen_random_uuid(),
  journal_entry_id uuid not null references public.finance_next_journal_entries(id),
  line_number integer not null check(line_number>0),
  coa_code text not null references public.finance_coa(code),
  description text not null default '',
  debit numeric(18,2) not null default 0 check(debit>=0),
  credit numeric(18,2) not null default 0 check(credit>=0),
  project_id uuid references public.projects(id),
  project_name text,
  client text,
  service_line_key text references public.finance_next_service_lines(service_line_key),
  unique(journal_entry_id,line_number),
  check((debit>0 and credit=0) or (credit>0 and debit=0))
);

create index if not exists finance_next_entries_date_idx on public.finance_next_journal_entries(entry_date desc);
create index if not exists finance_next_lines_account_idx on public.finance_next_journal_lines(coa_code,journal_entry_id);
create index if not exists finance_next_lines_service_idx on public.finance_next_journal_lines(service_line_key,journal_entry_id);

create table if not exists public.finance_next_legacy_mappings(
  id uuid primary key default extensions.gen_random_uuid(),
  migration_batch text not null,
  source_type text not null,
  source_id text not null,
  journal_entry_id uuid references public.finance_next_journal_entries(id),
  source_checksum text not null,
  mapped_at timestamptz not null default now(),
  unique(migration_batch,source_type,source_id)
);

create table if not exists public.finance_next_audit_logs(
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id),
  actor_membership_id uuid references public.memberships(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.finance_next_service_lines enable row level security;
alter table public.finance_next_periods enable row level security;
alter table public.finance_next_journal_entries enable row level security;
alter table public.finance_next_journal_lines enable row level security;
alter table public.finance_next_legacy_mappings enable row level security;
alter table public.finance_next_audit_logs enable row level security;

drop policy if exists finance_next_services_view on public.finance_next_service_lines;
create policy finance_next_services_view on public.finance_next_service_lines for select to authenticated using(public.current_user_has_permission('finance_next.view'));
drop policy if exists finance_next_accounts_view on public.finance_coa;
create policy finance_next_accounts_view on public.finance_coa for select to authenticated using(public.current_user_has_permission('finance_next.view'));
drop policy if exists finance_next_periods_view on public.finance_next_periods;
create policy finance_next_periods_view on public.finance_next_periods for select to authenticated using(public.current_user_has_permission('finance_next.view'));
drop policy if exists finance_next_entries_view on public.finance_next_journal_entries;
create policy finance_next_entries_view on public.finance_next_journal_entries for select to authenticated using(public.current_user_has_permission('finance_next.view'));
drop policy if exists finance_next_lines_view on public.finance_next_journal_lines;
create policy finance_next_lines_view on public.finance_next_journal_lines for select to authenticated using(public.current_user_has_permission('finance_next.view'));
drop policy if exists finance_next_legacy_view on public.finance_next_legacy_mappings;
create policy finance_next_legacy_view on public.finance_next_legacy_mappings for select to authenticated using(public.current_user_has_permission('finance_next.view'));
drop policy if exists finance_next_audit_view on public.finance_next_audit_logs;
create policy finance_next_audit_view on public.finance_next_audit_logs for select to authenticated using(public.current_user_has_permission('finance_next.view'));
drop policy if exists finance_next_project_references on public.projects;
create policy finance_next_project_references on public.projects for select to authenticated using(public.current_user_has_permission('finance_next.view') and deleted_at is null);

grant select on public.finance_next_service_lines,public.finance_next_periods,public.finance_next_journal_entries,public.finance_next_journal_lines,public.finance_next_legacy_mappings,public.finance_next_audit_logs to authenticated;
grant usage,select on sequence public.finance_next_audit_logs_id_seq to authenticated;
revoke insert,update,delete,truncate on public.finance_next_service_lines,public.finance_next_periods,public.finance_next_journal_entries,public.finance_next_journal_lines,public.finance_next_legacy_mappings,public.finance_next_audit_logs from anon,authenticated;

create or replace function public.finance_next_post_journal(
  p_entry_date date,p_description text,p_lines jsonb,p_source_type text default null,p_source_id text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); entry_id uuid; line jsonb; line_no integer:=0; total_debit numeric(18,2):=0; total_credit numeric(18,2):=0; account_row public.finance_coa%rowtype; line_debit numeric(18,2); line_credit numeric(18,2); service_key text; project text; project_ref uuid; month_state text;
begin
  if not public.current_user_has_permission('finance_next.manage') then raise exception 'Izin kelola Finance Pilot diperlukan.' using errcode='42501'; end if;
  if actor is null or p_entry_date is null or trim(coalesce(p_description,''))='' then raise exception 'Tanggal dan keterangan jurnal wajib diisi.'; end if;
  if coalesce(jsonb_typeof(p_lines),'')<>'array' or jsonb_array_length(p_lines)<2 then raise exception 'Jurnal harus memiliki minimal dua baris.'; end if;
  select status into month_state from public.finance_next_periods where period_month=date_trunc('month',p_entry_date)::date;
  if month_state in ('closed','close_requested') then raise exception 'Periode sudah ditutup atau menunggu penutupan.' using errcode='55000'; end if;
  for line in select value from jsonb_array_elements(p_lines) loop
    line_no:=line_no+1;
    select * into account_row from public.finance_coa where code=trim(coalesce(line->>'coa_code','')) and is_active;
    if not found then raise exception 'Akun % tidak ditemukan atau tidak aktif.',line->>'coa_code'; end if;
    line_debit:=coalesce(nullif(line->>'debit','')::numeric,0); line_credit:=coalesce(nullif(line->>'credit','')::numeric,0);
    if line_debit<0 or line_credit<0 or ((case when line_debit>0 then 1 else 0 end)+(case when line_credit>0 then 1 else 0 end))<>1 then raise exception 'Setiap baris harus berisi debit atau kredit positif.'; end if;
    service_key:=nullif(trim(line->>'service_line_key'),''); project_ref:=nullif(trim(line->>'project_id'),'')::uuid; project:=nullif(trim(line->>'project_name'),'');
    if account_row.account_class in ('Pendapatan','Beban Langsung Proyek') and service_key is null then raise exception 'Service line wajib untuk baris pendapatan dan HPP langsung.'; end if;
    if project_ref is not null then select name into project from public.projects where id=project_ref and deleted_at is null; if project is null then raise exception 'Project ID tidak ditemukan atau sudah diarsipkan.'; end if; end if;
    if account_row.account_class='Beban Langsung Proyek' and project_ref is null then raise exception 'Project ID wajib untuk setiap biaya langsung.'; end if;
    if service_key is not null and not exists(select 1 from public.finance_next_service_lines where service_line_key=service_key and is_active) then raise exception 'Service line tidak valid.'; end if;
    total_debit:=total_debit+line_debit; total_credit:=total_credit+line_credit;
  end loop;
  if total_debit<=0 or total_debit<>total_credit then raise exception 'Jurnal tidak seimbang: debit % dan kredit %.',total_debit,total_credit; end if;
  insert into public.finance_next_journal_entries(entry_date,description,source_type,source_id,created_by_membership_id)
  values(p_entry_date,trim(p_description),nullif(trim(p_source_type),''),nullif(trim(p_source_id),''),actor) returning id into entry_id;
  line_no:=0;
  for line in select value from jsonb_array_elements(p_lines) loop
    line_no:=line_no+1;
    project_ref:=nullif(trim(line->>'project_id'),'')::uuid;
    select name into project from public.projects where id=project_ref;
    insert into public.finance_next_journal_lines(journal_entry_id,line_number,coa_code,description,debit,credit,project_id,project_name,client,service_line_key)
    values(entry_id,line_no,trim(line->>'coa_code'),coalesce(trim(line->>'description'),''),coalesce(nullif(line->>'debit','')::numeric,0),coalesce(nullif(line->>'credit','')::numeric,0),project_ref,project,nullif(trim(line->>'client'),''),nullif(trim(line->>'service_line_key'),''));
  end loop;
  insert into public.finance_next_audit_logs(actor_user_id,actor_membership_id,action,entity_type,entity_id,after_data)
  values(auth.uid(),actor,'journal.post','finance_next_journal_entry',entry_id::text,jsonb_build_object('entry_date',p_entry_date,'description',trim(p_description),'line_count',line_no,'debit',total_debit,'credit',total_credit,'source_type',p_source_type,'source_id',p_source_id));
  return entry_id;
end $$;

create or replace function public.finance_next_request_period_change(p_period_month date,p_action text,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); current_status text;
begin
  if not public.current_user_has_permission('finance_next.manage') then raise exception 'Izin kelola Finance Pilot diperlukan.' using errcode='42501'; end if;
  if p_period_month is null or p_period_month<>date_trunc('month',p_period_month)::date or p_action not in ('close','reopen') or trim(coalesce(p_reason,''))='' then raise exception 'Periode, aksi, dan alasan yang valid wajib diisi.'; end if;
  select status into current_status from public.finance_next_periods where period_month=p_period_month for update;
  if current_status is null then current_status:='open'; end if;
  if (p_action='close' and current_status not in ('open','reopen_requested')) or (p_action='reopen' and current_status<>'closed') then raise exception 'Status periode tidak mengizinkan permintaan ini.'; end if;
  insert into public.finance_next_periods(period_month,status,requested_action,requested_by_membership_id,reviewed_by_membership_id,requested_at,reviewed_at,review_note)
  values(p_period_month,case p_action when 'close' then 'close_requested' else 'reopen_requested' end,p_action,actor,null,now(),null,trim(p_reason))
  on conflict(period_month) do update set status=excluded.status,requested_action=excluded.requested_action,requested_by_membership_id=excluded.requested_by_membership_id,reviewed_by_membership_id=null,requested_at=now(),reviewed_at=null,review_note=excluded.review_note,updated_at=now();
  insert into public.finance_next_audit_logs(actor_user_id,actor_membership_id,action,entity_type,entity_id,after_data,reason)
  values(auth.uid(),actor,'period.'||p_action||'.request','finance_next_period',p_period_month::text,jsonb_build_object('status',case p_action when 'close' then 'close_requested' else 'reopen_requested' end),trim(p_reason));
end $$;

create or replace function public.finance_next_review_period_change(p_period_month date,p_decision text,p_note text)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); period_row public.finance_next_periods%rowtype; next_status text;
begin
  if not public.current_user_has_permission('finance_next.approve') then raise exception 'Izin approver Finance Pilot diperlukan.' using errcode='42501'; end if;
  select * into period_row from public.finance_next_periods where period_month=p_period_month for update;
  if period_row.period_month is null or period_row.status not in ('close_requested','reopen_requested') then raise exception 'Tidak ada permintaan periode untuk ditinjau.'; end if;
  if period_row.requested_by_membership_id=actor then raise exception 'Pemohon tidak boleh menyetujui permintaannya sendiri.' using errcode='42501'; end if;
  if p_decision not in ('approve','reject') or (p_decision='reject' and trim(coalesce(p_note,''))='') then raise exception 'Keputusan tidak valid; alasan wajib saat menolak.'; end if;
  next_status:=case when p_decision='approve' and period_row.requested_action='close' then 'closed' when p_decision='approve' then 'open' when period_row.requested_action='close' then 'open' else 'closed' end;
  update public.finance_next_periods set status=next_status,reviewed_by_membership_id=actor,reviewed_at=now(),review_note=coalesce(nullif(trim(p_note),''),review_note),updated_at=now() where period_month=p_period_month;
  insert into public.finance_next_audit_logs(actor_user_id,actor_membership_id,action,entity_type,entity_id,before_data,after_data,reason)
  values(auth.uid(),actor,'period.'||period_row.requested_action||'.'||p_decision,'finance_next_period',p_period_month::text,jsonb_build_object('status',period_row.status),jsonb_build_object('status',next_status),coalesce(nullif(trim(p_note),''),period_row.review_note));
end $$;

revoke all on function public.finance_next_post_journal(date,text,jsonb,text,text) from public,anon;
revoke all on function public.finance_next_request_period_change(date,text,text) from public,anon;
revoke all on function public.finance_next_review_period_change(date,text,text) from public,anon;
grant execute on function public.finance_next_post_journal(date,text,jsonb,text,text) to authenticated;
grant execute on function public.finance_next_request_period_change(date,text,text) to authenticated;
grant execute on function public.finance_next_review_period_change(date,text,text) to authenticated;
