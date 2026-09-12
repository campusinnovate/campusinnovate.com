import { createClient } from 'npm:@supabase/supabase-js@2';
import { messageContent, normalizePhone, verifySignature } from '../_shared/whatsapp.ts';

Deno.serve(async (req: Request) => {
  const token = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
  const secret = Deno.env.get('WHATSAPP_APP_SECRET');
  const numberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !secret || !numberId) return new Response('Not configured', { status: 503 });
  if (req.method === 'GET') {
    const p = new URL(req.url).searchParams;
    return p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === token
      ? new Response(p.get('hub.challenge') ?? '') : new Response('Forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const raw = await req.text();
  if (!await verifySignature(raw, req.headers.get('x-hub-signature-256'), secret)) return new Response('Forbidden', { status: 403 });
  let payload;
  try { payload = JSON.parse(raw); } catch { return new Response('Invalid JSON', { status: 400 }); }
  if (payload.object !== 'whatsapp_business_account') return new Response('Ignored');

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
      const value = change.value;
      if (change.field !== 'messages' || value?.metadata?.phone_number_id !== numberId) continue;

      for (const message of value.messages ?? []) {
        const phoneNumber = normalizePhone(message.from);
        const displayName = value.contacts?.find((c: { wa_id: string }) => c.wa_id === message.from)?.profile?.name ?? '';
        const content = messageContent(message);
        const messageTime = new Date(Number(message.timestamp) * 1000).toISOString();

        // Store incoming message
        const receiveResult = await db.rpc('whatsapp_receive', {
          number_id: numberId, phone_number: phoneNumber,
          display_name: displayName, wamid: message.id, kind: message.type ?? 'unknown',
          body: content, message_time: messageTime
        });
        if (receiveResult.error) throw receiveResult.error;

        // Get conversation_id for async processing
        const { data: conv } = await db.from('whatsapp_conversations')
          .select('id').eq('whatsapp_number_id', numberId).eq('phone', phoneNumber).single();

        if (conv?.id && message.type === 'text') {
          // Async: extract contact entities from message (fire and forget)
          db.functions.invoke('whatsapp-contact-extractor', {
            body: { conversation_id: conv.id, message_id: message.id, content }
          }).catch(() => {}); // Don't block webhook

          // Async: calculate lead score (fire and forget)
          db.functions.invoke('whatsapp-lead-scorer', {
            body: { conversation_id: conv.id, auto_suggest_source: true }
          }).catch(() => {});
        }
      }

      for (const status of value.statuses ?? []) {
        if (!['sent', 'delivered', 'read', 'failed'].includes(status.status)) continue;
        const result = await db.rpc('whatsapp_status', {
          wamid: status.id, new_status: status.status,
          status_time: new Date(Number(status.timestamp) * 1000).toISOString(),
          code: status.errors?.[0]?.code?.toString() ?? null
        });
        if (result.error) throw result.error;
      }
    }
    return new Response('OK');
  } catch {
    return new Response('Persistence failed; retry delivery', { status: 500 });
  }
});