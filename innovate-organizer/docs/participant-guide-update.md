# Participant guide replacement — 27 November 2026

The user-supplied `Panduan Peserta · Beasiswa Pertamina 2026.html` replaces the previous Elite Club itinerary. The exact requested address is `/ittinerary` (two t characters). `/itinerary`, `/itinerary/` and the legacy `/itinerary/index.html` also serve the new guide so existing links continue to work. Both native route handlers serve the same source document. No export/preview wrapper, fixed canvas metadata or $preview dimensions remain. Native portal sections, photos, original copy, participant-room search and LO conditional contact behavior are retained.

Archived React, DC runtime, logos, photographs and Latin Poppins font files are hosted locally under `/ittinerary/assets/`, with the original font license retained. The page uses natural document height, responsive layout overrides, reduced-motion support, keyboard focus states and a viewport declaration. It is marked noindex/nofollow as an operational participant guide. The uploaded Library file is unchanged.

The source's room list and LO names are placeholders. Empty LO phone numbers remain empty and their WhatsApp action is not shown by the source's conditional template. No participant, room or contact data has been fabricated. There is no new database, authentication or shared-editing behavior. The tracker, marketing homepage, brief API and database binding are preserved.

Source upload SHA-256: 11368545277dd745c78eac566a146a58f200cffd546ddbef01100debfccbc7cf

Validation: all 20 tests pass, including both-address content parity, local-asset and anchor resolution, participant-room search/empty results, and the absence of active WhatsApp actions for unfilled LO phone numbers. Existing tracker and lead/tracking tests still pass. Production build contains both `/ittinerary` and `/itinerary`. No browser-control tool was available for a visual browser pass in this session.
