# Finance Pilot: additive accounting foundation

This route implements the first, isolated slice of `PRD_Sistem_Keuangan_Campus_Innovate.docx.pdf`. The existing `/ruang-kawan/finance/` module and all its tables remain in place. The pilot uses new `finance_next_*` tables and is reachable at `/ruang-kawan/finance-pilot/` after migration deployment.

## Included in this pilot

- Six service lines from the PRD.
- Double-entry journal posting against the existing Chart of Accounts. The posting RPC rejects unbalanced entries and requires a service line for revenue and direct project costs; direct project costs also require a project.
- Posted journal lines are read-only to client roles. Corrections will be handled by a later reversal workflow.
- Period close and reopen requests, with a separate approver permission and a rule that the requester cannot approve their own request.
- Role permission defaults: `finance_manager` can view and operate; `executive` can view and approve period requests; `system_admin` has all three pilot permissions. System administrators can grant the permissions to other memberships through the existing access controls.

## Deploy

1. Review this migration with the rest of the pending schema changes: `supabase/migrations/20260930110000_finance_pilot_accounting_core.sql`.
2. Apply it to the intended Supabase environment using the team's normal migration process. The SQL only creates new tables, indexes, policies, permissions, and RPCs; it does not backfill, rename, update, or delete existing finance records.
3. Deploy the frontend. Members with `finance_next.view` will see **Finance Pilot** from the Workspace navigation and dashboard.
4. Prepare a small approved test journal and verify both sides in the pilot. Submit a month close request and confirm an account with `finance_next.approve` can review it, while the requester cannot approve it.

## Data and scope boundaries

No historical journal conversion runs in this migration. Existing transactions, invoices, reports, IDs, and amounts remain in the current Finance workspace. The pilot does not yet publish consolidated reports or copy old records. The PRD requires a production snapshot, pre-migration counts/control totals, draft mapping, reconciliation, a parallel run, COO sign-off, and CEO approval before any legacy conversion or cutover.

The pilot is the accounting-core phase, not the complete PRD. Annual target versioning, project/pipeline analytics, receipt and bill automation, bank reconciliation, fund buckets, accounting statements, export formats, journal reversal, threshold approvals, and reconciliation-based history mapping remain later implementation phases. The current `finance_coa` catalog is reused read-only; no COA rows are replaced by this pilot.
