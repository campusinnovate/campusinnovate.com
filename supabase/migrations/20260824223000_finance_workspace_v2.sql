-- Finance Workspace V2: mirrors CI Finance Control workbook semantics in Supabase.

create table if not exists public.finance_coa (
  code text primary key,
  name text not null,
  account_class text not null,
  cash_flow_category text not null,
  default_flow text not null check (default_flow in ('Masuk','Keluar','Non-Kas')),
  cost_nature text not null default 'Non-Beban',
  control_position text not null default 'Normal',
  retained_earnings_impact text not null default 'Tidak Langsung',
  default_event text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_transaction_catalog (
  event_name text primary key,
  group_key text not null check (group_key in ('cash-in','cash-out','non-cash','control')),
  group_label text not null,
  label text not null,
  flow text not null check (flow in ('Masuk','Keluar','Non-Kas')),
  default_coa text references public.finance_coa(code),
  description text not null,
  requires_reference boolean not null default false,
  requires_due_date boolean not null default false,
  creates_asset boolean not null default false,
  sort_order integer not null
);

create table if not exists public.finance_option_values (
  option_group text not null,
  option_value text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  primary key(option_group,option_value)
);

create table if not exists public.finance_settings (
  setting_key text primary key,
  setting_value text not null default '',
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.finance_coa(code,name,account_class,cash_flow_category,default_flow,cost_nature,control_position,retained_earnings_impact,default_event) values
('1000','Pendapatan Usaha - Jasa','Pendapatan','Operasional','Masuk','Non-Beban','Normal','Tambah via Laba','Pendapatan Kas'),
('1001','Pendapatan Usaha - Produk','Pendapatan','Operasional','Masuk','Non-Beban','Normal','Tambah via Laba','Pendapatan Kas'),
('1002','Pendapatan Lain-lain','Pendapatan','Operasional','Masuk','Non-Beban','Normal','Tambah via Laba','Pendapatan Kas'),
('2000','Piutang Usaha','Aset','Operasional','Non-Kas','Non-Beban','Piutang','Tidak Langsung','Pengakuan Piutang'),
('2001','Piutang Pihak Terkait','Aset','Investasi','Keluar','Non-Beban','Piutang','Tidak Langsung','Penyaluran Piutang'),
('2002','Penerimaan/Pelunasan Piutang Pihak Terkait','Aset','Piutang','Masuk','Non-Beban','Piutang','Tidak Langsung','Penerimaan Piutang'),
('2003','Penerimaan/Pelunasan Piutang Usaha','Aset','Piutang','Masuk','Non-Beban','Piutang Usaha','Tidak Langsung','Penerimaan Piutang'),
('3000','Beban Gaji & Insentif','Beban Operasional','Operasional','Keluar','Tetap','Normal','Kurang via Laba','Beban Dibayar'),
('3001','Beban Sewa Kantor','Beban Operasional','Operasional','Keluar','Tetap','Normal','Kurang via Laba','Beban Dibayar'),
('3002','Beban Konsumsi & Meeting','Beban Operasional','Operasional','Keluar','Variabel','Normal','Kurang via Laba','Beban Dibayar'),
('3003','Beban Pemasaran & Kemitraan','Beban Operasional','Operasional','Keluar','Variabel','Normal','Kurang via Laba','Beban Dibayar'),
('3004','Beban ATK & Perlengkapan Umum','Beban Operasional','Operasional','Keluar','Variabel','Normal','Kurang via Laba','Beban Dibayar'),
('3005','Beban Software & Langganan','Beban Operasional','Operasional','Keluar','Tetap','Normal','Kurang via Laba','Beban Dibayar'),
('3006','Beban Internet & Komunikasi','Beban Operasional','Operasional','Keluar','Tetap','Normal','Kurang via Laba','Beban Dibayar'),
('3007','Beban Keamanan & Listrik','Beban Operasional','Operasional','Keluar','Tetap','Normal','Kurang via Laba','Beban Dibayar'),
('3008','Beban Operasional Lainnya','Beban Operasional','Operasional','Keluar','Variabel','Normal','Kurang via Laba','Beban Dibayar'),
('3009','Beban Website & Digital Produk','Beban Operasional','Operasional','Keluar','Variabel','Normal','Kurang via Laba','Beban Dibayar'),
('3100','Biaya Produksi, Cetak & Perlengkapan Proyek','Beban Langsung Proyek','Operasional','Keluar','Langsung Proyek','Normal','Kurang via Laba','Beban Dibayar'),
('3101','Biaya Vendor & Talent Proyek','Beban Langsung Proyek','Operasional','Keluar','Langsung Proyek','Normal','Kurang via Laba','Beban Dibayar'),
('3102','Honor Crew & SDM Proyek','Beban Langsung Proyek','Operasional','Keluar','Langsung Proyek','Normal','Kurang via Laba','Beban Dibayar'),
('3103','Transportasi & Logistik Proyek','Beban Langsung Proyek','Operasional','Keluar','Langsung Proyek','Normal','Kurang via Laba','Beban Dibayar'),
('3104','Konsumsi & Hospitality Proyek','Beban Langsung Proyek','Operasional','Keluar','Langsung Proyek','Normal','Kurang via Laba','Beban Dibayar'),
('3105','Sewa Venue & Fasilitas Proyek','Beban Langsung Proyek','Operasional','Keluar','Langsung Proyek','Normal','Kurang via Laba','Beban Dibayar'),
('3106','Reimburse & Operasional Proyek','Beban Langsung Proyek','Operasional','Keluar','Langsung Proyek','Normal','Kurang via Laba','Beban Dibayar'),
('3200','Refund / Pengembalian Dana Vendor','Kontra Beban','Operasional','Masuk','Pengurang Beban','Normal','Tambah via Laba','Refund Biaya'),
('3900','Beban Penalti & Koreksi Proyek','Beban Non-Operasional','Operasional','Keluar','Variabel','Normal','Kurang via Laba','Beban Dibayar'),
('5000','Beban Pajak','Pajak','Operasional','Keluar','Variabel','Normal','Kurang via Laba','Beban Dibayar'),
('6000','Penambahan Modal / Investasi Masuk','Ekuitas','Pendanaan','Masuk','Non-Beban','Modal','Tidak Langsung','Penerimaan Modal'),
('6001','Pembayaran Bagi Hasil Eksekutif (40%)','Ekuitas','Pendanaan','Keluar','Non-Beban','Hak Eksekutif','Kurang Langsung','Pembayaran Bagi Hasil Eksekutif'),
('6002','Penyesuaian Dana Bagian Perusahaan','Kontrol Dana','Non-Kas','Non-Kas','Non-Beban','Dana Bagian Perusahaan','Penyesuaian Langsung','Penyesuaian Dana Bagian Perusahaan'),
('6003','Alokasi Dana Bagian Perusahaan (60%)','Kontrol Dana','Non-Kas','Non-Kas','Non-Beban','Dana Bagian Perusahaan','Tidak Langsung','Alokasi Dana Bagian Perusahaan'),
('7000','Pembelian Aset Tetap','Aset','Investasi','Keluar','Non-Beban','Aset','Tidak Langsung','Pembelian Aset'),
('7001','Penjualan Aset Tetap','Aset','Investasi','Masuk','Non-Beban','Aset','Tidak Langsung','Penjualan Aset'),
('8000','Pinjaman Bank Diterima','Kewajiban','Pendanaan','Masuk','Non-Beban','Kewajiban','Tidak Langsung','Penerimaan Pinjaman'),
('8001','Pembayaran Kewajiban / Utang','Kewajiban','Operasional','Keluar','Non-Beban','Kewajiban','Tidak Langsung','Pembayaran Kewajiban'),
('8002','Pengakuan Kewajiban / Utang','Kewajiban','Non-Kas','Non-Kas','Non-Beban','Kewajiban','Tidak Langsung','Pengakuan Kewajiban'),
('8003','Alokasi Hak Bagi Hasil Eksekutif (40%)','Kewajiban','Non-Kas','Non-Kas','Non-Beban','Hak Eksekutif','Tidak Langsung','Alokasi Hak Bagi Hasil Eksekutif'),
('9000','Alokasi Dana Terikat','Kontrol Dana','Non-Kas','Non-Kas','Non-Beban','Dana Terikat','Tidak Langsung','Alokasi Dana Terikat'),
('9001','Pelepasan Dana Terikat','Kontrol Dana','Non-Kas','Non-Kas','Non-Beban','Dana Terikat','Tidak Langsung','Pelepasan Dana Terikat'),
('9100','Saldo Aktual Rekening Bank','Kontrol Saldo','Non-Kas','Non-Kas','Non-Beban','Saldo Aktual','Tidak Langsung','Saldo Aktual Bank'),
('9200','Potential Lead / Pipeline Aktif','Kontrol Pipeline','Non-Kas','Non-Kas','Non-Beban','Potential Lead','Tidak Langsung','Potential Lead'),
('9201','Penutupan Potential Lead','Kontrol Pipeline','Non-Kas','Non-Kas','Non-Beban','Potential Lead','Tidak Langsung','Penutupan Potential Lead')
on conflict(code) do update set name=excluded.name,account_class=excluded.account_class,cash_flow_category=excluded.cash_flow_category,default_flow=excluded.default_flow,cost_nature=excluded.cost_nature,control_position=excluded.control_position,retained_earnings_impact=excluded.retained_earnings_impact,default_event=excluded.default_event,is_active=true,updated_at=now();

insert into public.finance_transaction_catalog(event_name,group_key,group_label,label,flow,default_coa,description,requires_reference,requires_due_date,creates_asset,sort_order) values
('Pendapatan Kas','cash-in','Cash In','Pendapatan diterima','Masuk','1000','Penerimaan pendapatan jasa atau usaha.',false,false,false,10),
('Penerimaan Piutang','cash-in','Cash In','Penerimaan piutang','Masuk','2003','Pembayaran atas invoice atau piutang yang telah diakui.',true,false,false,20),
('Refund Biaya','cash-in','Cash In','Refund biaya','Masuk','3200','Pengembalian biaya dari vendor.',false,false,false,30),
('Penerimaan Modal','cash-in','Cash In','Penerimaan modal','Masuk','6000','Setoran modal atau investasi.',false,false,false,40),
('Penerimaan Pinjaman','cash-in','Cash In','Penerimaan pinjaman','Masuk','8000','Dana pinjaman yang diterima perusahaan.',false,false,false,50),
('Beban Dibayar','cash-out','Cash Out','Beban dibayar','Keluar',null,'Pembayaran biaya operasional atau proyek.',false,false,false,60),
('Pembayaran Kewajiban','cash-out','Cash Out','Pembayaran kewajiban','Keluar','8001','Pelunasan kewajiban yang telah diakui.',true,false,false,70),
('Pembelian Aset','cash-out','Cash Out','Pembelian aset','Keluar','7000','Pembelian aset fisik atau digital.',false,false,true,80),
('Pembayaran Bagi Hasil Eksekutif','cash-out','Cash Out','Pembayaran hak eksekutif','Keluar','6001','Pembayaran pool eksekutif.',true,false,false,90),
('Penjualan Aset','cash-out','Cash Out','Penjualan aset','Masuk','7001','Penerimaan dari penjualan aset.',false,false,false,100),
('Pengakuan Piutang','non-cash','Non-Cash','Pengakuan piutang','Non-Kas','2000','Penerbitan invoice atau pengakuan tagihan.',true,true,false,110),
('Penyaluran Piutang','non-cash','Non-Cash','Penyaluran piutang','Non-Kas','2001','Tambahan nilai pada referensi piutang.',true,true,false,120),
('Pengakuan Kewajiban','non-cash','Non-Cash','Pengakuan kewajiban','Non-Kas','8002','Pengakuan tagihan vendor atau kewajiban.',true,true,false,130),
('Alokasi Dana Bagian Perusahaan','non-cash','Non-Cash','Alokasi dana perusahaan','Non-Kas','6003','Mengalokasikan bagian perusahaan dari laba proyek.',true,false,false,140),
('Alokasi Hak Bagi Hasil Eksekutif','non-cash','Non-Cash','Alokasi hak eksekutif','Non-Kas','8003','Mengakui hak eksekutif dari laba proyek.',true,false,false,150),
('Alokasi Dana Terikat','non-cash','Non-Cash','Alokasi dana terikat','Non-Kas','9000','Mengalokasikan dana untuk kebutuhan tertentu.',true,false,false,160),
('Potential Lead','non-cash','Non-Cash','Potential lead','Non-Kas','9200','Mencatat nilai pipeline potensial.',true,false,false,170),
('Saldo Aktual Bank','control','Control Entry','Saldo aktual bank','Non-Kas','9100','Snapshot saldo aktual rekening untuk rekonsiliasi.',false,false,false,180),
('Penutupan Potential Lead','control','Control Entry','Penutupan potential lead','Non-Kas','9201','Menutup lead yang tidak lagi aktif.',true,false,false,190),
('Pelepasan Dana Terikat','control','Control Entry','Pelepasan dana terikat','Non-Kas','9001','Melepas dana terikat.',true,false,false,200),
('Penyesuaian Dana Bagian Perusahaan','control','Control Entry','Penyesuaian dana perusahaan','Non-Kas','6002','Koreksi atau penyesuaian kontrol dana.',true,false,false,210)
on conflict(event_name) do update set group_key=excluded.group_key,group_label=excluded.group_label,label=excluded.label,flow=excluded.flow,default_coa=excluded.default_coa,description=excluded.description,requires_reference=excluded.requires_reference,requires_due_date=excluded.requires_due_date,creates_asset=excluded.creates_asset,sort_order=excluded.sort_order;

insert into public.finance_option_values(option_group,option_value,sort_order) values
('bank','Bank BCA - Rekening Utama',10),('bank','Bank Mandiri - Operasional',20),('bank','Bank BNI - Proyek',30),('bank','Kas Kecil (Petty Cash)',40),
('fund_source','Operasional Umum',10),('fund_source','Bagian Perusahaan (60%)',20),('fund_source','Hak Eksekutif (40%)',30),('fund_source','Dana Proyek',40),('fund_source','Dana Terikat',50),('fund_source','Modal/Investasi',60),('fund_source','Pinjaman',70),('fund_source','Lainnya',80),
('fund_use','Operasional / Fixed Cost',10),('fund_use','Laba Ditahan',20),('fund_use','Dana Darurat',30),('fund_use','Hak Eksekutif',40),('fund_use','Dana Proyek',50),('fund_use','Modal / Pinjaman',60),('fund_use','Lainnya',70),
('asset_type','Fisik',10),('asset_type','Digital',20),
('asset_status','Aktif',10),('asset_status','Tidak Aktif',20),('asset_status','Dalam Perbaikan',30),('asset_status','Dijual',40),('asset_status','Rusak',50),('asset_status','Berakhir',60),
('allocation_status','Draft',10),('allocation_status','Approved',20),
('document_status_quotation','Draft',10),('document_status_quotation','Sent',20),('document_status_quotation','Accepted',30),('document_status_quotation','Rejected',40),('document_status_quotation','Expired',50),('document_status_quotation','Cancelled',60),
('document_status_invoice','Draft',10),('document_status_invoice','Issued',20),('document_status_invoice','Unpaid',30),('document_status_invoice','Partially Paid',40),('document_status_invoice','Paid',50),('document_status_invoice','Overdue',60),('document_status_invoice','Cancelled',70),
('document_status_receipt','Issued',10),('document_status_receipt','Cancelled',20),
('fund_position','Operasional / Fixed Cost',10),('fund_position','Laba Ditahan',20),('fund_position','Dana Darurat',30),('fund_position','Hak Eksekutif',40)
on conflict(option_group,option_value) do update set sort_order=excluded.sort_order,is_active=true;

insert into public.finance_settings(setting_key,setting_value,description) values
('company_name','Campus Innovate','Nama perusahaan'),('workspace_name','Finance Workspace','Nama workspace'),('fiscal_year','2026','Tahun buku'),('currency','IDR','Mata uang'),('emergency_target_months','3','Target dana darurat dalam bulan fixed cost'),('cash_runway_target_months','3','Target cash runway'),('default_invoice_terms_days','14','Jatuh tempo invoice default'),('invoice_prefix','INV','Prefix Invoice'),('quotation_prefix','QUO','Prefix Quotation'),('receipt_prefix','RCP','Prefix Receipt')
on conflict(setting_key) do nothing;

alter table public.finance_transactions
  add column if not exists project_name text,
  add column if not exists coa_code text references public.finance_coa(code),
  add column if not exists account_name text,
  add column if not exists account_class text,
  add column if not exists cash_flow_category text,
  add column if not exists transaction_event text references public.finance_transaction_catalog(event_name),
  add column if not exists bank_account text,
  add column if not exists due_date date,
  add column if not exists auto_status text,
  add column if not exists cost_nature text,
  add column if not exists control_position text,
  add column if not exists notes text,
  add column if not exists fund_source text,
  add column if not exists fund_use text,
  add column if not exists profit_allocation_code text;

alter table public.finance_budgets
  add column if not exists coa_code text references public.finance_coa(code),
  add column if not exists allocated_amount numeric(18,2) not null default 0,
  add column if not exists pic text;
alter table public.finance_budgets drop constraint if exists finance_budgets_status_check;

alter table public.finance_assets
  add column if not exists asset_type text not null default 'Fisik',
  add column if not exists asset_status text not null default 'Aktif',
  add column if not exists useful_life_months integer not null default 36,
  add column if not exists fund_source text,
  add column if not exists location text,
  add column if not exists pic text,
  add column if not exists expiry_date date,
  add column if not exists serial_or_account text,
  add column if not exists evidence_url text,
  add column if not exists journal_reference text;

create table if not exists public.finance_profit_allocations (
  id uuid primary key default extensions.gen_random_uuid(),
  allocation_code text not null unique,
  status text not null default 'Draft' check(status in ('Draft','Approved')),
  closing_date date not null,
  project_name text not null,
  approved_profit numeric(18,2) not null check(approved_profit>0),
  company_share numeric(18,2) generated always as (round(approved_profit*0.60,2)) stored,
  executive_share numeric(18,2) generated always as (round(approved_profit*0.40,2)) stored,
  operational_fixed_cost numeric(18,2) not null default 0 check(operational_fixed_cost>=0),
  company_remainder numeric(18,2) generated always as (greatest(round(approved_profit*0.60,2)-operational_fixed_cost,0)) stored,
  retained_earnings numeric(18,2) generated always as (round(greatest(round(approved_profit*0.60,2)-operational_fixed_cost,0)*0.50,2)) stored,
  emergency_fund numeric(18,2) generated always as (round(greatest(round(approved_profit*0.60,2)-operational_fixed_cost,0)*0.50,2)) stored,
  ceo_pool numeric(18,2) generated always as (round(approved_profit*0.40*0.40,2)) stored,
  coo_pool numeric(18,2) generated always as (round(approved_profit*0.40*0.30,2)) stored,
  cto_pool numeric(18,2) generated always as (round(approved_profit*0.40*0.30,2)) stored,
  reference_number text,
  notes text,
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now()
);

create table if not exists public.finance_fund_openings (
  position text primary key,
  opening_balance numeric(18,2) not null default 0,
  target_minimum numeric(18,2) not null default 0,
  updated_at timestamptz not null default now(),
  updated_by_membership_id uuid references public.memberships(id)
);
insert into public.finance_fund_openings(position,opening_balance,target_minimum) values
('Operasional / Fixed Cost',0,0),('Laba Ditahan',0,0),('Dana Darurat',0,0),('Hak Eksekutif',0,0)
on conflict(position) do nothing;

alter table public.finance_coa enable row level security;
alter table public.finance_transaction_catalog enable row level security;
alter table public.finance_option_values enable row level security;
alter table public.finance_settings enable row level security;
alter table public.finance_profit_allocations enable row level security;
alter table public.finance_fund_openings enable row level security;

drop policy if exists finance_coa_view on public.finance_coa;
create policy finance_coa_view on public.finance_coa for select using(public.current_user_has_permission('finance.view'));
drop policy if exists finance_catalog_view on public.finance_transaction_catalog;
create policy finance_catalog_view on public.finance_transaction_catalog for select using(public.current_user_has_permission('finance.view'));
drop policy if exists finance_options_view on public.finance_option_values;
create policy finance_options_view on public.finance_option_values for select using(public.current_user_has_permission('finance.view'));
drop policy if exists finance_settings_view on public.finance_settings;
create policy finance_settings_view on public.finance_settings for select using(public.current_user_has_permission('finance.view'));
drop policy if exists finance_allocations_view on public.finance_profit_allocations;
create policy finance_allocations_view on public.finance_profit_allocations for select using(public.current_user_has_permission('finance.view'));
drop policy if exists finance_openings_view on public.finance_fund_openings;
create policy finance_openings_view on public.finance_fund_openings for select using(public.current_user_has_permission('finance.view'));

create or replace function public.finance_next_allocation_code()
returns text language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  if not public.current_user_has_permission('finance.manage') then raise exception 'Izin Finance diperlukan.' using errcode='42501'; end if;
  select coalesce(max(nullif(regexp_replace(allocation_code,'\\D','','g'), '')::integer),0)+1 into n from public.finance_profit_allocations;
  return 'ALC-'||lpad(n::text,4,'0');
end $$;

create or replace function public.finance_create_journal_entry(
  entry_date date, entry_project text, entry_coa_code text, entry_description text,
  entry_amount numeric, entry_bank text, entry_event text, entry_reference text,
  entry_counterparty text, entry_due_date date, entry_notes text, entry_fund_source text,
  entry_fund_use text, entry_allocation_code text, entry_evidence_url text
) returns uuid language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); saved_id uuid; tx_number text; coa public.finance_coa%rowtype; catalog public.finance_transaction_catalog%rowtype; internal_event text; internal_flow text; calculated_status text;
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
  internal_event:=case when entry_event='Pengakuan Piutang' then 'receivable_recognition' when entry_event='Penerimaan Piutang' then 'receivable_receipt' when catalog.flow='Masuk' then 'income' when catalog.flow='Keluar' then 'expense' else 'adjustment' end;
  calculated_status:=case when entry_due_date is not null and entry_due_date<current_date and entry_event in ('Pengakuan Piutang','Penyaluran Piutang','Pengakuan Kewajiban') then 'OVERDUE' else 'SELESAI' end;
  tx_number:=public.next_finance_number('transaction');
  insert into public.finance_transactions(transaction_number,transaction_date,event_type,flow,category,description,counterparty,amount,reference_number,evidence_url,status,created_by_membership_id,project_name,coa_code,account_name,account_class,cash_flow_category,transaction_event,bank_account,due_date,auto_status,cost_nature,control_position,notes,fund_source,fund_use,profit_allocation_code)
  values(tx_number,entry_date,internal_event,internal_flow,coa.name,trim(entry_description),nullif(trim(entry_counterparty),''),entry_amount,nullif(trim(entry_reference),''),nullif(trim(entry_evidence_url),''),'posted',actor_id,nullif(trim(entry_project),''),coa.code,coa.name,coa.account_class,coa.cash_flow_category,catalog.event_name,nullif(trim(entry_bank),''),entry_due_date,calculated_status,coa.cost_nature,coa.control_position,nullif(trim(entry_notes),''),nullif(trim(entry_fund_source),''),nullif(trim(entry_fund_use),''),nullif(trim(entry_allocation_code),'')) returning id into saved_id;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),'finance.journal.create','finance_transaction',saved_id::text,jsonb_build_object('number',tx_number,'event',entry_event,'coa',coa.code,'amount',entry_amount));
  return saved_id;
end $$;

create or replace function public.finance_save_budget(budget_id uuid,budget_period date,budget_coa text,budget_component text,budget_amount numeric,budget_allocated numeric,budget_pic text,budget_notes text)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); saved_id uuid;
begin
  if not public.current_user_has_permission('finance.manage') then raise exception 'Izin Finance diperlukan.' using errcode='42501'; end if;
  if budget_period is null or trim(coalesce(budget_coa,''))='' or trim(coalesce(budget_component,''))='' then raise exception 'Periode, COA, dan komponen wajib diisi.'; end if;
  if budget_id is null then
    insert into public.finance_budgets(period_month,category,budget_type,planned_amount,allocated_amount,pic,notes,status,coa_code,created_by_membership_id)
    values(date_trunc('month',budget_period)::date,trim(budget_component),'fixed_cost',greatest(coalesce(budget_amount,0),0),greatest(coalesce(budget_allocated,0),0),nullif(trim(budget_pic),''),nullif(trim(budget_notes),''),'active',budget_coa,actor_id)
    on conflict(period_month,category,budget_type) do update set planned_amount=excluded.planned_amount,allocated_amount=excluded.allocated_amount,pic=excluded.pic,notes=excluded.notes,coa_code=excluded.coa_code,updated_at=now() returning id into saved_id;
  else
    update public.finance_budgets set period_month=date_trunc('month',budget_period)::date,category=trim(budget_component),planned_amount=greatest(coalesce(budget_amount,0),0),allocated_amount=greatest(coalesce(budget_allocated,0),0),pic=nullif(trim(budget_pic),''),notes=nullif(trim(budget_notes),''),coa_code=budget_coa,updated_at=now() where id=budget_id returning id into saved_id;
  end if;
  return saved_id;
end $$;

create or replace function public.finance_save_profit_allocation(allocation_status text,allocation_date date,allocation_project text,allocation_profit numeric,allocation_operational numeric,allocation_reference text,allocation_notes text)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); saved_id uuid; code text;
begin
  if not public.current_user_has_permission('finance.manage') then raise exception 'Izin Finance diperlukan.' using errcode='42501'; end if;
  if allocation_status not in ('Draft','Approved') then raise exception 'Status alokasi tidak valid.'; end if;
  if allocation_date is null or trim(coalesce(allocation_project,''))='' or coalesce(allocation_profit,0)<=0 then raise exception 'Tanggal, proyek, dan laba disetujui wajib diisi.'; end if;
  if coalesce(allocation_operational,0)>allocation_profit*0.60 then raise exception 'Fixed cost tidak boleh melebihi porsi perusahaan 60%%.'; end if;
  code:=public.finance_next_allocation_code();
  insert into public.finance_profit_allocations(allocation_code,status,closing_date,project_name,approved_profit,operational_fixed_cost,reference_number,notes,created_by_membership_id)
  values(code,allocation_status,allocation_date,trim(allocation_project),allocation_profit,greatest(coalesce(allocation_operational,0),0),nullif(trim(allocation_reference),''),nullif(trim(allocation_notes),''),actor_id) returning id into saved_id;
  return saved_id;
end $$;

create or replace function public.finance_save_asset(asset_status_value text,asset_type_value text,asset_name_value text,asset_category text,asset_date date,asset_journal_reference text,asset_value numeric,asset_life integer,asset_fund_source text,asset_location text,asset_pic text,asset_expiry date,asset_serial text,asset_evidence text,asset_notes text)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); saved_id uuid; n integer; code text;
begin
  if not public.current_user_has_permission('finance.manage') then raise exception 'Izin Finance diperlukan.' using errcode='42501'; end if;
  if trim(coalesce(asset_name_value,''))='' or asset_date is null or coalesce(asset_value,0)<=0 or coalesce(asset_life,0)<=0 then raise exception 'Nama, tanggal, nilai, dan masa manfaat aset wajib diisi.'; end if;
  select coalesce(max(nullif(regexp_replace(asset_code,'\\D','','g'),'')::integer),0)+1 into n from public.finance_assets;
  code:='AST-'||lpad(n::text,4,'0');
  insert into public.finance_assets(asset_code,asset_name,category,acquisition_date,acquisition_value,custodian,condition,notes,is_active,created_by_membership_id,asset_type,asset_status,useful_life_months,fund_source,location,pic,expiry_date,serial_or_account,evidence_url,journal_reference)
  values(code,trim(asset_name_value),nullif(trim(asset_category),''),asset_date,asset_value,nullif(trim(asset_pic),''),'good',nullif(trim(asset_notes),''),asset_status_value='Aktif',actor_id,asset_type_value,asset_status_value,asset_life,nullif(trim(asset_fund_source),''),nullif(trim(asset_location),''),nullif(trim(asset_pic),''),asset_expiry,nullif(trim(asset_serial),''),nullif(trim(asset_evidence),''),nullif(trim(asset_journal_reference),'')) returning id into saved_id;
  return saved_id;
end $$;

revoke all on function public.finance_next_allocation_code(),public.finance_create_journal_entry(date,text,text,text,numeric,text,text,text,text,date,text,text,text,text,text),public.finance_save_budget(uuid,date,text,text,numeric,numeric,text,text),public.finance_save_profit_allocation(text,date,text,numeric,numeric,text,text),public.finance_save_asset(text,text,text,text,date,text,numeric,integer,text,text,text,date,text,text,text) from public,anon;
grant execute on function public.finance_next_allocation_code(),public.finance_create_journal_entry(date,text,text,text,numeric,text,text,text,text,date,text,text,text,text,text),public.finance_save_budget(uuid,date,text,text,numeric,numeric,text,text),public.finance_save_profit_allocation(text,date,text,numeric,numeric,text,text),public.finance_save_asset(text,text,text,text,date,text,numeric,integer,text,text,text,date,text,text,text) to authenticated;
grant select on public.finance_coa,public.finance_transaction_catalog,public.finance_option_values,public.finance_settings,public.finance_profit_allocations,public.finance_fund_openings to authenticated;
