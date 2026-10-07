-- GENERATED DEV-only update. Existing installation required; stop on collisions.
-- No production function/schema or financial data mutation. Only prefixed wrappers/new DEV policies.
begin;set local lock_timeout='3s';set local statement_timeout='90s';
do $$ begin
 if not exists(select 1 from finance_pilot_dev_private.settings where enabled) or to_regprocedure('public.finance_pilot_dev_dashboard(text,date,date,date,text,uuid,text,text,text,jsonb)') is not null then raise exception 'DEV disabled or update already exists; inspect first.';end if;
end $$;
create table finance_pilot_dev.activities("id" uuid default extensions.gen_random_uuid() not null,"owner_membership_id" uuid not null,primary key(id));
alter table finance_pilot_dev.activities enable row level security;revoke all on finance_pilot_dev.activities from public,anon,authenticated;
insert into finance_pilot_dev.finance_bank_accounts(bank_account) values('DEV Bank A'),('DEV Bank B') on conflict(bank_account) do nothing;
-- Additional canonical workflows; no production seed or historical backfill.
create or replace function finance_pilot_dev_private.advance_balance(p_id uuid,p_asof date) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce(sum(l.credit-l.debit),0) from finance_pilot_dev.finance_next_journal_lines l join finance_pilot_dev.finance_next_journal_entries e on e.id=l.journal_entry_id left join finance_pilot_dev.finance_next_journal_entries oe on oe.id=e.reversal_of_id join finance_pilot_dev.finance_next_requests r on r.id::text=case when e.reversal_of_id is not null then oe.source_id else e.source_id end where e.status='posted' and e.entry_date<=p_asof and l.coa_code=finance_pilot_dev_private.policy()->'accounts'->>'advance' and (r.id=p_id or r.payload->>'advance_request_id'=p_id::text);
$$;
revoke all on function finance_pilot_dev_private.advance_balance(uuid,date) from public,anon,authenticated;
create unique index finance_pilot_advance_reference on finance_pilot_dev.finance_next_requests((payload->>'advance_request_id'),(payload->>'reference')) where kind='journal' and state='posted' and payload->>'business_event'='advance_settlement';
create unique index finance_pilot_estimate_consumption on finance_pilot_dev.finance_next_requests((payload->>'estimate_id')) where kind='budget' and state in('draft','submitted','approved','posted') and payload->>'estimate_id' is not null;
create or replace function finance_pilot_dev_private.validate(p_kind text,p jsonb) returns numeric
language plpgsql security definer set search_path='' as $$
declare amount numeric(18,2); ac jsonb:=finance_pilot_dev_private.policy()->'accounts'; total numeric(18,2); l jsonb; pr uuid; required_field text; ctl finance_pilot_dev.finance_next_project_controls%rowtype;
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
 if nullif(trim(p->>'code'),'') is null or exists(select 1 from finance_pilot_dev.finance_coa where code=p->>'code') or nullif(trim(p->>'name'),'') is null or p->>'account_class' not in ('Aset','Kewajiban','Ekuitas','Pendapatan','Beban Operasional','Beban Langsung Proyek','Beban Non-Operasional','Pajak') or p->>'cash_flow_category' not in ('Operasional','Investasi','Pendanaan','Non-Kas') then raise exception 'Akun baru dan klasifikasi valid wajib.'; end if; return 0; end if;
 if p_kind='policy' then perform finance_pilot_dev_private.validate_policy(p); return 0; end if;
 if p_kind in ('journal','invoice','receipt','reversal') then
  perform finance_pilot_dev_private.evidence(p->>'evidence_path');
  perform finance_pilot_dev_private.lock_period((p->>'date')::date);
 end if;
 if p_kind in ('journal','invoice','receipt','target','funds','budget','reversal') and finance_pilot_dev_private.policy() is null then raise exception 'Kebijakan belum disetujui CEO; jangan memakai asumsi.'; end if;
 if p_kind='journal' then
  if p->>'claim_id' is not null and not exists(select 1 from finance_pilot_dev.finance_next_requests where id=(p->>'claim_id')::uuid and kind='claim' and state='approved' and (payload->>'amount')::numeric=(p->>'amount')::numeric and payload->>'evidence_path'=p->>'evidence_path') then raise exception 'Claim sumber tidak cocok atau belum ditriage.'; end if;
  if nullif(trim(p->>'reference'),'') is null then raise exception 'Referensi transaksi wajib.'; end if;
  if jsonb_typeof(p->'lines')<>'array' or jsonb_array_length(p->'lines')<2 then raise exception 'Minimal dua baris.'; end if;
  select sum(coalesce((value->>'debit')::numeric,0)),sum(coalesce((value->>'credit')::numeric,0)) into amount,total from jsonb_array_elements(p->'lines');
  if amount is null or amount<=0 or amount<>total then raise exception 'Jurnal tidak seimbang.'; end if;
  if p->>'business_event' not in ('customer_advance','project_expense','operating_expense','vendor_bill','vendor_payment','owner_receivable','asset_purchase','opening_adjustment','profit_distribution','advance_settlement','manual') then raise exception 'Business event wajib.'; end if;
  if exists(select 1 from jsonb_array_elements(p->'lines') a where a->>'coa_code'=ac->>'distribution_payable') then raise exception 'Kebijakan distribusi dan eligible profit belum diputuskan; diblokir.'; end if;
  if p->>'business_event'='profit_distribution' then raise exception 'Kebijakan distribusi dan eligible profit belum diputuskan; diblokir.'; end if;
 elsif p_kind='invoice' then
  if nullif(trim(p->>'client'),'') is null or nullif(trim(p->>'item_description'),'') is null or (p->>'quantity')::numeric<=0 or (p->>'unit_price')::numeric<=0 then raise exception 'Client, item, kuantitas dan harga wajib.'; end if;
  if (p->>'due_date')::date<(p->>'date')::date then raise exception 'Jatuh tempo sebelum tanggal invoice.'; end if;
  if not exists(select 1 from finance_pilot_dev.finance_next_service_lines where service_line_key=p->>'service_line_key' and is_active) then raise exception 'Service line wajib.'; end if;
  if (p->>'tax')::numeric<0 or (p->>'discount')::numeric<0 or (p->>'management_fee')::numeric<0 or (p->>'other_fees')::numeric<0 then raise exception 'Komponen invoice tidak boleh negatif.'; end if;
  if nullif(trim(p->>'milestone_evidence'),'') is null then raise exception 'Bukti milestone selesai wajib sebelum pengakuan revenue.'; end if;
  amount:=round((p->>'quantity')::numeric*(p->>'unit_price')::numeric,2)-coalesce((p->>'discount')::numeric,0)+coalesce((p->>'tax')::numeric,0)+coalesce((p->>'management_fee')::numeric,0)+coalesce((p->>'other_fees')::numeric,0);
  if amount<=0 then raise exception 'Total invoice harus positif.'; end if;
  if (select sum(value::numeric) from jsonb_array_elements_text(p->'percentages')) is distinct from 100::numeric or exists(select 1 from jsonb_array_elements_text(p->'percentages') where value::numeric<=0) then raise exception 'Termin harus tepat 100%%.'; end if;
  pr:=nullif(p->>'project_id','')::uuid;
  if pr is not null and not exists(select 1 from finance_pilot_dev.finance_next_project_controls where project_id=pr and service_line_key=p->>'service_line_key' and financially_closed_at is null) then raise exception 'Project/service line belum memiliki budget disetujui.'; end if;
 elsif p_kind='receipt' then
  amount:=(p->>'amount')::numeric;
  if amount<=0 or nullif(trim(p->>'reference'),'') is null then raise exception 'Nominal dan referensi pembayaran wajib.'; end if;
  if p->>'deposit_coa_code' is distinct from ac->>'cash' then raise exception 'Akun kas harus mapping yang disetujui.'; end if;
  if not exists(select 1 from finance_pilot_dev.finance_documents where id=(p->>'invoice_id')::uuid and finance_pilot is true and document_type='invoice' and pilot_journal_id is not null and balance>=amount) then raise exception 'Invoice tidak ditemukan atau pembayaran melebihi saldo.'; end if;
 elsif p_kind='target' then
  if (p->>'fiscal_year')::int not between 2000 and 2200 or (p->>'annual_target')::numeric<=0 then raise exception 'Tahun/target tidak valid.'; end if;
  if jsonb_array_length(p->'allocations')<12 then raise exception 'Alokasi bulanan per service wajib.'; end if;
  select sum((value->>'amount')::numeric) into total from jsonb_array_elements(p->'allocations');
  if total is distinct from (p->>'annual_target')::numeric or exists(select 1 from jsonb_array_elements(p->'allocations') a where ((a->>'amount')::numeric<0 or (a->>'amount')::numeric::text in ('NaN','Infinity','-Infinity') or a->>'amount' is null) or (a->>'month')::int not between 1 and 12 or not exists(select 1 from finance_pilot_dev.finance_next_service_lines s where s.service_line_key=a->>'service_line_key')) then raise exception 'Alokasi bulanan/service tidak valid atau tidak sama dengan annual target.'; end if;
  if exists(select 1 from jsonb_array_elements(p->'allocations') a group by a->>'month',a->>'service_line_key' having count(*)>1) or (select count(distinct a->>'month') from jsonb_array_elements(p->'allocations') a)<>12 then raise exception 'Semua bulan wajib tanpa alokasi duplikat.'; end if;
 elsif p_kind='funds' then
  if (p->>'operating_target')::numeric<=0 then raise exception 'Target operating reserve wajib positif.'; end if;
  if jsonb_array_length(p->'buckets')<>3 or (select count(distinct a->>'key') from jsonb_array_elements(p->'buckets') a)<>3 or exists(select 1 from jsonb_array_elements(p->'buckets') a where a->>'key' not in ('project','operating','emergency') or (a->>'amount') is null or (a->>'amount')::numeric<0 or (a->>'amount')::numeric::text in ('NaN','Infinity','-Infinity')) then raise exception 'Bucket project, operating, emergency wajib tanpa duplikat.'; end if;
  -- Tax and distribution payable are ledger liabilities, not duplicate reserve balances.
 elsif p_kind='budget' then
  if p->>'estimate_id' is not null and not exists(select 1 from finance_pilot_dev.finance_next_requests e where e.id=(p->>'estimate_id')::uuid and e.kind='estimate' and e.state='approved' and e.payload->>'project_id'=p->>'project_id' and (e.payload->>'amount')::numeric=(p->>'budgeted_hpp')::numeric) then raise exception 'Estimate sumber tidak cocok atau belum disetujui COO.'; end if;
  pr:=(p->>'project_id')::uuid;
  if not exists(select 1 from finance_pilot_dev.projects where id=pr and deleted_at is null) or not exists(select 1 from finance_pilot_dev.finance_next_service_lines where service_line_key=p->>'service_line_key') or (p->>'contract_value')::numeric<0 or (p->>'budgeted_hpp')::numeric<0 or (p->>'committed_cost')::numeric<0 then raise exception 'Project budget tidak valid.'; end if;
 elsif p_kind='reversal' then
  if not exists(select 1 from finance_pilot_dev.finance_next_journal_entries where id=(p->>'journal_id')::uuid and source_type in ('request','finance_document') and entry_date<=(p->>'date')::date) then raise exception 'Jurnal sumber tidak valid atau tanggal reversal sebelum sumber.'; end if;
  if exists(select 1 from finance_pilot_dev.finance_documents where pilot_journal_id=(p->>'journal_id')::uuid and document_type='invoice' and paid>0) then raise exception 'Balikkan receipt terlebih dahulu sebelum membalikkan invoice dibayar.'; end if;
 elsif p_kind='project_closure' then
  select * into ctl from finance_pilot_dev.finance_next_project_controls where project_id=(p->>'project_id')::uuid for update;
  if ctl.project_id is null or ctl.financially_closed_at is not null or nullif(p->>'handover_evidence','') is null then raise exception 'Project aktif dan bukti handover wajib.'; end if;
  if ctl.service_line_key='digital_system' and ctl.delivery_confirmed_at is null then raise exception 'Konfirmasi CTO wajib untuk project digital.'; end if;
 end if;
 if p_kind in ('target','funds','budget','reversal','project_closure','account') and nullif(trim(p->>'reason'),'') is null then raise exception 'Alasan wajib.'; end if;
 if coalesce(amount,0)::text in ('NaN','Infinity','-Infinity') then raise exception 'Nilai bukan angka finite.'; end if;
 return coalesce(amount,0);
end $$;

create or replace function finance_pilot_dev_private.template(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb:=finance_pilot_dev_private.policy()->'accounts'; ev text:=p->>'business_event'; d text; c text; amt numeric(18,2):=(p->>'amount')::numeric; cl text; sk text; pr uuid:=nullif(p->>'project_id','')::uuid; bill finance_pilot_dev.finance_next_requests%rowtype; remaining numeric;
begin
 if ev in ('manual','opening_adjustment') then return p->'lines'; end if;
 if amt is null or amt<=0 or amt::text in ('NaN','Infinity','-Infinity') then raise exception 'Nominal business event harus positif.'; end if;
 if ev='vendor_payment' then
  if nullif(p->>'vendor_bill_id','') is null then raise exception 'Sumber vendor bill wajib.'; end if;
  select * into bill from finance_pilot_dev.finance_next_requests where id=(p->>'vendor_bill_id')::uuid and kind='journal' and state='posted';
  if bill.id is null or bill.payload->>'business_event'='vendor_payment' or not exists(select 1 from finance_pilot_dev.finance_next_journal_lines where journal_entry_id=bill.result_id and coa_code=a->>'payable' and credit>0) then raise exception 'Sumber AP posted tidak ditemukan.'; end if;
  if p->>'date' is null or (p->>'date')::date<(bill.payload->>'date')::date then raise exception 'Tanggal payment harus setelah atau sama dengan bill.'; end if;
  remaining:=least(finance_pilot_dev_private.ap_balance(bill.id,(p->>'date')::date),finance_pilot_dev_private.ap_balance(bill.id,'9999-12-31'::date));
  if amt>remaining then raise exception 'Payment melebihi outstanding vendor %.',remaining; end if;
  if p->>'client' is distinct from bill.payload->>'client' or nullif(p->>'project_id','') is distinct from nullif(bill.payload->>'project_id','') then raise exception 'Vendor/project harus cocok bill sumber.'; end if;
  d:=a->>'payable'; c:=a->>'cash';
 elsif ev='advance_settlement' then
  if p->>'advance_request_id' is null or p->>'invoice_id' is null then raise exception 'Advance sumber dan invoice wajib.'; end if;
  select * into bill from finance_pilot_dev.finance_next_requests where id=(p->>'advance_request_id')::uuid and kind='journal' and state='posted' and payload->>'business_event'='customer_advance';
  if bill.id is null or bill.payload->>'client' is distinct from p->>'client' or nullif(bill.payload->>'project_id','') is distinct from nullif(p->>'project_id','') or (p->>'date')::date<(bill.payload->>'date')::date then raise exception 'Advance/client/project/tanggal tidak cocok.'; end if;
  if not exists(select 1 from finance_pilot_dev.finance_documents where id=(p->>'invoice_id')::uuid and finance_pilot is true and document_type='invoice' and pilot_journal_id is not null and client=p->>'client' and pilot_project_id is not distinct from pr and document_date<=(p->>'date')::date and balance>=amt) then raise exception 'Invoice tidak cocok atau outstanding tidak cukup.'; end if;
  if amt>least(finance_pilot_dev_private.advance_balance(bill.id,(p->>'date')::date),finance_pilot_dev_private.advance_balance(bill.id,'9999-12-31'::date)) then raise exception 'Advance tidak mencukupi.'; end if;
  d:=a->>'advance';c:=a->>'receivable';
 elsif ev='customer_advance' then d:=a->>'cash';c:=a->>'advance';
 elsif ev='owner_receivable' then d:=a->>'related_receivable';c:=a->>'cash';
   if nullif(trim(p->>'client'),'') is null or p->>'due_date' is null then raise exception 'Owner dan due date wajib untuk piutang pihak terkait.'; end if;
 elsif ev='asset_purchase' then d:=a->>'fixed_asset';c:=p->>'settlement_account';
   if nullif(trim(p->>'asset_name'),'') is null or coalesce((p->>'useful_life_months')::int,0)<=0 or nullif(trim(p->>'custodian'),'') is null then raise exception 'Nama aset, umur manfaat dan custodian wajib.'; end if;
 elsif ev in ('project_expense','operating_expense','vendor_bill') then
   d:=p->>'expense_account'; c:=case when ev='vendor_bill' then a->>'payable' else p->>'settlement_account' end;
   select account_class into cl from finance_pilot_dev.finance_coa where code=d and is_active;
   if (ev='project_expense' and cl is distinct from 'Beban Langsung Proyek') or (ev='operating_expense' and cl is distinct from 'Beban Operasional') or (ev='vendor_bill' and cl not in ('Beban Langsung Proyek','Beban Operasional')) then raise exception 'Akun expense tidak sesuai business event.'; end if;
 else raise exception 'Business event belum didukung.'; end if;
 if c is null or (ev in ('project_expense','operating_expense','vendor_bill','asset_purchase') and c not in (a->>'cash',a->>'payable')) or d is null then raise exception 'Mapping settlement tidak valid.'; end if;
 if c=a->>'payable' and (nullif(trim(p->>'client'),'') is null or nullif(p->>'due_date','') is null) then raise exception 'Vendor dan jatuh tempo wajib untuk AP.'; end if;
 if c=a->>'payable' and (p->>'due_date')::date<(p->>'date')::date then raise exception 'Jatuh tempo vendor sebelum tanggal bill.'; end if;
 if pr is not null then select service_line_key into sk from finance_pilot_dev.finance_next_project_controls where project_id=pr; end if;
 if ev in ('project_expense','customer_advance') and pr is null then raise exception 'Project wajib untuk advance/biaya langsung.'; end if;
 return jsonb_build_array(jsonb_build_object('coa_code',d,'description',p->>'description','debit',amt,'credit',0,'project_id',pr,'service_line_key',sk,'client',p->>'client'),jsonb_build_object('coa_code',c,'description',p->>'description','debit',0,'credit',amt,'project_id',pr,'service_line_key',sk,'client',p->>'client'));
end $$;

create or replace function finance_pilot_dev.finance_pilot_execute(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=finance_pilot_dev_private.actor('manage'); r finance_pilot_dev.finance_next_requests%rowtype; p jsonb; source_doc finance_pilot_dev.finance_documents%rowtype; ac jsonb:=finance_pilot_dev_private.policy()->'accounts'; eid uuid; did uuid; n text; amt numeric(18,2); sub numeric(18,2); rev numeric(18,2); tax numeric(18,2); ls jsonb; inv finance_pilot_dev.finance_documents%rowtype; sk text; pc finance_pilot_dev.finance_next_project_controls%rowtype;
begin
 select * into r from finance_pilot_dev.finance_next_requests where id=p_id for update;
 if r.id is null then raise exception 'Request tidak ditemukan.'; end if;
 if r.state='posted' then return r.result_id; end if;
 if r.kind in ('claim','estimate') then raise exception 'Pengajuan sumber wajib ditautkan ke transaksi/budget, bukan diterapkan langsung.'; end if;
 if r.state<>'approved' then raise exception 'Request belum disetujui.'; end if;
 p:=r.payload; amt:=finance_pilot_dev_private.validate(r.kind,p);
 if r.kind in ('journal','invoice','receipt') and amt>=(finance_pilot_dev_private.policy()->>'approval_threshold')::numeric and r.approved_by is null then raise exception 'Nominal mencapai threshold; diperlukan approval CEO.'; end if;
 if r.kind='account' then
 insert into finance_pilot_dev.finance_coa(code,name,account_class,cash_flow_category,default_flow,cost_nature,control_position,retained_earnings_impact) values(p->>'code',p->>'name',p->>'account_class',p->>'cash_flow_category','Non-Kas','Non-Beban','Normal','Tidak Langsung');
 elsif r.kind='journal' then
 if p->>'business_event'='advance_settlement' then
  perform 1 from finance_pilot_dev.finance_next_requests where id=(p->>'advance_request_id')::uuid for update;
  perform 1 from finance_pilot_dev.finance_documents where id=(p->>'invoice_id')::uuid for update;
  if p->'lines' is distinct from finance_pilot_dev_private.template(p) then raise exception 'Settlement advance berubah; periksa outstanding.'; end if;
 end if;
 if p->>'business_event'='vendor_payment' then
  perform 1 from finance_pilot_dev.finance_next_requests where id=(p->>'vendor_bill_id')::uuid for update;
  if p->'lines' is distinct from finance_pilot_dev_private.template(p) then raise exception 'Journal vendor payment tidak cocok sumber.'; end if;
 end if;
 -- Serialize project cost postings and budget revisions. Recheck after waiting.
 perform 1 from finance_pilot_dev.finance_next_project_controls where project_id in
 (select nullif(value->>'project_id','')::uuid from jsonb_array_elements(p->'lines')) order by project_id for update;
 if finance_pilot_dev_private.over_budget(p->'lines') and r.approved_by is null then
  raise exception 'Budget project berubah/terlampaui; diperlukan approval CEO.';
 end if;
 eid:=finance_pilot_dev_private.post((p->>'date')::date,p->>'description',p->'lines','request',r.id::text);
 if p->>'business_event'='advance_settlement' then
  select * into inv from finance_pilot_dev.finance_documents where id=(p->>'invoice_id')::uuid;
  did:=extensions.gen_random_uuid();n:=finance_pilot_dev_private.number('receipt');
  insert into finance_pilot_dev.finance_documents(id,document_type,document_number,document_date,client,project_name,status,subtotal,total,paid,balance,reference_number,linked_invoice_id,notes,items,created_by_membership_id,updated_by_membership_id,finance_pilot,pilot_project_id,pilot_service_line_key,pilot_journal_id,pilot_deposit_coa_code,pilot_evidence_path)
  values(did,'receipt',n,(p->>'date')::date,inv.client,inv.project_name,'Paid',amt,amt,amt,0,'ADV-SET-'||(p->>'reference'),inv.id,'Advance allocation; no new cash','[]',actor,actor,true,inv.pilot_project_id,inv.pilot_service_line_key,eid,null,p->>'evidence_path');
  update finance_pilot_dev.finance_documents set paid=paid+amt,balance=balance-amt,status=case when balance-amt=0 then 'Paid' else 'Partially Paid' end,updated_at=now(),updated_by_membership_id=actor where id=inv.id;
 end if;
 if p->>'business_event'='asset_purchase' then
 insert into finance_pilot_dev.finance_assets(asset_code,asset_name,category,acquisition_date,acquisition_value,custodian,useful_life_months,created_by_membership_id,pilot_journal_id) values('AST-FP-'||r.id::text,p->>'asset_name',p->>'asset_class',(p->>'date')::date,(p->>'amount')::numeric,p->>'custodian',(p->>'useful_life_months')::int,actor,eid); end if;
 elsif r.kind='invoice' then
 sub:=round((p->>'quantity')::numeric*(p->>'unit_price')::numeric,2);
 tax:=coalesce((p->>'tax')::numeric,0); rev:=amt-tax;
 if rev<=0 then raise exception 'Revenue invoice harus positif.'; end if;
 select revenue_account_code into sk from finance_pilot_dev.finance_next_service_lines where service_line_key=p->>'service_line_key';
 if not exists(select 1 from finance_pilot_dev.finance_coa where code=sk and account_class='Pendapatan' and is_active) then raise exception 'Mapping revenue service line tidak valid.'; end if;
 n:=finance_pilot_dev_private.number('invoice'); did:=extensions.gen_random_uuid();
 ls:=jsonb_build_array(jsonb_build_object('coa_code',ac->>'receivable','debit',amt,'credit',0,'project_id',p->>'project_id','service_line_key',p->>'service_line_key','client',p->>'client'),jsonb_build_object('coa_code',sk,'debit',0,'credit',rev,'project_id',p->>'project_id','service_line_key',p->>'service_line_key','client',p->>'client'));
 if tax>0 then ls:=ls||jsonb_build_array(jsonb_build_object('coa_code',ac->>'tax_payable','debit',0,'credit',tax,'project_id',p->>'project_id','service_line_key',p->>'service_line_key','client',p->>'client')); end if;
 eid:=finance_pilot_dev_private.post((p->>'date')::date,'Invoice '||n,ls,'finance_document',did::text);
 insert into finance_pilot_dev.finance_documents(id,document_type,document_number,document_date,due_date,client,client_address,project_name,status,subtotal,discount,tax,total,paid,balance,notes,items,created_by_membership_id,updated_by_membership_id,gross_total,management_fee,other_fees,installment_scheme,payment_schedule,finance_pilot,pilot_project_id,pilot_service_line_key,pilot_journal_id,pilot_evidence_path)
 values(did,'invoice',n,(p->>'date')::date,(p->>'due_date')::date,p->>'client',p->>'client_address',(select name from finance_pilot_dev.projects where id=nullif(p->>'project_id','')::uuid),'Unpaid',sub,(p->>'discount')::numeric,tax,amt,0,amt,p->>'notes',jsonb_build_array(jsonb_build_object('description',p->>'item_description','quantity',(p->>'quantity')::numeric,'unit_price',(p->>'unit_price')::numeric)),actor,actor,amt,(p->>'management_fee')::numeric,(p->>'other_fees')::numeric,p->>'installment_scheme',p->'percentages',true,nullif(p->>'project_id','')::uuid,p->>'service_line_key',eid,p->>'evidence_path');
 elsif r.kind='receipt' then
 select * into inv from finance_pilot_dev.finance_documents where id=(p->>'invoice_id')::uuid for update;
 -- Lock invoice before rechecking outstanding, and deduplicate real payment reference, not only request key.
 if amt>inv.balance then raise exception 'Pembayaran melebihi saldo terbaru.'; end if;
 if exists(select 1 from finance_pilot_dev.finance_documents where finance_pilot is true and document_type='receipt' and linked_invoice_id=inv.id and reference_number=p->>'reference') then raise exception 'Referensi pembayaran sudah digunakan.' using errcode='23505'; end if;
 n:=finance_pilot_dev_private.number('receipt'); did:=extensions.gen_random_uuid();
 ls:=jsonb_build_array(jsonb_build_object('coa_code',ac->>'cash','debit',amt,'credit',0,'project_id',inv.pilot_project_id,'service_line_key',inv.pilot_service_line_key,'client',inv.client),jsonb_build_object('coa_code',ac->>'receivable','debit',0,'credit',amt,'project_id',inv.pilot_project_id,'service_line_key',inv.pilot_service_line_key,'client',inv.client));
 eid:=finance_pilot_dev_private.post((p->>'date')::date,'Receipt '||n,ls,'finance_document',did::text);
 insert into finance_pilot_dev.finance_documents(id,document_type,document_number,document_date,client,project_name,status,subtotal,total,paid,balance,reference_number,linked_invoice_id,items,created_by_membership_id,updated_by_membership_id,finance_pilot,pilot_project_id,pilot_service_line_key,pilot_journal_id,pilot_deposit_coa_code,pilot_evidence_path)
 values(did,'receipt',n,(p->>'date')::date,inv.client,inv.project_name,'Paid',amt,amt,amt,0,p->>'reference',inv.id,'[]',actor,actor,true,inv.pilot_project_id,inv.pilot_service_line_key,eid,ac->>'cash',p->>'evidence_path');
 update finance_pilot_dev.finance_documents set paid=paid+amt,balance=balance-amt,status=case when balance-amt=0 then 'Paid' else 'Partially Paid' end,updated_at=now(),updated_by_membership_id=actor where id=inv.id;
 elsif r.kind='budget' then
 select * into pc from finance_pilot_dev.finance_next_project_controls where project_id=(p->>'project_id')::uuid for update;
 if pc.project_id is not null and pc.service_line_key<>p->>'service_line_key' and exists(select 1 from finance_pilot_dev.finance_next_journal_lines where project_id=pc.project_id) then raise exception 'Service line project posted tidak boleh diganti.'; end if;
 insert into finance_pilot_dev.finance_next_project_controls(project_id,service_line_key,contract_value,budgeted_hpp,committed_cost,approved_request_id)
 values((p->>'project_id')::uuid,p->>'service_line_key',(p->>'contract_value')::numeric,(p->>'budgeted_hpp')::numeric,(p->>'committed_cost')::numeric,p_id)
 on conflict(project_id) do update set service_line_key=excluded.service_line_key,contract_value=excluded.contract_value,budgeted_hpp=excluded.budgeted_hpp,committed_cost=excluded.committed_cost,approved_request_id=p_id;
 if p->>'estimate_id' is not null then update finance_pilot_dev.finance_next_requests set state='posted',result_id=r.id,updated_at=now() where id=(p->>'estimate_id')::uuid and kind='estimate'; end if;
 elsif r.kind='project_closure' then
 if exists(select 1 from finance_pilot_dev.finance_documents d where finance_pilot is true and pilot_project_id=(p->>'project_id')::uuid and document_type='invoice' and balance>0 and not exists(select 1 from finance_pilot_dev.finance_next_journal_entries re where re.reversal_of_id=d.pilot_journal_id)) then raise exception 'Project masih memiliki piutang; closure memerlukan penyelesaian atau write-off disetujui.'; end if;
 if exists(select 1 from finance_pilot_dev.finance_next_requests bill where bill.kind='journal' and bill.state='posted' and bill.payload->>'project_id'=p->>'project_id' and bill.payload->>'business_event'<>'vendor_payment' and finance_pilot_dev_private.ap_balance(bill.id,'9999-12-31'::date)>0) then raise exception 'Project masih memiliki outstanding vendor AP.'; end if;
 update finance_pilot_dev.finance_next_project_controls set handover_evidence=p->>'handover_evidence',financially_closed_at=now(),financially_closed_by=actor where project_id=(p->>'project_id')::uuid;
 elsif r.kind='reversal' then
 perform 1 from finance_pilot_dev.finance_next_requests bill where bill.id in (
  select case when rq.payload->>'business_event'='vendor_payment' then (rq.payload->>'vendor_bill_id')::uuid else rq.id end
  from finance_pilot_dev.finance_next_journal_entries source join finance_pilot_dev.finance_next_requests rq on source.source_type='request' and rq.id::text=source.source_id where source.id=(p->>'journal_id')::uuid
 ) order by bill.id for update;
 if exists(select 1 from finance_pilot_dev.finance_next_journal_entries source join finance_pilot_dev.finance_next_requests bill on bill.id::text=source.source_id and source.source_type='request'
  join finance_pilot_dev.finance_next_requests payment on payment.payload->>'vendor_bill_id'=bill.id::text and payment.payload->>'business_event'='vendor_payment' and payment.state='posted'
  join finance_pilot_dev.finance_next_journal_entries pe on pe.id=payment.result_id
  where source.id=(p->>'journal_id')::uuid and not exists(select 1 from finance_pilot_dev.finance_next_journal_entries re where re.reversal_of_id=pe.id)) then raise exception 'Balikkan pembayaran vendor dahulu sebelum bill.'; end if;
 if exists(select 1 from finance_pilot_dev.finance_next_journal_entries src join finance_pilot_dev.finance_next_requests adv on adv.id::text=src.source_id and src.source_type='request' join finance_pilot_dev.finance_next_requests settlement on settlement.payload->>'advance_request_id'=adv.id::text and settlement.state='posted' where src.id=(p->>'journal_id')::uuid and not exists(select 1 from finance_pilot_dev.finance_next_journal_entries re where re.reversal_of_id=settlement.result_id)) then raise exception 'Balikkan alokasi advance terlebih dahulu.'; end if;
 if exists(select 1 from finance_pilot_dev.finance_next_journal_entries where reversal_of_id=(p->>'journal_id')::uuid) then raise exception 'Jurnal sudah dibalik.'; end if;
 select jsonb_agg(jsonb_build_object('coa_code',coa_code,'description',description,'debit',credit,'credit',debit,'project_id',project_id,'service_line_key',service_line_key,'client',client) order by line_number) into ls from finance_pilot_dev.finance_next_journal_lines where journal_entry_id=(p->>'journal_id')::uuid;
 eid:=finance_pilot_dev_private.post((p->>'date')::date,'Reversal: '||(p->>'reason'),ls,'reversal',r.id::text,(p->>'journal_id')::uuid);
 select * into source_doc from finance_pilot_dev.finance_documents where pilot_journal_id=(p->>'journal_id')::uuid for update;
 if source_doc.id is not null then
  update finance_pilot_dev.finance_documents set status='Void',updated_at=now(),updated_by_membership_id=actor where id=source_doc.id;
  if source_doc.document_type='receipt' then
    update finance_pilot_dev.finance_documents set paid=paid-source_doc.total,balance=balance+source_doc.total,status=case when paid-source_doc.total=0 then 'Unpaid' else 'Partially Paid' end,updated_at=now(),updated_by_membership_id=actor where id=source_doc.linked_invoice_id;
  end if;
 end if;
 end if;
 if r.kind='journal' and p->>'business_event'='advance_settlement' then did:=null; end if;
 -- Targets/policies/funds are versioned immutable request snapshots; never maintain a second balance.
 if r.kind='journal' and p->>'claim_id' is not null then update finance_pilot_dev.finance_next_requests set state='posted',result_id=eid,updated_at=now() where id=(p->>'claim_id')::uuid and kind='claim'; end if;
 update finance_pilot_dev.finance_next_requests set state='posted',result_id=coalesce(did,eid,r.id),updated_at=now() where id=p_id;
 perform finance_pilot_dev_private.audit('request.apply',r.kind,p_id::text,to_jsonb(r),jsonb_build_object('result_id',coalesce(did,eid,r.id)));
 return coalesce(did,eid,r.id);
end $$;


-- Withdraw preserves source/audit; rejected draft has no approver or financial effect.
create or replace function finance_pilot_dev.finance_pilot_withdraw(p_id uuid) returns void language plpgsql security definer set search_path='' as $$ declare actor uuid:=finance_pilot_dev_private.actor('manage');r finance_pilot_dev.finance_next_requests%rowtype;begin select * into r from finance_pilot_dev.finance_next_requests where id=p_id for update; if r.prepared_by=actor and r.state='rejected' and r.review_note='Draft withdrawn by preparer' then return;end if;if r.id is null or r.prepared_by<>actor or r.state<>'draft' then raise exception 'Hanya draft sendiri dapat ditarik.';end if;update finance_pilot_dev.finance_next_requests set state='rejected',review_note='Draft withdrawn by preparer',updated_at=now() where id=p_id;perform finance_pilot_dev_private.audit('draft.withdraw',r.kind,p_id::text,to_jsonb(r),null);end $$;
create or replace function finance_pilot_dev.finance_pilot_update_draft(p_id uuid,p_payload jsonb,p_expected timestamptz) returns uuid language plpgsql security definer set search_path='' as $$ declare actor uuid:=finance_pilot_dev_private.actor('manage');r finance_pilot_dev.finance_next_requests%rowtype;begin select * into r from finance_pilot_dev.finance_next_requests where id=p_id for update;if r.id is null or r.prepared_by<>actor or r.state<>'draft' or jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>100000 then raise exception 'Draft tidak valid.';end if;if r.kind='journal' and p_payload->>'business_event' not in('manual','opening_adjustment') then p_payload:=p_payload||jsonb_build_object('lines',finance_pilot_dev_private.template(p_payload));end if;if r.payload=p_payload then return r.id;end if;if r.updated_at is distinct from p_expected then raise exception 'Draft berubah; refresh sebelum menyimpan.' using errcode='40001';end if;update finance_pilot_dev.finance_next_requests set payload=p_payload,updated_at=now() where id=p_id;perform finance_pilot_dev_private.audit('draft.update',r.kind,p_id::text,to_jsonb(r),p_payload);return p_id;end $$;
create or replace function finance_pilot_dev.finance_pilot_source(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare e finance_pilot_dev.finance_next_journal_entries%rowtype;begin perform finance_pilot_dev_private.actor('view');select * into e from finance_pilot_dev.finance_next_journal_entries where id=p_id;if e.id is null then raise exception 'Sumber jurnal tidak ditemukan.';end if;return jsonb_build_object('journal',to_jsonb(e),'lines',(select jsonb_agg(to_jsonb(l) order by line_number) from finance_pilot_dev.finance_next_journal_lines l where journal_entry_id=e.id),'document',(select to_jsonb(d) from finance_pilot_dev.finance_documents d where d.pilot_journal_id=e.id limit 1),'request',(select to_jsonb(r) from finance_pilot_dev.finance_next_requests r where (r.result_id=e.id or r.id::text=e.source_id or r.result_id=(select d.id from finance_pilot_dev.finance_documents d where d.pilot_journal_id=e.id limit 1)) and r.kind<>'claim' limit 1));end $$;
revoke all on function finance_pilot_dev.finance_pilot_withdraw(uuid),finance_pilot_dev.finance_pilot_update_draft(uuid,jsonb,timestamptz),finance_pilot_dev.finance_pilot_source(uuid) from public,anon;
grant execute on function finance_pilot_dev.finance_pilot_withdraw(uuid),finance_pilot_dev.finance_pilot_update_draft(uuid,jsonb,timestamptz),finance_pilot_dev.finance_pilot_source(uuid) to authenticated;
create or replace function finance_pilot_dev.finance_pilot_scoped_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=finance_pilot_dev.current_membership_id(); pk text;
begin
 if actor is null then raise exception 'Keanggotaan aktif diperlukan.' using errcode='42501'; end if;
 select p.key into pk from finance_pilot_dev.memberships m left join finance_pilot_dev.positions p on p.id=m.position_id where m.id=actor;
 return jsonb_build_object('position',pk,
 'requests',(select coalesce(jsonb_agg(to_jsonb(r) order by created_at desc),'[]'::jsonb) from finance_pilot_dev.finance_next_requests r where kind in ('claim','estimate') and prepared_by=actor),
 'projects',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'project_code',p.project_code,'name',p.name,'service_line_key',pc.service_line_key,'delivery_confirmed_at',pc.delivery_confirmed_at)),'[]'::jsonb) from finance_pilot_dev.projects p join finance_pilot_dev.project_members pm on pm.project_id=p.id and pm.membership_id=actor and pm.removed_at is null left join finance_pilot_dev.finance_next_project_controls pc on pc.project_id=p.id where p.deleted_at is null),
 'receivables',case when pk='business_development_staff' then (select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'invoice_number',d.document_number,'client',d.client,'project_id',d.pilot_project_id,'balance',d.balance,'due_date',d.due_date)),'[]'::jsonb) from finance_pilot_dev.finance_documents d where d.finance_pilot is true and d.document_type='invoice' and d.balance>0 and exists(select 1 from finance_pilot_dev.commercial_tickets ct join finance_pilot_dev.commercial_ticket_members tm on tm.ticket_id=ct.id where ct.project_id=d.pilot_project_id and tm.membership_id=actor)) else '[]'::jsonb end);
end $$;

create or replace function finance_pilot_dev.finance_pilot_submit_scoped(p_key uuid,p_kind text,p_project uuid,p_amount numeric,p_description text,p_evidence text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=finance_pilot_dev.current_membership_id(); pk text; r finance_pilot_dev.finance_next_requests%rowtype; payload jsonb; rid uuid;
begin
 if actor is null then raise exception 'Keanggotaan aktif diperlukan.' using errcode='42501'; end if;
 select p.key into pk from finance_pilot_dev.memberships m left join finance_pilot_dev.positions p on p.id=m.position_id where m.id=actor;
 if pk='ceo' or p_kind not in ('claim','estimate') or p_key is null or p_amount is null or p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity') or nullif(trim(p_description),'') is null then raise exception 'Pengajuan tidak valid; CEO approver-only.'; end if;
 if p_project is not null and not exists(select 1 from finance_pilot_dev.project_members where project_id=p_project and membership_id=actor and removed_at is null) then raise exception 'Project bukan penugasan pengguna.' using errcode='42501'; end if;
 if p_kind='estimate' and (pk is distinct from 'cto' or p_project is null) then raise exception 'Estimate hanya CTO pada project ditugaskan.' using errcode='42501'; end if;
 perform finance_pilot_dev_private.evidence(p_evidence);
 if split_part(p_evidence,'/',1)<>auth.uid()::text then raise exception 'Bukti harus milik pemohon.' using errcode='42501'; end if;
 payload:=jsonb_build_object('project_id',p_project,'amount',p_amount,'description',p_description,'evidence_path',p_evidence);
 perform pg_advisory_xact_lock(hashtextextended('finance-dev-request:'||p_key::text,0));
 select * into r from finance_pilot_dev.finance_next_requests where request_key=p_key;
 if r.id is not null then
   if r.prepared_by<>actor or r.kind<>p_kind or r.payload<>payload then raise exception 'Request key milik operasi berbeda.'; end if;
   return r.id;
 end if;
 insert into finance_pilot_dev.finance_next_requests(request_key,kind,state,payload,prepared_by,submitted_at) values(p_key,p_kind,'submitted',payload,actor,now()) returning id into rid;
 perform finance_pilot_dev_private.audit(p_kind||'.submit',p_kind,rid::text,null,payload);
 return rid;
end $$;

create or replace function finance_pilot_dev.finance_pilot_confirm_delivery(p_project_id uuid,p_evidence text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=finance_pilot_dev.current_membership_id(); pk text;
begin
 select p.key into pk from finance_pilot_dev.memberships m join finance_pilot_dev.positions p on p.id=m.position_id where m.id=actor;
 if pk is distinct from 'cto' or not exists(select 1 from finance_pilot_dev.project_members where project_id=p_project_id and membership_id=actor and removed_at is null) then raise exception 'Hanya CTO yang ditugaskan.' using errcode='42501'; end if;
 if nullif(trim(p_evidence),'') is null then raise exception 'Bukti delivery wajib.'; end if;
 update finance_pilot_dev.finance_next_project_controls set delivery_confirmed_at=now(),delivery_confirmed_by=actor,handover_evidence=p_evidence where project_id=p_project_id and service_line_key='digital_system' and financially_closed_at is null;
 if not found then raise exception 'Project digital aktif tidak ditemukan.'; end if;
 perform finance_pilot_dev_private.audit('delivery.confirm','project',p_project_id::text,null,jsonb_build_object('evidence',p_evidence));
end $$;


create or replace function finance_pilot_dev_private.can_submit_evidence() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from finance_pilot_dev.memberships m left join finance_pilot_dev.positions p on p.id=m.position_id where m.id=finance_pilot_dev.current_membership_id() and m.status='active' and p.key is distinct from 'ceo') $$;
revoke all on function finance_pilot_dev_private.can_submit_evidence() from public,anon;grant execute on function finance_pilot_dev_private.can_submit_evidence() to authenticated;
create policy finance_pilot_dev_evidence_insert_boundary on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'finance-pilot-dev-evidence' or ((storage.foldername(name))[1]=auth.uid()::text and finance_pilot_dev_private.can_submit_evidence()));
create policy finance_pilot_dev_evidence_read_boundary on storage.objects as restrictive for select to authenticated using(bucket_id<>'finance-pilot-dev-evidence' or finance_pilot_dev_private.can_view() or ((storage.foldername(name))[1]=auth.uid()::text and finance_pilot_dev_private.can_submit_evidence()));
create policy finance_pilot_dev_evidence_anon_boundary on storage.objects as restrictive for select to anon using(bucket_id<>'finance-pilot-dev-evidence');
create policy finance_pilot_dev_evidence_update_boundary on storage.objects as restrictive for update to authenticated using(bucket_id<>'finance-pilot-dev-evidence') with check(bucket_id<>'finance-pilot-dev-evidence');
create policy finance_pilot_dev_evidence_delete_boundary on storage.objects as restrictive for delete to authenticated using(bucket_id<>'finance-pilot-dev-evidence');

-- Internal parsers tolerate incomplete legacy metadata without inventing values.
create or replace function finance_pilot_dev_private.amount(v text) returns numeric language plpgsql immutable set search_path='' as $$ declare n numeric; begin n:=v::numeric; if n<0 or n::text in('NaN','Infinity','-Infinity') then return null; end if; return n; exception when others then return null; end $$;
create or replace function finance_pilot_dev_private.date_value(v text) returns date language plpgsql immutable set search_path='' as $$ begin if v !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if; return v::date; exception when others then return null; end $$;
create or replace function finance_pilot_dev_private.uuid_value(v text) returns uuid language plpgsql immutable set search_path='' as $$ begin return v::uuid; exception when others then return null; end $$;
create or replace function finance_pilot_dev_private.invoice_status(p_id uuid,p_asof date) returns text language plpgsql stable security definer set search_path='' as $$ declare i finance_pilot_dev.finance_documents%rowtype; paid numeric; begin select * into i from finance_pilot_dev.finance_documents where id=p_id and document_type='invoice' and finance_pilot is true; if i.id is null or exists(select 1 from finance_pilot_dev.finance_next_journal_entries where reversal_of_id=i.pilot_journal_id and entry_date<=p_asof) then return null; end if; select coalesce(sum(r.total),0) into paid from finance_pilot_dev.finance_documents r where r.linked_invoice_id=i.id and r.document_date<=p_asof and r.pilot_journal_id is not null and not exists(select 1 from finance_pilot_dev.finance_next_journal_entries where reversal_of_id=r.pilot_journal_id and entry_date<=p_asof); return case when paid=i.total then 'paid' when i.due_date<p_asof then 'overdue' when paid>0 then 'partially_paid' else 'issued' end; end $$;
create or replace function finance_pilot_dev_private.project_matches(p_id uuid,f jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select (nullif(f->>'outcome','') is null and nullif(f->>'source','') is null and nullif(f->>'lost_reason','') is null) or exists(select 1 from finance_pilot_dev.pipeline_leads l left join finance_pilot_dev.commercial_tickets ct on ct.pipeline_lead_id=l.id where coalesce(ct.project_id,finance_pilot_dev_private.uuid_value(l.extra_data->>'finance_project_id'))=p_id and (nullif(f->>'outcome','') is null or l.stage=f->>'outcome') and (nullif(f->>'source','') is null or l.lead_source=f->>'source') and (nullif(f->>'lost_reason','') is null or l.win_loss_reason=f->>'lost_reason'));
$$;
revoke all on function finance_pilot_dev_private.amount(text),finance_pilot_dev_private.date_value(text),finance_pilot_dev_private.uuid_value(text),finance_pilot_dev_private.invoice_status(uuid,date),finance_pilot_dev_private.project_matches(uuid,jsonb) from public,anon,authenticated;
-- Snapshot uses decimal Postgres totals, the existing posted ledger and canonical documents.
-- All aggregates precede UI limits. No conversion of legacy cash transactions to accrual journals.
create or replace function finance_pilot_dev.finance_pilot_dashboard(
 p_view text default 'MTD',p_asof date default (now() at time zone 'Asia/Jakarta')::date,
 p_start date default null,p_end date default null,p_service text default null,p_project uuid default null,
 p_client text default null,p_compare text default 'Previous Period',p_payment text default null,p_filters jsonb default '{}'::jsonb
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare pol jsonb:=finance_pilot_dev_private.policy(); ac jsonb; v_start_date date; v_end_date date; v_fy_start date; v_fs int; v_fy int;
 v_cmp_start date; v_cmp_end date; result jsonb;
begin
 perform finance_pilot_dev_private.actor('view');
 if jsonb_typeof(p_filters) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_filters) k where k not in ('pic','account','bank','outcome','source','lost_reason')) then raise exception 'Filter tambahan tidak valid.'; end if; ac:=pol->'accounts'; v_fs:=(pol->>'fiscal_start')::int;
 if p_view not in ('MTD','QTD','YTD','Custom') or p_compare not in ('Previous Period','Previous Year','Budget','Target') or p_asof is null then raise exception 'Filter tidak valid.'; end if;
 v_end_date:=case when p_view='Custom' then p_end else p_asof end;
 p_asof:=v_end_date;
 if v_fs is not null then
 v_fy:=extract(year from p_asof)::int-case when extract(month from p_asof)<v_fs then 1 else 0 end;
 v_fy_start:=make_date(v_fy,v_fs,1);
 end if;
 v_start_date:=case p_view when 'MTD' then date_trunc('month',p_asof)::date
 when 'QTD' then case when v_fs is null then null else (v_fy_start+((floor(((extract(year from p_asof)-extract(year from v_fy_start))*12+extract(month from p_asof)-extract(month from v_fy_start))/3)*3)::int||' months')::interval)::date end
 when 'YTD' then v_fy_start else p_start end;
 if p_view='Custom' and (p_start is null or p_end is null or p_start>p_end) then raise exception 'Custom range wajib valid.'; end if;
 if p_service is not null and not exists(select 1 from finance_pilot_dev.finance_next_service_lines where service_line_key=p_service) then raise exception 'Service line tidak valid.'; end if;
 if p_compare='Previous Year' then v_cmp_start:=(v_start_date-interval '1 year')::date; v_cmp_end:=(v_end_date-interval '1 year')::date;
 elsif p_view='MTD' then v_cmp_start:=(v_start_date-interval '1 month')::date; v_cmp_end:=least((v_end_date-interval '1 month')::date,(v_start_date-interval '1 day')::date);
 elsif p_view='QTD' then v_cmp_start:=(v_start_date-interval '3 months')::date; v_cmp_end:=(v_end_date-interval '3 months')::date;
 elsif p_view='YTD' then v_cmp_start:=(v_start_date-interval '1 year')::date; v_cmp_end:=(v_end_date-interval '1 year')::date;
 else v_cmp_end:=v_start_date-1; v_cmp_start:=v_cmp_end-(v_end_date-v_start_date); end if;

 with
 all_lines as (
 select l.*,e.created_by_membership_id,e.entry_date,e.description as entry_description,e.source_type,e.source_id,e.reversal_of_id,
 coalesce(case when d.document_type='invoice' then d.id else d.linked_invoice_id end,case when od.document_type='invoice' then od.id else od.linked_invoice_id end) as invoice_id,c.name as account_name,c.account_class,c.cash_flow_category,
 case when coalesce(r.payload->>'business_event',orig.payload->>'business_event')='vendor_payment' then (select bill.payload->>'business_event' from finance_pilot_dev.finance_next_requests bill where bill.id::text=coalesce(r.payload->>'vendor_bill_id',orig.payload->>'vendor_bill_id'))
 else coalesce(r.payload->>'business_event',orig.payload->>'business_event',case when coalesce(d.document_type,od.document_type)='receipt' then 'customer_receipt' when coalesce(d.document_type,od.document_type)='invoice' then 'client_invoice' end) end as business_event
 from finance_pilot_dev.finance_next_journal_lines l join finance_pilot_dev.finance_next_journal_entries e on e.id=l.journal_entry_id
 join finance_pilot_dev.finance_coa c on c.code=l.coa_code
 left join finance_pilot_dev.finance_next_requests r on r.id::text=e.source_id and e.source_type='request'
 left join finance_pilot_dev.finance_documents d on d.id::text=e.source_id and e.source_type='finance_document'
 left join finance_pilot_dev.finance_next_journal_entries oe on oe.id=e.reversal_of_id
 left join finance_pilot_dev.finance_documents od on od.id::text=oe.source_id and oe.source_type='finance_document'
 left join finance_pilot_dev.finance_next_requests orig on orig.id::text=oe.source_id and oe.source_type='request'
 where e.status='posted'
 ), dim as (
 select * from all_lines where finance_pilot_dev_private.project_matches(project_id,p_filters)
 and (nullif(p_filters->>'pic','') is null or created_by_membership_id=nullif(p_filters->>'pic','')::uuid or exists(select 1 from finance_pilot_dev.project_members pm where pm.project_id=all_lines.project_id and pm.membership_id=nullif(p_filters->>'pic','')::uuid and pm.removed_at is null))
 and (nullif(p_filters->>'account','') is null or coa_code=p_filters->>'account')
 and (nullif(p_filters->>'bank','') is null or exists(select 1 from finance_pilot_dev.finance_next_journal_lines bl where bl.journal_entry_id=all_lines.journal_entry_id and bl.coa_code=p_filters->>'bank'))
 and (p_payment is null or finance_pilot_dev_private.invoice_status(invoice_id,v_end_date)=p_payment)
 and (p_service is null or service_line_key=p_service) and (p_project is null or project_id=p_project) and (p_client is null or client=p_client)
 ), period_lines as (select * from dim where entry_date between v_start_date and v_end_date),
 income as (
 select coalesce(sum(credit-debit) filter(where account_class='Pendapatan'),0) as revenue,
 coalesce(sum(debit-credit) filter(where account_class='Beban Langsung Proyek'),0) as hpp,
 coalesce(sum(debit-credit) filter(where account_class='Beban Operasional'),0) as opex,
 coalesce(sum(debit-credit) filter(where account_class='Beban Non-Operasional'),0) as other,
 coalesce(sum(debit-credit) filter(where account_class='Pajak'),0) as tax from period_lines
 ), prior as (
 select coalesce(sum(credit-debit) filter(where account_class='Pendapatan'),0) as revenue,
 coalesce(sum(debit-credit) filter(where account_class='Beban Langsung Proyek'),0) as hpp,
 coalesce(sum(debit-credit) filter(where account_class='Beban Operasional'),0) as opex,coalesce(sum(debit-credit) filter(where account_class='Beban Non-Operasional'),0) as other,coalesce(sum(debit-credit) filter(where account_class='Pajak'),0) as tax from dim where entry_date between v_cmp_start and v_cmp_end
 ), balances as (
 select c.code,c.name,c.account_class,coalesce(sum(d.debit-d.credit) filter(where d.entry_date<v_start_date),0) as opening,
 coalesce(sum(d.debit) filter(where d.entry_date between v_start_date and v_end_date),0) as debit,
 coalesce(sum(d.credit) filter(where d.entry_date between v_start_date and v_end_date),0) as credit,
 coalesce(sum(d.debit-d.credit) filter(where d.entry_date<=v_end_date),0) as closing,coalesce(sum(d.debit-d.credit) filter(where d.entry_date<=v_cmp_end),0) as prior_closing
 from finance_pilot_dev.finance_coa c left join dim d on d.coa_code=c.code where c.is_active and c.account_class not like 'Kontrol%' group by c.code,c.name,c.account_class
 ), liquidity as (
 select coalesce(sum(debit-credit) filter(where coa_code=any(finance_pilot_dev_private.cash_codes())),0) as book_cash,
 coalesce(sum(credit-debit) filter(where coa_code=ac->>'payable'),0) as payables,
 coalesce(sum(credit-debit) filter(where coa_code=ac->>'tax_payable'),0) as taxes,
 coalesce(sum(credit-debit) filter(where coa_code=ac->>'distribution_payable'),0) as distribution,
 md5(coalesce(string_agg(id::text,',' order by id) filter(where coa_code=any(finance_pilot_dev_private.cash_codes())),'')) as fingerprint
 from all_lines where entry_date<=v_end_date
 ), recon as (
 select r.* from finance_pilot_dev.finance_next_reconciliations r where r.bank_coa_code=any(finance_pilot_dev_private.cash_codes()) and r.as_of_date=v_end_date order by r.created_at desc limit 1
 ), fund_plan as (
 select payload from finance_pilot_dev.finance_next_requests where kind='funds' and state='posted' and (payload->>'as_of')::date<=v_end_date order by (payload->>'as_of')::date desc,reviewed_at desc limit 1
 ), buckets as (
 select value->>'key' as key,value->>'label' as label,(value->>'amount')::numeric as amount,true as restricted from fund_plan,jsonb_array_elements(payload->'buckets')
 ), inv as (
 select d.*,coalesce((select sum(r.total) from finance_pilot_dev.finance_documents r where r.finance_pilot is true and r.document_type='receipt' and r.linked_invoice_id=d.id and r.document_date<=v_end_date and r.pilot_journal_id is not null and not exists(select 1 from finance_pilot_dev.finance_next_journal_entries re where re.reversal_of_id=r.pilot_journal_id and re.entry_date<=v_end_date)),0) as asof_paid
 from finance_pilot_dev.finance_documents d where d.finance_pilot is true and d.document_type='invoice' and d.pilot_journal_id is not null and d.document_date<=v_end_date and not exists(select 1 from finance_pilot_dev.finance_next_journal_entries re where re.reversal_of_id=d.pilot_journal_id and re.entry_date<=v_end_date)
 and finance_pilot_dev_private.project_matches(d.pilot_project_id,p_filters)
 and (nullif(p_filters->>'pic','') is null or d.created_by_membership_id=nullif(p_filters->>'pic','')::uuid or exists(select 1 from finance_pilot_dev.project_members pm where pm.project_id=d.pilot_project_id and pm.membership_id=nullif(p_filters->>'pic','')::uuid and pm.removed_at is null))
 and (nullif(p_filters->>'account','') is null or exists(select 1 from finance_pilot_dev.finance_next_journal_lines l where l.journal_entry_id=d.pilot_journal_id and l.coa_code=p_filters->>'account'))
 and (nullif(p_filters->>'bank','') is null or exists(select 1 from finance_pilot_dev.finance_documents br where br.linked_invoice_id=d.id and br.pilot_deposit_coa_code=p_filters->>'bank' and br.document_date<=v_end_date))
 and (p_service is null or d.pilot_service_line_key=p_service) and (p_project is null or d.pilot_project_id=p_project) and (p_client is null or d.client=p_client)
 ), invoice_rows as (
 select *,total-asof_paid as asof_balance,case when asof_paid=total then 'paid' when due_date<v_end_date then 'overdue' when asof_paid>0 then 'partially_paid' else 'issued' end as asof_status from inv
 ), selected_invoices as (select * from invoice_rows where p_payment is null or asof_status=p_payment),
 rec as (
 select r.* from finance_pilot_dev.finance_documents r join selected_invoices i on i.id=r.linked_invoice_id where r.finance_pilot is true and r.document_type='receipt' and r.pilot_journal_id is not null and (nullif(p_filters->>'bank','') is null or r.pilot_deposit_coa_code=p_filters->>'bank') and r.document_date between v_start_date and v_end_date and not exists(select 1 from finance_pilot_dev.finance_next_journal_entries re where re.reversal_of_id=r.pilot_journal_id and re.entry_date<=v_end_date)
 ), vendor_bills_all as (
 select rq.id,rq.payload->>'reference' as reference,rq.payload->>'client' as vendor,(rq.payload->>'date')::date as bill_date,
 (rq.payload->>'due_date')::date as due_date,nullif(rq.payload->>'project_id','')::uuid as project_id,
 (select service_line_key from finance_pilot_dev.finance_next_project_controls where project_id=nullif(rq.payload->>'project_id','')::uuid) as service_line_key,
 rq.result_id as journal_id,rq.payload->>'evidence_path' as evidence_path,
 (select sum(l.credit-l.debit) from finance_pilot_dev.finance_next_journal_lines l where l.journal_entry_id=rq.result_id and l.coa_code=ac->>'payable') as amount,
 finance_pilot_dev_private.ap_balance(rq.id,v_end_date) as balance
 from finance_pilot_dev.finance_next_requests rq where rq.kind='journal' and rq.state='posted' and rq.payload->>'business_event'<>'vendor_payment'
 and (rq.payload->>'date')::date<=v_end_date and exists(select 1 from finance_pilot_dev.finance_next_journal_lines where journal_entry_id=rq.result_id and coa_code=ac->>'payable' and credit>0)
 ), vendor_bills as (
 select * from vendor_bills_all where finance_pilot_dev_private.project_matches(project_id,p_filters) and (p_service is null or service_line_key=p_service) and (p_project is null or project_id=p_project) and (p_client is null or vendor=p_client)
 ), target as (
 select r.* from finance_pilot_dev.finance_next_requests r where r.kind='target' and r.state='posted' and (r.payload->>'fiscal_year')::int=v_fy order by reviewed_at desc,id limit 1
 ), original_target as (
 select payload from finance_pilot_dev.finance_next_requests where kind='target' and state='posted' and (payload->>'fiscal_year')::int=v_fy order by reviewed_at,id limit 1
 ), monthly as (
 select month,coalesce((select sum((a->>'amount')::numeric) from target,jsonb_array_elements(payload->'allocations') a where (a->>'month')::int=month and (p_service is null or a->>'service_line_key'=p_service)),0) as target,
 coalesce((select sum(credit-debit) from dim where account_class='Pendapatan' and entry_date>=(v_fy_start+((month-1)||' months')::interval)::date and entry_date<(v_fy_start+(month||' months')::interval)::date and entry_date<=p_asof),0) as actual
 from generate_series(1,12) month
 ), outcome as (
 select l.id,l.lead_code,l.account_name,case when l.stage in('Won','Closed Won','Deal','Paid/Booked') then 'Won' when l.stage in('Lost','Closed Lost','Tidak Jadi') then 'Lost' else l.stage end as stage,l.business_unit,l.lead_source,finance_pilot_dev_private.amount(l.extra_data->>'proposal_value') as proposal_value,finance_pilot_dev_private.amount(l.extra_data->>'won_value') as won_value,l.win_loss_reason,l.won_at,l.lost_at,l.proposal_date,coalesce(ct.project_id,finance_pilot_dev_private.uuid_value(l.extra_data->>'finance_project_id')) as project_id,coalesce((select owner_membership_id from finance_pilot_dev.activities where id=l.activity_id),finance_pilot_dev_private.uuid_value(l.extra_data->>'finance_owner_id')) as owner_id,
 case when l.stage in('Won','Closed Won','Deal','Paid/Booked') then coalesce(finance_pilot_dev_private.date_value(l.extra_data->>'won_date'),(l.won_at at time zone 'Asia/Jakarta')::date) when l.stage in('Lost','Closed Lost','Tidak Jadi') then coalesce(finance_pilot_dev_private.date_value(l.extra_data->>'lost_date'),(l.lost_at at time zone 'Asia/Jakarta')::date) else l.proposal_date end as outcome_date,
 coalesce((select service_line_key from finance_pilot_dev.finance_next_service_lines where service_line_key=l.extra_data->>'finance_service_line_key'),s.service_line_key) as service_line_key
 from finance_pilot_dev.pipeline_leads l left join finance_pilot_dev.finance_next_service_lines s on s.label=l.business_unit
 left join lateral(select project_id from finance_pilot_dev.commercial_tickets where pipeline_lead_id=l.id order by created_at desc limit 1) ct on true
 where l.stage in ('Proposal','Proposal / Offer','Decision','Proposal Sent','Submitted','Negotiation','Won','Closed Won','Deal','Paid/Booked','Lost','Closed Lost','Tidak Jadi','On Hold','Cancelled')
 ), selected_outcome as (
 select * from outcome where (nullif(p_filters->>'pic','') is null or owner_id=nullif(p_filters->>'pic','')::uuid)
 and (nullif(p_filters->>'outcome','') is null or stage=p_filters->>'outcome') and (nullif(p_filters->>'source','') is null or lead_source=p_filters->>'source') and (nullif(p_filters->>'lost_reason','') is null or win_loss_reason=p_filters->>'lost_reason') and outcome_date between v_start_date and v_end_date and (p_service is null or service_line_key=p_service) and (p_project is null or project_id=p_project) and (p_client is null or account_name=p_client)
 ), service_stats as (
 select s.service_line_key,s.label,coalesce(sum(d.credit-d.debit) filter(where d.account_class='Pendapatan'),0) as revenue,coalesce(sum(d.debit-d.credit) filter(where d.account_class='Beban Langsung Proyek'),0) as hpp
 from finance_pilot_dev.finance_next_service_lines s left join period_lines d on d.service_line_key=s.service_line_key group by s.service_line_key,s.label
 ), journal_rows as (
 select e.*,e.source_id as source_reference,(select d.id from finance_pilot_dev.finance_documents d where d.pilot_journal_id=e.id) as document_id, (select jsonb_agg(jsonb_build_object('line_number',l.line_number,'coa_code',l.coa_code,'description',l.description,'debit',l.debit,'credit',l.credit,'project_id',l.project_id,'project_name',l.project_name,'client',l.client,'service_line_key',l.service_line_key) order by l.line_number) from finance_pilot_dev.finance_next_journal_lines l where l.journal_entry_id=e.id) as finance_next_journal_lines
 from finance_pilot_dev.finance_next_journal_entries e where e.id in (select journal_entry_id from period_lines) order by e.entry_date desc,e.created_at desc
 ), project_rows as (
 select p.id,p.project_code,p.name,p.client_name,coalesce(pc.service_line_key,'unmapped') as service_line_key,p.status,
 pc.contract_value,pc.budgeted_hpp,pc.committed_cost,pc.financially_closed_at,pc.delivery_confirmed_at,
 coalesce((select sum(credit-debit) from period_lines where project_id=p.id and account_class='Pendapatan'),0) as recognized_revenue,
 coalesce((select sum(debit-credit) from period_lines where project_id=p.id and account_class='Beban Langsung Proyek'),0) as actual_hpp,
 coalesce((select sum(total) from selected_invoices where pilot_project_id=p.id and document_date between v_start_date and v_end_date),0) as billed_amount,
 coalesce((select sum(debit-credit) from period_lines where project_id=p.id and coa_code=any(finance_pilot_dev_private.cash_codes()) and business_event in('customer_receipt','customer_advance')),0) as cash_collected
 from finance_pilot_dev.projects p left join finance_pilot_dev.finance_next_project_controls pc on pc.project_id=p.id where p.deleted_at is null and finance_pilot_dev_private.project_matches(p.id,p_filters) and (nullif(p_filters->>'pic','') is null or exists(select 1 from finance_pilot_dev.project_members pm where pm.project_id=p.id and pm.membership_id=nullif(p_filters->>'pic','')::uuid and pm.removed_at is null)) and (p_service is null or pc.service_line_key=p_service) and (p_project is null or p.id=p_project) and (p_client is null or p.client_name=p_client)
 ), cashflow as (
 select coalesce(sum(debit-credit) filter(where business_event not in ('asset_purchase','owner_receivable','opening_adjustment')),0) as operating,
 coalesce(sum(debit-credit) filter(where business_event in ('asset_purchase','owner_receivable')),0) as investing,
 coalesce(sum(debit-credit) filter(where business_event='opening_adjustment'),0) as financing
 from period_lines where coa_code=any(finance_pilot_dev_private.cash_codes())
 ), report as (
 select jsonb_build_object(
 'income',jsonb_build_array(jsonb_build_object('label','Recognized Revenue','account_class','Pendapatan','value',revenue,'comparison',case when p_compare='Target' then (select sum(target) from monthly where (v_fy_start+((month-1)||' months')::interval)::date between date_trunc('month',v_start_date)::date and v_end_date) when p_compare='Budget' then null else pr.prev_revenue end),jsonb_build_object('label','Direct Project Cost / HPP','account_class','Beban Langsung Proyek','value',-hpp,'comparison',case when p_compare='Budget' then -(select sum(budgeted_hpp) from project_rows) when p_compare='Target' then null else -pr.prev_hpp end),jsonb_build_object('label','Gross Profit','value',revenue-hpp,'comparison',case when p_compare in('Budget','Target') then null else pr.prev_revenue-pr.prev_hpp end),jsonb_build_object('label','Operating Expense','account_class','Beban Operasional','value',-opex,'comparison',case when p_compare in('Budget','Target') then null else -pr.prev_opex end),jsonb_build_object('label','Operating Profit','value',revenue-hpp-opex,'comparison',case when p_compare in('Budget','Target') then null else pr.prev_revenue-pr.prev_hpp-pr.prev_opex end),jsonb_build_object('label','Other Expense','value',-other,'comparison',case when p_compare in('Budget','Target') then null else -pr.prev_other end),jsonb_build_object('label','Tax Expense','value',-tax,'comparison',case when p_compare in('Budget','Target') then null else -pr.prev_tax end),jsonb_build_object('label','Net Profit','value',revenue-hpp-opex-other-tax,'comparison',case when p_compare in('Budget','Target') then null else pr.prev_revenue-pr.prev_hpp-pr.prev_opex-pr.prev_other-pr.prev_tax end)),
 'position',coalesce((select jsonb_agg(jsonb_build_object('label',code||' · '||name,'value',case when account_class='Aset' then closing else -closing end,'coa_code',code,'comparison',case when account_class='Aset' then prior_closing else -prior_closing end)) from balances where account_class in ('Aset','Kewajiban','Ekuitas')), '[]'::jsonb)||jsonb_build_array(jsonb_build_object('label','Unclosed retained profit','value',coalesce((select sum(case when account_class='Pendapatan' then credit-debit else credit-debit end) from dim where entry_date<=v_end_date and account_class in ('Pendapatan','Beban Langsung Proyek','Beban Operasional','Beban Non-Operasional','Pajak')),0))),
 'trial',coalesce((select jsonb_agg(jsonb_build_object('label',code||' · '||name,'value',closing,'coa_code',code,'opening',opening,'debit',debit,'credit',credit)) from balances),'[]'::jsonb),
 'cashflow',jsonb_build_array(jsonb_build_object('label','Operating activities','value',cf.operating),jsonb_build_object('label','Investing activities','value',cf.investing),jsonb_build_object('label','Financing activities','value',cf.financing),jsonb_build_object('label','Net cash movement','value',cf.operating+cf.investing+cf.financing)),
 'equity',coalesce((select jsonb_agg(jsonb_build_object('label',code||' · '||name,'value',-closing,'opening',-opening,'change',credit-debit,'coa_code',code)) from balances where account_class='Ekuitas'),'[]'::jsonb)||jsonb_build_array(jsonb_build_object('label','Period retained profit','value',revenue-hpp-opex-other-tax)),
 'aging',coalesce((select jsonb_agg(jsonb_build_object('label','AR · '||document_number||' · '||client,'value',asof_balance,'due_date',due_date,'days_overdue',greatest(v_end_date-due_date,0),'aging_bucket',case when due_date>=v_end_date then 'Current' when v_end_date-due_date<=30 then '1–30' when v_end_date-due_date<=60 then '31–60' when v_end_date-due_date<=90 then '61–90' else '>90' end,'document_id',id,'coa_code',ac->>'receivable')) from selected_invoices where asof_balance>0),'[]'::jsonb)
 ||coalesce((select jsonb_agg(jsonb_build_object('label','AP · '||reference||' · '||vendor,'value',balance,'due_date',due_date,'days_overdue',greatest(v_end_date-due_date,0),'aging_bucket',case when due_date>=v_end_date then 'Current' when v_end_date-due_date<=30 then '1–30' when v_end_date-due_date<=60 then '31–60' when v_end_date-due_date<=90 then '61–90' else '>90' end,'request_id',id,'journal_id',journal_id,'coa_code',ac->>'payable')) from vendor_bills where balance>0),'[]'::jsonb)
 ) as data from income cross join cashflow cf cross join (select revenue as prev_revenue,hpp as prev_hpp,opex as prev_opex,other as prev_other,tax as prev_tax from prior) pr
 )
 select jsonb_build_object(
 'period',jsonb_build_object('start',v_start_date,'end',v_end_date,'view',p_view,'compare',p_compare,'comparison_start',v_cmp_start,'comparison_end',v_cmp_end,'fiscal_year',v_fy,'fiscal_start',v_fy_start),
 'updated_at',now(),'policy',pol,'filters',p_filters,'cash_scope','Company-wide as-of; dimensions do not reallocate company bank balances',
 'accounts',(select coalesce(jsonb_agg(to_jsonb(c) order by c.code),'[]'::jsonb) from finance_pilot_dev.finance_coa c where is_active),
 'services',(select jsonb_agg(to_jsonb(s) order by service_line_key) from finance_pilot_dev.finance_next_service_lines s),
 'project_options',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'project_code',p.project_code,'name',p.name,'client_name',p.client_name,'service_line_key',pc.service_line_key,'status',p.status)),'[]'::jsonb) from finance_pilot_dev.projects p left join finance_pilot_dev.finance_next_project_controls pc on pc.project_id=p.id where deleted_at is null),
 'projects',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from project_rows p),
 'journals',(select coalesce(jsonb_agg(to_jsonb(j)),'[]'::jsonb) from journal_rows j),
 'journal_count',(select count(distinct journal_entry_id) from period_lines),
 'posted_value',(select coalesce(sum(debit),0) from period_lines),
 'periods',(select coalesce(jsonb_agg(to_jsonb(p) order by period_month desc),'[]'::jsonb) from finance_pilot_dev.finance_next_periods p),
 'requests',(select coalesce(jsonb_agg(to_jsonb(r) order by created_at desc),'[]'::jsonb) from finance_pilot_dev.finance_next_requests r where state in ('draft','submitted','approved','rejected') or (kind='target' and (payload->>'fiscal_year')::int=v_fy)),
 'invoices',(select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('invoice_number',document_number,'invoice_date',document_date,'service_line_key',pilot_service_line_key,'project_id',pilot_project_id,'management_fee',management_fee,'paid',asof_paid,'balance',asof_balance,'status',asof_status,'finance_next_invoice_items',(select jsonb_agg(a||jsonb_build_object('line_total',round((a->>'quantity')::numeric*(a->>'unit_price')::numeric,2))) from jsonb_array_elements(items) a))),'[]'::jsonb) from selected_invoices d),
 'vendor_bills',(select coalesce(jsonb_agg(to_jsonb(v) order by due_date,id),'[]'::jsonb) from vendor_bills v),
 'receipts',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('receipt_number',document_number,'invoice_id',linked_invoice_id,'receipt_date',document_date,'amount',total,'deposit_coa_code',pilot_deposit_coa_code,'payment_reference',reference_number)),'[]'::jsonb) from rec r),
 'totals',(select to_jsonb(i)||jsonb_build_object('gross_profit',revenue-hpp,'operating_profit',revenue-hpp-opex,'net_profit',revenue-hpp-opex-other-tax,
 'billed',(select coalesce(sum(total),0) from selected_invoices where document_date between v_start_date and v_end_date),'collected',(select coalesce(sum(debit-credit),0) from period_lines where coa_code=any(finance_pilot_dev_private.cash_codes()) and business_event in ('customer_receipt','customer_advance')),'outstanding',(select coalesce(sum(asof_balance),0) from selected_invoices)) from income i),
 'comparison',(select to_jsonb(p)||jsonb_build_object('basis',p_compare,'hpp_budget',(select coalesce(sum(budgeted_hpp),0) from project_rows),'target_revenue',(select sum(target) from monthly where (v_fy_start+((month-1)||' months')::interval)::date between date_trunc('month',v_start_date)::date and v_end_date)) from prior p),
 'service_stats',(select jsonb_agg(to_jsonb(s) order by revenue desc) from service_stats s),
 'cash',(select to_jsonb(l)||jsonb_build_object('banks',finance_pilot_dev_private.bank_status(v_end_date),'reconciled',coalesce((select bool_and((b->>'reconciled')::boolean) from jsonb_array_elements(finance_pilot_dev_private.bank_status(v_end_date)) b),false),'reconciliation',(select to_jsonb(r) from recon r),'buckets',(select coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) from buckets b),'operating_target',(select (payload->>'operating_target')::numeric from fund_plan),'restrictions',(select coalesce(sum(amount),0) from buckets),'free_cash',case when coalesce((select bool_and((b->>'reconciled')::boolean) from jsonb_array_elements(finance_pilot_dev_private.bank_status(v_end_date)) b),false) and exists(select 1 from fund_plan) then l.book_cash-(select coalesce(sum(amount),0) from buckets)-l.payables-l.taxes-l.distribution else null end) from liquidity l),
 'target',jsonb_build_object('latest',(select to_jsonb(t) from target t),'original',(select payload from original_target),'monthly',(select jsonb_agg(to_jsonb(m) order by month) from monthly m),'actual',(select coalesce(sum(credit-debit),0) from dim where account_class='Pendapatan' and entry_date between v_fy_start and p_asof),'annual_scope',(select sum(target) from monthly),'ytd_target',(select sum(target) from monthly where (v_fy_start+((month-1)||' months')::interval)::date<=p_asof),'cash_collected',(select coalesce(sum(debit-credit),0) from dim where coa_code=any(finance_pilot_dev_private.cash_codes()) and business_event in('customer_receipt','customer_advance') and entry_date between v_fy_start and p_asof),'elapsed_months',case when v_fy_start is null then null else ((extract(year from p_asof)-extract(year from v_fy_start))*12+extract(month from p_asof)-extract(month from v_fy_start)+1)::int end,'allocation_scope',case when p_project is not null or p_client is not null or p_payment is not null or p_filters<>'{}'::jsonb then 'Target allocated by fiscal month/service only; additional dimensions have no allocated target' else 'Fiscal month/service allocations' end),
 'reports',(select data from report),
 'outcomes',(select coalesce(jsonb_agg(to_jsonb(o)),'[]'::jsonb) from selected_outcome o),
 'advances',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'reference',r.payload->>'reference','client',r.payload->>'client','project_id',r.payload->>'project_id','balance',finance_pilot_dev_private.advance_balance(r.id,v_end_date))),'[]'::jsonb) from finance_pilot_dev.finance_next_requests r where kind='journal' and state='posted' and payload->>'business_event'='customer_advance' and (payload->>'date')::date<=v_end_date),
 'filter_options',jsonb_build_object('bank_accounts',(select coalesce(jsonb_agg(jsonb_build_object('bank_account',bank_account)),'[]'::jsonb) from finance_pilot_dev.finance_bank_accounts),'pics',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',coalesce(full_name,left(id::text,8)))),'[]'::jsonb) from finance_pilot_dev.memberships where status='active'),'sources',(select coalesce(jsonb_agg(distinct lead_source) filter(where lead_source is not null),'[]'::jsonb) from finance_pilot_dev.pipeline_leads),'lost_reasons',jsonb_build_array('Price or Budget','Competitor','Scope Fit','Timing','No Response','Client Cancelled','Internal Capacity','Other')),
 'history',(select coalesce(jsonb_agg(to_jsonb(r) order by reviewed_at desc),'[]'::jsonb) from finance_pilot_dev.finance_next_requests r where kind in('policy','target','funds','budget','account') and state='posted'),
 'quality',jsonb_build_object('policy_configured',pol is not null,'unmapped_legacy_count',(select count(*) from finance_pilot_dev.finance_transactions t where not exists(select 1 from finance_pilot_dev.finance_next_legacy_mappings m where m.source_type='finance_transaction' and m.source_id=t.id::text)),
 'ledger_difference',(select coalesce(sum(debit-credit),0) from all_lines),'unallocated_ap',(select payables-(select coalesce(sum(balance),0) from vendor_bills_all) from liquidity),'unmapped_deals',(select count(*) from outcome where service_line_key is null or (stage in ('Won','Lost') and outcome_date is null)),
 'scope','Pilot ledger only; historical finance has not been converted or reconciled. No cutover.')
 ) into result;
 return result;
end $$;
revoke all on function finance_pilot_dev.finance_pilot_dashboard(text,date,date,date,text,uuid,text,text,text,jsonb) from public,anon;
grant execute on function finance_pilot_dev.finance_pilot_dashboard(text,date,date,date,text,uuid,text,text,text,jsonb) to authenticated;

-- The existing pipeline remains the only deal record. Legacy rows are never backfilled.
create or replace function finance_pilot_dev.finance_pilot_commercial_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=finance_pilot_dev.current_membership_id();pk text;begin
 select p.key into pk from finance_pilot_dev.memberships m join finance_pilot_dev.positions p on p.id=m.position_id where m.id=actor and m.status='active';
 if actor is null or coalesce(pk,'') not in('coo','ceo','business_development_staff') then raise exception 'Akses commercial ditolak.' using errcode='42501';end if;
 return jsonb_build_object('leads',(select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('owner_id',a.owner_membership_id)),'[]'::jsonb) from finance_pilot_dev.pipeline_leads l join finance_pilot_dev.activities a on a.id=l.activity_id where pk in('coo','ceo') or a.owner_membership_id=actor),'projects',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'project_code',p.project_code)),'[]'::jsonb) from finance_pilot_dev.projects p where p.deleted_at is null and (pk in('coo','ceo') or exists(select 1 from finance_pilot_dev.project_members pm where pm.project_id=p.id and pm.membership_id=actor and pm.removed_at is null))),'services',(select jsonb_agg(to_jsonb(s)) from finance_pilot_dev.finance_next_service_lines s));
end $$;
create or replace function finance_pilot_dev_private.outcome_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid;sk text;changed boolean;begin
 -- Allow unrelated maintenance of untouched historical records; new/changed outcome must be complete.
 changed:=tg_op='INSERT';
 if tg_op='UPDATE' then changed:=new.stage is distinct from old.stage or (new.extra_data->'finance_outcome_confirmed') is distinct from (old.extra_data->'finance_outcome_confirmed') or (new.extra_data->'proposal_value') is distinct from (old.extra_data->'proposal_value') or (new.extra_data->'won_value') is distinct from (old.extra_data->'won_value') or new.win_loss_reason is distinct from old.win_loss_reason or jsonb_build_array(new.extra_data->'finance_service_line_key',new.extra_data->'finance_project_id',new.extra_data->'won_date',new.extra_data->'lost_date',new.extra_data->'lost_notes') is distinct from jsonb_build_array(old.extra_data->'finance_service_line_key',old.extra_data->'finance_project_id',old.extra_data->'won_date',old.extra_data->'lost_date',old.extra_data->'lost_notes');end if;
 if not changed or new.stage not in('Won','Closed Won','Deal','Paid/Booked','Lost','Closed Lost','Tidak Jadi') then return new;end if;
 if changed and auth.uid() is not null and exists(select 1 from finance_pilot_dev.memberships m join finance_pilot_dev.positions p on p.id=m.position_id where m.id=finance_pilot_dev.current_membership_id() and p.key='ceo') then raise exception 'CEO Finance approver-only; outcome harus disiapkan oleh owner.' using errcode='42501';end if;
 select owner_membership_id into owner_id from finance_pilot_dev.activities where id=new.activity_id;
 select service_line_key into sk from finance_pilot_dev.finance_next_service_lines where service_line_key=new.extra_data->>'finance_service_line_key' or label=new.business_unit limit 1;
 if owner_id is null or sk is null or finance_pilot_dev_private.amount(new.extra_data->>'proposal_value') is null then raise exception 'Outcome memerlukan owner, service line resmi, dan nilai proposal terkonfirmasi.';end if;
 if new.stage in('Lost','Closed Lost','Tidak Jadi') then
 if finance_pilot_dev_private.date_value(new.extra_data->>'lost_date') is null or coalesce(nullif(new.extra_data->>'win_loss_reason',''),new.win_loss_reason,'') not in('Price or Budget','Competitor','Scope Fit','Timing','No Response','Client Cancelled','Internal Capacity','Other') or (coalesce(nullif(new.extra_data->>'win_loss_reason',''),new.win_loss_reason,'')='Other' and nullif(trim(new.extra_data->>'lost_notes'),'') is null) then raise exception 'Lost memerlukan tanggal, alasan resmi, dan catatan untuk Other.';end if;
 else
 if finance_pilot_dev_private.date_value(new.extra_data->>'won_date') is null or finance_pilot_dev_private.amount(new.extra_data->>'won_value') is null or not exists(select 1 from finance_pilot_dev.projects p where p.id=finance_pilot_dev_private.uuid_value(new.extra_data->>'finance_project_id') and p.deleted_at is null) then raise exception 'Won memerlukan tanggal, kontrak terkonfirmasi, dan Project ID.';end if;
 end if;
 return new;
end $$;
revoke all on function finance_pilot_dev_private.outcome_guard() from public,anon,authenticated;
create trigger zz_finance_pilot_outcome_guard before insert or update on finance_pilot_dev.pipeline_leads for each row execute function finance_pilot_dev_private.outcome_guard();
create or replace function finance_pilot_dev.finance_pilot_save_outcome(p_id uuid,p_expected timestamptz,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=finance_pilot_dev.current_membership_id();l finance_pilot_dev.pipeline_leads%rowtype;pk text;extra jsonb;target_stage text;begin
 select p.key into pk from finance_pilot_dev.memberships m join finance_pilot_dev.positions p on p.id=m.position_id where m.id=actor and m.status='active';
 if actor is null or pk is distinct from 'business_development_staff' then raise exception 'Hanya BD owner mengisi outcome; CEO Finance approver-only.' using errcode='42501';end if;
 select * into l from finance_pilot_dev.pipeline_leads where id=p_id for update;
 if l.id is null or not exists(select 1 from finance_pilot_dev.activities where id=l.activity_id and owner_membership_id=actor) then raise exception 'Lead bukan penugasan pengguna.' using errcode='42501';end if;
 target_stage:=p_payload->>'stage';
 if coalesce(target_stage,'') not in('Submitted','Won','Lost','On Hold','Cancelled') or jsonb_typeof(p_payload)<>'object' then raise exception 'Outcome tidak valid.';end if;
 extra:=coalesce(l.extra_data,'{}'::jsonb)||jsonb_build_object('finance_outcome_confirmed',true,'finance_owner_id',actor,'finance_service_line_key',p_payload->>'service_line_key','finance_project_id',p_payload->>'project_id','proposal_value',p_payload->'proposal_value','won_value',p_payload->'won_value','won_date',case when target_stage='Won' then p_payload->>'outcome_date' else l.extra_data->>'won_date' end,'lost_date',case when target_stage='Lost' then p_payload->>'outcome_date' else l.extra_data->>'lost_date' end,'win_loss_reason',p_payload->>'lost_reason','lost_notes',p_payload->>'notes');
 if l.stage=target_stage and l.extra_data=extra then return l.id;end if;
 if l.updated_at is distinct from p_expected then raise exception 'Lead berubah; refresh sebelum menyimpan.' using errcode='40001';end if;
 if not exists(select 1 from finance_pilot_dev.finance_next_service_lines where service_line_key=p_payload->>'service_line_key') or finance_pilot_dev_private.date_value(p_payload->>'outcome_date') is null or finance_pilot_dev_private.amount(p_payload->>'proposal_value') is null then raise exception 'Tanggal, service dan proposal wajib.';end if;
 if target_stage='Won' and not exists(select 1 from finance_pilot_dev.project_members where project_id=finance_pilot_dev_private.uuid_value(p_payload->>'project_id') and membership_id=actor and removed_at is null) then raise exception 'Project Won bukan penugasan BD.';end if;
 update finance_pilot_dev.pipeline_leads set stage=target_stage,business_unit=(select label from finance_pilot_dev.finance_next_service_lines where service_line_key=p_payload->>'service_line_key'),extra_data=extra,proposal_value=finance_pilot_dev_private.amount(p_payload->>'proposal_value'),won_value=case when target_stage='Won' then finance_pilot_dev_private.amount(p_payload->>'won_value') else won_value end,win_loss_reason=p_payload->>'lost_reason',won_at=case when target_stage='Won' then (p_payload->>'outcome_date')::date::timestamp at time zone 'Asia/Jakarta' else won_at end,lost_at=case when target_stage='Lost' then (p_payload->>'outcome_date')::date::timestamp at time zone 'Asia/Jakarta' else lost_at end,proposal_date=case when target_stage='Submitted' then (p_payload->>'outcome_date')::date else proposal_date end,updated_at=now() where id=p_id;
 perform finance_pilot_dev_private.audit('commercial.outcome','pipeline_lead',p_id::text,to_jsonb(l),p_payload);return p_id;
end $$;
revoke all on function finance_pilot_dev.finance_pilot_commercial_workspace(),finance_pilot_dev.finance_pilot_save_outcome(uuid,timestamptz,jsonb) from public,anon;
grant execute on function finance_pilot_dev.finance_pilot_commercial_workspace(),finance_pilot_dev.finance_pilot_save_outcome(uuid,timestamptz,jsonb) to authenticated;

-- Explicit approved mapping; never use finance_bank_accounts.current_balance as a second ledger.
create or replace function finance_pilot_dev_private.cash_codes() returns text[] language sql stable security definer set search_path='' as $$ select array_agg(distinct code) filter(where code is not null) from (select finance_pilot_dev_private.policy()->'accounts'->>'cash' as code union all select b->>'coa_code' from jsonb_array_elements(coalesce(finance_pilot_dev_private.policy()->'bank_mappings','[]'::jsonb)) b) q $$;
create or replace function finance_pilot_dev_private.bank_status(p_asof date) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('coa_code',b.code,'label',coalesce((select x->>'bank_account' from jsonb_array_elements(coalesce(finance_pilot_dev_private.policy()->'bank_mappings','[]'::jsonb)) x where x->>'coa_code'=b.code),b.code),'book_balance',b.book,'reconciled',coalesce(r.ledger_fingerprint=b.fingerprint and r.book_balance=b.book,false),'statement_balance',r.statement_balance,'evidence_path',r.evidence_path)),'[]'::jsonb) from (select c.code,coalesce(sum(l.debit-l.credit),0) as book,md5(coalesce(string_agg(l.id::text,',' order by l.id),'')) as fingerprint from unnest(finance_pilot_dev_private.cash_codes()) c(code) left join (select l.* from finance_pilot_dev.finance_next_journal_lines l join finance_pilot_dev.finance_next_journal_entries e on e.id=l.journal_entry_id where e.status='posted' and e.entry_date<=p_asof) l on l.coa_code=c.code group by c.code) b left join lateral(select r.* from finance_pilot_dev.finance_next_reconciliations r where r.bank_coa_code=b.code and r.as_of_date=p_asof order by created_at desc,id desc limit 1) r on true;
$$;
revoke all on function finance_pilot_dev_private.cash_codes(),finance_pilot_dev_private.bank_status(date) from public,anon,authenticated;
create or replace function finance_pilot_dev_private.validate_policy(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare k text; ac text; mapped text[];
begin
 if (p->>'approval_threshold')::numeric<0 or (p->>'approval_threshold') is null or (p->>'fiscal_start')::int not between 1 and 12 or p->>'fiscal_start' is null then raise exception 'Threshold dan tahun fiskal harus diputuskan eksplisit.'; end if;
 if (p->>'approval_threshold')::numeric::text in ('NaN','Infinity','-Infinity') then raise exception 'Threshold tidak valid.'; end if;
 foreach k in array array['cash','receivable','payable','advance','tax_payable','retained_earnings','distribution_payable','fixed_asset','related_receivable'] loop
   select account_class into ac from finance_pilot_dev.finance_coa where code=p->'accounts'->>k and is_active;
   if ac is null or (k in ('cash','receivable','fixed_asset','related_receivable') and ac<>'Aset')
    or (k in ('payable','advance','tax_payable','distribution_payable') and ac<>'Kewajiban') or (k='retained_earnings' and ac<>'Ekuitas') then raise exception 'Mapping akun % belum sesuai.',k; end if;
 end loop;
 select array_agg(value) into mapped from jsonb_each_text(p->'accounts');
 if (select count(*) from unnest(mapped))<>(select count(distinct v) from unnest(mapped) v) then raise exception 'Akun kontrol berbeda tidak boleh memakai saldo yang sama.'; end if;
 if exists(select 1 from finance_pilot_dev.finance_next_journal_entries) and finance_pilot_dev_private.policy()->'accounts' is distinct from p->'accounts' then raise exception 'Mapping akun posted memerlukan rencana migrasi terpisah; perubahan diblokir.'; end if;
 if exists(select 1 from finance_pilot_dev.finance_next_requests where kind='target' and state='posted') and finance_pilot_dev_private.policy()->>'fiscal_start' is distinct from p->>'fiscal_start' then raise exception 'Kalender fiscal bertarget aktif tidak boleh diubah tanpa migrasi.'; end if;
 if p ? 'bank_mappings' then
 if jsonb_typeof(p->'bank_mappings') is distinct from 'array' or exists(select 1 from jsonb_array_elements(p->'bank_mappings') b where not exists(select 1 from finance_pilot_dev.finance_bank_accounts where bank_account=b->>'bank_account') or not exists(select 1 from finance_pilot_dev.finance_coa where code=b->>'coa_code' and account_class='Aset' and is_active) or exists(select 1 from jsonb_each_text(p->'accounts') a where a.key<>'cash' and a.value=b->>'coa_code')) then raise exception 'Bank mapping wajib menggunakan bank existing dan akun aset terpisah.';end if;
 if (select count(*) from jsonb_array_elements(p->'bank_mappings'))<>(select count(distinct b->>'bank_account') from jsonb_array_elements(p->'bank_mappings') b) or (select count(*) from jsonb_array_elements(p->'bank_mappings'))<>(select count(distinct b->>'coa_code') from jsonb_array_elements(p->'bank_mappings') b) then raise exception 'Bank/akun kas tidak boleh dipetakan ganda.';end if;
 if exists(select 1 from finance_pilot_dev.finance_next_journal_entries) and coalesce(finance_pilot_dev_private.policy()->'bank_mappings','[]'::jsonb) is distinct from p->'bank_mappings' then raise exception 'Mapping bank posted memerlukan migrasi terpisah.';end if;
 elsif exists(select 1 from finance_pilot_dev.finance_next_journal_entries) and coalesce(finance_pilot_dev_private.policy()->'bank_mappings','[]'::jsonb)<>'[]'::jsonb then raise exception 'Mapping bank posted tidak boleh dihapus.';end if;
 if nullif(trim(p->>'reason'),'') is null then raise exception 'Alasan perubahan kebijakan wajib.'; end if;
end $$;

create or replace function finance_pilot_dev_private.validate(p_kind text,p jsonb) returns numeric
language plpgsql security definer set search_path='' as $$
declare amount numeric(18,2); ac jsonb:=finance_pilot_dev_private.policy()->'accounts'; total numeric(18,2); l jsonb; pr uuid; required_field text; ctl finance_pilot_dev.finance_next_project_controls%rowtype;
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
 if nullif(trim(p->>'code'),'') is null or exists(select 1 from finance_pilot_dev.finance_coa where code=p->>'code') or nullif(trim(p->>'name'),'') is null or p->>'account_class' not in ('Aset','Kewajiban','Ekuitas','Pendapatan','Beban Operasional','Beban Langsung Proyek','Beban Non-Operasional','Pajak') or p->>'cash_flow_category' not in ('Operasional','Investasi','Pendanaan','Non-Kas') then raise exception 'Akun baru dan klasifikasi valid wajib.'; end if; return 0; end if;
 if p_kind='policy' then perform finance_pilot_dev_private.validate_policy(p); return 0; end if;
 if p_kind in ('journal','invoice','receipt','reversal') then
  perform finance_pilot_dev_private.evidence(p->>'evidence_path');
  perform finance_pilot_dev_private.lock_period((p->>'date')::date);
 end if;
 if p_kind in ('journal','invoice','receipt','target','funds','budget','reversal') and finance_pilot_dev_private.policy() is null then raise exception 'Kebijakan belum disetujui CEO; jangan memakai asumsi.'; end if;
 if p_kind='journal' then
  if p->>'claim_id' is not null and not exists(select 1 from finance_pilot_dev.finance_next_requests where id=(p->>'claim_id')::uuid and kind='claim' and state='approved' and (payload->>'amount')::numeric=(p->>'amount')::numeric and payload->>'evidence_path'=p->>'evidence_path') then raise exception 'Claim sumber tidak cocok atau belum ditriage.'; end if;
  if nullif(trim(p->>'reference'),'') is null then raise exception 'Referensi transaksi wajib.'; end if;
  if jsonb_typeof(p->'lines')<>'array' or jsonb_array_length(p->'lines')<2 then raise exception 'Minimal dua baris.'; end if;
  select sum(coalesce((value->>'debit')::numeric,0)),sum(coalesce((value->>'credit')::numeric,0)) into amount,total from jsonb_array_elements(p->'lines');
  if amount is null or amount<=0 or amount<>total then raise exception 'Jurnal tidak seimbang.'; end if;
  if p->>'business_event' not in ('customer_advance','project_expense','operating_expense','vendor_bill','vendor_payment','owner_receivable','asset_purchase','opening_adjustment','profit_distribution','advance_settlement','manual') then raise exception 'Business event wajib.'; end if;
  if exists(select 1 from jsonb_array_elements(p->'lines') a where a->>'coa_code'=ac->>'distribution_payable') then raise exception 'Kebijakan distribusi dan eligible profit belum diputuskan; diblokir.'; end if;
  if p->>'business_event'='profit_distribution' then raise exception 'Kebijakan distribusi dan eligible profit belum diputuskan; diblokir.'; end if;
 elsif p_kind='invoice' then
  if nullif(trim(p->>'client'),'') is null or nullif(trim(p->>'item_description'),'') is null or (p->>'quantity')::numeric<=0 or (p->>'unit_price')::numeric<=0 then raise exception 'Client, item, kuantitas dan harga wajib.'; end if;
  if (p->>'due_date')::date<(p->>'date')::date then raise exception 'Jatuh tempo sebelum tanggal invoice.'; end if;
  if not exists(select 1 from finance_pilot_dev.finance_next_service_lines where service_line_key=p->>'service_line_key' and is_active) then raise exception 'Service line wajib.'; end if;
  if (p->>'tax')::numeric<0 or (p->>'discount')::numeric<0 or (p->>'management_fee')::numeric<0 or (p->>'other_fees')::numeric<0 then raise exception 'Komponen invoice tidak boleh negatif.'; end if;
  if nullif(trim(p->>'milestone_evidence'),'') is null then raise exception 'Bukti milestone selesai wajib sebelum pengakuan revenue.'; end if;
  amount:=round((p->>'quantity')::numeric*(p->>'unit_price')::numeric,2)-coalesce((p->>'discount')::numeric,0)+coalesce((p->>'tax')::numeric,0)+coalesce((p->>'management_fee')::numeric,0)+coalesce((p->>'other_fees')::numeric,0);
  if amount<=0 then raise exception 'Total invoice harus positif.'; end if;
  if (select sum(value::numeric) from jsonb_array_elements_text(p->'percentages')) is distinct from 100::numeric or exists(select 1 from jsonb_array_elements_text(p->'percentages') where value::numeric<=0) then raise exception 'Termin harus tepat 100%%.'; end if;
  pr:=nullif(p->>'project_id','')::uuid;
  if pr is not null and not exists(select 1 from finance_pilot_dev.finance_next_project_controls where project_id=pr and service_line_key=p->>'service_line_key' and financially_closed_at is null) then raise exception 'Project/service line belum memiliki budget disetujui.'; end if;
 elsif p_kind='receipt' then
  amount:=(p->>'amount')::numeric;
  if amount<=0 or nullif(trim(p->>'reference'),'') is null then raise exception 'Nominal dan referensi pembayaran wajib.'; end if;
  if not coalesce(p->>'deposit_coa_code'=any(finance_pilot_dev_private.cash_codes()),false) then raise exception 'Akun kas harus mapping yang disetujui.'; end if;
  if not exists(select 1 from finance_pilot_dev.finance_documents where id=(p->>'invoice_id')::uuid and finance_pilot is true and document_type='invoice' and pilot_journal_id is not null and balance>=amount) then raise exception 'Invoice tidak ditemukan atau pembayaran melebihi saldo.'; end if;
 elsif p_kind='target' then
  if (p->>'fiscal_year')::int not between 2000 and 2200 or (p->>'annual_target')::numeric<=0 then raise exception 'Tahun/target tidak valid.'; end if;
  if jsonb_array_length(p->'allocations')<12 then raise exception 'Alokasi bulanan per service wajib.'; end if;
  select sum((value->>'amount')::numeric) into total from jsonb_array_elements(p->'allocations');
  if total is distinct from (p->>'annual_target')::numeric or exists(select 1 from jsonb_array_elements(p->'allocations') a where ((a->>'amount')::numeric<0 or (a->>'amount')::numeric::text in ('NaN','Infinity','-Infinity') or a->>'amount' is null) or (a->>'month')::int not between 1 and 12 or not exists(select 1 from finance_pilot_dev.finance_next_service_lines s where s.service_line_key=a->>'service_line_key')) then raise exception 'Alokasi bulanan/service tidak valid atau tidak sama dengan annual target.'; end if;
  if exists(select 1 from jsonb_array_elements(p->'allocations') a group by a->>'month',a->>'service_line_key' having count(*)>1) or (select count(distinct a->>'month') from jsonb_array_elements(p->'allocations') a)<>12 then raise exception 'Semua bulan wajib tanpa alokasi duplikat.'; end if;
 elsif p_kind='funds' then
  if (p->>'operating_target')::numeric<=0 then raise exception 'Target operating reserve wajib positif.'; end if;
  if jsonb_array_length(p->'buckets')<>3 or (select count(distinct a->>'key') from jsonb_array_elements(p->'buckets') a)<>3 or exists(select 1 from jsonb_array_elements(p->'buckets') a where a->>'key' not in ('project','operating','emergency') or (a->>'amount') is null or (a->>'amount')::numeric<0 or (a->>'amount')::numeric::text in ('NaN','Infinity','-Infinity')) then raise exception 'Bucket project, operating, emergency wajib tanpa duplikat.'; end if;
  -- Tax and distribution payable are ledger liabilities, not duplicate reserve balances.
 elsif p_kind='budget' then
  if p->>'estimate_id' is not null and not exists(select 1 from finance_pilot_dev.finance_next_requests e where e.id=(p->>'estimate_id')::uuid and e.kind='estimate' and e.state='approved' and e.payload->>'project_id'=p->>'project_id' and (e.payload->>'amount')::numeric=(p->>'budgeted_hpp')::numeric) then raise exception 'Estimate sumber tidak cocok atau belum disetujui COO.'; end if;
  pr:=(p->>'project_id')::uuid;
  if not exists(select 1 from finance_pilot_dev.projects where id=pr and deleted_at is null) or not exists(select 1 from finance_pilot_dev.finance_next_service_lines where service_line_key=p->>'service_line_key') or (p->>'contract_value')::numeric<0 or (p->>'budgeted_hpp')::numeric<0 or (p->>'committed_cost')::numeric<0 then raise exception 'Project budget tidak valid.'; end if;
 elsif p_kind='reversal' then
  if not exists(select 1 from finance_pilot_dev.finance_next_journal_entries where id=(p->>'journal_id')::uuid and source_type in ('request','finance_document') and entry_date<=(p->>'date')::date) then raise exception 'Jurnal sumber tidak valid atau tanggal reversal sebelum sumber.'; end if;
  if exists(select 1 from finance_pilot_dev.finance_documents where pilot_journal_id=(p->>'journal_id')::uuid and document_type='invoice' and paid>0) then raise exception 'Balikkan receipt terlebih dahulu sebelum membalikkan invoice dibayar.'; end if;
 elsif p_kind='project_closure' then
  select * into ctl from finance_pilot_dev.finance_next_project_controls where project_id=(p->>'project_id')::uuid for update;
  if ctl.project_id is null or ctl.financially_closed_at is not null or nullif(p->>'handover_evidence','') is null then raise exception 'Project aktif dan bukti handover wajib.'; end if;
  if ctl.service_line_key='digital_system' and ctl.delivery_confirmed_at is null then raise exception 'Konfirmasi CTO wajib untuk project digital.'; end if;
 end if;
 if p_kind in ('target','funds','budget','reversal','project_closure','account') and nullif(trim(p->>'reason'),'') is null then raise exception 'Alasan wajib.'; end if;
 if coalesce(amount,0)::text in ('NaN','Infinity','-Infinity') then raise exception 'Nilai bukan angka finite.'; end if;
 return coalesce(amount,0);
end $$;

create or replace function finance_pilot_dev_private.template(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb:=finance_pilot_dev_private.policy()->'accounts'; ev text:=p->>'business_event'; d text; c text; amt numeric(18,2):=(p->>'amount')::numeric; cl text; sk text; pr uuid:=nullif(p->>'project_id','')::uuid; bill finance_pilot_dev.finance_next_requests%rowtype; remaining numeric;
begin
 if ev in ('manual','opening_adjustment') then return p->'lines'; end if;
 if amt is null or amt<=0 or amt::text in ('NaN','Infinity','-Infinity') then raise exception 'Nominal business event harus positif.'; end if;
 if ev='vendor_payment' then
  if nullif(p->>'vendor_bill_id','') is null then raise exception 'Sumber vendor bill wajib.'; end if;
  select * into bill from finance_pilot_dev.finance_next_requests where id=(p->>'vendor_bill_id')::uuid and kind='journal' and state='posted';
  if bill.id is null or bill.payload->>'business_event'='vendor_payment' or not exists(select 1 from finance_pilot_dev.finance_next_journal_lines where journal_entry_id=bill.result_id and coa_code=a->>'payable' and credit>0) then raise exception 'Sumber AP posted tidak ditemukan.'; end if;
  if p->>'date' is null or (p->>'date')::date<(bill.payload->>'date')::date then raise exception 'Tanggal payment harus setelah atau sama dengan bill.'; end if;
  remaining:=least(finance_pilot_dev_private.ap_balance(bill.id,(p->>'date')::date),finance_pilot_dev_private.ap_balance(bill.id,'9999-12-31'::date));
  if amt>remaining then raise exception 'Payment melebihi outstanding vendor %.',remaining; end if;
  if p->>'client' is distinct from bill.payload->>'client' or nullif(p->>'project_id','') is distinct from nullif(bill.payload->>'project_id','') then raise exception 'Vendor/project harus cocok bill sumber.'; end if;
  d:=a->>'payable'; c:=coalesce(nullif(p->>'settlement_account',''),a->>'cash');
 elsif ev='advance_settlement' then
  if p->>'advance_request_id' is null or p->>'invoice_id' is null then raise exception 'Advance sumber dan invoice wajib.'; end if;
  select * into bill from finance_pilot_dev.finance_next_requests where id=(p->>'advance_request_id')::uuid and kind='journal' and state='posted' and payload->>'business_event'='customer_advance';
  if bill.id is null or bill.payload->>'client' is distinct from p->>'client' or nullif(bill.payload->>'project_id','') is distinct from nullif(p->>'project_id','') or (p->>'date')::date<(bill.payload->>'date')::date then raise exception 'Advance/client/project/tanggal tidak cocok.'; end if;
  if not exists(select 1 from finance_pilot_dev.finance_documents where id=(p->>'invoice_id')::uuid and finance_pilot is true and document_type='invoice' and pilot_journal_id is not null and client=p->>'client' and pilot_project_id is not distinct from pr and document_date<=(p->>'date')::date and balance>=amt) then raise exception 'Invoice tidak cocok atau outstanding tidak cukup.'; end if;
  if amt>least(finance_pilot_dev_private.advance_balance(bill.id,(p->>'date')::date),finance_pilot_dev_private.advance_balance(bill.id,'9999-12-31'::date)) then raise exception 'Advance tidak mencukupi.'; end if;
  d:=a->>'advance';c:=a->>'receivable';
 elsif ev='customer_advance' then d:=coalesce(nullif(p->>'settlement_account',''),a->>'cash');c:=a->>'advance';
 elsif ev='owner_receivable' then d:=a->>'related_receivable';c:=coalesce(nullif(p->>'settlement_account',''),a->>'cash');
   if nullif(trim(p->>'client'),'') is null or p->>'due_date' is null then raise exception 'Owner dan due date wajib untuk piutang pihak terkait.'; end if;
 elsif ev='asset_purchase' then d:=a->>'fixed_asset';c:=p->>'settlement_account';
   if nullif(trim(p->>'asset_name'),'') is null or coalesce((p->>'useful_life_months')::int,0)<=0 or nullif(trim(p->>'custodian'),'') is null then raise exception 'Nama aset, umur manfaat dan custodian wajib.'; end if;
 elsif ev in ('project_expense','operating_expense','vendor_bill') then
   d:=p->>'expense_account'; c:=case when ev='vendor_bill' then a->>'payable' else p->>'settlement_account' end;
   select account_class into cl from finance_pilot_dev.finance_coa where code=d and is_active;
   if (ev='project_expense' and cl is distinct from 'Beban Langsung Proyek') or (ev='operating_expense' and cl is distinct from 'Beban Operasional') or (ev='vendor_bill' and cl not in ('Beban Langsung Proyek','Beban Operasional')) then raise exception 'Akun expense tidak sesuai business event.'; end if;
 else raise exception 'Business event belum didukung.'; end if;
 if c is null or (ev in ('project_expense','operating_expense','vendor_bill','asset_purchase') and not (c=any(finance_pilot_dev_private.cash_codes()) or c=a->>'payable')) or d is null then raise exception 'Mapping settlement tidak valid.'; end if;
 if (ev in('vendor_payment','owner_receivable') and not coalesce(c=any(finance_pilot_dev_private.cash_codes()),false)) or (ev='customer_advance' and not coalesce(d=any(finance_pilot_dev_private.cash_codes()),false)) then raise exception 'Bank settlement belum disetujui.';end if;
 if c=a->>'payable' and (nullif(trim(p->>'client'),'') is null or nullif(p->>'due_date','') is null) then raise exception 'Vendor dan jatuh tempo wajib untuk AP.'; end if;
 if c=a->>'payable' and (p->>'due_date')::date<(p->>'date')::date then raise exception 'Jatuh tempo vendor sebelum tanggal bill.'; end if;
 if pr is not null then select service_line_key into sk from finance_pilot_dev.finance_next_project_controls where project_id=pr; end if;
 if ev in ('project_expense','customer_advance') and pr is null then raise exception 'Project wajib untuk advance/biaya langsung.'; end if;
 return jsonb_build_array(jsonb_build_object('coa_code',d,'description',p->>'description','debit',amt,'credit',0,'project_id',pr,'service_line_key',sk,'client',p->>'client'),jsonb_build_object('coa_code',c,'description',p->>'description','debit',0,'credit',amt,'project_id',pr,'service_line_key',sk,'client',p->>'client'));
end $$;

create or replace function finance_pilot_dev.finance_pilot_execute(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=finance_pilot_dev_private.actor('manage'); r finance_pilot_dev.finance_next_requests%rowtype; p jsonb; source_doc finance_pilot_dev.finance_documents%rowtype; ac jsonb:=finance_pilot_dev_private.policy()->'accounts'; eid uuid; did uuid; n text; amt numeric(18,2); sub numeric(18,2); rev numeric(18,2); tax numeric(18,2); ls jsonb; inv finance_pilot_dev.finance_documents%rowtype; sk text; pc finance_pilot_dev.finance_next_project_controls%rowtype;
begin
 select * into r from finance_pilot_dev.finance_next_requests where id=p_id for update;
 if r.id is null then raise exception 'Request tidak ditemukan.'; end if;
 if r.state='posted' then return r.result_id; end if;
 if r.kind in ('claim','estimate') then raise exception 'Pengajuan sumber wajib ditautkan ke transaksi/budget, bukan diterapkan langsung.'; end if;
 if r.state<>'approved' then raise exception 'Request belum disetujui.'; end if;
 p:=r.payload; amt:=finance_pilot_dev_private.validate(r.kind,p);
 if r.kind in ('journal','invoice','receipt') and amt>=(finance_pilot_dev_private.policy()->>'approval_threshold')::numeric and r.approved_by is null then raise exception 'Nominal mencapai threshold; diperlukan approval CEO.'; end if;
 if r.kind='account' then
 insert into finance_pilot_dev.finance_coa(code,name,account_class,cash_flow_category,default_flow,cost_nature,control_position,retained_earnings_impact) values(p->>'code',p->>'name',p->>'account_class',p->>'cash_flow_category','Non-Kas','Non-Beban','Normal','Tidak Langsung');
 elsif r.kind='journal' then
 if p->>'business_event'='advance_settlement' then
  perform 1 from finance_pilot_dev.finance_next_requests where id=(p->>'advance_request_id')::uuid for update;
  perform 1 from finance_pilot_dev.finance_documents where id=(p->>'invoice_id')::uuid for update;
  if p->'lines' is distinct from finance_pilot_dev_private.template(p) then raise exception 'Settlement advance berubah; periksa outstanding.'; end if;
 end if;
 if p->>'business_event'='vendor_payment' then
  perform 1 from finance_pilot_dev.finance_next_requests where id=(p->>'vendor_bill_id')::uuid for update;
  if p->'lines' is distinct from finance_pilot_dev_private.template(p) then raise exception 'Journal vendor payment tidak cocok sumber.'; end if;
 end if;
 -- Serialize project cost postings and budget revisions. Recheck after waiting.
 perform 1 from finance_pilot_dev.finance_next_project_controls where project_id in
 (select nullif(value->>'project_id','')::uuid from jsonb_array_elements(p->'lines')) order by project_id for update;
 if finance_pilot_dev_private.over_budget(p->'lines') and r.approved_by is null then
  raise exception 'Budget project berubah/terlampaui; diperlukan approval CEO.';
 end if;
 eid:=finance_pilot_dev_private.post((p->>'date')::date,p->>'description',p->'lines','request',r.id::text);
 if p->>'business_event'='advance_settlement' then
  select * into inv from finance_pilot_dev.finance_documents where id=(p->>'invoice_id')::uuid;
  did:=extensions.gen_random_uuid();n:=finance_pilot_dev_private.number('receipt');
  insert into finance_pilot_dev.finance_documents(id,document_type,document_number,document_date,client,project_name,status,subtotal,total,paid,balance,reference_number,linked_invoice_id,notes,items,created_by_membership_id,updated_by_membership_id,finance_pilot,pilot_project_id,pilot_service_line_key,pilot_journal_id,pilot_deposit_coa_code,pilot_evidence_path)
  values(did,'receipt',n,(p->>'date')::date,inv.client,inv.project_name,'Paid',amt,amt,amt,0,'ADV-SET-'||(p->>'reference'),inv.id,'Advance allocation; no new cash','[]',actor,actor,true,inv.pilot_project_id,inv.pilot_service_line_key,eid,null,p->>'evidence_path');
  update finance_pilot_dev.finance_documents set paid=paid+amt,balance=balance-amt,status=case when balance-amt=0 then 'Paid' else 'Partially Paid' end,updated_at=now(),updated_by_membership_id=actor where id=inv.id;
 end if;
 if p->>'business_event'='asset_purchase' then
 insert into finance_pilot_dev.finance_assets(asset_code,asset_name,category,acquisition_date,acquisition_value,custodian,useful_life_months,created_by_membership_id,pilot_journal_id) values('AST-FP-'||r.id::text,p->>'asset_name',p->>'asset_class',(p->>'date')::date,(p->>'amount')::numeric,p->>'custodian',(p->>'useful_life_months')::int,actor,eid); end if;
 elsif r.kind='invoice' then
 sub:=round((p->>'quantity')::numeric*(p->>'unit_price')::numeric,2);
 tax:=coalesce((p->>'tax')::numeric,0); rev:=amt-tax;
 if rev<=0 then raise exception 'Revenue invoice harus positif.'; end if;
 select revenue_account_code into sk from finance_pilot_dev.finance_next_service_lines where service_line_key=p->>'service_line_key';
 if not exists(select 1 from finance_pilot_dev.finance_coa where code=sk and account_class='Pendapatan' and is_active) then raise exception 'Mapping revenue service line tidak valid.'; end if;
 n:=finance_pilot_dev_private.number('invoice'); did:=extensions.gen_random_uuid();
 ls:=jsonb_build_array(jsonb_build_object('coa_code',ac->>'receivable','debit',amt,'credit',0,'project_id',p->>'project_id','service_line_key',p->>'service_line_key','client',p->>'client'),jsonb_build_object('coa_code',sk,'debit',0,'credit',rev,'project_id',p->>'project_id','service_line_key',p->>'service_line_key','client',p->>'client'));
 if tax>0 then ls:=ls||jsonb_build_array(jsonb_build_object('coa_code',ac->>'tax_payable','debit',0,'credit',tax,'project_id',p->>'project_id','service_line_key',p->>'service_line_key','client',p->>'client')); end if;
 eid:=finance_pilot_dev_private.post((p->>'date')::date,'Invoice '||n,ls,'finance_document',did::text);
 insert into finance_pilot_dev.finance_documents(id,document_type,document_number,document_date,due_date,client,client_address,project_name,status,subtotal,discount,tax,total,paid,balance,notes,items,created_by_membership_id,updated_by_membership_id,gross_total,management_fee,other_fees,installment_scheme,payment_schedule,finance_pilot,pilot_project_id,pilot_service_line_key,pilot_journal_id,pilot_evidence_path)
 values(did,'invoice',n,(p->>'date')::date,(p->>'due_date')::date,p->>'client',p->>'client_address',(select name from finance_pilot_dev.projects where id=nullif(p->>'project_id','')::uuid),'Unpaid',sub,(p->>'discount')::numeric,tax,amt,0,amt,p->>'notes',jsonb_build_array(jsonb_build_object('description',p->>'item_description','quantity',(p->>'quantity')::numeric,'unit_price',(p->>'unit_price')::numeric)),actor,actor,amt,(p->>'management_fee')::numeric,(p->>'other_fees')::numeric,p->>'installment_scheme',p->'percentages',true,nullif(p->>'project_id','')::uuid,p->>'service_line_key',eid,p->>'evidence_path');
 elsif r.kind='receipt' then
 select * into inv from finance_pilot_dev.finance_documents where id=(p->>'invoice_id')::uuid for update;
 -- Lock invoice before rechecking outstanding, and deduplicate real payment reference, not only request key.
 if amt>inv.balance then raise exception 'Pembayaran melebihi saldo terbaru.'; end if;
 if exists(select 1 from finance_pilot_dev.finance_documents where finance_pilot is true and document_type='receipt' and linked_invoice_id=inv.id and reference_number=p->>'reference') then raise exception 'Referensi pembayaran sudah digunakan.' using errcode='23505'; end if;
 n:=finance_pilot_dev_private.number('receipt'); did:=extensions.gen_random_uuid();
 ls:=jsonb_build_array(jsonb_build_object('coa_code',p->>'deposit_coa_code','debit',amt,'credit',0,'project_id',inv.pilot_project_id,'service_line_key',inv.pilot_service_line_key,'client',inv.client),jsonb_build_object('coa_code',ac->>'receivable','debit',0,'credit',amt,'project_id',inv.pilot_project_id,'service_line_key',inv.pilot_service_line_key,'client',inv.client));
 eid:=finance_pilot_dev_private.post((p->>'date')::date,'Receipt '||n,ls,'finance_document',did::text);
 insert into finance_pilot_dev.finance_documents(id,document_type,document_number,document_date,client,project_name,status,subtotal,total,paid,balance,reference_number,linked_invoice_id,items,created_by_membership_id,updated_by_membership_id,finance_pilot,pilot_project_id,pilot_service_line_key,pilot_journal_id,pilot_deposit_coa_code,pilot_evidence_path)
 values(did,'receipt',n,(p->>'date')::date,inv.client,inv.project_name,'Paid',amt,amt,amt,0,p->>'reference',inv.id,'[]',actor,actor,true,inv.pilot_project_id,inv.pilot_service_line_key,eid,p->>'deposit_coa_code',p->>'evidence_path');
 update finance_pilot_dev.finance_documents set paid=paid+amt,balance=balance-amt,status=case when balance-amt=0 then 'Paid' else 'Partially Paid' end,updated_at=now(),updated_by_membership_id=actor where id=inv.id;
 elsif r.kind='budget' then
 select * into pc from finance_pilot_dev.finance_next_project_controls where project_id=(p->>'project_id')::uuid for update;
 if pc.project_id is not null and pc.service_line_key<>p->>'service_line_key' and exists(select 1 from finance_pilot_dev.finance_next_journal_lines where project_id=pc.project_id) then raise exception 'Service line project posted tidak boleh diganti.'; end if;
 insert into finance_pilot_dev.finance_next_project_controls(project_id,service_line_key,contract_value,budgeted_hpp,committed_cost,approved_request_id)
 values((p->>'project_id')::uuid,p->>'service_line_key',(p->>'contract_value')::numeric,(p->>'budgeted_hpp')::numeric,(p->>'committed_cost')::numeric,p_id)
 on conflict(project_id) do update set service_line_key=excluded.service_line_key,contract_value=excluded.contract_value,budgeted_hpp=excluded.budgeted_hpp,committed_cost=excluded.committed_cost,approved_request_id=p_id;
 if p->>'estimate_id' is not null then update finance_pilot_dev.finance_next_requests set state='posted',result_id=r.id,updated_at=now() where id=(p->>'estimate_id')::uuid and kind='estimate'; end if;
 elsif r.kind='project_closure' then
 if exists(select 1 from finance_pilot_dev.finance_documents d where finance_pilot is true and pilot_project_id=(p->>'project_id')::uuid and document_type='invoice' and balance>0 and not exists(select 1 from finance_pilot_dev.finance_next_journal_entries re where re.reversal_of_id=d.pilot_journal_id)) then raise exception 'Project masih memiliki piutang; closure memerlukan penyelesaian atau write-off disetujui.'; end if;
 if exists(select 1 from finance_pilot_dev.finance_next_requests bill where bill.kind='journal' and bill.state='posted' and bill.payload->>'project_id'=p->>'project_id' and bill.payload->>'business_event'<>'vendor_payment' and finance_pilot_dev_private.ap_balance(bill.id,'9999-12-31'::date)>0) then raise exception 'Project masih memiliki outstanding vendor AP.'; end if;
 update finance_pilot_dev.finance_next_project_controls set handover_evidence=p->>'handover_evidence',financially_closed_at=now(),financially_closed_by=actor where project_id=(p->>'project_id')::uuid;
 elsif r.kind='reversal' then
 perform 1 from finance_pilot_dev.finance_next_requests bill where bill.id in (
  select case when rq.payload->>'business_event'='vendor_payment' then (rq.payload->>'vendor_bill_id')::uuid else rq.id end
  from finance_pilot_dev.finance_next_journal_entries source join finance_pilot_dev.finance_next_requests rq on source.source_type='request' and rq.id::text=source.source_id where source.id=(p->>'journal_id')::uuid
 ) order by bill.id for update;
 if exists(select 1 from finance_pilot_dev.finance_next_journal_entries source join finance_pilot_dev.finance_next_requests bill on bill.id::text=source.source_id and source.source_type='request'
  join finance_pilot_dev.finance_next_requests payment on payment.payload->>'vendor_bill_id'=bill.id::text and payment.payload->>'business_event'='vendor_payment' and payment.state='posted'
  join finance_pilot_dev.finance_next_journal_entries pe on pe.id=payment.result_id
  where source.id=(p->>'journal_id')::uuid and not exists(select 1 from finance_pilot_dev.finance_next_journal_entries re where re.reversal_of_id=pe.id)) then raise exception 'Balikkan pembayaran vendor dahulu sebelum bill.'; end if;
 if exists(select 1 from finance_pilot_dev.finance_next_journal_entries src join finance_pilot_dev.finance_next_requests adv on adv.id::text=src.source_id and src.source_type='request' join finance_pilot_dev.finance_next_requests settlement on settlement.payload->>'advance_request_id'=adv.id::text and settlement.state='posted' where src.id=(p->>'journal_id')::uuid and not exists(select 1 from finance_pilot_dev.finance_next_journal_entries re where re.reversal_of_id=settlement.result_id)) then raise exception 'Balikkan alokasi advance terlebih dahulu.'; end if;
 if exists(select 1 from finance_pilot_dev.finance_next_journal_entries where reversal_of_id=(p->>'journal_id')::uuid) then raise exception 'Jurnal sudah dibalik.'; end if;
 select jsonb_agg(jsonb_build_object('coa_code',coa_code,'description',description,'debit',credit,'credit',debit,'project_id',project_id,'service_line_key',service_line_key,'client',client) order by line_number) into ls from finance_pilot_dev.finance_next_journal_lines where journal_entry_id=(p->>'journal_id')::uuid;
 eid:=finance_pilot_dev_private.post((p->>'date')::date,'Reversal: '||(p->>'reason'),ls,'reversal',r.id::text,(p->>'journal_id')::uuid);
 select * into source_doc from finance_pilot_dev.finance_documents where pilot_journal_id=(p->>'journal_id')::uuid for update;
 if source_doc.id is not null then
  update finance_pilot_dev.finance_documents set status='Void',updated_at=now(),updated_by_membership_id=actor where id=source_doc.id;
  if source_doc.document_type='receipt' then
    update finance_pilot_dev.finance_documents set paid=paid-source_doc.total,balance=balance+source_doc.total,status=case when paid-source_doc.total=0 then 'Unpaid' else 'Partially Paid' end,updated_at=now(),updated_by_membership_id=actor where id=source_doc.linked_invoice_id;
  end if;
 end if;
 end if;
 if r.kind='journal' and p->>'business_event'='advance_settlement' then did:=null; end if;
 -- Targets/policies/funds are versioned immutable request snapshots; never maintain a second balance.
 if r.kind='journal' and p->>'claim_id' is not null then update finance_pilot_dev.finance_next_requests set state='posted',result_id=eid,updated_at=now() where id=(p->>'claim_id')::uuid and kind='claim'; end if;
 update finance_pilot_dev.finance_next_requests set state='posted',result_id=coalesce(did,eid,r.id),updated_at=now() where id=p_id;
 perform finance_pilot_dev_private.audit('request.apply',r.kind,p_id::text,to_jsonb(r),jsonb_build_object('result_id',coalesce(did,eid,r.id)));
 return coalesce(did,eid,r.id);
end $$;

create or replace function finance_pilot_dev.finance_pilot_reconcile_bank(p_key uuid,p_bank text,p_asof date,p_balance numeric,p_evidence text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=finance_pilot_dev_private.actor('manage'); ac text:=p_bank; b numeric(18,2); fp text; rid uuid;
begin
 if p_key is null or p_asof is null or p_balance is null or ac is null then raise exception 'Rekonsiliasi memerlukan policy dan input lengkap.'; end if;
 if not coalesce(ac=any(finance_pilot_dev_private.cash_codes()),false) or p_balance::text in('NaN','Infinity','-Infinity') then raise exception 'Bank atau nominal tidak valid.';end if;
 perform finance_pilot_dev_private.evidence(p_evidence);
 perform pg_advisory_xact_lock(hashtextextended('finance-reconcile:'||ac||':'||p_asof::text,0));
 select id into rid from finance_pilot_dev.finance_next_reconciliations where request_key=p_key;
 if rid is not null then
 if not exists(select 1 from finance_pilot_dev.finance_next_reconciliations where id=rid and bank_coa_code=ac and as_of_date=p_asof and statement_balance=p_balance and evidence_path=p_evidence) then raise exception 'Request key digunakan untuk rekonsiliasi berbeda.'; end if;
 return rid; end if;
 select coalesce(sum(l.debit-l.credit),0),md5(coalesce(string_agg(l.id::text,',' order by l.id),'')) into b,fp from finance_pilot_dev.finance_next_journal_lines l join finance_pilot_dev.finance_next_journal_entries e on e.id=l.journal_entry_id where l.coa_code=ac and e.entry_date<=p_asof;
 if p_balance<>b then raise exception 'Selisih bank % belum diselesaikan. Tidak ada auto adjustment.',p_balance-b; end if;
 insert into finance_pilot_dev.finance_next_reconciliations(request_key,bank_coa_code,as_of_date,statement_balance,book_balance,ledger_fingerprint,evidence_path,prepared_by) values(p_key,ac,p_asof,p_balance,b,fp,p_evidence,actor) returning id into rid;
 perform finance_pilot_dev_private.audit('bank.reconcile','reconciliation',rid::text,null,jsonb_build_object('as_of',p_asof,'book',b,'statement',p_balance));
 return rid;
end $$;

revoke all on function finance_pilot_dev.finance_pilot_reconcile_bank(uuid,text,date,numeric,text) from public,anon;grant execute on function finance_pilot_dev.finance_pilot_reconcile_bank(uuid,text,date,numeric,text) to authenticated;

create function public.finance_pilot_dev_withdraw(p_id uuid) returns void language sql security invoker set search_path='' as $$ select finance_pilot_dev.finance_pilot_withdraw(p_id); $$;
revoke all on function public.finance_pilot_dev_withdraw(uuid) from public,anon;
grant execute on function public.finance_pilot_dev_withdraw(uuid) to authenticated;
create function public.finance_pilot_dev_update_draft(p_id uuid,p_payload jsonb,p_expected timestamptz) returns uuid language sql security invoker set search_path='' as $$ select finance_pilot_dev.finance_pilot_update_draft(p_id,p_payload,p_expected); $$;
revoke all on function public.finance_pilot_dev_update_draft(uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.finance_pilot_dev_update_draft(uuid,jsonb,timestamptz) to authenticated;
create function public.finance_pilot_dev_source(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select finance_pilot_dev.finance_pilot_source(p_id); $$;
revoke all on function public.finance_pilot_dev_source(uuid) from public,anon;
grant execute on function public.finance_pilot_dev_source(uuid) to authenticated;
create function public.finance_pilot_dev_dashboard(
 p_view text default 'MTD',p_asof date default (now() at time zone 'Asia/Jakarta')::date,
 p_start date default null,p_end date default null,p_service text default null,p_project uuid default null,
 p_client text default null,p_compare text default 'Previous Period',p_payment text default null,p_filters jsonb default '{}'::jsonb
) returns jsonb language sql security invoker set search_path='' as $$ select finance_pilot_dev.finance_pilot_dashboard(p_view,p_asof,p_start,p_end,p_service,p_project,p_client,p_compare,p_payment,p_filters); $$;
revoke all on function public.finance_pilot_dev_dashboard(text,date,date,date,text,uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.finance_pilot_dev_dashboard(text,date,date,date,text,uuid,text,text,text,jsonb) to authenticated;
create function public.finance_pilot_dev_commercial_workspace() returns jsonb language sql security invoker set search_path='' as $$ select finance_pilot_dev.finance_pilot_commercial_workspace(); $$;
revoke all on function public.finance_pilot_dev_commercial_workspace() from public,anon;
grant execute on function public.finance_pilot_dev_commercial_workspace() to authenticated;
create function public.finance_pilot_dev_save_outcome(p_id uuid,p_expected timestamptz,p_payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select finance_pilot_dev.finance_pilot_save_outcome(p_id,p_expected,p_payload); $$;
revoke all on function public.finance_pilot_dev_save_outcome(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.finance_pilot_dev_save_outcome(uuid,timestamptz,jsonb) to authenticated;
create function public.finance_pilot_dev_reconcile_bank(p_key uuid,p_bank text,p_asof date,p_balance numeric,p_evidence text) returns uuid language sql security invoker set search_path='' as $$ select finance_pilot_dev.finance_pilot_reconcile_bank(p_key,p_bank,p_asof,p_balance,p_evidence); $$;
revoke all on function public.finance_pilot_dev_reconcile_bank(uuid,text,date,numeric,text) from public,anon;
grant execute on function public.finance_pilot_dev_reconcile_bank(uuid,text,date,numeric,text) to authenticated;
commit;
