# Finance Pilot completion checkpoint — 7 October 2026

This is a development checkpoint, not a production release or complete PRD acceptance. The execution environment went offline before all local changes could be published. Preserve/recover the local working tree before restarting implementation.

## Applied to shared DEV only

Project: lxwqhtuhlddgwfxjtlas (Campus-Innovate/ruang-kawan). Ruang Ayat was not used.

- 20261007081710_finance_pilot_isolated_shared_dev
- 20261007082011_finance_pilot_dev_storage_authorization_fix
- 20261007124401_finance_pilot_shared_dev_completion

The completion delta is saved verbatim in supabase/dev/finance-pilot/completion-update.sql. Its SHA-256 is 0013f43fe22a9e96d373558310a4e6b964b937a1806202b4f17ebe0e4bad4608. It belongs outside automatic production migrations and must not be replayed blindly.

Shared DEV now has 25 distinctly prefixed public endpoints, separate schemas and evidence bucket, synthetic empty financial fixtures and two synthetic bank-master labels. COO/CEO allowlist remains unchanged; production live roles are rechecked. No actual Auth users or production financial records were created/edited for testing.

Installed additions include draft edit/withdraw, canonical journal/document/request source details, advance allocation and reversal, estimate consumption, dashboard filters/target projections, existing-pipeline outcome validation, approved multiple-bank mappings and per-bank reconciliation. COO operates; CEO approves. Threshold remains inclusive >= Rp1,000,000, fiscal January–December.

## Evidence

Hosted PostgreSQL role/JWT simulation passed after installation:
- Invoice 1,000,000 + receipt 400,000 => revenue 1,000,000, cash 400,000, AR 600,000, trial difference 0.
- Canonical invoice source includes preparation/approval request.
- Two bank accounts reconcile independently; identical retry returns the same reconciliation.
- CEO operational writes, bank reconciliation and evidence upload denied.
- Anonymous/outsider access and direct table writes denied.
- Existing office Storage read and EXPLAIN-only upload regression passed.
- All hosted synthetic writes rolled back.

Production before/after controls: 209 transactions, 27 documents, 0 pilot journals. Existing public function fingerprint 72f3032754b1c4ffd9b5c96fcd64a4a2 and existing Storage policy fingerprint f7d56bf1fd88978c4cb7c6089a58f7b3 remained identical using the same query/order. No main migration, Edge Function or site deployment occurred.

Local actual PostgreSQL/PGlite testing reached 103 passing checks; fresh installation and upgrade isolation tests passed (18 checks), routing checks passed (7), TypeScript/static shared-DEV production build/diff check passed. These local result/source files were not all published before the runtime failed.

Browser testing used synthetic Auth/Storage transport with actual PostgreSQL/RLS, never hosted production transactions. Observed passes: connected tabs, private proof upload, invoice draft save/edit/refresh/issue, second-bank partial receipt (paid 200,000 / AR 400,000), request resend identity, signed evidence GET, six reports/CSV download, original/latest target charts, period/filter controls, CEO posting denial, and COO target form -> CEO approval-only UI -> COO atomic apply. Original target 1.2m remained intact; latest target 2.4m. Scoped CTO view also rendered. Later scoped-role browser coverage did not finish.

These tests do not prove actual hosted Auth login/Storage file HTTP behavior, multi-connection concurrency or complete production/module regression.

## Local changes still to publish after runtime recovery

Local branch codex/finance-pilot-backend in /workspace/scratch/55e3fa6b0006/campusinnovate contains additional frontend/backend/test changes. The checkpoint commit only saves this report and the applied DEV SQL; it does not claim to publish those local edits.

Pending local source includes:
- Expanded existing Finance Pilot page/API adapter, source detail, commercial/scoped workspace and target charts.
- Narrow changes to existing pipeline outcome form; no frontend/architecture rebuild.
- Four proposed main migrations: completion, dashboard, commercial and banks, plus generators and expanded tests.
- Final AP dimension/date/alias reporting corrections and main evidence-policy helper; these final local corrections require DEV synchronization and retesting.
- DEV check/preview-artifact GitHub Actions workflow. It has not been published or run; no preview URL/artifact is claimed.

Recover the working tree, inspect diff, rerun checks, complete browser role/button coverage, synchronize only DEV changes, then publish the exact reviewed tree to draft PR 29. Do not overwrite unrelated work or production branch codex/web-handoff.

## Remaining decisions / release gates

Actual bank/account mappings, annual targets, reserve policy/target, opening balance/cutover, eligible-profit/distribution ratios and formal tax/closing policy need business decisions. Distribution remains explicitly blocked; no ratios or accounting policy were invented. Historical mapping/conversion/parallel run and COO/CEO sign-off are still pending.

Main production migrations and deployment require a separate concrete change/risk/recovery summary and user approval. Existing DEV authorization persists; no additional DEV approval was requested because of the infrastructure outage.
