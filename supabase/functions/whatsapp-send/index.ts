import { createClient } from 'npm:@supabase/supabase-js@2';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
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
  if (!member.data || rights?.membership_status !== 'active' || !rights?.permissions?.includes('pipeline.view') || !rights?.permissions?.includes('pipeline.manage_self')) return reply({ error: 'Akses reply ditolak.' }, 403);
  let body;
  try { body = await req.json(); } catch { return reply({ error: 'Invalid JSON' }, 400); }
  if (typeof body.content !== 'string' || !body.content.trim() || body.content.length > 4096 || !/^[0-9a-f-]{36}$/i.test(body.request_id ?? '') || !/^[0-9a-f-]{36}$/i.test(body.conversation_id ?? '')) return reply({ error: 'Pesan atau request tidak valid.' }, 400);
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN'), version = Deno.env.get('WHATSAPP_GRAPH_VERSION'), numberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !version || !/^v\d+\.\d+$/.test(version) || !numberId) return reply({ error: 'WhatsApp belum dikonfigurasi.' }, 503);
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: conversation, error } = await db.from('whatsapp_conversations').select('*').eq('id', body.conversation_id).single();
  if (error || !conversation || conversation.whatsapp_number_id !== numberId) return reply({ error: 'Conversation tidak ditemukan.' }, 404);
  if (!conversation.last_incoming_at || Date.now() - Date.parse(conversation.last_incoming_at) >= 86400000) return reply({ error: 'Sesi 24 jam berakhir. Tunggu pesan customer; template tersedia pada fase berikutnya.' }, 409);
  // Durable idempotency claim BEFORE contacting Meta. Never resend an ambiguous attempt.
  const claim = await db.from('whatsapp_messages').insert({ conversation_id: conversation.id, request_id: body.request_id,
    direction: 'outgoing', message_type: 'text', content: body.content.trim(), delivery_status: 'sending',
    sender_membership_id: member.data, sent_at: new Date().toISOString() }).select('id').single();
  if (claim.error) {
    if (claim.error.code === '23505') return reply({ error: 'Request sudah diproses. Periksa status pesan sebelum mengirim kembali.' }, 409);
    return reply({ error: 'Pesan tidak dapat disimpan.' }, 500);
  }
  let response: Response, result;
  try {
    response = await fetch(`https://graph.facebook.com/${version}/${numberId}/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ messaging_product: 'whatsapp', to: conversation.phone, type: 'text', text: { body: body.content.trim() } }) });
    result = await response.json();
  } catch {
    await db.from('whatsapp_messages').update({ delivery_status: 'unknown', error_code: 'NETWORK_UNCERTAIN' }).eq('id', claim.data.id);
    return reply({ error: 'Status pengiriman belum diketahui. Jangan kirim ulang sebelum memeriksa WhatsApp.' }, 502);
  }
  if (!response.ok) {
    await db.from('whatsapp_messages').update({ delivery_status: 'failed', error_code: String(result.error?.code ?? response.status) }).eq('id', claim.data.id);
    return reply({ error: `WhatsApp menolak pesan (kode ${result.error?.code ?? response.status}).` }, 502);
  }
  if (!result.messages?.[0]?.id) return reply({ error: 'Respons WhatsApp tidak lengkap; periksa status sebelum mengirim ulang.' }, 502);
  const saved = await db.from('whatsapp_messages').update({ whatsapp_message_id: result.messages[0].id, delivery_status: 'sent' }).eq('id', claim.data.id);
  if (saved.error) return reply({ error: 'WhatsApp menerima pesan, tetapi status lokal belum tersimpan. Jangan kirim ulang.' }, 502);
  return reply({ ok: true });
});
