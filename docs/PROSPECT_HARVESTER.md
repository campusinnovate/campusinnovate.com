# Ruang Kawan — Prospect Harvester

Prospect Harvester adalah discovery layer sebelum Pipeline Business Development. Data hasil Google Maps dan Threads tidak langsung masuk `pipeline_leads`. Semua kandidat melewati raw staging, deduplication, AI enrichment, human review, lalu baru dipromosikan ke pipeline existing.

## Production architecture

Frontend Ruang Kawan tetap mengikuti deployment existing sebagai static export di GitHub Pages. Karena GitHub Pages tidak menjalankan Next.js server routes, Prospect Harvester memakai Supabase Edge Functions untuk seluruh logic yang membutuhkan secret/API key.

- UI: `/ruang-kawan/prospects/`
- Database + RPC: Supabase PostgreSQL
- Harvest backend: `supabase/functions/prospect-harvest`
- AI backend: `supabase/functions/prospect-ai`
- Production website deploy: push/merge ke `codex/web-handoff`

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

Migration:
`supabase/migrations/20260904113000_ruang_kawan_prospect_harvester.sql`

## Phase 2 — Google Maps Harvester

Edge Function:
`prospect-harvest`

Provider: `google_maps`.

Supabase secret:
`GOOGLE_PLACES_API_KEY`

Enable Google Places API (New). Text Search dipanggil server-side dengan FieldMask agar field dan biaya tetap terkontrol.

## Phase 3 — Threads Intent Monitor

Edge Function yang sama menggunakan provider `threads`.

Supabase secrets:
- `THREADS_ACCESS_TOKEN`
- `THREADS_API_HOST=https://graph.threads.net`

Token Meta harus memiliki permission `threads_keyword_search`.

Threads diperlakukan sebagai sumber buying intent; post publik yang relevan disimpan sebagai `prospect_signal`.

## Phase 4 — AI Web Enrichment

Edge Function:
`prospect-ai`

Mode: `enrich`.

Supabase secrets:
- `OPENAI_API_KEY`
- `OPENAI_PROSPECT_MODEL` (default `gpt-5-mini`)

Function membaca prospect + public website text yang tersedia, lalu menghasilkan account type, industry, city, public contact yang benar-benar tersedia, service fit, recommended pipeline/business unit, scores, AI summary, decision-maker role, dan evidence.

## Phase 5 — Decision-Maker Enrichment

AI mengidentifikasi role yang relevan dari evidence tersedia, misalnya HR / People Development / L&D, Corporate Communication / Marketing / CSR, Kepala Sekolah / Wakasek Kesiswaan, Student Affairs, atau ketua organisasi.

LinkedIn tidak di-scrape. Public LinkedIn URL boleh disimpan sebagai link enrichment. Official LinkedIn connector dapat ditambahkan bila akses resmi tersedia.

## Phase 6 — Outreach Generator

Edge Function `prospect-ai`, mode `outreach`.

Draft yang dibuat:
- Threads reply
- Threads DM
- WhatsApp
- Email subject
- Email body
- Follow-up 1
- Follow-up 2

Draft disimpan di `prospect_outreach_drafts`. Tidak ada auto-send; BD tetap review/copy dulu.

## Deployment order

1. Apply migration Supabase.
2. Deploy Edge Functions `prospect-harvest` dan `prospect-ai`.
3. Set Supabase secrets:
   - `APP_ORIGIN=https://campusinnovate.com`
   - `GOOGLE_PLACES_API_KEY`
   - `THREADS_ACCESS_TOKEN`
   - `THREADS_API_HOST=https://graph.threads.net`
   - `OPENAI_API_KEY`
   - `OPENAI_PROSPECT_MODEL=gpt-5-mini`
4. Smoke-test kedua Edge Functions dengan akun Ruang Kawan yang punya `pipeline.manage_self`.
5. Merge PR ke `codex/web-handoff`.
6. GitHub Pages workflow otomatis menjalankan `npm ci` + `npm run build` + deploy.
7. Open `/ruang-kawan/prospects/`.
8. Test satu query Google Maps dan satu query Threads.
9. AI Enrich satu prospect.
10. Generate outreach.
11. Promote satu test prospect ke B2B Services/COREVA.
12. Verify lead di `/ruang-kawan/pipeline/` dan next action di My Activity.

## Operational rule

Jangan auto-promote harvested records ke Pipeline. Default flow:

`Harvest → Deduplicate → Score → AI Enrich → BD Review → Promote → Outreach/Follow-up → Meeting → Proposal → Won/Lost`

Dengan struktur ini, Pipeline BD tetap berisi account yang benar-benar dipilih tim untuk dikerjakan.
