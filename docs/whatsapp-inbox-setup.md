# Kawan Inbox — Phase 1

## Audit dan implementation plan

- Frontend: Next.js 16 App Router, React client components, CSS modules; GitHub Actions uses static export. Existing WorkspaceMiniNav, auth session, typography and existing navy/blue workspace color tokens are retained.
- Backend/database: Supabase Postgres, RLS, permission RPCs, Deno Edge Functions. Webhooks cannot depend on Next.js runtime on GitHub Pages.
- CRM: `pipeline_leads` and `save_pipeline_lead` already coordinate work sources, memberships and activities. `prospects` is discovery staging, not a canonical Contacts table. No replacement CRM/contact/lead tables are introduced in Phase 1.
- Staff: existing `memberships`, `get_my_access`, `current_membership_id`, `current_user_has_permission`. Phase 1 is a shared inbox visible to active users with `pipeline.view`; replying also requires `pipeline.manage_self`.
- Sequence: infrastructure/RLS → signed webhook and atomic capture → durable outbound request → inbox UI/read state → tests/setup. Subsequent phases extend this module and existing pipeline.

## Activate

1. Review and apply `supabase/migrations/20260911120000_whatsapp_inbox.sql` using the normal migration process. Keep existing migrations intact. `supabase db push` applies all pending migrations, including any unrelated local work: review the pending list first.
2. Configure Edge Function secrets (never `NEXT_PUBLIC_`):
   - `WHATSAPP_APP_SECRET`: Meta app secret for HMAC verification.
   - `WHATSAPP_VERIFY_TOKEN`: long random string chosen for the webhook challenge.
   - `WHATSAPP_PHONE_NUMBER_ID`: registered/test business phone number ID, not its displayed number.
   - `WHATSAPP_ACCESS_TOKEN`: Meta system-user token authorized for this WhatsApp account with `whatsapp_business_messaging`.
   - `WHATSAPP_GRAPH_VERSION`: explicitly choose a supported Graph API version for your Meta app, in `vNN.0` format.
   - Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to hosted functions.
3. Deploy `supabase functions deploy whatsapp-webhook` and `supabase functions deploy whatsapp-send`. The checked-in config disables gateway JWT verification; webhook verifies HMAC and sender validates the user's token and permissions itself.
4. In Meta, configure callback `https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook`, use the exact verify token, and subscribe the app to the WhatsApp Business Account `messages` webhook field. Use the registered number matching the configured phone number ID.
5. Build/deploy the frontend using the existing process. Open `/ruang-kawan/inbox/` with an active Pipeline-enabled staff account.
6. Send a message from an authorized test recipient/customer, confirm capture, open it to clear the staff unread badge, reply, and verify `sent` → `delivered` → `read` where customer read receipts are available. Replaying the same webhook must not increase message count.

Official references: [Meta Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api), [Meta webhook signature handling](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/).

## Behavior and limits

- One configured business number. Unknown number IDs are ignored; invalid signatures rejected. Database failures return HTTP 500 so Meta retries. `wamid` uniqueness and transactional receive prevent duplicate incoming messages.
- Customer phone identity is normalized (Indonesian local `0` → `62`). Conversation uniqueness is business number + normalized phone. This is channel identity, not automatic CRM Contact creation.
- Text replies only, within 24 hours of the latest incoming customer message. Media events display their type and caption; files are not downloaded. Templates/broadcast are visibly unavailable, not simulated.
- Each outgoing request is persisted before the Meta call; repeating its request ID never sends twice. Network uncertainty is shown as `unknown`; process interruption can leave `sending`. Do not blindly resend either status. Check Meta/WhatsApp before composing another send. There is no automatic outbound retry worker in this phase.
- Delivery receipts are persisted before/after outbound response storage and statuses never regress from `read`/`delivered` to earlier states. Error codes are displayed without exposing tokens or raw upstream errors.
- Inbox unread is per staff, independent of Meta customer read receipts. Opening a conversation marks only fetched messages as read locally; it does not send a WhatsApp read receipt.
- Polling: inbox 5 seconds, navigation badge 10 seconds while visible. Latest 200 conversations and latest 100 messages per selection; displayed limits are explicit. Older-message pagination and global server-side search are future extensions.
- No live Meta request, external message, database migration, or remote deployment is performed by implementation tests.

## Next phases

2. Design canonical Contacts with normalized matching; attach/create leads using existing pipeline RPCs and work-source configuration; staff assignment and activity history.
3. Website session/UTM/CTA tracking, unique reference code and attribution.
4. Rules-based scoring, reminders, stale warnings, tags, quick reply, approved templates, assignment and separately scoped broadcast.
5. AI only after CRM is stable and separately authorized; commercial commitments require human approval.

## Validation

`node --test tests/whatsapp-*.test.cjs`

`npx tsc --noEmit`

`GITHUB_ACTIONS=true npm run build`

Production smoke testing still requires a configured Supabase environment, Meta account, and an authorized test recipient.
