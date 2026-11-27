# Innovate Organizer

Production: https://io.campusinnovate.com/
Site identity: `appgprj_6af2a97417c48191954e9f651b24017e`. Keep its public audience and custom domain.

The site uses the Sites Vinext starter to retain the existing HTML design while saving incoming event briefs in Cloudflare D1. It is no longer a static-only deployment.

## Edit and publish

- `public/index.html`: original page HTML, SEO, form and FAQ.
- `public/assets/app.js`: services, portfolio descriptions, scopes and galleries.
- `public/assets/languages.js`: language dictionaries.
- `public/assets/style.css`: base layout and controls.
- `public/assets/brand-refresh.css`: authoritative four-color reference theme (#DCEAF7, #4A74A7, #142A44, #081426), navy-dominant surfaces, steel-blue aurora, ice text/highlights, centered gallery hero, bento principles and responsive motion.
- `public/assets/motion.js`, `systems.js`: progressive reveals, system showcase and figure motion controls.
- `public/assets/tracking.js`: conversion tracking; contains the existing WhatsApp Ads action and a deliberately empty destination for the pending “Kirim Brief” action.
- `public/assets/brief.js`: save first, then continue to WhatsApp.
- `worker/leads.mjs`, `app/api/brief/route.ts`: validated, anonymous write-only lead endpoint.
- `db/schema.ts`, `drizzle/`: lead schema and immutable migrations.

Run `node scripts/prepare-site.mjs` after HTML or asset edits. This refreshes asset hashes and generates `site.html` for the root route. Keep the Sites `sites()` integration and bindings. Run `node --test tests/leads.test.mjs`, then use the Sites build/source/save/deploy workflow. Publishing only `public/` will break lead saving.

`public/itinerary/` is an existing separate page: preserve it.

## Incoming briefs

Briefs are stored in the `DB` binding, table `event_leads`. The owner can inspect the private data through the Site's database viewer or native Sites database tools. There is no public listing or unauthenticated read API. Contact details require explicit form consent, are not sent in analytics parameters, and request bodies are not logged. Best-effort burst protection, same-origin JSON submission, a honeypot, body limits and server validation are included. Burst limits are per Worker isolate, not a distributed anti-spam service.

Successful storage does not mean the visitor sent the WhatsApp message. They still press Send themselves. Retries reuse one submission UUID to avoid duplicate rows. Failed saves retain the form and do not fire a brief event.

## Google Ads: remaining account setup

The existing button action is `AW-18473450758/iaLBCN-i35AdEIb66ehE`. Every ordinary WhatsApp link is captured by one delegated click handler, including floating/service/project links and supported whatsapp.com URLs.

The new brief action **has not been created in Google Ads**: the available signed-in Google account showed an empty account picker on 26 November 2026. Create/reuse a distinct action named “Kirim Brief”, copy its exact `send_to` label into `destinations.brief` in `public/assets/tracking.js`, and republish. Until then, confirmed saves dispatch the `brief_submit` event but are not claimed as a Google Ads conversion. Do not reuse the button label or invent a new label. The existing action's display name also has not been changed in the account.

The events `whatsapp_click` and `brief_submit` distinguish sources; only the relevant conversion action fires. The post-form WhatsApp continuation does not additionally fire the ordinary button action. Real Google receipt/status still needs verification in the correct Ads account/Tag Assistant. Local preview interactions are excluded from production conversion reporting.
