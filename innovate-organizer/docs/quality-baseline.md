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

User requested a more fluid page while retaining copy/layout. Use a restrained MO-2 treatment: navy/blue/gold CSS aurora on hero and brief, static ambient color in content sections, transform/opacity reveal on below-fold blocks, fine-pointer card hover and brief native dialog entrance. No external motion library, pointer tracking, video or image effects. Existing content geometry and copy remain the baseline. Hero text is never opacity-hidden. Scroll reveal is progressive enhancement and is disabled for reduced motion/print; focusing a pending block reveals it immediately. All loops use transforms only and run over 14–18 seconds.
