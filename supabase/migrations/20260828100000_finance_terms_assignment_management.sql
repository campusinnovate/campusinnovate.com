-- Ruang Kawan: invoice installments, flexible charges, and safe assignment lifecycle.

alter table public.finance_documents
  add column if not exists gross_total numeric(18,2) not null default 0,
  add column if not exists management_fee numeric(18,2) not null default 0,
  add column if not exists other_fees numeric(18,2) not null default 0,
  add column if not exists charge_components jsonb not null default '[]'::jsonb,
  add column if not exists installment_scheme text not null default 'full',
  add column if not exists installment_number integer not null default 1,
  add column if not exists installment_percentage numeric(8,4) not null default 100,
  add column if not exists payment_schedule jsonb not null default '[]'::jsonb;

update public.finance_documents
set gross_total=case when gross_total=0 then total else gross_total end,
    payment_schedule=case when payment_schedule='[]'::jsonb then
      jsonb_build_array(jsonb_build_object('number',1,'label','Pembayaran penuh','percentage',100,'amount',total,'due_date',due_date))
      else payment_schedule end
where deleted_at is null;

alter table public.finance_documents drop constraint if exists finance_documents_installment_scheme_check;
alter table public.finance_documents add constraint finance_documents_installment_scheme_check
  check(installment_scheme in ('full','50-50','50-25-25','custom'));
alter table public.finance_documents drop constraint if exists finance_documents_installment_number_check;
alter table public.finance_documents add constraint finance_documents_installment_number_check
  check(installment_number>=1 and installment_percentage>0 and installment_percentage<=100);
alter table public.finance_documents drop constraint if exists finance_documents_charge_components_check;
alter table public.finance_documents add constraint finance_documents_charge_components_check
  check(jsonb_typeof(charge_components)='array' and jsonb_typeof(payment_schedule)='array');
alter table public.finance_documents drop constraint if exists finance_documents_flexible_charges_nonnegative_check;
alter table public.finance_documents add constraint finance_documents_flexible_charges_nonnegative_check
  check(gross_total>=0 and management_fee>=0 and other_fees>=0);

create or replace function public.finance_save_document_v2(target_document_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  actor_id uuid:=public.current_membership_id(); current_doc public.finance_documents%rowtype; invoice_row public.finance_documents%rowtype;
  saved_id uuid; doc_number text; doc_type text:=payload->>'type'; doc_date date:=(payload->>'date')::date;
  due_value date:=nullif(payload->>'due_date','')::date; client_value text:=trim(coalesce(payload->>'client',''));
  address_value text:=nullif(trim(payload->>'address'),''); project_value text:=nullif(trim(payload->>'project'),'');
  items_value jsonb:=coalesce(payload->'items','[]'::jsonb); notes_value text:=nullif(trim(payload->>'notes'),'');
  discount_value numeric:=greatest(0,coalesce(nullif(payload->>'discount','')::numeric,0)); subtotal_value numeric:=0;
  base_value numeric; tax_mode text:=coalesce(nullif(payload#>>'{tax,mode}',''),'fixed'); tax_input numeric:=greatest(0,coalesce(nullif(payload#>>'{tax,value}','')::numeric,0)); tax_value numeric:=0;
  management_mode text:=coalesce(nullif(payload#>>'{management_fee,mode}',''),'fixed'); management_input numeric:=greatest(0,coalesce(nullif(payload#>>'{management_fee,value}','')::numeric,0)); management_value numeric:=0;
  other_value numeric:=0; gross_value numeric:=0; installment_value numeric:=100; invoice_total numeric:=0;
  scheme_value text:=coalesce(nullif(payload->>'installment_scheme',''),'full'); installment_no_value integer:=greatest(1,coalesce(nullif(payload->>'installment_number','')::integer,1));
  percentages numeric[]; percentage_item numeric; schedule_value jsonb:='[]'::jsonb; schedule_index integer:=0;
  component jsonb; component_mode text; component_input numeric; component_amount numeric; charges_value jsonb:='[]'::jsonb;
  linked_id uuid:=nullif(payload->>'invoice_id','')::uuid; receipt_value numeric:=greatest(0,coalesce(nullif(payload->>'receipt_amount','')::numeric,0));
  selected_bank text:=nullif(trim(payload->>'bank'),''); tx_number text;
begin
  if not public.current_user_has_permission('finance.manage') then raise exception 'Izin Finance diperlukan.' using errcode='42501'; end if;
  if doc_type not in ('quotation','invoice','receipt') then raise exception 'Tipe dokumen tidak valid.'; end if;
  if jsonb_typeof(items_value)<>'array' then raise exception 'Item dokumen tidak valid.'; end if;
  if tax_mode not in ('fixed','percent') or management_mode not in ('fixed','percent') then raise exception 'Mode pajak atau fee management tidak valid.';end if;
  if scheme_value not in ('full','50-50','50-25-25','custom') then raise exception 'Skema pembayaran tidak valid.';end if;

  if target_document_id is not null then
    select * into current_doc from public.finance_documents where id=target_document_id and deleted_at is null for update;
    if current_doc.id is null then raise exception 'Dokumen tidak ditemukan.'; end if;
    if current_doc.document_type='receipt' then raise exception 'Receipt tidak diedit; gunakan Hapus/Koreksi lalu buat receipt baru.'; end if;
    if current_doc.document_type='invoice' and current_doc.paid>0 then raise exception 'Invoice yang sudah dibayar tidak boleh mengubah nilai finansial.'; end if;
    doc_type:=current_doc.document_type;
  end if;

  if doc_type='receipt' then
    select * into invoice_row from public.finance_documents where id=linked_id and document_type='invoice' and deleted_at is null for update;
    if invoice_row.id is null then raise exception 'Invoice terkait tidak ditemukan.'; end if;
    if receipt_value<=0 or receipt_value>invoice_row.balance then raise exception 'Nominal receipt melebihi outstanding invoice atau tidak valid.'; end if;
    if selected_bank is null or not exists(select 1 from public.finance_bank_accounts where bank_account=selected_bank) then raise exception 'Rekening penerimaan wajib dipilih.'; end if;
    client_value:=invoice_row.client; project_value:=invoice_row.project_name; subtotal_value:=receipt_value; gross_value:=receipt_value; invoice_total:=receipt_value;
    scheme_value:='full';installment_no_value:=1;installment_value:=100;
    schedule_value:=jsonb_build_array(jsonb_build_object('number',1,'label','Pembayaran diterima','percentage',100,'amount',receipt_value,'due_date',doc_date));
  else
    if client_value='' or jsonb_array_length(items_value)=0 then raise exception 'Client dan minimal satu item wajib diisi.'; end if;
    select coalesce(sum(greatest(0,coalesce((item->>'quantity')::numeric,0))*greatest(0,coalesce((item->>'unit_price')::numeric,0))),0)
      into subtotal_value from jsonb_array_elements(items_value) item;
    if subtotal_value<=0 then raise exception 'Subtotal dokumen harus lebih dari nol.'; end if;
    base_value:=greatest(0,subtotal_value-discount_value);
    tax_value:=case when coalesce((payload#>>'{tax,enabled}')::boolean,false) then case tax_mode when 'percent' then round(base_value*tax_input/100,2) else tax_input end else 0 end;
    if tax_value>0 then charges_value:=charges_value||jsonb_build_array(jsonb_build_object('label','Pajak','mode',tax_mode,'value',tax_input,'amount',tax_value));end if;
    if management_value>0 then charges_value:=charges_value||jsonb_build_array(jsonb_build_object('label','Fee Management','mode',management_mode,'value',management_input,'amount',management_value));end if;
    for component in select value from jsonb_array_elements(coalesce(payload->'other_charges','[]'::jsonb)) loop
      if trim(coalesce(component->>'label',''))='' then continue;end if;
      component_mode:=coalesce(nullif(component->>'mode',''),'fixed');component_input:=greatest(0,coalesce(nullif(component->>'value','')::numeric,0));
      if component_mode not in ('fixed','percent') then raise exception 'Mode biaya tambahan tidak valid.';end if;
      component_amount:=case component_mode when 'percent' then round(base_value*component_input/100,2) else component_input end;
      other_value:=other_value+component_amount;
      charges_value:=charges_value||jsonb_build_array(jsonb_build_object('label',trim(component->>'label'),'mode',component_mode,'value',component_input,'amount',component_amount));
    end loop;
    gross_value:=base_value+tax_value+management_value+other_value;
    if gross_value<=0 then raise exception 'Total dokumen harus lebih dari nol.';end if;
    if doc_type='quotation' then scheme_value:='full';end if;
    percentages:=case scheme_value when '50-50' then array[50::numeric,50::numeric] when '50-25-25' then array[50::numeric,25::numeric,25::numeric] when 'custom' then array[greatest(0.0001,least(100,coalesce(nullif(payload->>'installment_percentage','')::numeric,100)))] else array[100::numeric] end;
    if installment_no_value>array_length(percentages,1) then raise exception 'Nomor termin tidak sesuai skema pembayaran.';end if;
    installment_value:=percentages[installment_no_value];
    invoice_total:=case when doc_type='invoice' then round(gross_value*installment_value/100,2) else gross_value end;
    foreach percentage_item in array percentages loop
      schedule_index:=schedule_index+1;
      schedule_value:=schedule_value||jsonb_build_array(jsonb_build_object('number',schedule_index,'label',case when schedule_index=1 and percentage_item<100 then 'DP' else 'Termin '||schedule_index end,'percentage',percentage_item,'amount',round(gross_value*percentage_item/100,2),'due_date',case when schedule_index=installment_no_value then due_value else null end));
    end loop;
  end if;
  due_value:=case when doc_type='invoice' then coalesce(due_value,doc_date+14) else due_value end;
  if doc_type='invoice' then
    schedule_value:=coalesce((select jsonb_agg(case when (entry->>'number')::integer=installment_no_value then jsonb_set(entry,'{due_date}',to_jsonb(due_value)) else entry end order by ordinal) from jsonb_array_elements(schedule_value) with ordinality schedule(entry,ordinal)),'[]'::jsonb);
  end if;

  if target_document_id is null then
    doc_number:=public.next_finance_number(doc_type);
    insert into public.finance_documents(document_type,document_number,document_date,due_date,client,client_address,project_name,status,subtotal,discount,tax,total,paid,balance,linked_invoice_id,notes,items,created_by_membership_id,updated_by_membership_id,gross_total,management_fee,other_fees,charge_components,installment_scheme,installment_number,installment_percentage,payment_schedule)
    values(doc_type,doc_number,doc_date,due_value,client_value,address_value,project_value,case doc_type when 'quotation' then 'Draft' when 'invoice' then public.finance_invoice_status(0,invoice_total,due_value) else 'Paid' end,subtotal_value,discount_value,tax_value,invoice_total,case when doc_type='receipt' then invoice_total else 0 end,case when doc_type='receipt' then 0 else invoice_total end,linked_id,notes_value,items_value,actor_id,actor_id,gross_value,management_value,other_value,charges_value,scheme_value,installment_no_value,installment_value,schedule_value) returning id into saved_id;
  else
    update public.finance_documents set document_date=doc_date,due_date=due_value,client=client_value,client_address=address_value,project_name=project_value,subtotal=subtotal_value,discount=discount_value,tax=tax_value,total=invoice_total,balance=invoice_total,status=case when doc_type='quotation' then status else public.finance_invoice_status(0,invoice_total,due_value) end,notes=notes_value,items=items_value,gross_total=gross_value,management_fee=management_value,other_fees=other_value,charge_components=charges_value,installment_scheme=scheme_value,installment_number=installment_no_value,installment_percentage=installment_value,payment_schedule=schedule_value,updated_at=now(),updated_by_membership_id=actor_id where id=target_document_id returning id,document_number into saved_id,doc_number;
  end if;

  if doc_type='invoice' then
    if target_document_id is null then
      tx_number:=public.next_finance_number('transaction');
      insert into public.finance_transactions(transaction_number,transaction_date,event_type,flow,category,description,counterparty,amount,reference_number,document_id,created_by_membership_id,project_name,coa_code,account_name,account_class,cash_flow_category,transaction_event,due_date,auto_status,cost_nature,control_position,notes)
      values(tx_number,doc_date,'receivable_recognition','non_cash','Piutang Usaha','Pengakuan piutang '||doc_number,client_value,invoice_total,doc_number,saved_id,actor_id,project_value,'2000','Piutang Usaha','Aset','Operasional','Pengakuan Piutang',due_value,case when due_value<current_date then 'OVERDUE' else 'AKTIF' end,'Non-Beban','Piutang',notes_value);
    else
      update public.finance_transactions set transaction_date=doc_date,description='Pengakuan piutang '||doc_number,counterparty=client_value,amount=invoice_total,project_name=project_value,due_date=due_value,auto_status=case when due_value<current_date then 'OVERDUE' else 'AKTIF' end,notes=notes_value where document_id=saved_id and status='posted' and reversal_of_id is null;
    end if;
  elsif doc_type='receipt' then
    update public.finance_documents set paid=paid+invoice_total,balance=balance-invoice_total,status=public.finance_invoice_status(paid+invoice_total,balance-invoice_total,due_date),updated_at=now(),updated_by_membership_id=actor_id where id=invoice_row.id;
    tx_number:=public.next_finance_number('transaction');
    insert into public.finance_transactions(transaction_number,transaction_date,event_type,flow,category,description,counterparty,amount,reference_number,document_id,created_by_membership_id,project_name,coa_code,account_name,account_class,cash_flow_category,transaction_event,bank_account,auto_status,cost_nature,control_position,notes)
    values(tx_number,doc_date,'receivable_receipt','in','Penerimaan Piutang Usaha','Penerimaan '||doc_number,invoice_row.client,invoice_total,invoice_row.document_number,saved_id,actor_id,invoice_row.project_name,'2003','Penerimaan/Pelunasan Piutang Usaha','Aset','Piutang','Penerimaan Piutang',selected_bank,'SELESAI','Non-Beban','Piutang Usaha',notes_value);
    update public.finance_bank_accounts set current_balance=current_balance+invoice_total,updated_at=now(),updated_by_membership_id=actor_id where bank_account=selected_bank;
  end if;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),case when target_document_id is null then 'finance.document.create_v2' else 'finance.document.update_v2' end,'finance_document',saved_id::text,jsonb_build_object('number',doc_number,'type',doc_type,'gross_total',gross_value,'invoice_total',invoice_total,'installment',installment_value));
  return saved_id;
end $$;

create or replace function public.delete_assignment(target_activity_id uuid,confirmation_title text,reason text)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();target public.activities%rowtype;
begin
  select * into target from public.activities where id=target_activity_id for update;
  if target.id is null then raise exception 'Assignment tidak ditemukan.';end if;
  if target.assigned_by_membership_id<>actor and not public.current_user_has_permission('activity.assign_team') then raise exception 'Hanya pemberi tugas atau pengelola yang dapat menghapus assignment.' using errcode='42501';end if;
  if trim(coalesce(confirmation_title,''))<>target.title then raise exception 'Konfirmasi judul assignment tidak sesuai.';end if;
  if char_length(trim(coalesce(reason,'')))<5 then raise exception 'Alasan penghapusan minimal 5 karakter.';end if;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,before_data,reason) values(auth.uid(),'assignment.delete','activity',target.id::text,to_jsonb(target),trim(reason));
  delete from public.activities where id=target.id;
end $$;

create or replace function public.kpi_assignment_impact(target_assignment_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select case when public.current_user_has_permission('kpi.manage') then jsonb_build_object(
  'assignment_id',a.id,'member_name',coalesce(m.full_name,m.email::text),'role_name',r.name,'period_name',p.name,
  'result_count',(select count(*) from public.kpi_results x where x.assignment_id=a.id),
  'weekly_update_count',(select count(*) from public.kpi_weekly_updates u join public.kpi_results x on x.id=u.result_id where x.assignment_id=a.id),
  'evidence_count',(select count(*) from public.kpi_results x where x.assignment_id=a.id and nullif(x.evidence_url,'') is not null)+(select count(*) from public.kpi_weekly_updates u join public.kpi_results x on x.id=u.result_id where x.assignment_id=a.id and nullif(u.evidence_url,'') is not null)
 ) else null end from public.kpi_assignments a join public.memberships m on m.id=a.membership_id join public.kpi_roles r on r.id=a.kpi_role_id join public.kpi_periods p on p.id=a.period_id where a.id=target_assignment_id;
$$;

create or replace function public.delete_kpi_assignment(target_assignment_id uuid,confirmation_name text)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();target public.kpi_assignments%rowtype;member_name text;role_name text;period_name text;snapshot jsonb;impact_value jsonb;
begin
 if not public.current_user_has_permission('kpi.manage') then raise exception 'Izin kelola KPI diperlukan.' using errcode='42501';end if;
 select a into target from public.kpi_assignments a where a.id=target_assignment_id for update;
 if target.id is null then raise exception 'Assignment KPI tidak ditemukan.';end if;
 select coalesce(m.full_name,m.email::text),r.name,p.name into member_name,role_name,period_name from public.memberships m join public.kpi_roles r on r.id=target.kpi_role_id join public.kpi_periods p on p.id=target.period_id where m.id=target.membership_id;
 if trim(coalesce(confirmation_name,''))<>member_name then raise exception 'Konfirmasi nama anggota tidak sesuai.';end if;
 select public.kpi_assignment_impact(target.id) into impact_value;
 select jsonb_build_object('assignment',to_jsonb(target),'member_name',member_name,'role_name',role_name,'period_name',period_name,'results',coalesce((select jsonb_agg(to_jsonb(x)) from public.kpi_results x where x.assignment_id=target.id),'[]'::jsonb),'updates',coalesce((select jsonb_agg(to_jsonb(u)) from public.kpi_weekly_updates u join public.kpi_results x on x.id=u.result_id where x.assignment_id=target.id),'[]'::jsonb),'events',coalesce((select jsonb_agg(to_jsonb(e)) from public.kpi_events e where e.assignment_id=target.id),'[]'::jsonb)) into snapshot;
 insert into public.kpi_admin_audits(actor_membership_id,action,target_type,target_id,before_data,impact) values(actor,'assignment.deleted','assignment',target.id,snapshot,coalesce(impact_value,'{}'::jsonb));
 delete from public.kpi_assignments where id=target.id;
end $$;

revoke all on function public.finance_save_document_v2(uuid,jsonb),public.delete_assignment(uuid,text,text),public.kpi_assignment_impact(uuid),public.delete_kpi_assignment(uuid,text) from anon,public;
grant execute on function public.finance_save_document_v2(uuid,jsonb),public.delete_assignment(uuid,text,text),public.kpi_assignment_impact(uuid),public.delete_kpi_assignment(uuid,text) to authenticated;
