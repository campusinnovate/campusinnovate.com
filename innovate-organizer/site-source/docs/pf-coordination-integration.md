# Coordination PDF integration — 28 November 2026

Source: user-uploaded `Koordinasi_Teknis_PF_CB_ASB_2026.pdf`, 33 pages. Text extracted with Poppler and bus/crew tables visually checked on pages 19/21. The user's follow-up explicitly confirms that Patir is Muhamad Tirta Fabiansyah, so the earlier full-name/phone list can be joined to the source bus assignments.

## Current public information

- Both itinerary URLs and all six tracker pages use the 2–4 December coordination baseline. Marketing homepage, lead API, Site identity and D1 bindings remain unchanged.
- Day 1 contains the 13 source sessions from 08.00 to 21.00. Day 2 includes the 05.00 crew briefing only in the tracker, 05.30 participant assembly, 06.00 outbound, 12.00 return, 14.00 role play, 15.00–18.00 DEB and an open-ended final session. Day 3 uses PF protocol milestones: arrival 06.00, registration 06.30–08.55 (seated by 08.25), 09.00–11.00 core event and 11.00–13.30 lunch/ramah tamah. Departure from Wisma UT remains TBC. The source offers a proposal to divide boots on day 1 and leaves the final time open; website wording preserves that uncertainty.
- Five 59-seat buses total 295 (153 women, 142 men). PICs: Bus 1 Nava, 2 Faiza, 3 Patir/Tirta, 4 Dicky, 5 Fadhil. Phone pairings are unchanged from the user's supplied list. The provided spelling of Nava's full name is retained.
- Rooms reconcile to 87/310 beds, including 81 rooms/295 awardee beds, speakers, PF and EO. Named room assignments are not present in the PDF; the former fictional/example roster rows are removed. Guide room search starts empty and tracker roster remains available for confirmed entries.
- Fifteen ASB groups reconcile as 10×20 + 5×19 = 295. Group membership awaits PF names. Crew structure is 5 core + 8 special day-2 crew; MC and vendors are listed separately, with availability approval still pending.
- Tracker logistics covers the 400 m² tent, 20 VIP chairs, 400 folding chairs, 10 tables, 600 boots/poncho sets, 5,000 W sound, 60 kVA genset, 1 December setup, kit/KV/bumper production and 9 distribution lanes (5 awardee + 4 invitee). Pending decisions are grouped into the source's 3 Wisma UT + 16 PF day-1 + 12 PF day-2 + 1 PF day-3 points. The last group also explicitly records the separately stated departure/meal-box timing question.
- Progress is seeded only for completed planning actions described in the PDF. Booked vendors/payments, chosen KV, speakers and MC approval remain pending. Commercial influencer ratecards/add-on prices and the raw PDF itself are not copied to participant-facing pages.

## Navigation and storage

The top bar is now outside hero clipping and stays sticky. Desktop has a full navigation row; widths below 1024px use a native details/summary Menu with a two-column list. Delegated navigation closes on selected links/outside clicks/Escape. Guide links cover the three-day schedule, packing, dress code, bus/groups, LO, rooms and locations. Tracker links cover all six pages plus the participant guide.

The baseline uses new `io-tracker-pf2026:<page>:coord-20261128` localStorage keys so obsolete two-day/nine-bus drafts do not overwrite the coordination update. Earlier v1 entries remain stored, untouched; no storage is deleted. This is still browser-local editing, not shared/server synchronization. Named participant data has not been invented or fetched from elsewhere.

## Validation

23 tests pass: participant/bus/group/room arithmetic, three-day schedule and fixed protocol milestones, afternoon sessions, TBC timing, LO alias/phone matching, empty roster/search behavior, tracker persistence, lead/tracking/API behavior, route parity and links. Browser preview used 320/390px iframe widths to check the two-column mobile menu, link-close/Escape behavior, sticky header, all three tracker day tabs, fixed protocol controls, actual afternoon session names and five bus cards. Header measured 65px at the narrow viewport, desktop measured 77px, and desktop navigation is present while the mobile menu is hidden. This is narrow browser-viewport QA, not a claimed physical phone test. The temporary QA page is removed before build/publication.

Canonical coordination snapshot: `public/event-data/pertamina-2026-coordination.json`; canonical contacts: `public/event-data/pertamina-2026-lo.json`. The HTML documents contain synchronized snapshots of these records for offline/local runtime use. Both itinerary HTML exports must remain identical.
