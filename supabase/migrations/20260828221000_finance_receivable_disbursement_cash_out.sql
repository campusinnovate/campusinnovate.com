begin;

update public.finance_transaction_catalog
set
  group_key = 'cash-out',
  group_label = 'Cash Out',
  label = 'Penyaluran / Tambahan Piutang',
  flow = 'Keluar',
  default_coa = '2001',
  description = 'Dana keluar yang menambah piutang pihak terkait pada referensi yang sama.',
  requires_reference = true,
  requires_due_date = true,
  creates_asset = false,
  sort_order = 75
where event_name = 'Penyaluran Piutang';

create or replace function public.finance_create_journal_entry(
  entry_date date,
  entry_project text,
  entry_coa_code text,
  entry_description text,
  entry_amount numeric,
  entry_bank text,
  entry_event text,
  entry_reference text,
  entry_counterparty text,
  entry_due_date date,
  entry_notes text,
  entry_fund_source text,
  entry_fund_use text,
  entry_allocation_code text,
  entry_evidence_url text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_membership_id();
  saved_id uuid;
  tx_number text;
  coa public.finance_coa%rowtype;
  catalog public.finance_transaction_catalog%rowtype;
  internal_event text;
  internal_flow text;
  calculated_status text;
  selected_bank text := nullif(trim(entry_bank), '');
begin
  if not public.current_user_has_permission('finance.manage') then
    raise exception 'Izin Finance diperlukan.' using errcode = '42501';
  end if;

  if entry_date is null
    or trim(coalesce(entry_description, '')) = ''
    or coalesce(entry_amount, 0) <= 0 then
    raise exception 'Tanggal, keterangan, dan nominal wajib diisi.';
  end if;

  select * into catalog
  from public.finance_transaction_catalog
  where event_name = entry_event;

  if catalog.event_name is null then
    raise exception 'Jenis kejadian tidak valid.';
  end if;

  select * into coa
  from public.finance_coa
  where code = entry_coa_code
    and is_active;

  if coa.code is null then
    raise exception 'COA tidak valid.';
  end if;

  if catalog.requires_reference
    and trim(coalesce(entry_reference, '')) = '' then
    raise exception 'ID Referensi wajib untuk jenis transaksi ini.';
  end if;

  if catalog.requires_due_date and entry_due_date is null then
    raise exception 'Jatuh tempo wajib untuk jenis transaksi ini.';
  end if;

  internal_flow := case catalog.flow
    when 'Masuk' then 'in'
    when 'Keluar' then 'out'
    else 'non_cash'
  end;

  if (internal_flow in ('in', 'out') or entry_event = 'Saldo Aktual Bank')
    and selected_bank is null then
    raise exception 'Rekening / bank wajib dipilih agar saldo aktual terhubung.';
  end if;

  if selected_bank is not null
    and not exists (
      select 1
      from public.finance_bank_accounts
      where bank_account = selected_bank
    ) then
    raise exception 'Rekening / bank tidak valid.';
  end if;

  internal_event := case
    when entry_event = 'Pengakuan Piutang' then 'receivable_recognition'
    when entry_event = 'Penyaluran Piutang' then 'receivable_disbursement'
    when entry_event = 'Penerimaan Piutang' then 'receivable_receipt'
    when catalog.flow = 'Masuk' then 'income'
    when catalog.flow = 'Keluar' then 'expense'
    else 'adjustment'
  end;

  calculated_status := case
    when entry_due_date is not null
      and entry_due_date < current_date
      and entry_event in (
        'Pengakuan Piutang',
        'Penyaluran Piutang',
        'Pengakuan Kewajiban'
      ) then 'OVERDUE'
    else 'SELESAI'
  end;

  tx_number := public.next_finance_number('transaction');

  insert into public.finance_transactions(
    transaction_number,
    transaction_date,
    event_type,
    flow,
    category,
    description,
    counterparty,
    amount,
    reference_number,
    evidence_url,
    status,
    created_by_membership_id,
    project_name,
    coa_code,
    account_name,
    account_class,
    cash_flow_category,
    transaction_event,
    bank_account,
    due_date,
    auto_status,
    cost_nature,
    control_position,
    notes,
    fund_source,
    fund_use,
    profit_allocation_code
  )
  values(
    tx_number,
    entry_date,
    internal_event,
    internal_flow,
    coa.name,
    trim(entry_description),
    nullif(trim(entry_counterparty), ''),
    entry_amount,
    nullif(trim(entry_reference), ''),
    nullif(trim(entry_evidence_url), ''),
    'posted',
    actor_id,
    nullif(trim(entry_project), ''),
    coa.code,
    coa.name,
    coa.account_class,
    coa.cash_flow_category,
    catalog.event_name,
    selected_bank,
    entry_due_date,
    calculated_status,
    coa.cost_nature,
    coa.control_position,
    nullif(trim(entry_notes), ''),
    nullif(trim(entry_fund_source), ''),
    nullif(trim(entry_fund_use), ''),
    nullif(trim(entry_allocation_code), '')
  )
  returning id into saved_id;

  if entry_event = 'Saldo Aktual Bank' then
    update public.finance_bank_accounts
    set
      current_balance = entry_amount,
      last_snapshot_at = now(),
      updated_at = now(),
      updated_by_membership_id = actor_id
    where bank_account = selected_bank;
  elsif internal_flow = 'in' then
    update public.finance_bank_accounts
    set
      current_balance = current_balance + entry_amount,
      updated_at = now(),
      updated_by_membership_id = actor_id
    where bank_account = selected_bank;
  elsif internal_flow = 'out' then
    update public.finance_bank_accounts
    set
      current_balance = current_balance - entry_amount,
      updated_at = now(),
      updated_by_membership_id = actor_id
    where bank_account = selected_bank;
  end if;

  insert into public.activity_logs(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_data
  )
  values(
    auth.uid(),
    'finance.journal.create',
    'finance_transaction',
    saved_id::text,
    jsonb_build_object(
      'number', tx_number,
      'event', entry_event,
      'coa', coa.code,
      'amount', entry_amount,
      'bank', selected_bank
    )
  );

  return saved_id;
end
$$;

revoke all on function public.finance_create_journal_entry(
  date, text, text, text, numeric, text, text, text, text, date,
  text, text, text, text, text
) from anon, public;

grant execute on function public.finance_create_journal_entry(
  date, text, text, text, numeric, text, text, text, text, date,
  text, text, text, text, text
) to authenticated;

commit;
