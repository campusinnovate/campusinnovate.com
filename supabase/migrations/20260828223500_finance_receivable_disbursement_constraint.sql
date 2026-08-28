alter table public.finance_transactions
  drop constraint if exists finance_transactions_event_type_check;

alter table public.finance_transactions
  add constraint finance_transactions_event_type_check
  check (
    event_type in (
      'income',
      'expense',
      'receivable_recognition',
      'receivable_receipt',
      'receivable_disbursement',
      'adjustment',
      'reversal'
    )
  );
