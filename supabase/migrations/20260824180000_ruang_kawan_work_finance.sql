-- Ruang Kawan: private scratchpad, assignments/reviews, notifications, and Finance foundation.

insert into public.permissions (key, name, description) values
  ('notes.manage_self', 'Kelola Coret-coret', 'Membuat dan mengelola catatan pribadi.'),
  ('activity.assign_team', 'Berikan assignment', 'Memberikan pekerjaan kepada anggota lain.'),
  ('activity.comment', 'Komentar aktivitas', 'Berdiskusi pada aktivitas yang dapat diakses.'),
  ('activity.submit_review', 'Ajukan review', 'Mengajukan hasil pekerjaan untuk direview.'),
  ('notifications.view_self', 'Lihat notifikasi sendiri', 'Melihat notifikasi pekerjaan pribadi.')
on conflict (key) do update set name = excluded.name, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r join public.permissions p on
  r.key = 'system_admin'
  or (r.key = 'executive' and p.key in ('notes.manage_self','activity.assign_team','activity.comment','activity.submit_review','notifications.view_self'))
  or (r.key in ('finance_manager','people_hr_manager','project_lead') and p.key in ('notes.manage_self','activity.assign_team','activity.comment','activity.submit_review','notifications.view_self'))
  or (r.key in ('staff','freelancer') and p.key in ('notes.manage_self','activity.comment','activity.submit_review','notifications.view_self'))
on conflict do nothing;

create table public.personal_notes (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_membership_id uuid not null references public.memberships(id) on delete cascade,
  title text,
  content text not null default '',
  tags text[] not null default '{}'::text[],
  color text not null default 'yellow' check (color in ('yellow','blue','green','pink','plain')),
  is_pinned boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(coalesce(title,'')) <= 180),
  check (char_length(content) <= 20000)
);

alter table public.activities
  add column if not exists assigned_by_membership_id uuid references public.memberships(id),
  add column if not exists reviewer_membership_id uuid references public.memberships(id),
  add column if not exists review_status text not null default 'not_submitted'
    check (review_status in ('not_submitted','waiting_review','approved','revision_requested')),
  add column if not exists review_note text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz;

create table public.activity_comments (
  id uuid primary key default extensions.gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  author_membership_id uuid not null references public.memberships(id),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_history (
  id bigint generated always as identity primary key,
  activity_id uuid not null references public.activities(id) on delete cascade,
  actor_membership_id uuid references public.memberships(id),
  event_type text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  recipient_membership_id uuid not null references public.memberships(id) on delete cascade,
  actor_membership_id uuid references public.memberships(id),
  notification_type text not null,
  title text not null,
  message text,
  entity_type text,
  entity_id text,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.finance_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null check (account_type in ('cash','bank','receivable','payable','income','expense','equity','asset')),
  opening_balance numeric(18,2) not null default 0,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_sequences (
  document_type text primary key check (document_type in ('transaction','quotation','invoice','receipt')),
  prefix text not null,
  period_key text not null,
  last_number integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.finance_sequences(document_type,prefix,period_key,last_number) values
  ('transaction','TRX',to_char(current_date,'YYYYMM'),0),
  ('quotation','QUO',to_char(current_date,'YYYYMM'),0),
  ('invoice','INV',to_char(current_date,'YYYYMM'),0),
  ('receipt','RCP',to_char(current_date,'YYYYMM'),0)
on conflict do nothing;

create table public.finance_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  document_type text not null check (document_type in ('quotation','invoice','receipt')),
  document_number text not null unique,
  document_date date not null,
  due_date date,
  client text not null,
  client_address text,
  project_name text,
  status text not null,
  subtotal numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  tax numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  paid numeric(18,2) not null default 0,
  balance numeric(18,2) not null default 0,
  reference_number text,
  linked_invoice_id uuid references public.finance_documents(id),
  google_doc_url text,
  pdf_url text,
  notes text,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_by_membership_id uuid not null references public.memberships(id),
  updated_by_membership_id uuid not null references public.memberships(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subtotal >= 0 and discount >= 0 and tax >= 0 and total >= 0 and paid >= 0 and balance >= 0)
);

create table public.finance_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  transaction_number text not null unique,
  transaction_date date not null,
  event_type text not null check (event_type in ('income','expense','receivable_recognition','receivable_receipt','adjustment','reversal')),
  flow text not null check (flow in ('in','out','non_cash')),
  account_id uuid references public.finance_accounts(id),
  category text not null,
  description text not null,
  counterparty text,
  amount numeric(18,2) not null check (amount > 0),
  reference_number text,
  document_id uuid references public.finance_documents(id),
  evidence_url text,
  status text not null default 'posted' check (status in ('draft','posted','reversed')),
  reversal_of_id uuid unique references public.finance_transactions(id),
  reversal_reason text,
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now()
);

create table public.finance_budgets (
  id uuid primary key default extensions.gen_random_uuid(),
  period_month date not null,
  category text not null,
  budget_type text not null default 'fixed_cost' check (budget_type in ('fixed_cost','project','company_fund')),
  planned_amount numeric(18,2) not null check (planned_amount >= 0),
  notes text,
  status text not null default 'active' check (status in ('draft','active','closed','archived')),
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(period_month, category, budget_type)
);

create table public.finance_assets (
  id uuid primary key default extensions.gen_random_uuid(),
  asset_code text not null unique,
  asset_name text not null,
  category text,
  acquisition_date date,
  acquisition_value numeric(18,2) not null default 0 check (acquisition_value >= 0),
  custodian text,
  condition text not null default 'good' check (condition in ('good','needs_attention','damaged','disposed')),
  notes text,
  is_active boolean not null default true,
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personal_notes_owner_updated_idx on public.personal_notes(owner_membership_id, is_pinned desc, updated_at desc);
create index activity_comments_activity_idx on public.activity_comments(activity_id, created_at);
create index activity_history_activity_idx on public.activity_history(activity_id, created_at desc);
create index notifications_recipient_idx on public.notifications(recipient_membership_id, read_at, created_at desc);
create index finance_documents_type_date_idx on public.finance_documents(document_type, document_date desc);
create index finance_documents_status_idx on public.finance_documents(status);
create index finance_transactions_date_idx on public.finance_transactions(transaction_date desc);
create index finance_transactions_document_idx on public.finance_transactions(document_id);

create or replace function public.can_access_activity(target_activity_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.activities a
    where a.id = target_activity_id and (
      a.owner_membership_id = public.current_membership_id()
      or a.assigned_by_membership_id = public.current_membership_id()
      or a.reviewer_membership_id = public.current_membership_id()
      or public.current_user_has_permission('activity.view_team')
    )
  );
$$;

create or replace function public.list_assignable_members()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.current_user_has_permission('activity.assign_team') then
    coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'email',m.email,'position',p.name) order by coalesce(m.full_name,m.email::text)), '[]'::jsonb)
  else '[]'::jsonb end
  from public.memberships m left join public.positions p on p.id=m.position_id where m.status='active';
$$;

create or replace function public.list_accessible_assignments()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(
    to_jsonb(a)
    || jsonb_build_object(
      'source_name',ws.name,'source_color',ws.color,
      'owner_name',coalesce(owner_m.full_name,owner_m.email::text),
      'assigned_by_name',coalesce(assigner_m.full_name,assigner_m.email::text),
      'reviewer_name',coalesce(reviewer_m.full_name,reviewer_m.email::text)
    ) order by a.activity_date desc,a.created_at desc
  ),'[]'::jsonb)
  from public.activities a
  join public.work_sources ws on ws.id=a.source_id
  join public.memberships owner_m on owner_m.id=a.owner_membership_id
  left join public.memberships assigner_m on assigner_m.id=a.assigned_by_membership_id
  left join public.memberships reviewer_m on reviewer_m.id=a.reviewer_membership_id
  where public.can_access_activity(a.id);
$$;

create or replace function public.save_assignment(
  assignment_id uuid, target_membership_id uuid, target_reviewer_id uuid, target_source_id uuid,
  assignment_title text, assignment_date date, assignment_priority text, assignment_detail text,
  assignment_output text, assignment_next_action text, assignment_evidence_url text
) returns uuid language plpgsql security definer set search_path=public as $$
declare saved_id uuid; before_row jsonb; after_row jsonb; actor_id uuid := public.current_membership_id();
begin
  if actor_id is null then raise exception 'Sesi anggota tidak valid.' using errcode='42501'; end if;
  if target_membership_id <> actor_id and not public.current_user_has_permission('activity.assign_team') then raise exception 'Izin assignment diperlukan.' using errcode='42501'; end if;
  if not public.can_access_work_source(target_source_id) and target_membership_id=actor_id then raise exception 'Sumber kerja tidak tersedia.' using errcode='42501'; end if;
  if assignment_id is null then
    insert into public.activities(owner_membership_id,assigned_by_membership_id,reviewer_membership_id,source_id,title,activity_date,priority,detail,output,next_action,evidence_url,created_by,updated_by)
    values(target_membership_id,actor_id,target_reviewer_id,target_source_id,trim(assignment_title),assignment_date,assignment_priority,nullif(trim(assignment_detail),''),nullif(trim(assignment_output),''),nullif(trim(assignment_next_action),''),nullif(trim(assignment_evidence_url),''),auth.uid(),auth.uid()) returning id into saved_id;
    insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url)
    values(target_membership_id,actor_id,'assignment','Assignment baru',trim(assignment_title),'activity',saved_id::text,'/ruang-kawan/activity/');
    insert into public.activity_history(activity_id,actor_membership_id,event_type,after_data) values(saved_id,actor_id,'assigned',jsonb_build_object('owner',target_membership_id,'reviewer',target_reviewer_id));
  else
    if not public.can_access_activity(assignment_id) then raise exception 'Assignment tidak dapat diakses.' using errcode='42501'; end if;
    select to_jsonb(a) into before_row from public.activities a where a.id=assignment_id;
    update public.activities set owner_membership_id=target_membership_id, reviewer_membership_id=target_reviewer_id, source_id=target_source_id,
      title=trim(assignment_title), activity_date=assignment_date, priority=assignment_priority, detail=nullif(trim(assignment_detail),''),
      output=nullif(trim(assignment_output),''), next_action=nullif(trim(assignment_next_action),''), evidence_url=nullif(trim(assignment_evidence_url),''), updated_by=auth.uid(), updated_at=now()
    where id=assignment_id returning id,to_jsonb(activities) into saved_id,after_row;
    insert into public.activity_history(activity_id,actor_membership_id,event_type,before_data,after_data) values(saved_id,actor_id,'updated',before_row,after_row);
  end if;
  return saved_id;
end; $$;

create or replace function public.submit_activity_review(target_activity_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare a public.activities%rowtype; actor_id uuid:=public.current_membership_id();
begin
  select * into a from public.activities where id=target_activity_id;
  if a.owner_membership_id<>actor_id or not public.current_user_has_permission('activity.submit_review') then raise exception 'Aktivitas tidak dapat diajukan.' using errcode='42501'; end if;
  if a.reviewer_membership_id is null then raise exception 'Reviewer belum ditetapkan.'; end if;
  update public.activities set review_status='waiting_review',submitted_at=now(),reviewed_at=null,review_note=null,updated_by=auth.uid(),updated_at=now() where id=target_activity_id;
  insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url)
  values(a.reviewer_membership_id,actor_id,'review_requested','Pekerjaan menunggu review',a.title,'activity',a.id::text,'/ruang-kawan/activity/');
  insert into public.activity_history(activity_id,actor_membership_id,event_type,after_data) values(a.id,actor_id,'review_submitted',jsonb_build_object('review_status','waiting_review'));
end; $$;

create or replace function public.review_activity(target_activity_id uuid, decision text, note text)
returns void language plpgsql security definer set search_path=public as $$
declare a public.activities%rowtype; actor_id uuid:=public.current_membership_id();
begin
  if decision not in ('approved','revision_requested') then raise exception 'Keputusan review tidak valid.'; end if;
  select * into a from public.activities where id=target_activity_id;
  if a.reviewer_membership_id<>actor_id and not public.current_user_has_permission('activity.review_team') then raise exception 'Izin review diperlukan.' using errcode='42501'; end if;
  if a.review_status<>'waiting_review' then raise exception 'Pekerjaan belum menunggu review.'; end if;
  if decision='revision_requested' and trim(coalesce(note,''))='' then raise exception 'Catatan revisi wajib diisi.'; end if;
  update public.activities set review_status=decision,review_note=nullif(trim(note),''),reviewed_at=now(),updated_by=auth.uid(),updated_at=now() where id=target_activity_id;
  insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url)
  values(a.owner_membership_id,actor_id,'review_result',case when decision='approved' then 'Pekerjaan disetujui' else 'Pekerjaan perlu revisi' end,coalesce(nullif(trim(note),''),a.title),'activity',a.id::text,'/ruang-kawan/activity/');
  insert into public.activity_history(activity_id,actor_membership_id,event_type,after_data) values(a.id,actor_id,'reviewed',jsonb_build_object('review_status',decision,'note',note));
end; $$;

create or replace function public.next_finance_number(target_type text)
returns text language plpgsql security definer set search_path=public as $$
declare current_period text:=to_char(current_date,'YYYYMM'); seq public.finance_sequences%rowtype;
begin
  if not public.current_user_has_permission('finance.manage') then raise exception 'Izin Finance diperlukan.' using errcode='42501'; end if;
  if target_type not in ('transaction','quotation','invoice','receipt') then raise exception 'Tipe nomor tidak valid.'; end if;
  select * into seq from public.finance_sequences where document_type=target_type for update;
  if seq.period_key<>current_period then seq.last_number:=0; seq.period_key:=current_period; end if;
  seq.last_number:=seq.last_number+1;
  update public.finance_sequences set period_key=seq.period_key,last_number=seq.last_number,updated_at=now() where document_type=target_type;
  return seq.prefix||'-'||seq.period_key||'-'||lpad(seq.last_number::text,4,'0');
end; $$;

create or replace function public.finance_create_transaction(tx_date date, tx_event_type text, tx_flow text, tx_account_id uuid, tx_category text, tx_description text, tx_counterparty text, tx_amount numeric, tx_reference text, tx_evidence_url text)
returns uuid language plpgsql security definer set search_path=public as $$
declare saved_id uuid; actor_id uuid:=public.current_membership_id(); tx_number text;
begin
  if not public.current_user_has_permission('finance.manage') then raise exception 'Izin Finance diperlukan.' using errcode='42501'; end if;
  if tx_event_type not in ('income','expense','adjustment') then raise exception 'Jenis transaksi manual tidak valid.'; end if;
  if tx_amount<=0 then raise exception 'Nominal harus lebih dari nol.'; end if;
  tx_number:=public.next_finance_number('transaction');
  insert into public.finance_transactions(transaction_number,transaction_date,event_type,flow,account_id,category,description,counterparty,amount,reference_number,evidence_url,created_by_membership_id)
  values(tx_number,tx_date,tx_event_type,tx_flow,tx_account_id,trim(tx_category),trim(tx_description),nullif(trim(tx_counterparty),''),tx_amount,nullif(trim(tx_reference),''),nullif(trim(tx_evidence_url),''),actor_id) returning id into saved_id;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),'finance.transaction.create','finance_transaction',saved_id::text,jsonb_build_object('number',tx_number,'amount',tx_amount,'flow',tx_flow));
  return saved_id;
end; $$;

create or replace function public.finance_reverse_transaction(target_transaction_id uuid, reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare original public.finance_transactions%rowtype; saved_id uuid; actor_id uuid:=public.current_membership_id(); tx_number text;
begin
  if not public.current_user_has_permission('finance.manage') then raise exception 'Izin Finance diperlukan.' using errcode='42501'; end if;
  if char_length(trim(coalesce(reason,'')))<5 then raise exception 'Alasan reversal wajib diisi.'; end if;
  select * into original from public.finance_transactions where id=target_transaction_id for update;
  if original.id is null or original.status<>'posted' then raise exception 'Transaksi tidak dapat direversal.'; end if;
  tx_number:=public.next_finance_number('transaction');
  insert into public.finance_transactions(transaction_number,transaction_date,event_type,flow,account_id,category,description,counterparty,amount,reference_number,status,reversal_of_id,reversal_reason,created_by_membership_id)
  values(tx_number,current_date,'reversal',case original.flow when 'in' then 'out' when 'out' then 'in' else 'non_cash' end,original.account_id,original.category,'Reversal '||original.transaction_number,original.counterparty,original.amount,original.transaction_number,'posted',original.id,trim(reason),actor_id) returning id into saved_id;
  update public.finance_transactions set status='reversed' where id=original.id;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,reason) values(auth.uid(),'finance.transaction.reverse','finance_transaction',original.id::text,to_jsonb(original),jsonb_build_object('reversal_id',saved_id,'reversal_number',tx_number),trim(reason));
  return saved_id;
end; $$;

create or replace function public.finance_invoice_status(paid_value numeric,balance_value numeric,due_value date)
returns text language sql stable as $$
  select case when balance_value<=0 then 'Paid' when paid_value>0 then 'Partially Paid' when due_value<current_date then 'Overdue' else 'Unpaid' end;
$$;

create or replace function public.finance_create_document(
  doc_type text, doc_date date, doc_due_date date, doc_client text, doc_client_address text,
  doc_project text, doc_discount numeric, doc_tax numeric, doc_notes text, doc_items jsonb,
  doc_linked_invoice_id uuid, receipt_amount numeric
) returns uuid language plpgsql security definer set search_path=public as $$
declare saved_id uuid; actor_id uuid:=public.current_membership_id(); doc_number text; subtotal_value numeric:=0; total_value numeric:=0; due_value date; invoice_row public.finance_documents%rowtype; tx_number text;
begin
  if not public.current_user_has_permission('finance.manage') then raise exception 'Izin Finance diperlukan.' using errcode='42501'; end if;
  if doc_type not in ('quotation','invoice','receipt') then raise exception 'Tipe dokumen tidak valid.'; end if;
  if trim(coalesce(doc_client,''))='' then raise exception 'Nama client wajib diisi.'; end if;
  if jsonb_typeof(coalesce(doc_items,'[]'::jsonb))<>'array' then raise exception 'Item dokumen tidak valid.'; end if;
  select coalesce(sum(greatest(0,coalesce((item->>'quantity')::numeric,0))*greatest(0,coalesce((item->>'unit_price')::numeric,0))),0) into subtotal_value from jsonb_array_elements(coalesce(doc_items,'[]'::jsonb)) item;
  if doc_type='receipt' then
    select * into invoice_row from public.finance_documents where id=doc_linked_invoice_id and document_type='invoice' and deleted_at is null for update;
    if invoice_row.id is null then raise exception 'Invoice terkait tidak ditemukan.'; end if;
    if receipt_amount<=0 or receipt_amount>invoice_row.balance then raise exception 'Nominal receipt melebihi outstanding invoice atau tidak valid.'; end if;
    subtotal_value:=receipt_amount; doc_client:=invoice_row.client; doc_project:=invoice_row.project_name;
  end if;
  total_value:=greatest(0,subtotal_value-greatest(0,coalesce(doc_discount,0))+greatest(0,coalesce(doc_tax,0)));
  if total_value<=0 then raise exception 'Total dokumen harus lebih dari nol.'; end if;
  due_value:=case when doc_type='invoice' then coalesce(doc_due_date,doc_date+14) else doc_due_date end;
  doc_number:=public.next_finance_number(doc_type);
  insert into public.finance_documents(document_type,document_number,document_date,due_date,client,client_address,project_name,status,subtotal,discount,tax,total,paid,balance,linked_invoice_id,notes,items,created_by_membership_id,updated_by_membership_id)
  values(doc_type,doc_number,doc_date,due_value,trim(doc_client),nullif(trim(doc_client_address),''),nullif(trim(doc_project),''),case doc_type when 'quotation' then 'Draft' when 'invoice' then public.finance_invoice_status(0,total_value,due_value) else 'Paid' end,subtotal_value,greatest(0,coalesce(doc_discount,0)),greatest(0,coalesce(doc_tax,0)),total_value,case when doc_type='receipt' then total_value else 0 end,case when doc_type='receipt' then 0 else total_value end,doc_linked_invoice_id,nullif(trim(doc_notes),''),coalesce(doc_items,'[]'::jsonb),actor_id,actor_id) returning id into saved_id;
  if doc_type='invoice' then
    tx_number:=public.next_finance_number('transaction');
    insert into public.finance_transactions(transaction_number,transaction_date,event_type,flow,category,description,counterparty,amount,reference_number,document_id,created_by_membership_id)
    values(tx_number,doc_date,'receivable_recognition','non_cash','Piutang','Pengakuan piutang '||doc_number,trim(doc_client),total_value,doc_number,saved_id,actor_id);
  elsif doc_type='receipt' then
    update public.finance_documents set paid=paid+total_value,balance=balance-total_value,status=public.finance_invoice_status(paid+total_value,balance-total_value,due_date),updated_at=now(),updated_by_membership_id=actor_id where id=invoice_row.id;
    tx_number:=public.next_finance_number('transaction');
    insert into public.finance_transactions(transaction_number,transaction_date,event_type,flow,category,description,counterparty,amount,reference_number,document_id,created_by_membership_id)
    values(tx_number,doc_date,'receivable_receipt','in','Penerimaan Piutang','Penerimaan '||doc_number,invoice_row.client,total_value,invoice_row.document_number,saved_id,actor_id);
  end if;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),'finance.document.create','finance_document',saved_id::text,jsonb_build_object('number',doc_number,'type',doc_type,'total',total_value));
  return saved_id;
end; $$;

alter table public.personal_notes enable row level security;
alter table public.activity_comments enable row level security;
alter table public.activity_history enable row level security;
alter table public.notifications enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_sequences enable row level security;
alter table public.finance_documents enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_budgets enable row level security;
alter table public.finance_assets enable row level security;

create policy "Own private notes" on public.personal_notes for all to authenticated using(owner_membership_id=public.current_membership_id()) with check(owner_membership_id=public.current_membership_id() and public.current_user_has_permission('notes.manage_self'));
create policy "Read accessible activity comments" on public.activity_comments for select to authenticated using(public.can_access_activity(activity_id));
create policy "Add accessible activity comments" on public.activity_comments for insert to authenticated with check(author_membership_id=public.current_membership_id() and public.can_access_activity(activity_id) and public.current_user_has_permission('activity.comment'));
create policy "Read accessible activity history" on public.activity_history for select to authenticated using(public.can_access_activity(activity_id));
create policy "Read own notifications" on public.notifications for select to authenticated using(recipient_membership_id=public.current_membership_id());
create policy "Update own notifications" on public.notifications for update to authenticated using(recipient_membership_id=public.current_membership_id()) with check(recipient_membership_id=public.current_membership_id());

create policy "Finance view accounts" on public.finance_accounts for select to authenticated using(public.current_user_has_permission('finance.view'));
create policy "Finance manage accounts" on public.finance_accounts for all to authenticated using(public.current_user_has_permission('finance.manage')) with check(public.current_user_has_permission('finance.manage'));
create policy "Finance view documents" on public.finance_documents for select to authenticated using(public.current_user_has_permission('finance.view'));
create policy "Finance manage documents" on public.finance_documents for all to authenticated using(public.current_user_has_permission('finance.manage')) with check(public.current_user_has_permission('finance.manage'));
create policy "Finance view transactions" on public.finance_transactions for select to authenticated using(public.current_user_has_permission('finance.view'));
create policy "Finance view budgets" on public.finance_budgets for select to authenticated using(public.current_user_has_permission('finance.view'));
create policy "Finance manage budgets" on public.finance_budgets for all to authenticated using(public.current_user_has_permission('finance.manage')) with check(public.current_user_has_permission('finance.manage'));
create policy "Finance view assets" on public.finance_assets for select to authenticated using(public.current_user_has_permission('finance.view'));
create policy "Finance manage assets" on public.finance_assets for all to authenticated using(public.current_user_has_permission('finance.manage')) with check(public.current_user_has_permission('finance.manage'));

grant select,insert,update,delete on public.personal_notes to authenticated;
grant select,insert,update on public.activity_comments to authenticated;
grant select on public.activity_history to authenticated;
grant select,update on public.notifications to authenticated;
grant select,insert,update on public.finance_accounts,public.finance_documents,public.finance_budgets,public.finance_assets to authenticated;
grant select on public.finance_transactions to authenticated;
revoke all on public.finance_sequences from anon,authenticated;

revoke all on function public.can_access_activity(uuid),public.list_assignable_members(),public.list_accessible_assignments(),public.save_assignment(uuid,uuid,uuid,uuid,text,date,text,text,text,text,text),public.submit_activity_review(uuid),public.review_activity(uuid,text,text),public.next_finance_number(text),public.finance_create_transaction(date,text,text,uuid,text,text,text,numeric,text,text),public.finance_reverse_transaction(uuid,text),public.finance_invoice_status(numeric,numeric,date),public.finance_create_document(text,date,date,text,text,text,numeric,numeric,text,jsonb,uuid,numeric) from public,anon;
grant execute on function public.can_access_activity(uuid),public.list_assignable_members(),public.list_accessible_assignments(),public.save_assignment(uuid,uuid,uuid,uuid,text,date,text,text,text,text,text),public.submit_activity_review(uuid),public.review_activity(uuid,text,text),public.next_finance_number(text),public.finance_create_transaction(date,text,text,uuid,text,text,text,numeric,text,text),public.finance_reverse_transaction(uuid,text),public.finance_invoice_status(numeric,numeric,date),public.finance_create_document(text,date,date,text,text,text,numeric,numeric,text,jsonb,uuid,numeric) to authenticated;
