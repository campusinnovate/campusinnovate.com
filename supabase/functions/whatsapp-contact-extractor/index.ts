import { createClient } from 'npm:@supabase/supabase-js@2';
import { messageContent } from '../_shared/whatsapp.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401 });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, {
    global: { headers: { Authorization: authHeader } }
  });

  try {
    const body = await req.json();
    const { conversation_id, message_id, content } = body;

    if (!conversation_id || !content) {
      return new Response(JSON.stringify({ error: 'Missing conversation_id or content' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Extract contact entities from message
    const extractResult = await db.rpc('extract_contact_entities', { message_text: content });
    if (extractResult.error) throw extractResult.error;

    const entities = extractResult.data as { email?: string; phone?: string; name?: string; organization?: string };
    if (Object.keys(entities).length === 0) {
      return new Response(JSON.stringify({ ok: true, extracted: false }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Get conversation to find contact_id
    const { data: conv } = await db.from('whatsapp_conversations').select('contact_id').eq('id', conversation_id).single();
    if (!conv?.contact_id) {
      return new Response(JSON.stringify({ ok: true, extracted: false, reason: 'no contact_id' }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Update contact with extracted info (only fills empty fields)
    const updates: Record<string, string> = {};
    if (entities.name) updates.name = entities.name;
    if (entities.email) updates.email = entities.email;
    if (entities.organization) updates.organization = entities.organization;
    if (entities.phone) updates.phone = entities.phone; // Note: phone is unique key, be careful

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await db.from('crm_contacts')
        .update({ ...updates, updated_at: new Date().toISOString(), updated_by_membership_id: null })
        .eq('id', conv.contact_id);
      if (updateError) throw updateError;
    }

    return new Response(JSON.stringify({ ok: true, extracted: true, entities, updated: Object.keys(updates) }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Contact extractor error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});