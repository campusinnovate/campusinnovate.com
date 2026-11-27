# Nocturne integration

Source: user-uploaded `Nocturne.zip`, received 27 November 2026. The original Claude artifact could not expose its content publicly; this archive is the authoritative supplied reference.

Use `public/assets/nocturne-tokens.css` and `public/assets/nocturne-theme.css` after the existing layout styles. `tokens.css` is copied from the supplied archive with custom properties consistently renamed from `--name` to `--nc-name`; values and references are otherwise preserved. Do not use the earlier four-color interpretation as the current theme.

| Role | Nocturne value |
| --- | --- |
| Page background | #032A5A |
| Royal gradient | #1543A0 |
| Decorative glow | #5B7CFF |
| Surface / raised | #0B3473 / #12408F |
| Text / muted | #DCEAF7 / #B4C8E6 |
| Primary / text on primary | #2F5FD0 / #FFFFFF |
| Card / control borders | #1F4F9E / #7FA3D6 |
| Raised shadow | 0 12px 32px #0814268C |
| Primary CTA glow | 0 0 32px #5B7CFF59 |

Regular cards use color depth without shadows. Raised shadow is used on the floating navbar, gallery previews, screenshots and dialogs. The glow shadow is limited to the hero CTA. A subtle static paper texture is adapted from the archive's Texture component and clipped behind the hero. Existing calm motion, pause controls and reduced-motion behavior are retained. Original brand logos and documentary photos remain unchanged; WhatsApp service buttons use Nocturne success mint, and the fixed WhatsApp mark stays green.

Scope: color, shadows, radius and decorative texture. Existing section layout, Poppins typography, supplied copy, portfolio content, language switching, lead storage, Google Ads destinations and itinerary page are preserved. No new external font dependency or JavaScript from the ZIP is introduced.

Validation: 28 adapter token references resolve. Calculated ink contrast against bg/surface/raised: 11.57/9.79/7.96; muted text: 8.33/7.04/5.73. Primary white text: 5.72. Browser verified actual bg rgb(3,42,90), primary rgb(47,95,208), surface rgb(11,52,115), raised rgb(18,64,143), supplied modal shadow and single CTA glow. Desktop has no horizontal overflow; service CTAs remain single-line at 48px; system dialog and brief navigation work. Twelve lead/tracking/form tests pass. No production lead or conversion was submitted during visual QA.


## Hero, logo and motion refinement

The user's subsequent instruction requests stronger aurora, a different/larger hero font in two desktop lines, larger proof figures without the old team caption, readable client marks and gradients/shadows/motion on lower cards. This supersedes the earlier no-shadow treatment for regular cards. The Nocturne palette remains unchanged.

Hero and numeric figures now use locally hosted Plus Jakarta Sans ExtraBold 800 from Google Fonts (official stylesheet + fonts.gstatic.com), with its SIL OFL license in `plus-jakarta-sans-OFL.txt`. The existing Indonesian headline is split after “Jabodetabek,” on wide desktops, retaining exact words and a single accessible heading. At narrower widths each line can wrap; translated/service-specific headlines remain natural text. The body font remains Poppins. At the tested 1363px desktop viewport the heading is 66.1px, with two 74px lines and no horizontal overflow.

Three blue ribbon/bloom layers create a stronger aurora with transform-based motion. The proof figures remain stable 26/22/2 text in three larger glass-gradient cards; the previous “Rekam jejak tim…” caption is removed as requested. The existing pause control now pauses aurora, figures, sheen and lower-card lighting, while the logo marquee retains its separate pause control. Reduced-motion preferences stop the effects.

Client tracks remain full bleed without edge masks. Source logos retain their color/artwork and use 196×118px ice-blue tiles with 74px image areas on desktop (responsive sizes on phones). Only each image uses multiply blending to remove source white backing; the track itself uses normal blending so logos remain legible.

Lower cards use subtle layered gradients, inset highlights and soft shadows. IntersectionObserver starts decorative lighting only while its card is visible; text itself stays still. Native project/system dialogs, form semantics and tracking are retained. Browser verified active card lighting, global pause state, restored Indonesian two-line headline after switching to English and back, larger logos and no desktop overflow. Twelve lead/tracking/form tests pass. No production lead or Ads conversion was submitted.
