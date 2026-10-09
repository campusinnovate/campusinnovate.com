# Event Management landing

Public landing: `/event-management/`. The homepage's event service link opens this route. Legacy URLs on `/` and `/home/` with `#event-experience` redirect after hydration to the landing while preserving the complete query string (including UTM, gclid, gbraid and wbraid).

The landing reuses the published WUNPROQ, KLHK and SEE portfolio assets and roles from `src/data/homepage.ts`; it adds no testimonials, participant counts, outcome claims or price guarantees. It uses Indonesian copy, vertical scrolling, contextual WhatsApp links, native FAQ disclosure controls and a mobile sticky CTA. The root Google tag is reused; there is no additional base tag or landing-specific conversion listener.

## Conversion verification

All WhatsApp links point to `6285882514394` with the editable event message. The root delegated click listener sends `AW-18473450758/iaLBCN-i35AdEIb66ehE` once per click, including clicks on nested icon/text elements. Conversion is not sent on load. Placement and service are included as event metadata, not additional conversion events. Their availability in reporting depends on the connected analytics configuration.

Local checks should block the Google tag network while checking the dataLayer, to avoid sending test conversions to the live account. Before interpreting Ads performance, verify real delivery in Tag Assistant / Google Ads diagnostics and exclude test interactions. Tracking source configuration in the Ads account is outside this code change.

## Experiment measurement

Use the same traffic source and comparable dates for baseline versus landing. Record landing sessions, WhatsApp clicks, real qualified event conversations, ad spend and proposals/deals separately. A click is not a conversation. Calculate qualified inquiry rate as qualified conversations / landing sessions, and cost per qualified inquiry as ad spend / qualified conversations. Mark test contacts and spam separately.

Record real inquiries in the existing sales workflow with the date, institution, event need, qualification and known source. Do not infer that a conversation came from an ad just because it arrived after publication. Standard wa.me links do not automatically put gclid or UTM into the WhatsApp conversation.

The Ads campaign, budget and destination settings are not modified by this release. Use the dedicated landing URL as the final URL when the campaign owner updates its destination. Legacy event links remain supported.
