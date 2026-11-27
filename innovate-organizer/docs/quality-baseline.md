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

## Navy aurora, event systems and content refresh (27 November 2026)

User requested a darker continuous gradient, stronger aurora, edge-to-edge client tracks, animated hero figures, glossy shaped CTAs, an Our System section, revised copy and a structured footer. These instructions supersede the earlier limits on palette, copy and section additions. Navy, blue and gold remain the brand colors. White is used only inside source screenshots and logo artwork; page/card surfaces use navy glass gradients. Client rows span the viewport without white fade masks. Animation uses transforms/opacity/background-position, with reduced-motion support and separate pause controls for figures and logos. Counts are stable text (26/22/2), not fabricated looping increments.

Copy follows the user's supplied hero, five service lines, Tech/Smart/Event Partners principles, fifth engagement card, five process stages and closing invitation. The new Event Support form option is accepted by the existing validated write-only API; other lead behavior and conversion destinations are preserved.

Our System explains four operational reasons and five design/delivery steps. Three primary examples: KLH/BPLH live scoring, IPB Leap, and the existing itinerary demo. Original interface images come from the uploaded company profile (pages 27 and 31) and a browser screenshot of the unchanged itinerary demo. Digital work from the company profile is separately labeled under Campus Innovate: YLOS (page 20), COREVA (21), IPB Connect prototype (23), and Optima CRM (16). No video footage or functional demo is implied by static mockups; `systems.js` supports an actual video source when supplied later. The itinerary screenshot is explicitly labeled as a demo, not a completed future event.

Featured order: WUNPROQ, Astra, BRMP, KLH/BPLH. Cards include client logos, service, event format and participant profile. Per-event headcounts remain unconfirmed and are not invented. LPA2I is reinstated per the latest request with its previously documented scope and client logo, without relabeling an unrelated team photo. Two SQL training batches at Badan Informasi Geospasial add twenty real photographs from the original Drive documentation. Other project galleries and the itinerary source are retained. New photo and screenshot provenance is documented in `redesign-media-sources.json`.

Browser QA: complete hero copy, figures below CTA, full-width logo container with no mask, five single-line 48px service CTAs, four featured projects in the requested order, project facts, three main system mockups, four footer columns, English/Arabic/Chinese hero/service switching and the figure pause control. Desktop horizontal overflow is absent. Native mobile emulation could not be opened because the desktop accessibility provider was unavailable; mobile layout is covered by CSS breakpoint inspection, without a claimed mobile browser pass. Twelve lead/tracking/form tests pass, including the new service option. Publishing and GitHub synchronization use the same Sites source state.


## Four-color reference redesign (27 November 2026)

The user's latest visual references supersede the previous navy/blue/gold surface palette: #DCEAF7, #4A74A7, #142A44 and #081426. The authoritative theme is `public/assets/brand-refresh.css`. Documentary photography, logo artwork and the green WhatsApp affordance retain their original colors. Ice-blue gradient surfaces replace solid white sections; a contained dark hero and footer add contrast.

The centered hero uses the existing approved copy, two glossy pill CTAs and stable 26/22/2 figures. Six linked documentary/system-image cards create a curved gallery using CSS perspective. These are real existing assets, with intrinsic dimensions; no fabricated UI metrics or client claims were added. Client tracks stay edge-to-edge, with opposing loops and a pause control. About Us follows the logos and uses three varied bento principles (photo, ice blue, navy). Service, portfolio, system, FAQ, form and footer content is preserved; all existing IDs and functional handlers remain.

Checks: all six hero images loaded in the browser; desktop layout has no horizontal overflow; five service CTAs remain on one line; the three system showcase cards and figure pause control work. Twelve existing backend/form/tracking tests pass. Browser device emulation is restricted by organization policy, so no mobile browser pass is claimed. CSS retains explicit phone/tablet layouts, horizontal navigation scrolling, clipped decorative gallery, reduced-motion support and accessible controls. No production lead or Ads event was generated for this visual verification.


## Navy-dominant palette correction (27 November 2026)

The user found the first four-color interpretation too pale. The palette's navy colors #081426 and #142A44 now dominate all page, card, form and dialog surfaces. #4A74A7 is used for stronger blue aurora, card edges, gradients and selected emphasis. #DCEAF7 is reserved for readable text, CTA highlights, source-logo backing. The narrow full-bleed logo band uses steel blue with navy transitions, without a bright central stripe. Source artwork and photographs retain their original colors. No new business claims, copy, portfolios, tracking destinations, lead behavior or database changes are introduced. The responsive layout is retained; regular copy is raised to 16px and navigation/form labels to 14px. Decorative principle numbering and eyebrow dots are removed.

Browser checks: dark page/card/form surfaces verified, text inherits #DCEAF7, regular copy is 16px, all five service CTAs stay on one 48px line, and the client tracks span the full viewport without fade masks. Existing 12 lead/tracking/form tests pass. No production lead or conversion was submitted.


## Supplied Nocturne design system (27 November 2026)

The uploaded `Nocturne.zip` supersedes earlier inferred palette treatments. It adds authoritative deep navy #032A5A, royal blue #1543A0 and electric decorative glow #5B7CFF to the four original reference colors. The new Nocturne token and adapter styles are the last stylesheet layer. Regular surfaces use the supplied #0B3473/#12408F without shadows, primary controls use #2F5FD0 with white text, and floating elements use the supplied raised shadow. Hero texture and aurora are adapted from the archive. Detailed provenance, mapping, scope and measured contrast are in `nocturne-integration.md`. Existing structure, copy, Poppins type, media, backend and tracking are preserved. Browser verification and all twelve existing tests pass; no new mobile browser pass is claimed.
