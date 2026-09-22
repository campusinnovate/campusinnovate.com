# Noortura Google Sheets webhook

- Personalized RSVP (`invited_guest_id` present): updates the matching `Guest List` row.
- Public RSVP: appends or updates by RSVP UUID in `RSVP Publik`.
- Script Property: `NOORTURA_SHEETS_SECRET`.
- Deploy as Web App, execute as spreadsheet owner, access `Anyone`.
- Supabase secrets: `GOOGLE_SHEETS_WEBHOOK_URL` and the matching `NOORTURA_SHEETS_SECRET`.
