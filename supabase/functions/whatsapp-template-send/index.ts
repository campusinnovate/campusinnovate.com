import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth, error: authError } = await user.auth.getUser();
  if (authError || !auth.user) return reply({ error: 'Login diperlukan.' }, 401);

  const [access, member] = await Promise.all([user.rpc('get_my_access'), user.rpc('current_membership_id')]);
  const rights = Array.isArray(access.data) ? access.data[0] : access.data;
  if (!member.data || rights?.membership_status !== 'active' || !rights?.permissions?.includes('pipeline.view') || !rights?.permissions?.includes('pipeline.manage_self')) {
    return reply({ error: 'Akses template ditolak.' }, 403);
  }

  let body;
  try { body = await req.json(); } catch { return reply({ error: 'Invalid JSON' }, 400); }

  const { template_id, conversation_id, parameters = {}, language = 'id' } = body;
  if (!template_id || !conversation_id) return reply({ error: 'template_id dan conversation_id wajib' }, 400);

  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const version = Deno.env.get('WHATSAPP_GRAPH_VERSION');
  const numberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !version || !/^v\d+\.\d+$/.test(version) || !numberId) return reply({ error: 'WhatsApp belum dikonfigurasi.' }, 503);

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Get template
  const { data: template, error: templateError } = await db.from('whatsapp_templates').select('*').eq('id', template_id).single();
  if (templateError || !template) return reply({ error: 'Template tidak ditemukan.' }, 404);
  if (template.status !== 'approved') return reply({ error: 'Template belum disetujui.' }, 400);
  if (!template.meta_template_name) return reply({ error: 'Template belum memiliki nama Meta.' }, 400);

  // Get conversation
  const { data: conversation, error: convError } = await db.from('whatsapp_conversations').select('*').eq('id', conversation_id).single();
  if (convError || !conversation || conversation.whatsapp_number_id !== numberId) return reply({ error: 'Conversation tidak ditemukan.' }, 404);

  // Build template message
  const components = [];

  // Header
  if (template.header_type && template.header_text) {
    const headerParams = template.header_type === 'text' && template.header_text.includes('{{')
      ? template.header_text.match(/\{\{(\d+)\}\}/g)?.map(m => parameters[m.replace(/[{}]/g, '')]) || []
      : [];
    components.push({
      type: 'header',
      parameters: headerParams.map((p: string) => ({ type: 'text', text: p }))
    });
  }

  // Body
  if (template.body_text) {
    const bodyParams = template.body_text.match(/\{\{(\d+)\}\}/g)?.map(m => parameters[m.replace(/[{}]/g, '')]) || [];
    components.push({
      type: 'body',
      parameters: bodyParams.map((p: string) => ({ type: 'text', text: p }))
    });
  }

  // Footer (no params in footer typically)

  // Buttons
  if (template.buttons && template.buttons.length > 0) {
    // For simplicity, we don't handle dynamic button params here
    // Quick reply buttons don't support params in WhatsApp API
  }

  // Durable idempotency
  const request_id = crypto.randomUUID();
  const claim = await db.from('whatsapp_messages').insert({
    conversation_id: conversation.id,
    request_id,
    direction: 'outgoing',
    message_type: 'template',
    content: JSON.stringify({ template_name: template.meta_template_name, language, components }),
    delivery_status: 'sending',
    sender_membership_id: member.data,
    sent_at: new Date().toISOString()
  }).select('id').single();

  if (claim.error) {
    if (claim.error.code === '23505') return reply({ error: 'Request sudah diproses.' }, 409);
    return reply({ error: 'Pesan tidak dapat disimpan.' }, 500);
  }

  let response: Response, result;
  try {
    response = await fetch(`https://graph.facebook.com/${version}/${numberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: conversation.phone,
        type: 'template',
        template: {
          name: template.meta_template_name,
          language: { code: language, policy: 'deterministic' },
          components
        }
      })
    });
    result = await response.json();
  } catch {
    await db.from('whatsapp_messages').update({ delivery_status: 'unknown', error_code: 'NETWORK_UNCERTAIN' }).eq('id', claim.data.id);
    return reply({ error: 'Status pengiriman belum diketahui. Jangan kirim ulang.' }, 502);
  }

  if (!response.ok) {
    await db.from('whatsapp_messages').update({ delivery_status: 'failed', error_code: String(result.error?.code ?? response.status) }).eq('id', claim.data.id);
    return reply({ error: `WhatsApp menolak template (kode ${result.error?.code ?? response.status}).` }, 502);
  }

  if (!result.messages?.[0]?.id) return reply({ error: 'Respons WhatsApp tidak lengkap.' }, 502);

  const saved = await db.from('whatsapp_messages').update({ whatsapp_message_id: result.messages[0].id, delivery_status: 'sent' }).eq('id', claim.data.id);
  if (saved.error) return reply({ error: 'WhatsApp menerima pesan, status lokal gagal disimpan.' }, 502);

  // Increment template usage
  await db.from('whatsapp_templates').update({ usage_count: template.usage_count + 1 }).eq('id', template_id);

  return reply({ ok: true, message_id: result.messages[0].id });
});