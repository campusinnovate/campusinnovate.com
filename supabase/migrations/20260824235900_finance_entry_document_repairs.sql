-- Finance workflow repairs: live bank balance, safe corrections, and editable multi-item documents.

create table if not exists public.finance_bank_accounts (
  bank_account text primary key,
  opening_balance numeric(18,2) not null default 0,
  current_balance numeric(18,2) not null default 0,
  last_snapshot_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by_membership_id uuid references public.memberships(id)
);

insert into public.finance_bank_accounts(bank_account)
select option_value from public.finance_option_values where option_group='bank'
on conflict(bank_account) do nothing;

-- One-time/idempotent reconstruction: latest snapshot per bank plus live cash movements after it.
with latest_snapshot as (
  select distinct on (bank_account) bank_account,amount,created_at
  from public.finance_transactions
  where transaction_event='Saldo Aktual Bank' and bank_account is not null and status='posted' and reversal_of_id is null
  order by bank_account,created_at desc
), calculated as (
  select b.bank_account,
    coalesce(s.amount,b.opening_balance)
    + coalesce(sum(case when t.flow='in' then t.amount when t.flow='out' then -t.amount else 0 end),0) as balance
  from public.finance_bank_accounts b
  left join latest_snapshot s on s.bank_account=b.bank_account
  left join public.finance_transactions t on t.bank_account=b.bank_account
    and t.status='posted' and t.reversal_of_id is null and t.transaction_event<>'Saldo Aktual Bank'
    and (s.created_at is null or t.created_at>s.created_at)
  group by b.bank_account,b.opening_balance,s.amount
)
update public.finance_bank_accounts b set current_balance=c.balance,updated_at=now()
from calculated c where c.bank_account=b.bank_account;

alter table public.finance_bank_accounts enable row level security;
drop policy if exists finance_bank_accounts_view on public.finance_bank_accounts;
create policy finance_bank_accounts_view on public.finance_bank_accounts for select
using(public.current_user_has_permission('finance.view'));
grant select on public.finance_bank_accounts to authenticated;

create or replace function public.finance_create_journal_entry(
  entry_date date, entry_project text, entry_coa_code text, entry_description text,
  entry_amount numeric, entry_bank text, entry_event text, entry_reference text,
  entry_counterparty text, entry_due_date date, entry_notes text, entry_fund_source text,
  entry_fund_use text, entry_allocation_code text, entry_evidence_url text
) returns uuid language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); saved_id uuid; tx_number text; coa public.finance_coa%rowtype; catalog public.finance_transaction_catalog%rowtype; internal_event text; internal_flow text; calculated_status text; selected_bank text:=nullif(trim(entry_bank),'');
begin
  if not public.current_user_has_permission('finance.manage') then raise exception 'Izin Finance diperlukan.' using errcode='42501'; end if;
  if entry_date is null or trim(coalesce(entry_description,''))='' or coalesce(entry_amount,0)<=0 then raise exception 'Tanggal, keterangan, dan nominal wajib diisi.'; end if;
  select * into catalog from public.finance_transaction_catalog where event_name=entry_event;
  if catalog.event_name is null then raise exception 'Jenis kejadian tidak valid.'; end if;
  select * into coa from public.finance_coa where code=entry_coa_code and is_active;
  if coa.code is null then raise exception 'COA tidak valid.'; end if;
  if catalog.requires_reference and trim(coalesce(entry_reference,''))='' then raise exception 'ID Referensi wajib untuk jenis transaksi ini.'; end if;
  if catalog.requires_due_date and entry_due_date is null then raise exception 'Jatuh tempo wajib untuk jenis transaksi ini.'; end if;
  internal_flow:=case catalog.flow when 'Masuk' then 'in' when 'Keluar' then 'out' else 'non_cash' end;
  if (internal_flow in ('in','out') or entry_event='Saldo Aktual Bank') and selected_bank is null then raise exception 'Rekening / bank wajib dipilih agar saldo aktual terhubung.'; end if;
  if selected_bank is not null and not exists(select 1 from public.finance_bank_accounts where bank_account=selected_bank) then raise exception 'Rekening / bank tidak valid.'; end if;
  internal_event:=case when entry_event='Pengakuan Piutang' then 'receivable_recognition' when entry_event='Penerimaan Piutang' then 'receivable_receipt' when catalog.flow='Masuk' then 'income' when catalog.flow='Keluar' then 'expense' else 'adjustment' end;
  calculated_status:=case when entry_due_date is not null and entry_due_date<current_date and entry_event in ('Pengakuan Piutang','Penyaluran Piutang','Pengakuan Kewajiban') then 'OVERDUE' else 'SELESAI' end;
  tx_number:=public.next_finance_number('transaction');
  insert into public.finance_transactions(transaction_number,transaction_date,event_type,flow,category,description,counterparty,amount,reference_number,evidence_url,status,created_by_membership_id,project_name,coa_code,account_name,account_class,cash_flow_category,transaction_event,bank_account,due_date,auto_status,cost_nature,control_position,notes,fund_source,fund_use,profit_allocation_code)
  values(tx_number,entry_date,internal_event,internal_flow,coa.name,trim(entry_description),nullif(trim(entry_counterparty),''),entry_amount,nullif(trim(entry_reference),''),nullif(trim(entry_evidence_url),''),'posted',actor_id,nullif(trim(entry_project),''),coa.code,coa.name,coa.account_class,coa.cash_flow_category,catalog.event_name,selected_bank,entry_due_date,calculated_status,coa.cost_nature,coa.control_position,nullif(trim(entry_notes),''),nullif(trim(entry_fund_source),''),nullif(trim(entry_fund_use),''),nullif(trim(entry_allocation_code),'')) returning id into saved_id;
  if entry_event='Saldo Aktual Bank' then
    update public.finance_bank_accounts set current_balance=entry_amount,last_snapshot_at=now(),updated_at=now(),updated_by_membership_id=actor_id where bank_account=selected_bank;
  elsif internal_flow='in' then
    update public.finance_bank_accounts set current_balance=current_balance+entry_amount,updated_at=now(),updated_by_membership_id=actor_id where bank_account=selected_bank;
  elsif internal_flow='out' then
    update public.finance_bank_accounts set current_balance=current_balance-entry_amount,updated_at=now(),updated_by_membership_id=actor_id where bank_account=selected_bank;
  end if;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),'finance.journal.create','finance_transaction',saved_id::text,jsonb_build_object('number',tx_number,'event',entry_event,'coa',coa.code,'amount',entry_amount,'bank',selected_bank));
  return saved_id;
end $$;

create or replace function public.finance_reverse_transaction(target_transaction_id uuid, reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare original public.finance_transactions%rowtype; saved_id uuid; actor_id uuid:=public.current_membership_id(); tx_number text; reverse_flow text;
begin
  if not public.current_user_has_permission('finance.manage') then raise exception 'Izin Finance diperlukan.' using errcode='42501'; end if;
  if char_length(trim(coalesce(reason,'')))<5 then raise exception 'Alasan koreksi minimal 5 karakter.'; end if;
  select * into original from public.finance_transactions where id=target_transaction_id for update;
  if original.id is null or original.status<>'posted' or original.reversal_of_id is not null then raise exception 'Transaksi tidak dapat dikoreksi.'; end if;
  if original.transaction_event='Saldo Aktual Bank' then raise exception 'Saldo aktual dikoreksi dengan membuat snapshot saldo baru.'; end if;
  reverse_flow:=case original.flow when 'in' then 'out' when 'out' then 'in' else 'non_cash' end;
  tx_number:=public.next_finance_number('transaction');
  insert into public.finance_transactions(transaction_number,transaction_date,event_type,flow,account_id,category,description,counterparty,amount,reference_number,document_id,evidence_url,status,reversal_of_id,reversal_reason,created_by_membership_id,project_name,coa_code,account_name,account_class,cash_flow_category,transaction_event,bank_account,due_date,auto_status,cost_nature,control_position,notes,fund_source,fund_use,profit_allocation_code)
  values(tx_number,current_date,'reversal',reverse_flow,original.account_id,original.category,'Koreksi '||original.transaction_number,original.counterparty,original.amount,original.reference_number,original.document_id,original.evidence_url,'posted',original.id,trim(reason),actor_id,original.project_name,original.coa_code,original.account_name,original.account_class,original.cash_flow_category,original.transaction_event,original.bank_account,original.due_date,'KOREKSI',original.cost_nature,original.control_position,original.notes,original.fund_source,original.fund_use,original.profit_allocation_code) returning id into saved_id;
  update public.finance_transactions set status='reversed' where id=original.id;
  if original.bank_account is not null and original.flow='in' then update public.finance_bank_accounts set current_balance=current_balance-original.amount,updated_at=now(),updated_by_membership_id=actor_id where bank_account=original.bank_account;
  elsif original.bank_account is not null and original.flow='out' then update public.finance_bank_accounts set current_balance=current_balance+original.amount,updated_at=now(),updated_by_membership_id=actor_id where bank_account=original.bank_account;
  end if;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,reason) values(auth.uid(),'finance.transaction.correct','finance_transaction',original.id::text,to_jsonb(original),jsonb_build_object('reversal_id',saved_id,'reversal_number',tx_number),trim(reason));
  return saved_id;
end $$;

create or replace function public.finance_correct_journal_entry(
  target_transaction_id uuid, correction_reason text,
  entry_date date, entry_project text, entry_coa_code text, entry_description text,
  entry_amount numeric, entry_bank text, entry_event text, entry_reference text,
  entry_counterparty text, entry_due_date date, entry_notes text, entry_fund_source text,
  entry_fund_use text, entry_allocation_code text, entry_evidence_url text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare reversal_id uuid; replacement_id uuid;
begin
  reversal_id:=public.finance_reverse_transaction(target_transaction_id,correction_reason);
  replacement_id:=public.finance_create_journal_entry(entry_date,entry_project,entry_coa_code,entry_description,entry_amount,entry_bank,entry_event,entry_reference,entry_counterparty,entry_due_date,entry_notes,entry_fund_source,entry_fund_use,entry_allocation_code,entry_evidence_url);
  return jsonb_build_object('reversal_id',reversal_id,'replacement_id',replacement_id);
end $$;

create or replace function public.finance_save_document(
  target_document_id uuid, doc_type text, doc_date date, doc_due_date date, doc_client text,
  doc_client_address text, doc_project text, doc_discount numeric, doc_tax numeric,
  doc_notes text, doc_items jsonb, doc_linked_invoice_id uuid, receipt_amount numeric, doc_bank text
) returns uuid language plpgsql security definer set search_path=public as $$
declare saved_id uuid; actor_id uuid:=public.current_membership_id(); doc_number text; subtotal_value numeric:=0; total_value numeric:=0; due_value date; current_doc public.finance_documents%rowtype; invoice_row public.finance_documents%rowtype; tx_number text; selected_bank text:=nullif(trim(doc_bank),'');
begin
  if not public.current_user_has_permission('finance.manage') then raise exception 'Izin Finance diperlukan.' using errcode='42501'; end if;
  if doc_type not in ('quotation','invoice','receipt') then raise exception 'Tipe dokumen tidak valid.'; end if;
  if jsonb_typeof(coalesce(doc_items,'[]'::jsonb))<>'array' then raise exception 'Item dokumen tidak valid.'; end if;
  select coalesce(sum(greatest(0,coalesce((item->>'quantity')::numeric,0))*greatest(0,coalesce((item->>'unit_price')::numeric,0))),0) into subtotal_value from jsonb_array_elements(coalesce(doc_items,'[]'::jsonb)) item;
  if target_document_id is not null then
    select * into current_doc from public.finance_documents where id=target_document_id and deleted_at is null for update;
    if current_doc.id is null then raise exception 'Dokumen tidak ditemukan.'; end if;
    if current_doc.document_type='receipt' then raise exception 'Receipt tidak diedit; gunakan Hapus/Koreksi lalu buat receipt baru.'; end if;
    if current_doc.document_type='invoice' and current_doc.paid>0 then raise exception 'Invoice yang sudah dibayar tidak boleh mengubah nilai finansial.'; end if;
    doc_type:=current_doc.document_type;
  end if;
  if doc_type='receipt' then
    select * into invoice_row from public.finance_documents where id=doc_linked_invoice_id and document_type='invoice' and deleted_at is null for update;
    if invoice_row.id is null then raise exception 'Invoice terkait tidak ditemukan.'; end if;
    if receipt_amount<=0 or receipt_amount>invoice_row.balance then raise exception 'Nominal receipt melebihi outstanding invoice atau tidak valid.'; end if;
    if selected_bank is null then raise exception 'Rekening penerimaan wajib dipilih.'; end if;
    subtotal_value:=receipt_amount; doc_client:=invoice_row.client; doc_project:=invoice_row.project_name;
  elsif trim(coalesce(doc_client,''))='' or jsonb_array_length(doc_items)=0 then
    raise exception 'Client dan minimal satu item wajib diisi.';
  end if;
  total_value:=greatest(0,subtotal_value-greatest(0,coalesce(doc_discount,0))+greatest(0,coalesce(doc_tax,0)));
  if total_value<=0 then raise exception 'Total dokumen harus lebih dari nol.'; end if;
  due_value:=case when doc_type='invoice' then coalesce(doc_due_date,doc_date+14) else doc_due_date end;
  if target_document_id is null then
    doc_number:=public.next_finance_number(doc_type);
    insert into public.finance_documents(document_type,document_number,document_date,due_date,client,client_address,project_name,status,subtotal,discount,tax,total,paid,balance,linked_invoice_id,notes,items,created_by_membership_id,updated_by_membership_id)
    values(doc_type,doc_number,doc_date,due_value,trim(doc_client),nullif(trim(doc_client_address),''),nullif(trim(doc_project),''),case doc_type when 'quotation' then 'Draft' when 'invoice' then public.finance_invoice_status(0,total_value,due_value) else 'Paid' end,subtotal_value,greatest(0,coalesce(doc_discount,0)),greatest(0,coalesce(doc_tax,0)),total_value,case when doc_type='receipt' then total_value else 0 end,case when doc_type='receipt' then 0 else total_value end,doc_linked_invoice_id,nullif(trim(doc_notes),''),coalesce(doc_items,'[]'::jsonb),actor_id,actor_id) returning id into saved_id;
  else
    update public.finance_documents set document_date=doc_date,due_date=due_value,client=trim(doc_client),client_address=nullif(trim(doc_client_address),''),project_name=nullif(trim(doc_project),''),subtotal=subtotal_value,discount=greatest(0,coalesce(doc_discount,0)),tax=greatest(0,coalesce(doc_tax,0)),total=total_value,balance=total_value,status=case when doc_type='quotation' then status else public.finance_invoice_status(0,total_value,due_value) end,notes=nullif(trim(doc_notes),''),items=doc_items,updated_at=now(),updated_by_membership_id=actor_id where id=target_document_id returning id,document_number into saved_id,doc_number;
  end if;
  if doc_type='invoice' then
    if target_document_id is null then
      tx_number:=public.next_finance_number('transaction');
      insert into public.finance_transactions(transaction_number,transaction_date,event_type,flow,category,description,counterparty,amount,reference_number,document_id,created_by_membership_id,project_name,coa_code,account_name,account_class,cash_flow_category,transaction_event,due_date,auto_status,cost_nature,control_position,notes)
      values(tx_number,doc_date,'receivable_recognition','non_cash','Piutang Usaha','Pengakuan piutang '||doc_number,trim(doc_client),total_value,doc_number,saved_id,actor_id,nullif(trim(doc_project),''),'2000','Piutang Usaha','Aset','Operasional','Pengakuan Piutang',due_value,case when due_value<current_date then 'OVERDUE' else 'AKTIF' end,'Non-Beban','Piutang',nullif(trim(doc_notes),''));
    else
      update public.finance_transactions set transaction_date=doc_date,description='Pengakuan piutang '||doc_number,counterparty=trim(doc_client),amount=total_value,project_name=nullif(trim(doc_project),''),due_date=due_value,auto_status=case when due_value<current_date then 'OVERDUE' else 'AKTIF' end,notes=nullif(trim(doc_notes),'') where document_id=saved_id and status='posted' and reversal_of_id is null;
    end if;
  elsif doc_type='receipt' then
    update public.finance_documents set paid=paid+total_value,balance=balance-total_value,status=public.finance_invoice_status(paid+total_value,balance-total_value,due_date),updated_at=now(),updated_by_membership_id=actor_id where id=invoice_row.id;
    tx_number:=public.next_finance_number('transaction');
    insert into public.finance_transactions(transaction_number,transaction_date,event_type,flow,category,description,counterparty,amount,reference_number,document_id,created_by_membership_id,project_name,coa_code,account_name,account_class,cash_flow_category,transaction_event,bank_account,auto_status,cost_nature,control_position,notes)
    values(tx_number,doc_date,'receivable_receipt','in','Penerimaan Piutang Usaha','Penerimaan '||doc_number,invoice_row.client,total_value,invoice_row.document_number,saved_id,actor_id,invoice_row.project_name,'2003','Penerimaan/Pelunasan Piutang Usaha','Aset','Piutang','Penerimaan Piutang',selected_bank,'SELESAI','Non-Beban','Piutang Usaha',nullif(trim(doc_notes),''));
    update public.finance_bank_accounts set current_balance=current_balance+total_value,updated_at=now(),updated_by_membership_id=actor_id where bank_account=selected_bank;
  end if;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),case when target_document_id is null then 'finance.document.create' else 'finance.document.update' end,'finance_document',saved_id::text,jsonb_build_object('number',doc_number,'type',doc_type,'total',total_value));
  return saved_id;
end $$;

create or replace function public.finance_delete_document(target_document_id uuid, confirmation_number text, reason text)
returns void language plpgsql security definer set search_path=public as $$
declare target public.finance_documents%rowtype; invoice_row public.finance_documents%rowtype; tx public.finance_transactions%rowtype; actor_id uuid:=public.current_membership_id();
begin
  if not public.current_user_has_permission('finance.manage') then raise exception 'Izin Finance diperlukan.' using errcode='42501'; end if;
  if char_length(trim(coalesce(reason,'')))<5 then raise exception 'Alasan hapus/koreksi minimal 5 karakter.'; end if;
  select * into target from public.finance_documents where id=target_document_id and deleted_at is null for update;
  if target.id is null then raise exception 'Dokumen tidak ditemukan.'; end if;
  if trim(confirmation_number)<>target.document_number then raise exception 'Konfirmasi nomor dokumen tidak sesuai.'; end if;
  if target.document_type='invoice' and target.paid>0 then raise exception 'Invoice berbayar tidak dapat dihapus sebelum receipt terkait dikoreksi.'; end if;
  if target.document_type='receipt' then
    select * into invoice_row from public.finance_documents where id=target.linked_invoice_id for update;
    update public.finance_documents set paid=greatest(paid-target.total,0),balance=balance+target.total,status=public.finance_invoice_status(greatest(paid-target.total,0),balance+target.total,due_date),updated_at=now(),updated_by_membership_id=actor_id where id=invoice_row.id;
  end if;
  select * into tx from public.finance_transactions where document_id=target.id and status='posted' and reversal_of_id is null order by created_at desc limit 1;
  if tx.id is not null then perform public.finance_reverse_transaction(tx.id,reason); end if;
  update public.finance_documents set deleted_at=now(),status='Cancelled',updated_at=now(),updated_by_membership_id=actor_id where id=target.id;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,before_data,reason) values(auth.uid(),'finance.document.delete','finance_document',target.id::text,to_jsonb(target),trim(reason));
end $$;

revoke all on function public.finance_correct_journal_entry(uuid,text,date,text,text,text,numeric,text,text,text,text,date,text,text,text,text,text),public.finance_save_document(uuid,text,date,date,text,text,text,numeric,numeric,text,jsonb,uuid,numeric,text),public.finance_delete_document(uuid,text,text) from public,anon;
grant execute on function public.finance_correct_journal_entry(uuid,text,date,text,text,text,numeric,text,text,text,text,date,text,text,text,text,text),public.finance_save_document(uuid,text,date,date,text,text,text,numeric,numeric,text,jsonb,uuid,numeric,text),public.finance_delete_document(uuid,text,text) to authenticated;
