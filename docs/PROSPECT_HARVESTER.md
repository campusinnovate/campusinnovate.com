# Ruang Kawan — Prospect Harvester

Prospect Harvester adalah discovery layer sebelum Pipeline Business Development. Data hasil Google Maps dan Threads tidak langsung masuk `pipeline_leads`. Semua kandidat melewati raw staging, deduplication, AI enrichment, human review, lalu baru dipromosikan ke pipeline existing.

## Flow

1. `prospect_raw_items` menyimpan respons mentah provider.
2. `prospects` menyimpan satu record per account/prospect setelah deduplication.
3. `prospect_signals` menyimpan buying intent/evidence dari berbagai sumber.
4. AI melengkapi segment, service fit, scores, recommended pipeline, dan decision-maker role berdasarkan data publik yang tersedia.
5. BD review di `/ruang-kawan/prospects/`.
6. `promote_prospect_to_pipeline()` memakai `save_pipeline_lead()` existing.
7. Lead otomatis mendapatkan owner, stage, next action, linked KPI, dan My Activity sesuai mekanisme Pipeline BD.

## Phase 1 — Internal Prospect Engine

Sudah diimplementasikan:

- raw staging
- prospect database
- signal history
- scoring Fit 0–40 / Intent 0–40 / Accessibility 0–20
- Hot/Warm/Potential filtering
- manual intake
- archive
- human review
- promote to existing Pipeline BD

Run Supabase migration:

`supabase/migrations/20260904113000_ruang_kawan_prospect_harvester.sql`

## Phase 2 — Google Maps Harvester

Server endpoint:

`POST /api/prospects/harvest`

Provider: `google_maps`.

Required environment variable:

`GOOGLE_PLACES_API_KEY`

Enable Google Places API (New). Text Search is called server-side and only the required fields are requested through FieldMask.

Default query library includes schools, universities, corporate offices, manufacturing companies, and training centers around Bogor/Jabodetabek/Bandung. Queries are stored in `prospect_search_configs` and can be expanded later without changing the prospect schema.

## Phase 3 — Threads Intent Monitor

The same endpoint uses provider `threads`.

Required environment variable:

`THREADS_ACCESS_TOKEN`

The Meta app/token must have `threads_keyword_search` permission.

Default host:

`THREADS_API_HOST=https://graph.threads.net`

Keyword queries include EO, vendor event, company gathering, team building, capacity building, trainer, training, website, landing page, leadership camp, and school programs.

Threads is treated as an intent source. Public post text becomes a `prospect_signal` and is scored higher than passive directory discovery.

## Phase 4 — AI Web Enrichment

Server endpoint:

`POST /api/prospects/ai`

Mode: `enrich`.

Required environment variables:

- `OPENAI_API_KEY`
- `OPENAI_PROSPECT_MODEL` (default `gpt-5-mini`)

The server reads the prospect record plus public website HTML when a website is available, then asks the model to return:

- account type
- industry
- city
- public contacts if present
- service fit
- recommended pipeline
- recommended business unit
- Fit / Intent / Accessibility scores
- AI summary
- evidence/signals

The model is instructed not to invent unavailable facts.

## Phase 5 — Decision-Maker Enrichment

The AI enrichment identifies the most relevant role from the evidence available, e.g.:

- HR / People Development / L&D
- Corporate Communication / Marketing / CSR
- School Principal / Vice Principal Student Affairs
- Student Affairs / Directorate / Department
- BEM/Himpunan/UKM leadership

LinkedIn is deliberately **not scraped**. Public LinkedIn URLs may be stored in the prospect record and used as human enrichment links. Automated LinkedIn data retrieval should only be enabled when Campus Innovate has an approved official LinkedIn API integration.

`LINKEDIN_ACCESS_TOKEN` is documented as a future official connector placeholder; no unofficial browser automation is implemented.

## Phase 6 — Outreach Generator

Endpoint:

`POST /api/prospects/ai`

Mode: `outreach`.

Generated drafts:

- Threads reply
- Threads DM
- WhatsApp
- Email subject
- Email body
- Follow-up 1
- Follow-up 2

Drafts are stored in `prospect_outreach_drafts`. Nothing is auto-sent; BD reviews/copies the draft first.

## Deployment checklist

1. Merge/deploy the code branch.
2. Apply the Supabase migration.
3. Add `GOOGLE_PLACES_API_KEY` to production environment.
4. Create/configure Meta Threads app and add `THREADS_ACCESS_TOKEN` with keyword-search permission.
5. Add `OPENAI_API_KEY` and optionally `OPENAI_PROSPECT_MODEL`.
6. Open `/ruang-kawan/prospects/` while logged in with Pipeline BD permission.
7. Test one Google Maps query.
8. Test one Threads query.
9. Run AI Enrich on a prospect with a website and one Threads prospect.
10. Generate outreach.
11. Promote one test prospect to B2B Services/COREVA.
12. Verify the created lead appears in `/ruang-kawan/pipeline/` and its next action appears in My Activity.

## Operational rule

Do not auto-promote harvested records to Pipeline. The default operating model is:

`Harvest → Deduplicate → Score → AI Enrich → BD Review → Promote → Outreach/Follow-up → Meeting → Proposal → Won/Lost`

This keeps Pipeline BD focused on accounts the team has intentionally chosen to work.
