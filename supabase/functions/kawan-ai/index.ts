import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!;
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-20b';
const APP_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://campusinnovate.com';

function cors(origin: string | null) {
  const allowed = origin === APP_ORIGIN || origin?.startsWith('http://localhost:');
  return { 'Access-Control-Allow-Origin': allowed ? origin! : APP_ORIGIN, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
}
function json(value: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(value), { status, headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function clean(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
const responseSchema = {
  type: 'object', additionalProperties: false, required: ['answer', 'actions'], properties: {
    answer: { type: 'string', minLength: 1, maxLength: 6000 },
    actions: { type: 'array', maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['id', 'type', 'title', 'payload_json'], properties: {
      id: { type: 'string', minLength: 1, maxLength: 80 },
      type: { type: 'string', enum: ['create_assignment', 'save_decision', 'create_meeting', 'link_project'] },
      title: { type: 'string', minLength: 1, maxLength: 180 },
      payload_json: { type: 'string', maxLength: 5000 },
    } } },
  },
};

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung.' }, 405, origin);
  if (!GROQ_API_KEY) return json({ error: 'Kawan AI belum dikonfigurasi.' }, 503, origin);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sesi tidak valid.' }, 401, origin);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return json({ error: 'Sesi tidak valid.' }, 401, origin);
  const body = await req.json().catch(() => ({}));
  const prompt = clean(body.prompt, 2000); const route = clean(body.route, 300);
  const entityType = clean(body.entityType, 100) || null; const entityId = clean(body.entityId, 160) || null;
  if (!prompt || !route.startsWith('/ruang-kawan/')) return json({ error: 'Pertanyaan atau konteks tidak valid.' }, 400, origin);
  const contextResult = await client.rpc('kawan_ai_context', { context_route: route, context_entity_type: entityType, context_entity_id: entityId });
  if (contextResult.error) return json({ error: contextResult.error.code === '42501' ? 'Kawan AI tidak tersedia untuk akun ini.' : 'Konteks kerja belum dapat dibaca.' }, contextResult.error.code === '42501' ? 403 : 400, origin);
  const selectedMessageId = clean(body.contextHint?.selectedMessageId, 80) || null;
  const context = { ...contextResult.data, selected_message_id: selectedMessageId };
  const instructions = `Kamu adalah Kawan AI, asisten kerja internal Campus Innovate. Jawab dalam Bahasa Indonesia yang ringkas, konkret, ramah, dan berbasis konteks yang diberikan. Jangan mengarang data, anggota, tanggal, keputusan, atau status. Jika data kurang, nyatakan kekurangannya. Jangan pernah mengungkap daftar permission mentah. proposed actions hanyalah draft dan wajib dikonfirmasi pengguna. Hanya usulkan action ketika konteks aktif adalah Kawan Chat dengan conversation_id yang sah. Payload action harus berupa JSON string yang sesuai: create_assignment dapat berisi title, detail, due_date, priority, owner_membership_id, reviewer_membership_id; save_decision dapat berisi title dan detail; create_meeting dapat berisi title, agenda, startsAt, endsAt, timezone, attendeeMembershipIds; link_project dapat berisi project_id dan title.`;
  const groq = await fetch('https://api.groq.com/openai/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({
    model: GROQ_MODEL, max_output_tokens: 1800, instructions,
    input: `Pertanyaan pengguna:\n${prompt}\n\nKonteks terotorisasi (JSON):\n${JSON.stringify(context)}`,
    text: { format: { type: 'json_schema', name: 'kawan_ai_response', strict: true, schema: responseSchema } },
  }) });
  const response = await groq.json().catch(() => ({}));
  if (!groq.ok) {
    const errorCode = String(response?.error?.code ?? 'unknown');
    console.error('Groq response error', groq.status, errorCode);
    if (errorCode === 'rate_limit_exceeded') return json({ error: 'Kapasitas Kawan AI sedang penuh. Coba lagi sebentar.' }, 429, origin);
    if (errorCode === 'model_not_found') return json({ error: 'Model Kawan AI belum tersedia pada provider saat ini.' }, 503, origin);
    return json({ error: 'Kawan AI belum dapat memproses permintaan.' }, 502, origin);
  }
  const outputText = response.output_text ?? response.output?.flatMap((item: Record<string, unknown>) => Array.isArray(item.content) ? item.content : []).find((item: Record<string, unknown>) => item.type === 'output_text')?.text;
  let result: { answer: string; actions: Array<{ id: string; type: string; title: string; payload_json: string }> };
  try { result = JSON.parse(String(outputText ?? '')); } catch { return json({ error: 'Jawaban Kawan AI tidak dapat dibaca.' }, 502, origin); }
  const actions = route.startsWith('/ruang-kawan/chat') && entityId ? result.actions : [];
  const run = await client.rpc('register_kawan_ai_run', { context_route: route, context_entity_type: entityType, context_entity_id: entityId, intent: prompt, model_name: GROQ_MODEL, actions });
  if (run.error) return json({ error: 'Jawaban tersedia, tetapi pencatatan audit Kawan AI gagal.' }, 500, origin);
  return json({ answer: result.answer, actions, runId: run.data, model: GROQ_MODEL }, 200, origin);
});
