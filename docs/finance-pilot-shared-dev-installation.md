# Shared DEV installation — 7 October 2026

Owner approved the concrete shared-project DEV package. Installed in **lxwqhtuhlddgwfxjtlas**, Campus-Innovate/ruang-kawan, with no paid resource, no Ruang Ayat access and no frontend production deployment.

## Applied

- `20261007081710_finance_pilot_isolated_shared_dev`: approved installer, two isolated schemas, 18 new DEV public RPCs, private evidence bucket and DEV Storage policies. Production migrations were **not** applied.
- `20261007082011_finance_pilot_dev_storage_authorization_fix`: DEV upload policy originally performed caller-context membership reads after direct table grants were revoked. Hosted testing exposed the permission failure. Replaced that predicate with a SECURITY DEFINER boolean authorization helper; kept membership tables private. The current generator incorporates the fix. Separate fix SQL documents the applied delta; do not replay blindly.
- No Edge Function deployed. No production roles, Auth users, existing functions, bank accounts, balances or financial rows changed by this work.

## Hosted evidence and limits

| Check | Result |
| --- | --- |
| Existing public function definitions, before/after | Same hash `bc7ac58d216080f164bff06778246e0d` |
| Existing Storage policies, before/after | Same hash `277a485fd90633ef81cbf29561587f1a` |
| Production control counts before/after | 209 transactions, 27 documents, 0 pilot journals |
| New DEV public RPCs | 18; anon EXECUTE count 0; real anonymous REST bind request returns HTTP 401 / SQLSTATE 42501 |
| DEV RLS/grants | 0 tables without RLS; 0 direct table grants to anon/authenticated/PUBLIC |
| Evidence bucket | Private; 10 MB; PDF/PNG/JPEG |
| Allowlist | 1 active COO, 1 active CEO; production roles unchanged |
| Database role/JWT simulation | Anon/outsider denied; COO manage allowed; CEO approve allowed and operational request denied; direct table writes denied |
| Accounting flow | Policy and exactly Rp1,000,000 invoice require CEO approval; receipt Rp400,000; cash Rp400,000; AR Rp600,000; trial difference 0 |
| Retry/refresh/input/period | Request/execute replay same ID; repeated snapshot same cash; custom day excludes earlier invoice revenue; negative receipt rejected |
| Storage SQL/RLS | DEV insert allowed, overwrite denied, outsider cannot read; existing office read and EXPLAIN-only upload regression pass |
| Isolation after smoke test | Transaction rolled back: 0 DEV memberships, requests, documents and evidence objects left; production hashes/counts unchanged |

Reproducible hosted smoke SQL: `scripts/finance-pilot-hosted-dev-smoke.sql`. This uses database role/JWT claim simulation and a rolled-back synthetic Storage metadata row, **not** actual Auth login or Storage HTTP file upload. Real-user browser/all-button tests, concurrency and complete PRD parity remain pending. Never run against another project or without reviewing the allowlist and namespace.

18 local isolation checks passed again after adding an office-only INSERT policy fixture: this catches the caller-privilege regression that broad permissive policy short-circuiting had hidden. Previous 72 workflow checks, 7 client routing checks, TypeScript and shared DEV build remain valid; frontend source unchanged by this installation fix.

## Advisors

DEV-only findings: RLS-enabled/no-policy INFO on 18 deliberately inaccessible helper/fixture tables, and authenticated SECURITY DEFINER WARN on the allowlist-guarded `finance_pilot_dev_bind`. These are reviewed design choices, not a clean-advisor claim. Remediation references: [RLS without policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [SECURITY DEFINER RPC](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Existing unrelated production findings were not changed.

## Frontend and next work

Development branch `codex/finance-pilot-backend`, draft PR #29. Frontend adapter already supports `NEXT_PUBLIC_FINANCE_PILOT_TARGET=shared-dev` and `NEXT_PUBLIC_FINANCE_PILOT_WRITES_ENABLED=true`; default production behavior stays unchanged. No shared DEV preview URL has been published. Existing hosting is GitHub Pages; this environment has no separate connected preview target. Do not repoint the production Pages branch/domain to create a DEV preview.

Continue remaining PRD integration and arrange separate preview access for real COO/CEO UAT. Production rollout, historical cutover, account/bank mappings and distribution policy remain separately reviewed decisions. Recovery is `supabase/dev/finance-pilot/disable.sql`: disable DEV access and preserve evidence/audit data. Do not drop or restore production data.
