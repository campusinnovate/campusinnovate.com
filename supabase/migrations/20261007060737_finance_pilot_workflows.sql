-- REVIEW ONLY: additive Finance Pilot integration. Do not run on production before approval.
-- Reuses finance_coa, finance_documents, projects, pipeline_leads and finance_next ledger.
-- No legacy backfill, bank snapshot mutation, automatic cutover or production test data.
create schema if not exists finance_pilot_private;
revoke all on schema finance_pilot_private from public,anon,authenticated;

create or replace function finance_pilot_private.actor(p_action text) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; position_key text;
begin
 select m.id,p.key into actor,position_key from public.memberships m join public.positions p on p.id=m.position_id
 where m.user_id=auth.uid() and m.status='active';
 if actor is null then raise exception 'Keanggotaan aktif diperlukan.' using errcode='42501'; end if;
 if p_action='manage' and (position_key<>'coo' or not public.current_user_has_permission('finance_next.manage')) then
   raise exception 'Operasional finance hanya untuk COO.' using errcode='42501';
 elsif p_action='approve' and (position_key<>'ceo' or not public.current_user_has_permission('finance_next.approve')) then
   raise exception 'Approval finansial hanya untuk CEO.' using errcode='42501';
 elsif p_action='view' and (position_key not in ('coo','ceo') or not public.current_user_has_permission('finance_next.view')) then
   raise exception 'Laporan finansial hanya untuk COO dan CEO.' using errcode='42501';
 elsif p_action not in ('view','manage','approve') then raise exception 'Aksi tidak valid.'; end if;
 return actor;
end $$;

-- Position grants preserve existing membership/role/override infrastructure; admin role cannot bypass actor().
insert into public.position_permissions(position_id,permission_id)
select pos.id,p.id from public.positions pos cross join public.permissions p
where (pos.key='coo' and p.key in ('finance_next.view','finance_next.manage'))
 or (pos.key='ceo' and p.key in ('finance_next.view','finance_next.approve')) on conflict do nothing;

create table public.finance_next_requests(
 id uuid primary key default extensions.gen_random_uuid(),
 request_key uuid not null unique,
 kind text not null check(kind in ('journal','invoice','receipt','target','policy','funds','budget','reversal','project_closure','account')),
 state text not null default 'draft' check(state in ('draft','submitted','approved','rejected','posted')),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 prepared_by uuid not null references public.memberships(id),
 approved_by uuid references public.memberships(id),
 submitted_at timestamptz, reviewed_at timestamptz, review_note text,
 result_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.finance_next_project_controls(
 project_id uuid primary key references public.projects(id),
 service_line_key text not null references public.finance_next_service_lines(service_line_key),
 contract_value numeric(18,2) not null check(contract_value>=0),
 budgeted_hpp numeric(18,2) not null check(budgeted_hpp>=0),
 committed_cost numeric(18,2) not null default 0 check(committed_cost>=0),
 delivery_confirmed_by uuid references public.memberships(id), delivery_confirmed_at timestamptz,
 handover_evidence text, financially_closed_at timestamptz, financially_closed_by uuid references public.memberships(id),
 approved_request_id uuid not null references public.finance_next_requests(id)
);
create table public.finance_next_reconciliations(
 id uuid primary key default extensions.gen_random_uuid(), request_key uuid not null unique,
 bank_coa_code text not null references public.finance_coa(code), as_of_date date not null,
 statement_balance numeric(18,2) not null, book_balance numeric(18,2) not null,
 ledger_fingerprint text not null, evidence_path text not null,
 prepared_by uuid not null references public.memberships(id), created_at timestamptz not null default now(),
 check(statement_balance=book_balance)
);
-- Existing document identity is canonical; nullable additions do not reclassify old records.
alter table public.finance_documents add column if not exists finance_pilot boolean;
alter table public.finance_documents add column if not exists pilot_project_id uuid references public.projects(id);
alter table public.finance_documents add column if not exists pilot_service_line_key text references public.finance_next_service_lines(service_line_key);
alter table public.finance_documents add column if not exists pilot_journal_id uuid references public.finance_next_journal_entries(id);
alter table public.finance_documents add column if not exists pilot_deposit_coa_code text references public.finance_coa(code);
alter table public.finance_documents add column if not exists pilot_evidence_path text;
alter table public.finance_next_journal_entries add column if not exists reversal_of_id uuid references public.finance_next_journal_entries(id);
create unique index finance_next_one_reversal on public.finance_next_journal_entries(reversal_of_id) where reversal_of_id is not null;
create index finance_next_requests_state_idx on public.finance_next_requests(state,kind,created_at);
create index finance_next_documents_idx on public.finance_documents(document_date,document_type) where finance_pilot is true;

create or replace function finance_pilot_private.can_view() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m join public.positions p on p.id=m.position_id
 where m.user_id=auth.uid() and m.status='active' and p.key in ('coo','ceo'))
 and public.current_user_has_permission('finance_next.view');
$$;
-- Private helper usable by RLS, not an exposed RPC.
grant usage on schema finance_pilot_private to authenticated;
grant execute on function finance_pilot_private.can_view() to authenticated;
alter table public.finance_next_requests enable row level security;
alter table public.finance_next_project_controls enable row level security;
alter table public.finance_next_reconciliations enable row level security;
create policy finance_next_requests_read on public.finance_next_requests for select to authenticated using(finance_pilot_private.can_view());
create policy finance_next_controls_read on public.finance_next_project_controls for select to authenticated using(finance_pilot_private.can_view());
create policy finance_next_reconciliations_read on public.finance_next_reconciliations for select to authenticated using(finance_pilot_private.can_view());
grant select on public.finance_next_requests,public.finance_next_project_controls,public.finance_next_reconciliations to authenticated;
revoke insert,update,delete,truncate on public.finance_next_requests,public.finance_next_project_controls,public.finance_next_reconciliations from anon,authenticated;
-- Restrictive policies prevent old broad role grants exposing pilot records. Legacy access unchanged.
create policy finance_pilot_document_boundary on public.finance_documents as restrictive to authenticated
 using(finance_pilot is not true or finance_pilot_private.can_view()) with check(finance_pilot is not true);
create policy finance_pilot_document_read on public.finance_documents for select to authenticated using(finance_pilot is true and finance_pilot_private.can_view());

do $$ declare t text; begin
 foreach t in array array['finance_next_service_lines','finance_next_periods','finance_next_journal_entries','finance_next_journal_lines','finance_next_legacy_mappings','finance_next_audit_logs'] loop
 execute format('create policy finance_pilot_role_boundary on public.%I as restrictive for select to authenticated using(finance_pilot_private.can_view())',t);
 end loop;
end $$;

create or replace function finance_pilot_private.audit(p_action text,p_entity text,p_id text,p_before jsonb,p_after jsonb,p_reason text default null)
returns void language sql security definer set search_path='' as $$
 insert into public.finance_next_audit_logs(actor_user_id,actor_membership_id,action,entity_type,entity_id,before_data,after_data,reason)
 values(auth.uid(),public.current_membership_id(),p_action,p_entity,p_id,p_before,p_after,p_reason);
$$;
create or replace function finance_pilot_private.policy() returns jsonb language sql stable security definer set search_path='' as $$
 select payload from public.finance_next_requests where kind='policy' and state='posted' order by reviewed_at desc,id limit 1;
$$;
create or replace function finance_pilot_private.evidence(p_path text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_path is null or not exists(select 1 from storage.objects where bucket_id='finance-pilot-evidence' and name=p_path) then
 raise exception 'Bukti privat wajib diunggah sebelum posting.'; end if;
end $$;
create or replace function finance_pilot_private.lock_period(p_date date) returns void language plpgsql security definer set search_path='' as $$
declare s text;
begin
 if p_date is null then raise exception 'Tanggal wajib.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('finance-period:'||date_trunc('month',p_date)::date::text,0));
 select status into s from public.finance_next_periods where period_month=date_trunc('month',p_date)::date for update;
 if s is not null and s<>'open' then raise exception 'Periode belum terbuka: %',s using errcode='55000'; end if;
end $$;

-- Internal ledger writer. Every source is unique; repeated executions return the existing entry.
create or replace function finance_pilot_private.post(p_date date,p_description text,p_lines jsonb,p_source_type text,p_source_id text,p_reversal uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid; l jsonb; a public.finance_coa%rowtype; d numeric(18,2); c numeric(18,2); td numeric(18,2):=0; tc numeric(18,2):=0; n int:=0; pr uuid; sk text; ctl public.finance_next_project_controls%rowtype;
begin
 perform finance_pilot_private.actor('manage');
 perform finance_pilot_private.lock_period(p_date);
 perform pg_advisory_xact_lock(hashtextextended('finance-source:'||p_source_type||':'||p_source_id,0));
 select id into eid from public.finance_next_journal_entries where source_type=p_source_type and source_id=p_source_id;
 if eid is not null then return eid; end if;
 if nullif(trim(p_description),'') is null or length(p_description)>500 or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then raise exception 'Jurnal minimal dua baris dan keterangan wajib.'; end if;
 for l in select value from jsonb_array_elements(p_lines) loop
 select * into a from public.finance_coa where code=l->>'coa_code' and is_active;
 if a.code is null or a.account_class like 'Kontrol%' or a.account_class='Kontra Beban' then raise exception 'Akun ledger aktif diperlukan; akun kontrol tidak boleh diposting.'; end if;
 d:=coalesce(nullif(l->>'debit','')::numeric,0); c:=coalesce(nullif(l->>'credit','')::numeric,0);
 if d<0 or c<0 or ((d>0)::int+(c>0)::int)<>1 or d::text in ('NaN','Infinity','-Infinity') or c::text in ('NaN','Infinity','-Infinity') then raise exception 'Debit/kredit tidak valid.'; end if;
 pr:=nullif(l->>'project_id','')::uuid; sk:=nullif(l->>'service_line_key','');
 if pr is not null then
   select * into ctl from public.finance_next_project_controls where project_id=pr;
   if not exists(select 1 from public.projects where id=pr and deleted_at is null and status not in ('Cancelled','Archived')) then raise exception 'Project tidak aktif.'; end if;
   if ctl.financially_closed_at is not null and p_reversal is null then raise exception 'Project sudah ditutup finansial.'; end if;
   if ctl.service_line_key is not null and sk is distinct from ctl.service_line_key then raise exception 'Service line harus diwarisi dari project.'; end if;
 end if;
 if a.account_class in ('Pendapatan','Beban Langsung Proyek') and not exists(select 1 from public.finance_next_service_lines where service_line_key=sk and is_active) then raise exception 'Service line wajib.'; end if;
 if a.account_class='Beban Langsung Proyek' and (pr is null or ctl.project_id is null) then raise exception 'Biaya langsung membutuhkan project dan budget disetujui.'; end if;
 td:=td+d; tc:=tc+c;
 end loop;
 if td<=0 or td<>tc then raise exception 'Jurnal tidak seimbang.'; end if;
 insert into public.finance_next_journal_entries(entry_date,description,source_type,source_id,created_by_membership_id,reversal_of_id)
 values(p_date,trim(p_description),p_source_type,p_source_id,public.current_membership_id(),p_reversal) returning id into eid;
 for l in select value from jsonb_array_elements(p_lines) loop
 n:=n+1; pr:=nullif(l->>'project_id','')::uuid;
 insert into public.finance_next_journal_lines(journal_entry_id,line_number,coa_code,description,debit,credit,project_id,project_name,client,service_line_key)
 values(eid,n,l->>'coa_code',coalesce(l->>'description',''),coalesce(nullif(l->>'debit','')::numeric,0),coalesce(nullif(l->>'credit','')::numeric,0),pr,(select name from public.projects where id=pr),nullif(l->>'client',''),nullif(l->>'service_line_key',''));
 end loop;
 perform finance_pilot_private.audit('journal.post','journal',eid::text,null,jsonb_build_object('source_type',p_source_type,'source_id',p_source_id,'debit',td,'credit',tc));
 return eid;
end $$;

-- The original RPC lacks evidence/idempotency/approval and must no longer bypass the workflow.
create or replace function public.finance_next_post_journal(p_entry_date date,p_description text,p_lines jsonb,p_source_type text default null,p_source_id text default null)
returns uuid language plpgsql security definer set search_path='' as $$
begin perform finance_pilot_private.actor('manage'); raise exception 'Gunakan workflow draft Finance Pilot dengan bukti dan request key.'; end $$;

create or replace function finance_pilot_private.immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Record posted/audit tidak boleh diubah atau dihapus; gunakan reversal.' using errcode='55000'; end $$;
create trigger finance_pilot_entries_immutable before update or delete on public.finance_next_journal_entries for each row execute function finance_pilot_private.immutable();
create trigger finance_pilot_lines_immutable before update or delete on public.finance_next_journal_lines for each row execute function finance_pilot_private.immutable();
create trigger finance_pilot_audit_immutable before update or delete on public.finance_next_audit_logs for each row execute function finance_pilot_private.immutable();

-- Protect pilot documents even when an older Finance RPC is invoked.
create or replace function finance_pilot_private.document_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
   if new.finance_pilot is not true and exists(select 1 from public.finance_documents where id=new.linked_invoice_id and finance_pilot is true) then raise exception 'Invoice pilot wajib dibayar melalui workflow pilot.'; end if;
   return new;
 end if;
 if old.finance_pilot is true then
   if TG_OP='DELETE' or new.deleted_at is not null or new.finance_pilot is distinct from old.finance_pilot then raise exception 'Dokumen pilot tidak boleh dihapus.'; end if;
   if old.pilot_journal_id is not null then
     if (to_jsonb(new)-array['paid','balance','status','updated_at','updated_by_membership_id']) is distinct from (to_jsonb(old)-array['paid','balance','status','updated_at','updated_by_membership_id']) then raise exception 'Nilai dokumen posted immutable.'; end if;
     if new.status='Void' then
       if not exists(select 1 from public.finance_next_journal_entries where reversal_of_id=old.pilot_journal_id) or new.paid<>old.paid or new.balance<>old.balance then raise exception 'Void memerlukan reversal nyata dan tidak boleh mengubah nilai sumber.'; end if;
     elsif old.document_type='receipt' or new.paid<>(select coalesce(sum(d.total),0) from public.finance_documents d where d.finance_pilot is true and d.linked_invoice_id=old.id and d.document_type='receipt' and d.pilot_journal_id is not null and not exists(select 1 from public.finance_next_journal_entries e where e.reversal_of_id=d.pilot_journal_id)) or new.balance<>new.total-new.paid then raise exception 'Saldo invoice harus berasal dari receipt ledger.'; end if;
   end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
create trigger finance_pilot_document_guard before insert or update or delete on public.finance_documents for each row execute function finance_pilot_private.document_guard();

-- Evidence is immutable/private; no public URL, upsert or delete policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('finance-pilot-evidence','finance-pilot-evidence',false,10485760,array['application/pdf','image/png','image/jpeg']) on conflict(id) do nothing;
create policy finance_pilot_evidence_upload on storage.objects for insert to authenticated with check(
 bucket_id='finance-pilot-evidence' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.memberships m join public.positions p on p.id=m.position_id where m.user_id=auth.uid() and m.status='active' and p.key='coo')
 and public.current_user_has_permission('finance_next.manage'));
create policy finance_pilot_evidence_read on storage.objects for select to authenticated using(bucket_id='finance-pilot-evidence' and finance_pilot_private.can_view());

create or replace function public.finance_pilot_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid; pk text;
begin
 actor:=finance_pilot_private.actor('view');
 select p.key into pk from public.memberships m join public.positions p on p.id=m.position_id where m.id=actor;
 return jsonb_build_object('membership_id',actor,'position',pk,'manage',pk='coo' and public.current_user_has_permission('finance_next.manage'),'approve',pk='ceo' and public.current_user_has_permission('finance_next.approve'));
end $$;

create or replace function public.finance_pilot_save_request(p_key uuid,p_kind text,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=finance_pilot_private.actor('manage'); r public.finance_next_requests%rowtype; rid uuid;
begin
 if p_key is null or p_kind not in ('journal','invoice','receipt','target','policy','funds','budget','reversal','project_closure','account') or coalesce(jsonb_typeof(p_payload),'')<>'object' then raise exception 'Draft tidak valid.'; end if;
 if p_kind='target' and (p_payload->>'fiscal_year' is null or p_payload->>'fiscal_year' !~ '^[0-9]{4}$') then raise exception 'Tahun fiscal draft wajib empat digit.'; end if;
 if length(p_payload::text)>100000 then raise exception 'Payload terlalu besar.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('finance-request:'||p_key::text,0));
 select * into r from public.finance_next_requests where request_key=p_key for update;
 -- Replay must not recalculate a payment against its already-reduced liability.
 if r.id is not null and r.state<>'draft' and p_kind='journal' and p_payload->>'business_event' not in ('manual','opening_adjustment') then
  if r.prepared_by<>actor or r.kind<>p_kind then raise exception 'Request key milik operasi lain.' using errcode='42501'; end if;
  if r.payload-'lines'=p_payload-'lines' then return r.id; end if;
  raise exception 'Payload request yang sudah submit tidak boleh berubah.';
 end if;
 if p_kind='journal' then p_payload:=p_payload||jsonb_build_object('lines',finance_pilot_private.template(p_payload)); end if;
 if r.id is not null then
   if r.prepared_by<>actor or r.kind<>p_kind then raise exception 'Request key milik operasi lain.' using errcode='42501'; end if;
   if r.state<>'draft' then
     if r.payload=p_payload then return r.id; end if;
     raise exception 'Payload request yang sudah submit tidak boleh berubah.';
   end if;
   update public.finance_next_requests set payload=p_payload,updated_at=now() where id=r.id; rid:=r.id;
 else
   insert into public.finance_next_requests(request_key,kind,payload,prepared_by) values(p_key,p_kind,p_payload,actor) returning id into rid;
 end if;
 perform finance_pilot_private.audit('draft.save',p_kind,rid::text,to_jsonb(r),p_payload);
 return rid;
end $$;

create or replace function finance_pilot_private.validate_policy(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare k text; ac text; mapped text[];
begin
 if (p->>'approval_threshold')::numeric<0 or (p->>'approval_threshold') is null or (p->>'fiscal_start')::int not between 1 and 12 or p->>'fiscal_start' is null then raise exception 'Threshold dan tahun fiskal harus diputuskan eksplisit.'; end if;
 if (p->>'approval_threshold')::numeric::text in ('NaN','Infinity','-Infinity') then raise exception 'Threshold tidak valid.'; end if;
 foreach k in array array['cash','receivable','payable','advance','tax_payable','retained_earnings','distribution_payable','fixed_asset','related_receivable'] loop
   select account_class into ac from public.finance_coa where code=p->'accounts'->>k and is_active;
   if ac is null or (k in ('cash','receivable','fixed_asset','related_receivable') and ac<>'Aset')
    or (k in ('payable','advance','tax_payable','distribution_payable') and ac<>'Kewajiban') or (k='retained_earnings' and ac<>'Ekuitas') then raise exception 'Mapping akun % belum sesuai.',k; end if;
 end loop;
 select array_agg(value) into mapped from jsonb_each_text(p->'accounts');
 if (select count(*) from unnest(mapped))<>(select count(distinct v) from unnest(mapped) v) then raise exception 'Akun kontrol berbeda tidak boleh memakai saldo yang sama.'; end if;
 if exists(select 1 from public.finance_next_journal_entries) and finance_pilot_private.policy()->'accounts' is distinct from p->'accounts' then raise exception 'Mapping akun posted memerlukan rencana migrasi terpisah; perubahan diblokir.'; end if;
 if exists(select 1 from public.finance_next_requests where kind='target' and state='posted') and finance_pilot_private.policy()->>'fiscal_start' is distinct from p->>'fiscal_start' then raise exception 'Kalender fiscal bertarget aktif tidak boleh diubah tanpa migrasi.'; end if;
 if nullif(trim(p->>'reason'),'') is null then raise exception 'Alasan perubahan kebijakan wajib.'; end if;
end $$;

create or replace function finance_pilot_private.validate(p_kind text,p jsonb) returns numeric
language plpgsql security definer set search_path='' as $$
declare amount numeric(18,2); ac jsonb:=finance_pilot_private.policy()->'accounts'; total numeric(18,2); l jsonb; pr uuid; required_field text; ctl public.finance_next_project_controls%rowtype;
begin
 if p_kind='journal' then
  foreach required_field in array array['date','description','business_event','reference','evidence_path'] loop if nullif(trim(p->>required_field),'') is null then raise exception 'Field wajib: %',required_field; end if; end loop;
 elsif p_kind='invoice' then
  foreach required_field in array array['date','due_date','client','item_description','quantity','unit_price','discount','tax','management_fee','other_fees','service_line_key','installment_scheme','evidence_path','milestone_evidence'] loop if nullif(trim(p->>required_field),'') is null then raise exception 'Field wajib: %',required_field; end if; end loop;
 elsif p_kind='receipt' then
  foreach required_field in array array['date','invoice_id','amount','deposit_coa_code','reference','evidence_path'] loop if nullif(trim(p->>required_field),'') is null then raise exception 'Field wajib: %',required_field; end if; end loop;
 elsif p_kind='target' then
  if p->>'fiscal_year' is null or p->>'annual_target' is null or jsonb_typeof(p->'allocations') is distinct from 'array' then raise exception 'Tahun, target dan array alokasi wajib.'; end if;
 elsif p_kind='funds' then
  if nullif(p->>'as_of','') is null or p->>'operating_target' is null or jsonb_typeof(p->'buckets') is distinct from 'array' then raise exception 'Tanggal dan target/bucket reserve wajib.'; end if;
  perform (p->>'as_of')::date;
 elsif p_kind='budget' then
  foreach required_field in array array['project_id','service_line_key','contract_value','budgeted_hpp','committed_cost'] loop if nullif(trim(p->>required_field),'') is null then raise exception 'Field wajib: %',required_field; end if; end loop;
 elsif p_kind='reversal' then
  if p->>'date' is null or p->>'journal_id' is null then raise exception 'Tanggal dan jurnal sumber wajib.'; end if;
 end if;
 foreach required_field in array array['amount','quantity','unit_price','discount','tax','management_fee','other_fees','annual_target','forecast','operating_target','contract_value','budgeted_hpp','committed_cost','approval_threshold'] loop
 if p->>required_field is not null and (p->>required_field)::numeric::text in ('NaN','Infinity','-Infinity') then raise exception 'Angka tidak finite: %',required_field; end if;
 end loop;
 if p_kind='account' then
 if nullif(trim(p->>'code'),'') is null or exists(select 1 from public.finance_coa where code=p->>'code') or nullif(trim(p->>'name'),'') is null or p->>'account_class' not in ('Aset','Kewajiban','Ekuitas','Pendapatan','Beban Operasional','Beban Langsung Proyek','Beban Non-Operasional','Pajak') or p->>'cash_flow_category' not in ('Operasional','Investasi','Pendanaan','Non-Kas') then raise exception 'Akun baru dan klasifikasi valid wajib.'; end if; return 0; end if;
 if p_kind='policy' then perform finance_pilot_private.validate_policy(p); return 0; end if;
 if p_kind in ('journal','invoice','receipt','reversal') then
  perform finance_pilot_private.evidence(p->>'evidence_path');
  perform finance_pilot_private.lock_period((p->>'date')::date);
 end if;
 if p_kind in ('journal','invoice','receipt','target','funds','budget','reversal') and finance_pilot_private.policy() is null then raise exception 'Kebijakan belum disetujui CEO; jangan memakai asumsi.'; end if;
 if p_kind='journal' then
  if p->>'claim_id' is not null and not exists(select 1 from public.finance_next_requests where id=(p->>'claim_id')::uuid and kind='claim' and state='approved' and (payload->>'amount')::numeric=(p->>'amount')::numeric and payload->>'evidence_path'=p->>'evidence_path') then raise exception 'Claim sumber tidak cocok atau belum ditriage.'; end if;
  if nullif(trim(p->>'reference'),'') is null then raise exception 'Referensi transaksi wajib.'; end if;
  if jsonb_typeof(p->'lines')<>'array' or jsonb_array_length(p->'lines')<2 then raise exception 'Minimal dua baris.'; end if;
  select sum(coalesce((value->>'debit')::numeric,0)),sum(coalesce((value->>'credit')::numeric,0)) into amount,total from jsonb_array_elements(p->'lines');
  if amount is null or amount<=0 or amount<>total then raise exception 'Jurnal tidak seimbang.'; end if;
  if p->>'business_event' not in ('customer_advance','project_expense','operating_expense','vendor_bill','vendor_payment','owner_receivable','asset_purchase','opening_adjustment','profit_distribution','manual') then raise exception 'Business event wajib.'; end if;
  if exists(select 1 from jsonb_array_elements(p->'lines') a where a->>'coa_code'=ac->>'distribution_payable') then raise exception 'Kebijakan distribusi dan eligible profit belum diputuskan; diblokir.'; end if;
  if p->>'business_event'='profit_distribution' then raise exception 'Kebijakan distribusi dan eligible profit belum diputuskan; diblokir.'; end if;
 elsif p_kind='invoice' then
  if nullif(trim(p->>'client'),'') is null or nullif(trim(p->>'item_description'),'') is null or (p->>'quantity')::numeric<=0 or (p->>'unit_price')::numeric<=0 then raise exception 'Client, item, kuantitas dan harga wajib.'; end if;
  if (p->>'due_date')::date<(p->>'date')::date then raise exception 'Jatuh tempo sebelum tanggal invoice.'; end if;
  if not exists(select 1 from public.finance_next_service_lines where service_line_key=p->>'service_line_key' and is_active) then raise exception 'Service line wajib.'; end if;
  if (p->>'tax')::numeric<0 or (p->>'discount')::numeric<0 or (p->>'management_fee')::numeric<0 or (p->>'other_fees')::numeric<0 then raise exception 'Komponen invoice tidak boleh negatif.'; end if;
  if nullif(trim(p->>'milestone_evidence'),'') is null then raise exception 'Bukti milestone selesai wajib sebelum pengakuan revenue.'; end if;
  amount:=round((p->>'quantity')::numeric*(p->>'unit_price')::numeric,2)-coalesce((p->>'discount')::numeric,0)+coalesce((p->>'tax')::numeric,0)+coalesce((p->>'management_fee')::numeric,0)+coalesce((p->>'other_fees')::numeric,0);
  if amount<=0 then raise exception 'Total invoice harus positif.'; end if;
  if (select sum(value::numeric) from jsonb_array_elements_text(p->'percentages')) is distinct from 100::numeric or exists(select 1 from jsonb_array_elements_text(p->'percentages') where value::numeric<=0) then raise exception 'Termin harus tepat 100%%.'; end if;
  pr:=nullif(p->>'project_id','')::uuid;
  if pr is not null and not exists(select 1 from public.finance_next_project_controls where project_id=pr and service_line_key=p->>'service_line_key' and financially_closed_at is null) then raise exception 'Project/service line belum memiliki budget disetujui.'; end if;
 elsif p_kind='receipt' then
  amount:=(p->>'amount')::numeric;
  if amount<=0 or nullif(trim(p->>'reference'),'') is null then raise exception 'Nominal dan referensi pembayaran wajib.'; end if;
  if p->>'deposit_coa_code' is distinct from ac->>'cash' then raise exception 'Akun kas harus mapping yang disetujui.'; end if;
  if not exists(select 1 from public.finance_documents where id=(p->>'invoice_id')::uuid and finance_pilot is true and document_type='invoice' and pilot_journal_id is not null and balance>=amount) then raise exception 'Invoice tidak ditemukan atau pembayaran melebihi saldo.'; end if;
 elsif p_kind='target' then
  if (p->>'fiscal_year')::int not between 2000 and 2200 or (p->>'annual_target')::numeric<=0 then raise exception 'Tahun/target tidak valid.'; end if;
  if jsonb_array_length(p->'allocations')<12 then raise exception 'Alokasi bulanan per service wajib.'; end if;
  select sum((value->>'amount')::numeric) into total from jsonb_array_elements(p->'allocations');
  if total is distinct from (p->>'annual_target')::numeric or exists(select 1 from jsonb_array_elements(p->'allocations') a where ((a->>'amount')::numeric<0 or (a->>'amount')::numeric::text in ('NaN','Infinity','-Infinity') or a->>'amount' is null) or (a->>'month')::int not between 1 and 12 or not exists(select 1 from public.finance_next_service_lines s where s.service_line_key=a->>'service_line_key')) then raise exception 'Alokasi bulanan/service tidak valid atau tidak sama dengan annual target.'; end if;
  if exists(select 1 from jsonb_array_elements(p->'allocations') a group by a->>'month',a->>'service_line_key' having count(*)>1) or (select count(distinct a->>'month') from jsonb_array_elements(p->'allocations') a)<>12 then raise exception 'Semua bulan wajib tanpa alokasi duplikat.'; end if;
 elsif p_kind='funds' then
  if (p->>'operating_target')::numeric<=0 then raise exception 'Target operating reserve wajib positif.'; end if;
  if jsonb_array_length(p->'buckets')<>3 or (select count(distinct a->>'key') from jsonb_array_elements(p->'buckets') a)<>3 or exists(select 1 from jsonb_array_elements(p->'buckets') a where a->>'key' not in ('project','operating','emergency') or (a->>'amount') is null or (a->>'amount')::numeric<0 or (a->>'amount')::numeric::text in ('NaN','Infinity','-Infinity')) then raise exception 'Bucket project, operating, emergency wajib tanpa duplikat.'; end if;
  -- Tax and distribution payable are ledger liabilities, not duplicate reserve balances.
 elsif p_kind='budget' then
  pr:=(p->>'project_id')::uuid;
  if not exists(select 1 from public.projects where id=pr and deleted_at is null) or not exists(select 1 from public.finance_next_service_lines where service_line_key=p->>'service_line_key') or (p->>'contract_value')::numeric<0 or (p->>'budgeted_hpp')::numeric<0 or (p->>'committed_cost')::numeric<0 then raise exception 'Project budget tidak valid.'; end if;
 elsif p_kind='reversal' then
  if not exists(select 1 from public.finance_next_journal_entries where id=(p->>'journal_id')::uuid and source_type in ('request','finance_document') and entry_date<=(p->>'date')::date) then raise exception 'Jurnal sumber tidak valid atau tanggal reversal sebelum sumber.'; end if;
  if exists(select 1 from public.finance_documents where pilot_journal_id=(p->>'journal_id')::uuid and document_type='invoice' and paid>0) then raise exception 'Balikkan receipt terlebih dahulu sebelum membalikkan invoice dibayar.'; end if;
 elsif p_kind='project_closure' then
  select * into ctl from public.finance_next_project_controls where project_id=(p->>'project_id')::uuid for update;
  if ctl.project_id is null or ctl.financially_closed_at is not null or nullif(p->>'handover_evidence','') is null then raise exception 'Project aktif dan bukti handover wajib.'; end if;
  if ctl.service_line_key='digital_system' and ctl.delivery_confirmed_at is null then raise exception 'Konfirmasi CTO wajib untuk project digital.'; end if;
 end if;
 if p_kind in ('target','funds','budget','reversal','project_closure','account') and nullif(trim(p->>'reason'),'') is null then raise exception 'Alasan wajib.'; end if;
 if coalesce(amount,0)::text in ('NaN','Infinity','-Infinity') then raise exception 'Nilai bukan angka finite.'; end if;
 return coalesce(amount,0);
end $$;

create or replace function finance_pilot_private.over_budget(p_lines jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select exists(
 select 1 from (
  select nullif(a->>'project_id','')::uuid project_id,
   sum(coalesce((a->>'debit')::numeric,0)-coalesce((a->>'credit')::numeric,0)) amount
  from jsonb_array_elements(p_lines) a join public.finance_coa c on c.code=a->>'coa_code'
  where c.account_class='Beban Langsung Proyek'
  group by nullif(a->>'project_id','')::uuid
 ) cost join public.finance_next_project_controls pc on pc.project_id=cost.project_id
 where cost.amount+pc.committed_cost+(select coalesce(sum(l.debit-l.credit),0)
  from public.finance_next_journal_lines l join public.finance_coa ca on ca.code=l.coa_code
  where l.project_id=pc.project_id and ca.account_class='Beban Langsung Proyek')>pc.budgeted_hpp
 );
$$;
revoke all on function finance_pilot_private.over_budget(jsonb) from public,anon,authenticated;

-- Outstanding vendor liability is calculated from the one posted ledger, including reversals.
create or replace function finance_pilot_private.ap_balance(p_bill uuid,p_asof date) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce(sum(l.credit-l.debit),0) from public.finance_next_journal_lines l
 join public.finance_next_journal_entries e on e.id=l.journal_entry_id
 left join public.finance_next_journal_entries original on original.id=e.reversal_of_id
 join public.finance_next_requests r on r.id::text=case when e.reversal_of_id is not null then original.source_id else e.source_id end
 where e.status='posted' and e.entry_date<=p_asof and l.coa_code=finance_pilot_private.policy()->'accounts'->>'payable'
 and (case when e.reversal_of_id is not null then original.source_type else e.source_type end)='request'
 and (r.id=p_bill or (r.payload->>'business_event'='vendor_payment' and r.payload->>'vendor_bill_id'=p_bill::text));
$$;
revoke all on function finance_pilot_private.ap_balance(uuid,date) from public,anon,authenticated;
create unique index finance_next_vendor_payment_reference on public.finance_next_requests
 ((payload->>'vendor_bill_id'),(payload->>'reference')) where kind='journal' and state='posted' and payload->>'business_event'='vendor_payment';

-- Submit decides only documented routine versus approval events. Unknown policy blocks posting.
create or replace function public.finance_pilot_submit(p_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare r public.finance_next_requests%rowtype; amt numeric; gated boolean;
begin
 perform finance_pilot_private.actor('manage');
 select * into r from public.finance_next_requests where id=p_id for update;
 if r.id is null or r.prepared_by<>public.current_membership_id() then raise exception 'Draft tidak ditemukan.'; end if;
 if r.state<>'draft' then return r.state; end if;
 amt:=finance_pilot_private.validate(r.kind,r.payload);
 gated:=r.kind in ('target','policy','funds','budget','reversal','account') or (r.kind in ('journal','invoice','receipt') and amt>=(finance_pilot_private.policy()->>'approval_threshold')::numeric) or (r.kind='journal' and r.payload->>'business_event' in ('owner_receivable','opening_adjustment','manual'));
 if r.kind='journal' and exists(select 1 from jsonb_array_elements(r.payload->'lines') a where a->>'coa_code' in (finance_pilot_private.policy()->'accounts'->>'related_receivable',finance_pilot_private.policy()->'accounts'->>'retained_earnings')) then gated:=true; end if;
 if r.kind='journal' and exists(select 1 from public.finance_next_requests x where x.id<>r.id and x.kind='journal' and x.state in ('submitted','approved','posted') and x.payload->>'reference'=r.payload->>'reference' and x.payload->>'date'=r.payload->>'date') then
 if nullif(trim(r.payload->>'duplicate_reason'),'') is null then raise exception 'Potential duplicate: referensi/tanggal sama. Catat alasan dan minta approval.'; end if; gated:=true; end if;
 -- Sum all cost lines for each project; splitting lines cannot bypass approval.
 if r.kind='journal' and finance_pilot_private.over_budget(r.payload->'lines') then gated:=true; end if;
 update public.finance_next_requests set state=case when gated then 'submitted' else 'approved' end,submitted_at=now(),updated_at=now() where id=p_id;
 perform finance_pilot_private.audit('request.submit',r.kind,p_id::text,to_jsonb(r),jsonb_build_object('gated',gated));
 if not gated then perform public.finance_pilot_execute(p_id); return 'posted'; end if;
 return 'submitted';
end $$;

create or replace function public.finance_pilot_review(p_id uuid,p_decision text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=finance_pilot_private.actor('approve'); r public.finance_next_requests%rowtype;
begin
 select * into r from public.finance_next_requests where id=p_id for update;
 if r.id is null then raise exception 'Request tidak ditemukan.'; end if;
 if r.approved_by=actor and r.state in ('approved','rejected','posted') then
 if ((r.state in ('approved','posted') and p_decision='approve') or (r.state='rejected' and p_decision='reject')) and r.review_note=p_note then return; end if;
 raise exception 'Keputusan approval immutable.'; end if;
 if r.kind in ('claim','estimate') then raise exception 'Pengajuan sumber ditriage COO, bukan approval finansial.'; end if;
 if r.state<>'submitted' or r.prepared_by=actor then raise exception 'Request tidak bisa diapprove atau self approval.' using errcode='42501'; end if;
 if p_decision not in ('approve','reject') or nullif(trim(p_note),'') is null then raise exception 'Keputusan dan komentar wajib.'; end if;
 update public.finance_next_requests set state=case p_decision when 'approve' then 'approved' else 'rejected' end,approved_by=actor,reviewed_at=now(),review_note=p_note,updated_at=now() where id=p_id;
 perform finance_pilot_private.audit('request.'||p_decision,r.kind,p_id::text,to_jsonb(r),jsonb_build_object('approver',actor,'decision',p_decision),p_note);
 -- CEO only records approval. COO applies the approved request via execute().
end $$;

create or replace function finance_pilot_private.number(p_type text) returns text language plpgsql security definer set search_path='' as $$
declare s public.finance_sequences%rowtype; per text:=to_char(now() at time zone 'Asia/Jakarta','YYYYMM'); num text;
begin
 select * into s from public.finance_sequences where document_type=p_type for update;
 if s.document_type is null then raise exception 'Sequence % belum tersedia.',p_type; end if;
 if s.period_key<>per then s.last_number:=0; end if;
 loop
 s.last_number:=s.last_number+1; num:=s.prefix||'-'||per||'-'||lpad(s.last_number::text,4,'0');
 exit when not exists(select 1 from public.finance_documents where document_number=num);
 end loop;
 update public.finance_sequences set period_key=per,last_number=s.last_number,updated_at=now() where document_type=p_type;
 return num;
end $$;

create or replace function public.finance_pilot_execute(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=finance_pilot_private.actor('manage'); r public.finance_next_requests%rowtype; p jsonb; source_doc public.finance_documents%rowtype; ac jsonb:=finance_pilot_private.policy()->'accounts'; eid uuid; did uuid; n text; amt numeric(18,2); sub numeric(18,2); rev numeric(18,2); tax numeric(18,2); ls jsonb; inv public.finance_documents%rowtype; sk text; pc public.finance_next_project_controls%rowtype;
begin
 select * into r from public.finance_next_requests where id=p_id for update;
 if r.id is null then raise exception 'Request tidak ditemukan.'; end if;
 if r.state='posted' then return r.result_id; end if;
 if r.kind in ('claim','estimate') then raise exception 'Pengajuan sumber wajib ditautkan ke transaksi/budget, bukan diterapkan langsung.'; end if;
 if r.state<>'approved' then raise exception 'Request belum disetujui.'; end if;
 p:=r.payload; amt:=finance_pilot_private.validate(r.kind,p);
 if r.kind in ('journal','invoice','receipt') and amt>=(finance_pilot_private.policy()->>'approval_threshold')::numeric and r.approved_by is null then raise exception 'Nominal mencapai threshold; diperlukan approval CEO.'; end if;
 if r.kind='account' then
 insert into public.finance_coa(code,name,account_class,cash_flow_category,default_flow,cost_nature,control_position,retained_earnings_impact) values(p->>'code',p->>'name',p->>'account_class',p->>'cash_flow_category','Non-Kas','Non-Beban','Normal','Tidak Langsung');
 elsif r.kind='journal' then
 if p->>'business_event'='vendor_payment' then
  perform 1 from public.finance_next_requests where id=(p->>'vendor_bill_id')::uuid for update;
  if p->'lines' is distinct from finance_pilot_private.template(p) then raise exception 'Journal vendor payment tidak cocok sumber.'; end if;
 end if;
 -- Serialize project cost postings and budget revisions. Recheck after waiting.
 perform 1 from public.finance_next_project_controls where project_id in
 (select nullif(value->>'project_id','')::uuid from jsonb_array_elements(p->'lines')) order by project_id for update;
 if finance_pilot_private.over_budget(p->'lines') and r.approved_by is null then
  raise exception 'Budget project berubah/terlampaui; diperlukan approval CEO.';
 end if;
 eid:=finance_pilot_private.post((p->>'date')::date,p->>'description',p->'lines','request',r.id::text);
 if p->>'business_event'='asset_purchase' then
 insert into public.finance_assets(asset_code,asset_name,category,acquisition_date,acquisition_value,custodian,useful_life_months,created_by_membership_id,pilot_journal_id) values('AST-FP-'||r.id::text,p->>'asset_name',p->>'asset_class',(p->>'date')::date,(p->>'amount')::numeric,p->>'custodian',(p->>'useful_life_months')::int,actor,eid); end if;
 elsif r.kind='invoice' then
 sub:=round((p->>'quantity')::numeric*(p->>'unit_price')::numeric,2);
 tax:=coalesce((p->>'tax')::numeric,0); rev:=amt-tax;
 if rev<=0 then raise exception 'Revenue invoice harus positif.'; end if;
 select revenue_account_code into sk from public.finance_next_service_lines where service_line_key=p->>'service_line_key';
 if not exists(select 1 from public.finance_coa where code=sk and account_class='Pendapatan' and is_active) then raise exception 'Mapping revenue service line tidak valid.'; end if;
 n:=finance_pilot_private.number('invoice'); did:=extensions.gen_random_uuid();
 ls:=jsonb_build_array(jsonb_build_object('coa_code',ac->>'receivable','debit',amt,'credit',0,'project_id',p->>'project_id','service_line_key',p->>'service_line_key','client',p->>'client'),jsonb_build_object('coa_code',sk,'debit',0,'credit',rev,'project_id',p->>'project_id','service_line_key',p->>'service_line_key','client',p->>'client'));
 if tax>0 then ls:=ls||jsonb_build_array(jsonb_build_object('coa_code',ac->>'tax_payable','debit',0,'credit',tax,'project_id',p->>'project_id','service_line_key',p->>'service_line_key','client',p->>'client')); end if;
 eid:=finance_pilot_private.post((p->>'date')::date,'Invoice '||n,ls,'finance_document',did::text);
 insert into public.finance_documents(id,document_type,document_number,document_date,due_date,client,client_address,project_name,status,subtotal,discount,tax,total,paid,balance,notes,items,created_by_membership_id,updated_by_membership_id,gross_total,management_fee,other_fees,installment_scheme,payment_schedule,finance_pilot,pilot_project_id,pilot_service_line_key,pilot_journal_id,pilot_evidence_path)
 values(did,'invoice',n,(p->>'date')::date,(p->>'due_date')::date,p->>'client',p->>'client_address',(select name from public.projects where id=nullif(p->>'project_id','')::uuid),'Unpaid',sub,(p->>'discount')::numeric,tax,amt,0,amt,p->>'notes',jsonb_build_array(jsonb_build_object('description',p->>'item_description','quantity',(p->>'quantity')::numeric,'unit_price',(p->>'unit_price')::numeric)),actor,actor,amt,(p->>'management_fee')::numeric,(p->>'other_fees')::numeric,p->>'installment_scheme',p->'percentages',true,nullif(p->>'project_id','')::uuid,p->>'service_line_key',eid,p->>'evidence_path');
 elsif r.kind='receipt' then
 select * into inv from public.finance_documents where id=(p->>'invoice_id')::uuid for update;
 -- Lock invoice before rechecking outstanding, and deduplicate real payment reference, not only request key.
 if amt>inv.balance then raise exception 'Pembayaran melebihi saldo terbaru.'; end if;
 if exists(select 1 from public.finance_documents where finance_pilot is true and document_type='receipt' and linked_invoice_id=inv.id and reference_number=p->>'reference') then raise exception 'Referensi pembayaran sudah digunakan.' using errcode='23505'; end if;
 n:=finance_pilot_private.number('receipt'); did:=extensions.gen_random_uuid();
 ls:=jsonb_build_array(jsonb_build_object('coa_code',ac->>'cash','debit',amt,'credit',0,'project_id',inv.pilot_project_id,'service_line_key',inv.pilot_service_line_key,'client',inv.client),jsonb_build_object('coa_code',ac->>'receivable','debit',0,'credit',amt,'project_id',inv.pilot_project_id,'service_line_key',inv.pilot_service_line_key,'client',inv.client));
 eid:=finance_pilot_private.post((p->>'date')::date,'Receipt '||n,ls,'finance_document',did::text);
 insert into public.finance_documents(id,document_type,document_number,document_date,client,project_name,status,subtotal,total,paid,balance,reference_number,linked_invoice_id,items,created_by_membership_id,updated_by_membership_id,finance_pilot,pilot_project_id,pilot_service_line_key,pilot_journal_id,pilot_deposit_coa_code,pilot_evidence_path)
 values(did,'receipt',n,(p->>'date')::date,inv.client,inv.project_name,'Paid',amt,amt,amt,0,p->>'reference',inv.id,'[]',actor,actor,true,inv.pilot_project_id,inv.pilot_service_line_key,eid,ac->>'cash',p->>'evidence_path');
 update public.finance_documents set paid=paid+amt,balance=balance-amt,status=case when balance-amt=0 then 'Paid' else 'Partially Paid' end,updated_at=now(),updated_by_membership_id=actor where id=inv.id;
 elsif r.kind='budget' then
 select * into pc from public.finance_next_project_controls where project_id=(p->>'project_id')::uuid for update;
 if pc.project_id is not null and pc.service_line_key<>p->>'service_line_key' and exists(select 1 from public.finance_next_journal_lines where project_id=pc.project_id) then raise exception 'Service line project posted tidak boleh diganti.'; end if;
 insert into public.finance_next_project_controls(project_id,service_line_key,contract_value,budgeted_hpp,committed_cost,approved_request_id)
 values((p->>'project_id')::uuid,p->>'service_line_key',(p->>'contract_value')::numeric,(p->>'budgeted_hpp')::numeric,(p->>'committed_cost')::numeric,p_id)
 on conflict(project_id) do update set service_line_key=excluded.service_line_key,contract_value=excluded.contract_value,budgeted_hpp=excluded.budgeted_hpp,committed_cost=excluded.committed_cost,approved_request_id=p_id;
 elsif r.kind='project_closure' then
 if exists(select 1 from public.finance_documents d where finance_pilot is true and pilot_project_id=(p->>'project_id')::uuid and document_type='invoice' and balance>0 and not exists(select 1 from public.finance_next_journal_entries re where re.reversal_of_id=d.pilot_journal_id)) then raise exception 'Project masih memiliki piutang; closure memerlukan penyelesaian atau write-off disetujui.'; end if;
 if exists(select 1 from public.finance_next_requests bill where bill.kind='journal' and bill.state='posted' and bill.payload->>'project_id'=p->>'project_id' and bill.payload->>'business_event'<>'vendor_payment' and finance_pilot_private.ap_balance(bill.id,'9999-12-31'::date)>0) then raise exception 'Project masih memiliki outstanding vendor AP.'; end if;
 update public.finance_next_project_controls set handover_evidence=p->>'handover_evidence',financially_closed_at=now(),financially_closed_by=actor where project_id=(p->>'project_id')::uuid;
 elsif r.kind='reversal' then
 perform 1 from public.finance_next_requests bill where bill.id in (
  select case when rq.payload->>'business_event'='vendor_payment' then (rq.payload->>'vendor_bill_id')::uuid else rq.id end
  from public.finance_next_journal_entries source join public.finance_next_requests rq on source.source_type='request' and rq.id::text=source.source_id where source.id=(p->>'journal_id')::uuid
 ) order by bill.id for update;
 if exists(select 1 from public.finance_next_journal_entries source join public.finance_next_requests bill on bill.id::text=source.source_id and source.source_type='request'
  join public.finance_next_requests payment on payment.payload->>'vendor_bill_id'=bill.id::text and payment.payload->>'business_event'='vendor_payment' and payment.state='posted'
  join public.finance_next_journal_entries pe on pe.id=payment.result_id
  where source.id=(p->>'journal_id')::uuid and not exists(select 1 from public.finance_next_journal_entries re where re.reversal_of_id=pe.id)) then raise exception 'Balikkan pembayaran vendor dahulu sebelum bill.'; end if;
 if exists(select 1 from public.finance_next_journal_entries where reversal_of_id=(p->>'journal_id')::uuid) then raise exception 'Jurnal sudah dibalik.'; end if;
 select jsonb_agg(jsonb_build_object('coa_code',coa_code,'description',description,'debit',credit,'credit',debit,'project_id',project_id,'service_line_key',service_line_key,'client',client) order by line_number) into ls from public.finance_next_journal_lines where journal_entry_id=(p->>'journal_id')::uuid;
 eid:=finance_pilot_private.post((p->>'date')::date,'Reversal: '||(p->>'reason'),ls,'reversal',r.id::text,(p->>'journal_id')::uuid);
 select * into source_doc from public.finance_documents where pilot_journal_id=(p->>'journal_id')::uuid for update;
 if source_doc.id is not null then
  update public.finance_documents set status='Void',updated_at=now(),updated_by_membership_id=actor where id=source_doc.id;
  if source_doc.document_type='receipt' then
    update public.finance_documents set paid=paid-source_doc.total,balance=balance+source_doc.total,status=case when paid-source_doc.total=0 then 'Unpaid' else 'Partially Paid' end,updated_at=now(),updated_by_membership_id=actor where id=source_doc.linked_invoice_id;
  end if;
 end if;
 end if;
 -- Targets/policies/funds are versioned immutable request snapshots; never maintain a second balance.
 if r.kind='journal' and p->>'claim_id' is not null then update public.finance_next_requests set state='posted',result_id=eid,updated_at=now() where id=(p->>'claim_id')::uuid and kind='claim'; end if;
 update public.finance_next_requests set state='posted',result_id=coalesce(did,eid,r.id),updated_at=now() where id=p_id;
 perform finance_pilot_private.audit('request.apply',r.kind,p_id::text,to_jsonb(r),jsonb_build_object('result_id',coalesce(did,eid,r.id)));
 return coalesce(did,eid,r.id);
end $$;

-- Period wrappers retain existing signatures while enforcing PRD position and shared posting lock.
create or replace function public.finance_next_request_period_change(p_period_month date,p_action text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=finance_pilot_private.actor('manage'); s text;
begin
 if p_period_month is null or p_period_month<>date_trunc('month',p_period_month)::date or p_action not in ('close','reopen') or nullif(trim(p_reason),'') is null then raise exception 'Bulan, aksi dan alasan wajib.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('finance-period:'||p_period_month::text,0));
 select status into s from public.finance_next_periods where period_month=p_period_month for update;
 if (p_action='close' and coalesce(s,'open')<>'open') or (p_action='reopen' and s is distinct from 'closed') then raise exception 'Status periode tidak sesuai.'; end if;
 insert into public.finance_next_periods(period_month,status,requested_action,requested_by_membership_id,requested_at,review_note)
 values(p_period_month,case p_action when 'close' then 'close_requested' else 'reopen_requested' end,p_action,actor,now(),p_reason)
 on conflict(period_month) do update set status=excluded.status,requested_action=p_action,requested_by_membership_id=actor,requested_at=now(),reviewed_at=null,reviewed_by_membership_id=null,review_note=p_reason,updated_at=now();
 perform finance_pilot_private.audit('period.request','period',p_period_month::text,null,jsonb_build_object('action',p_action),p_reason);
end $$;
create or replace function public.finance_next_review_period_change(p_period_month date,p_decision text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=finance_pilot_private.actor('approve'); r public.finance_next_periods%rowtype; s text;
begin
 perform pg_advisory_xact_lock(hashtextextended('finance-period:'||p_period_month::text,0));
 select * into r from public.finance_next_periods where period_month=p_period_month for update;
 if r.period_month is null or r.status not in ('close_requested','reopen_requested') or r.requested_by_membership_id=actor then raise exception 'Permintaan tidak valid atau self approval.'; end if;
 if p_decision not in ('approve','reject') or nullif(trim(p_note),'') is null then raise exception 'Keputusan dan komentar wajib.'; end if;
 s:=case when p_decision='approve' then case r.requested_action when 'close' then 'closed' else 'open' end else case r.requested_action when 'close' then 'open' else 'closed' end end;
 update public.finance_next_periods set status=s,reviewed_by_membership_id=actor,reviewed_at=now(),review_note=p_note,updated_at=now() where period_month=p_period_month;
 perform finance_pilot_private.audit('period.'||p_decision,'period',p_period_month::text,to_jsonb(r),jsonb_build_object('status',s),p_note);
end $$;

-- CTO access is limited to assigned digital delivery confirmation; no finance journal rights.
create or replace function public.finance_pilot_confirm_delivery(p_project_id uuid,p_evidence text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_membership_id(); pk text;
begin
 select p.key into pk from public.memberships m join public.positions p on p.id=m.position_id where m.id=actor;
 if pk is distinct from 'cto' or not exists(select 1 from public.project_members where project_id=p_project_id and membership_id=actor) then raise exception 'Hanya CTO yang ditugaskan.' using errcode='42501'; end if;
 if nullif(trim(p_evidence),'') is null then raise exception 'Bukti delivery wajib.'; end if;
 update public.finance_next_project_controls set delivery_confirmed_at=now(),delivery_confirmed_by=actor,handover_evidence=p_evidence where project_id=p_project_id and service_line_key='digital_system' and financially_closed_at is null;
 if not found then raise exception 'Project digital aktif tidak ditemukan.'; end if;
 perform finance_pilot_private.audit('delivery.confirm','project',p_project_id::text,null,jsonb_build_object('evidence',p_evidence));
end $$;

create or replace function public.finance_pilot_reconcile(p_key uuid,p_asof date,p_balance numeric,p_evidence text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=finance_pilot_private.actor('manage'); ac text:=finance_pilot_private.policy()->'accounts'->>'cash'; b numeric(18,2); fp text; rid uuid;
begin
 if p_key is null or p_asof is null or p_balance is null or ac is null then raise exception 'Rekonsiliasi memerlukan policy dan input lengkap.'; end if;
 perform finance_pilot_private.evidence(p_evidence);
 perform pg_advisory_xact_lock(hashtextextended('finance-reconcile:'||ac||':'||p_asof::text,0));
 select id into rid from public.finance_next_reconciliations where request_key=p_key;
 if rid is not null then
 if not exists(select 1 from public.finance_next_reconciliations where id=rid and as_of_date=p_asof and statement_balance=p_balance and evidence_path=p_evidence) then raise exception 'Request key digunakan untuk rekonsiliasi berbeda.'; end if;
 return rid; end if;
 select coalesce(sum(l.debit-l.credit),0),md5(coalesce(string_agg(l.id::text,',' order by l.id),'')) into b,fp from public.finance_next_journal_lines l join public.finance_next_journal_entries e on e.id=l.journal_entry_id where l.coa_code=ac and e.entry_date<=p_asof;
 if p_balance<>b then raise exception 'Selisih bank % belum diselesaikan. Tidak ada auto adjustment.',p_balance-b; end if;
 insert into public.finance_next_reconciliations(request_key,bank_coa_code,as_of_date,statement_balance,book_balance,ledger_fingerprint,evidence_path,prepared_by) values(p_key,ac,p_asof,p_balance,b,fp,p_evidence,actor) returning id into rid;
 perform finance_pilot_private.audit('bank.reconcile','reconciliation',rid::text,null,jsonb_build_object('as_of',p_asof,'book',b,'statement',p_balance));
 return rid;
end $$;

-- Append-only export audit; backend computes the same snapshot for audit/filter consistency.
create or replace function public.finance_pilot_audit_export(p_filters jsonb) returns void language plpgsql security definer set search_path='' as $$
begin perform finance_pilot_private.actor('view'); perform finance_pilot_private.audit('report.export','report',null,null,p_filters); end $$;

-- Explicit grants are necessary on current Supabase Data API defaults.
revoke all on all functions in schema finance_pilot_private from public,anon,authenticated;
grant execute on function finance_pilot_private.can_view() to authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'finance_pilot_%' loop
 execute format('revoke all on function %s from public,anon',f.sig);
 execute format('grant execute on function %s to authenticated',f.sig);
 end loop;
end $$;

create or replace function finance_pilot_private.template(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb:=finance_pilot_private.policy()->'accounts'; ev text:=p->>'business_event'; d text; c text; amt numeric(18,2):=(p->>'amount')::numeric; cl text; sk text; pr uuid:=nullif(p->>'project_id','')::uuid; bill public.finance_next_requests%rowtype; remaining numeric;
begin
 if ev in ('manual','opening_adjustment') then return p->'lines'; end if;
 if amt is null or amt<=0 or amt::text in ('NaN','Infinity','-Infinity') then raise exception 'Nominal business event harus positif.'; end if;
 if ev='vendor_payment' then
  if nullif(p->>'vendor_bill_id','') is null then raise exception 'Sumber vendor bill wajib.'; end if;
  select * into bill from public.finance_next_requests where id=(p->>'vendor_bill_id')::uuid and kind='journal' and state='posted';
  if bill.id is null or bill.payload->>'business_event'='vendor_payment' or not exists(select 1 from public.finance_next_journal_lines where journal_entry_id=bill.result_id and coa_code=a->>'payable' and credit>0) then raise exception 'Sumber AP posted tidak ditemukan.'; end if;
  if p->>'date' is null or (p->>'date')::date<(bill.payload->>'date')::date then raise exception 'Tanggal payment harus setelah atau sama dengan bill.'; end if;
  remaining:=least(finance_pilot_private.ap_balance(bill.id,(p->>'date')::date),finance_pilot_private.ap_balance(bill.id,'9999-12-31'::date));
  if amt>remaining then raise exception 'Payment melebihi outstanding vendor %.',remaining; end if;
  if p->>'client' is distinct from bill.payload->>'client' or nullif(p->>'project_id','') is distinct from nullif(bill.payload->>'project_id','') then raise exception 'Vendor/project harus cocok bill sumber.'; end if;
  d:=a->>'payable'; c:=a->>'cash';
 elsif ev='customer_advance' then d:=a->>'cash';c:=a->>'advance';
 elsif ev='owner_receivable' then d:=a->>'related_receivable';c:=a->>'cash';
   if nullif(trim(p->>'client'),'') is null or p->>'due_date' is null then raise exception 'Owner dan due date wajib untuk piutang pihak terkait.'; end if;
 elsif ev='asset_purchase' then d:=a->>'fixed_asset';c:=p->>'settlement_account';
   if nullif(trim(p->>'asset_name'),'') is null or coalesce((p->>'useful_life_months')::int,0)<=0 or nullif(trim(p->>'custodian'),'') is null then raise exception 'Nama aset, umur manfaat dan custodian wajib.'; end if;
 elsif ev in ('project_expense','operating_expense','vendor_bill') then
   d:=p->>'expense_account'; c:=case when ev='vendor_bill' then a->>'payable' else p->>'settlement_account' end;
   select account_class into cl from public.finance_coa where code=d and is_active;
   if (ev='project_expense' and cl is distinct from 'Beban Langsung Proyek') or (ev='operating_expense' and cl is distinct from 'Beban Operasional') or (ev='vendor_bill' and cl not in ('Beban Langsung Proyek','Beban Operasional')) then raise exception 'Akun expense tidak sesuai business event.'; end if;
 else raise exception 'Business event belum didukung.'; end if;
 if c is null or (ev in ('project_expense','operating_expense','vendor_bill','asset_purchase') and c not in (a->>'cash',a->>'payable')) or d is null then raise exception 'Mapping settlement tidak valid.'; end if;
 if c=a->>'payable' and (nullif(trim(p->>'client'),'') is null or nullif(p->>'due_date','') is null) then raise exception 'Vendor dan jatuh tempo wajib untuk AP.'; end if;
 if c=a->>'payable' and (p->>'due_date')::date<(p->>'date')::date then raise exception 'Jatuh tempo vendor sebelum tanggal bill.'; end if;
 if pr is not null then select service_line_key into sk from public.finance_next_project_controls where project_id=pr; end if;
 if ev in ('project_expense','customer_advance') and pr is null then raise exception 'Project wajib untuk advance/biaya langsung.'; end if;
 return jsonb_build_array(jsonb_build_object('coa_code',d,'description',p->>'description','debit',amt,'credit',0,'project_id',pr,'service_line_key',sk,'client',p->>'client'),jsonb_build_object('coa_code',c,'description',p->>'description','debit',0,'credit',amt,'project_id',pr,'service_line_key',sk,'client',p->>'client'));
end $$;
revoke all on function finance_pilot_private.template(jsonb) from public,anon,authenticated;
create or replace function public.finance_pilot_journal_preview(p_payload jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform finance_pilot_private.actor('manage'); return finance_pilot_private.template(p_payload); end $$;
revoke all on function public.finance_pilot_journal_preview(jsonb) from public,anon;
grant execute on function public.finance_pilot_journal_preview(jsonb) to authenticated;
-- Asset inventory remains the existing canonical register, linked back to the source journal.
alter table public.finance_assets add column if not exists pilot_journal_id uuid references public.finance_next_journal_entries(id);
