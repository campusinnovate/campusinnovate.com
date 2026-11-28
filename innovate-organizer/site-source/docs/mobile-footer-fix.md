# Mobile footer repair — 28 November 2026

The participant guide and all tracker pages previously retained a desktop `minmax(240px,1fr) 2fr` outer footer grid while only resizing the inner contacts. Footer markup now uses explicit shared identity/contact/bottom classes, without desktop inline grid constraints. A last-layer footer stylesheet retains two-column contacts and brand/contact desktop composition. At mobile widths, the brand/intro sits above four full-width contact rows with smaller icons and type, readable unclipped address values, and a two-line copyright/context area.

The original logo, contact destinations, copy and page-specific footer captions are preserved. Both itinerary exports remain identical. CSS URLs are content-hashed. No event data, room/bus assignments, schedule, storage, tracking or backend changes.

Browser QA at nominal 320 and 390px iframe widths: a 305px layout viewport showed a 305px footer, a 281px single-column contact grid, and 13px contact values with scrollWidth equal to clientWidth (210px), including the complete email and website. The guide and tracker screenshots show full-width contact rows, logo/intro spacing and copyright captions contained within the viewport. Temporary QA markup is removed before building. Existing functional tests are run as regression checks; no cosmetic mirror tests are added.
