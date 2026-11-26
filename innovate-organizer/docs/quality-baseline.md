# Innovate Organizer — COREVA Blueprint baseline

Source: COREVA Digital Blueprint (1).html, Library file libfile_edd2abb609c4819194550c717f2f015a (read 26 November 2026).

## Project scope and retained decisions

Existing public static marketing site. Keep all visible copy, section order, content, photos, grid columns, breakpoints, spacing, radii and navy/gold identity. Use the blueprint as a quality baseline, not as a replacement page template. Poppins 400/600/700 remains the single font family. Existing layout and branding are explicit exceptions to the blueprint's example themes, grid/gutter scale and stack presets; this is authorized by the user's instruction to preserve layout and copy.

## Applied baseline

- Main paragraph/list text and form inputs: 16px minimum. Labels and primary controls: 14px. Metadata: 12px. Existing heading scale retained.
- Input boundaries use #7a89a0 against white; language control boundary uses #7f96ba against navy. Main text pairs retain their existing high contrast.
- Main controls, navigation links, project triggers and contact links have 44px minimum click height; keyboard focus has a contrasting ring. Native dialog Escape dismissal restores focus to the invoking project button.
- Project buttons expose dialog relationships and unique accessible names while visible labels remain unchanged.
- All generated photos receive intrinsic width/height from actual asset metadata. Existing image fit/container rules stay in place. Below-fold images retain lazy loading; hero remains eager/high priority.
- Hero asset is 95,190 bytes, below the blueprint's 200 KB budget.
- Three identical Poppins faces converted losslessly from TTF to WOFF; total font bytes fall from 456,436 to 205,800 (55% smaller). Normal and bold faces are preloaded, with font-display: swap retained.
- Existing calm transitions retained; reduced-motion disables decorative animation and transitions globally.
- Added strict-origin-when-cross-origin referrer metadata and a narrowly scoped CSP restricting base URLs/plugins and upgrading insecure requests. Existing Google Ads sources and conversion handling remain intact.
- Existing JSON-LD, canonical URL, sitemap, robots.txt and four-language support are retained.

## Validation and practical limits

- JS syntax, source diff whitespace and actual image metadata verified.
- Browser comparison against the preceding live release: identical normalized visible copy, section IDs/order and desktop grid columns; no desktop horizontal overflow.
- Browser checks: 16px body/input text, all rendered image dimensions present, BRMP photos load, modal closes on Escape and focus returns to its trigger.
- No new backend, authentication, database, API, upload, dashboard or data-loading UI was introduced. Those blueprint modules/states are outside this static site's scope. Brief form continues to compose a WhatsApp message in the browser.
- No Lighthouse score, throttled 4G LCP/INP, field CLS or full WCAG certification is claimed. These need separate measurement. Host-level HSTS/security headers and operational backup/incident controls remain hosting/organization concerns.
- Existing Sites source versioning and codex/web-handoff mirror are retained. Do not migrate the production workflow, change repository-wide permissions, or introduce a different hosting stack merely to match the blueprint's sample CI/CD topology.

## Brand motion and aurora (26 November 2026)

User requested a more fluid page while retaining copy/layout. Use a restrained MO-2 treatment: navy/blue/gold CSS aurora on hero and brief, static ambient color in content sections, transform/opacity reveal on below-fold blocks, fine-pointer card hover and brief native dialog entrance. No external motion library, pointer tracking, video or image effects. Existing content geometry and copy remain the baseline. Hero text is never opacity-hidden. Scroll reveal is progressive enhancement and is disabled for reduced motion/print; focusing a pending block reveals it immediately. All loops use transforms only and run over 10–18 seconds.

## Motion visibility and asset refresh

Aurora intensity increased after the user reported the effect was not apparent. Blue/gold fields are stronger on light sections and hero drift spans a wider path over 10 seconds; reduced-motion behavior remains unchanged. index.html references each CSS/JS file with its SHA-256 prefix in `?v=`. Regenerate these references whenever the respective source changes so returning visitors request the new file. A browser cache on the user's device was not independently confirmed.

## Glossy surfaces, connected gradients and moving client marks

User authorized visual polish beyond the previously retained radii/surfaces: rounded translucent card finishes, glass header, pill buttons, continuous pale blue/gold background and a navy-to-light hero transition. Existing page order, body copy, imagery and grid columns are retained. Navigation defaults to Our Services / About Us / Portfolio / How We Work, with Arabic/Chinese translations. A fixed bottom-right WhatsApp button reuses the existing message and single Ads conversion listener. Client marks are larger and unboxed; two seamless opposing rows contain all original logos, with duplicates hidden from assistive technology. A pause control is provided, hover pauses each row, and reduced motion disables automatic movement while retaining manual horizontal access. White in source logo bitmaps is blended into the background without altering the source assets.

## Lead collection and portfolio expansion (26 November 2026)

User approved 26 projects and 22 clients & partners as the team's experience figures, and asked for briefs to be saved on the website before WhatsApp. These replace the earlier static-only scope. Existing design, Sites project identity, audience and itinerary are retained. FAQ terms are tailored per event: no invented minimum headcount, fixed lead time, deposit percentage or promise of unlimited service area.

The original page is retained under `public/`; a minimal Vinext root route serves its prepared HTML. A D1 write-only endpoint validates and stores briefs, explicit consent and bounded campaign attribution; no public lead-reading route exists. Unit tests cover validation, duplicates, errors, burst limits, click classification and save-before-WhatsApp behavior. Browser QA confirmed a local D1 save and the UI success state. This does not verify production storage before deployment.

Portfolio copy was expanded using existing scope and https://campusinnovate.com/ (read 26 November 2026). Noortura's date/location and LiDAR's three-day dates come from that website. Other event participant counts and unverified durations were omitted. Original participant video clips from KLHK and WMK are included; no fabricated quotations, ratings or project results were added.

Eight portfolios have at least ten distinct photo files: KLH/BPLH, BRMP, Astra, Noortura, WUNPROQ, Stripmate, PUSTARHUT and WMK. LiDAR has seven available documentary images; other older projects retain their available covers pending matched originals. Duplicate images identified by visual inspection/perceptual checks were removed. Provenance for new media is in `portfolio-media-sources.json`. Four featured covers and initial modal images load eagerly; remaining gallery images are lazy to limit data transfer.

The section gap after partnership is reduced. Stats, FAQ and form status messages have language entries. Two original participant videos use posters, native controls and preload=none. No real Ads conversion was generated during testing. The real Brief conversion action/label remains an account-access dependency; see README.
