# Finance Pilot backend development handoff — 2026-10-07

Status: implementation in development; not a complete PRD release, not deployed. Production must not receive these migrations before review, isolated Supabase tests and explicit user approval.

## Verified references

- Repository: `campusinnovate/campusinnovate.com`, production branch `codex/web-handoff`, SHA `a3c59c5f6fad4401159874204ab6b6d4838faa4c`.
- Published Finance Pilot route returned HTTP 200 and still contained demo controls at inspection.
- Full PRD retrieved from Google Drive document `1YdxkI_KDJtjhj-8v38OJ68--WLCH0C0J`.
- Supabase project `lxwqhtuhlddgwfxjtlas`: Campus-Innovate/ruang-kawan, active, PostgreSQL 17.6. No other Supabase project queried. No DEV branches existed at inspection.
- The existing `finance_next_*` accounting core exists remotely, but its core migration is absent from remote migration history. Do not blindly replay repository migrations.
- Draft `20261006044441_finance_pilot_invoices_receipts.sql` was not found in the latest repository and was not attached. It has not been reviewed or applied.
- Read-only production inventory: 207 legacy transactions, 25 documents, 42 COA entries, 4 bank accounts, 5 projects, 229 pipeline leads; pilot ledger was empty. These are discovery counts, not a cutover reconciliation.

## PRD → frontend → backend gaps

| Area / PRD | Handover frontend | Development implementation | Remaining before acceptance |
| --- | --- | --- | --- |
| ACC-001–004, SEC-001 | Simulated journals, mock role selection | Canonical existing pilot ledger; balanced server templates; evidence; COO operations; CEO approval; immutable posting; reversal; close/reopen | Hosted Auth/RLS/Storage tests, concurrent request tests, every approval event test |
| Invoice/payment | Local simulation | Existing `finance_documents` identity reused; atomic invoice/receipt/journal; payment status; partial payment; request replay; reversal | Browser UAT, draft edit UX, complete vendor AP lifecycle/aging, advance settlement and all prescribed event templates |
| REV-001–004 | Example amounts | Posted ledger snapshot separates revenue, billed, collected, AR; six service lines; real totals | Complete service ranking and drill-down coverage, all global filters |
| Projects | Example project metrics/buttons | Existing projects reused; approved service/contract/budget controls; actual HPP; overrun gate; CTO delivery and COO closure APIs | Full assigned-role delivery/closure UAT, source estimate-to-budget tooling, full project report parity |
| CASH-001–002 | Hardcoded cash/reserves | Book cash from ledger; saved reconciliation fingerprint; explicit approved reserves; restricted/free cash calculations | Production account mappings, opening balance/cutover; multiple bank workflows; reserve coverage and full AP commitments |
| DASH-001–005 | Hardcoded cards/filter subsets | MTD/QTD/YTD/custom and as-of snapshots; service/project/client/payment filters; report drill-down; ledger quality warnings | PIC/bank/outcome/source/lost reason filter parity; every KPI drill-down; complete budget/target comparisons |
| Reports | Sample rows | Trial balance, P&L, financial position, equity, cashflow, AR aging; CSV and export audit | AP aging, complete statement/cashflow classification validation, XLSX/PDF (Should), complete filter/export browser UAT |
| TGT-001–003 | Example target/chart | Versioned annual target/month/service allocations; CEO approval; actual revenue | Complete pace/variance and filtered-target parity; forecast validation (Should) |
| DEAL-001–005 | Sample outcome cards | Existing pipeline reused, real outcome summaries and links | Verified outcome-date semantics; mandatory Lost fields and approval/source integration; full value/owner filtering |
| Settings | Placeholder actions | Explicit approval threshold/fiscal year/account mappings; approved additions to existing COA; immutable policy history | Business-approved configuration; comprehensive settings/version UX; full service master lifecycle |
| Scoped roles | Role simulation | Own claims/evidence; assigned project metadata; CTO estimates/delivery; BD assigned AR follow-up | Hosted assignment/RLS UAT; claim-to-journal browser UAT; estimates-to-budget UX |
| MIG-001–002 | No backend conversion | No production or historical records changed; legacy documents remain canonical | Mapping, snapshot totals, staging conversion, parallel run, COO sign-off/CEO approval; not authorized yet |
| Profit distribution | Placeholder | Posting explicitly blocked pending approved business rules | Ratios, eligible-profit policy and distribution workflow require decisions |

“Implemented” means code exists on the development branch. It does not mean every PRD requirement passed UAT. The scope banner explicitly excludes unconverted legacy data from pilot ledger reports; cash is never copied from legacy snapshots into a second balance.

## Proposed migrations — none applied remotely

1. `20261007060737_finance_pilot_workflows.sql`: additive requests/project controls/reconciliation; nullable links on existing documents/assets; restrictive pilot RLS and private evidence bucket; atomic posting/approval/reversal/period APIs; protected pilot document mutations.
2. `20261007061234_finance_pilot_reports.sql`: single-snapshot posted-ledger reports and pipeline/target projections.
3. `20261007062328_finance_pilot_scoped_access.sql`: own claims, CTO estimates, assigned-project and BD AR access; claim consumption uniqueness.

No Edge Function was created or deployed. The existing static Next.js/GitHub Pages architecture and Supabase client are retained. The old Finance, KPI, Chat and profile frontend files are unchanged. Shared `finance_documents` receives nullable pilot fields and a pilot-only guard; existing legacy records still follow the original path.

## Safe DEV setup

Use a separate disposable Supabase DEV project or an explicitly approved development branch with synthetic users and records. Inspect existing schema/migration history before applying the core fixture and the three new migrations. No production cloning of financial records is required.

Set DEV `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and, only there, `NEXT_PUBLIC_FINANCE_PILOT_WRITES_ENABLED=true`. Writes default to disabled; backend role checks remain authoritative. Never place service-role keys in frontend or repository. The frontend must not be published against production until RPC/schema availability and approval are confirmed.

Production COA differs from the old mock catalog and has no approved genuine cash ledger account. COO must propose actual mappings and CEO approve before posting. Test-only `FP-*` COA rows in the fixture are not inserted by migrations.

## Evidence and limits

Run `node scripts/check-finance-pilot.mjs` for actual PostgreSQL functions/RLS in isolated PGlite with synthetic membership/JWT fixtures. It checks COO/CEO/CTO/BD/Project Lead/GM/team/system admin/viewer/anonymous boundaries; persistence/replay; validation; invoice/receipt linkage; reversals; period locks; immutable ledger; reconciliation; reserve/target versions; asset registration; private evidence ownership; legacy document guard boundaries; aggregated project overrun.

Reconciliation fixture: invoice 1,000,000; receipt 400,000; recognized revenue 1,000,000; cash 400,000; outstanding AR 600,000; trial balance difference zero. Approved reserves 150,000 produce free cash 250,000 only after saved reconciliation. A subsequent cash posting invalidates that reconciliation. Receipt reversal restores AR; invoice reversal then cancels AR/revenue without rewriting original amounts/identifiers.

This fixture is not a full hosted Supabase stack. Its HTTP adapter emulates Auth/Storage for local development and must never be deployed. It does not prove real signed URLs/JWT issuance, multi-connection concurrency or full legacy module regression. Browser UI tests could not run because the cloud browser could not reach the local DEV server; all-button UAT remains pending. Schema fixtures reproduce relevant production columns, not every constraint/trigger/module.

## Material decisions pending

Approval threshold; fiscal year start; approved account mappings; annual targets; reserve policy; opening balances and cutover; distribution ratios/eligible profit; formal tax/closing policy. No default business values are seeded. Unknown policy blocks financial posting. Decisions not specified by the PRD require user input.

## Production risks and recovery plan for later approval

- Permission changes intentionally supersede broad legacy-role grants for pilot operations. Verify real position keys/memberships and workflows in DEV before rollout.
- Existing core RPCs are replaced to prevent approval bypass. Capture schema/function definitions and backups before any approved production change; inspect all callers and migration drift.
- Restrictive document policies/guards and private Storage must be validated alongside the old Finance RPCs in hosted DEV. Do not enable pilot writes before those checks.
- Pilot statements exclude historical ledger conversion. Do not present them as company-wide reconciled financial statements until approved opening/cutover and parallel run.
- For a failed rollout: disable pilot writes, restore previous frontend artifact; preserve all posted records/audit. Restore pre-change RPC/policy definitions through a reviewed forward migration. Do not drop document columns/tables or delete journals as rollback. Database backup/PITR restore is a coordinated last resort because it affects shared production records.
- Discovery also found RLS disabled on shared `pipeline_assignment_state`. This was not modified because it is outside the approved finance integration scope; separately review exposure before release.

No production approval is requested by this document yet: isolated hosted validation and unresolved Must requirements remain.
