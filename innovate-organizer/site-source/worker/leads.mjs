const MAX_BODY = 8192;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const services = new Set(['Gathering & Outing', 'Team Building', 'Seminar & Konferensi', 'Acara Perusahaan', 'Pelatihan & Workshop', 'Lainnya', '']);
const recentSubmissions = new Map();

export async function handleBrief(request, env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'invalid_content_type' }, 415);
  if (Number(request.headers.get('content-length')) > MAX_BODY) return json({ error: 'body_too_large' }, 413);
  let data;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'invalid_request' }, 400);
    let size = 0, chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); return json({ error: 'body_too_large' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return json({ error: 'invalid_request' }, 400); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'invalid_request' }, 400);
  const id = text(data.id, 36), name = text(data.nama, 120), contact = text(data.kontak, 40);
  const type = text(data.jenis, 80), date = text(data.tanggal, 100), needs = text(data.kebutuhan, 800);
  const participants = data.jumlah === '' || data.jumlah == null ? null : Number(data.jumlah);
  if (data.website) return json({ error: 'invalid_request' }, 400);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || name.length < 2 || !/^\+?[\d\s()-]{8,30}$/.test(contact) || !/^\d{8,15}$/.test(contact.replace(/\D/g, '')) || !services.has(type) || data.consent !== true || (participants !== null && (!Number.isInteger(participants) || participants < 1 || participants > 1000000))) return json({ error: 'invalid_fields' }, 400);
  if (!env.DB) return json({ error: 'storage_unavailable' }, 503);
  // Best-effort burst protection per Worker isolate. No IPs are written to D1.
  const ip = request.headers.get('cf-connecting-ip');
  const now = Date.now();
  if (ip) {
    const recent = recentSubmissions.get(ip);
    if (recent && recent.until > now && recent.count >= 8) return json({ error: 'rate_limited' }, 429);
    if (recentSubmissions.size >= 1000) recentSubmissions.delete(recentSubmissions.keys().next().value);
    recentSubmissions.set(ip, recent && recent.until > now ? { ...recent, count: recent.count + 1 } : { until: now + 600000, count: 1 });
  }
  const attribution = {};
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid']) {
    const value = text(data.attribution?.[key], 200);
    if (value) attribution[key] = value;
  }
  try {
    // A stable submission UUID makes retries safe after an uncertain network response.
    await env.DB.prepare('INSERT INTO event_leads (id, created_at, name_company, whatsapp, event_type, event_date, participants, requirements, attribution, status, consent_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
      .bind(id, new Date().toISOString(), name, contact, type, date, participants, needs, JSON.stringify(attribution), 'new', 'brief-2026-11').run();
    return json({ ok: true, id }, 201);
  } catch {
    // Do not put contact details or request bodies into runtime logs.
    return json({ error: 'save_failed' }, 503);
  }
}
