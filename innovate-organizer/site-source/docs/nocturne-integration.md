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
