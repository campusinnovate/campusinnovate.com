# Pertamina Foundation client tracker

Imported from the user-supplied `Innovate Organizer Client Portal.html` (27 November 2026). The six nested archived pages are unpacked to native HTML routes under `/tracker`, without the preview canvas, board captions, 1440px iframes, or archive loading wrapper. The portal navigation remains functional; its overview tab is named Ringkasan. Original content, logo, photographs, animation and interactive DC/React logic are retained. Archived React, runtime, images and Latin fonts are hosted locally and font licensing is retained. Page layout uses normal document height and responsive overrides. Dense rundown controls scroll horizontally on small screens.

Routes: `/tracker`, `/tracker/rundown`, `/tracker/panitia`, `/tracker/peserta`, `/tracker/logistik`, `/tracker/kontak`. Unknown tracker pages return 404. Metadata opts these operational pages out of search indexing. Existing homepage, itinerary, lead API, D1 binding and analytics are unchanged.

Tracker edits persist per page in localStorage in the current browser. They are not shared between browsers/users and are not written to the lead database. A visible notice explains this; blocked localStorage falls back to session-only edits and updates the notice. No login, shared backend or access-control claim is implied. The example participant names/rooms remain placeholders from the source.

Input SHA-256: 9caf47ece43b186f5556aa913e08c004ba0dd0b10bcd142aa6c5191c0a15f36c

Validation: all 17 tests pass (12 existing lead/tracking tests plus tracker document/link checks, progress persistence/counter uniqueness, rundown timing/reordering, participant filtering, storage-failure fallback and WhatsApp composition). All archived scripts parse. Production build includes `/tracker` and `/tracker/:section`. No browser-control tool was exposed in this session, so a visual browser pass was unavailable.
