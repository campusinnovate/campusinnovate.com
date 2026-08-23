import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET')!;
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI') ?? `${SUPABASE_URL}/functions/v1/ruang-kawan-calendar/callback`;
const COMPANY_CALENDAR_ID = 'innovatecampus@gmail.com';
const APP_ORIGIN = 'https://campusinnovate.com';
const SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events'];

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function cors(origin: string | null) {
  const allowed = origin === APP_ORIGIN || origin?.startsWith('http://localhost:') ? origin : APP_ORIGIN;
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' };
}
function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function base64Url(bytes: Uint8Array) {
  let value = ''; bytes.forEach((byte) => { value += String.fromCharCode(byte); });
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function randomToken(size = 48) { return base64Url(crypto.getRandomValues(new Uint8Array(size))); }
async function sha256(value: string) { return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))); }
function safeReturnUrl(candidate: unknown) {
  try {
    const parsed = new URL(typeof candidate === 'string' ? candidate : `${APP_ORIGIN}/ruang-kawan/activity/`);
    if (parsed.origin !== APP_ORIGIN && !parsed.hostname.startsWith('localhost')) throw new Error('invalid origin');
    return parsed.toString();
  } catch { return `${APP_ORIGIN}/ruang-kawan/activity/`; }
}
async function authenticatedClient(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const accessToken = authorization.slice('Bearer '.length);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await service.auth.getUser(accessToken);
  return error || !user ? null : { client, user };
}
async function canManageCompany(client: ReturnType<typeof createClient>) {
  const { data } = await client.rpc('get_my_access');
  const access = Array.isArray(data) ? data[0] : data;
  return Boolean(access?.permissions?.includes('calendar.manage_company'));
}
async function refreshConnection(connection: Record<string, any>) {
  const expiresAt = connection.token_expires_at ? new Date(String(connection.token_expires_at)).getTime() : 0;
  if (expiresAt > Date.now() + 90_000) return connection;
  if (!connection.refresh_token) throw new Error('Google Calendar harus dihubungkan kembali.');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: String(connection.refresh_token), grant_type: 'refresh_token' }) });
  const token = await response.json();
  if (!response.ok) throw new Error(token.error_description || 'Token Google tidak dapat diperbarui.');
  const update = { access_token: token.access_token, token_expires_at: new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000).toISOString(), updated_at: new Date().toISOString() };
  await service.from('google_calendar_connections').update(update).eq('id', connection.id);
  return { ...connection, ...update };
}
async function googleFetch(connection: Record<string, any>, path: string, init?: RequestInit) {
  const ready = await refreshConnection(connection);
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...init, headers: { Authorization: `Bearer ${ready.access_token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'Google Calendar request gagal.');
  return body;
}

async function authorize(req: Request, origin: string | null) {
  const auth = await authenticatedClient(req);
  if (!auth) return json({ error: 'Sesi tidak valid.' }, 401, origin);
  const body = await req.json().catch(() => ({}));
  const connectionType = body.connectionType === 'company' ? 'company' : 'personal';
  if (connectionType === 'company' && !(await canManageCompany(auth.client))) return json({ error: 'Izin pengelola kalender perusahaan diperlukan.' }, 403, origin);
  const state = randomToken(); const verifier = randomToken(64); const challenge = await sha256(verifier); const returnUrl = safeReturnUrl(body.returnUrl);
  const { error } = await service.from('google_calendar_oauth_states').insert({ state_hash: await sha256(state), user_id: auth.user.id, connection_type: connectionType, code_verifier: verifier, return_url: returnUrl, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
  if (error) return json({ error: 'Koneksi belum dapat dimulai.' }, 500, origin);
  const params = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: GOOGLE_REDIRECT_URI, response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true', state, code_challenge: challenge, code_challenge_method: 'S256' });
  if (connectionType === 'company') params.set('login_hint', 'kawanberinovasi@gmail.com');
  return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }, 200, origin);
}

async function callback(req: Request) {
  const url = new URL(req.url); const state = url.searchParams.get('state'); const code = url.searchParams.get('code');
  if (!state || !code) return Response.redirect(`${APP_ORIGIN}/ruang-kawan/activity/?calendar=cancelled`, 302);
  const stateHash = await sha256(state);
  const { data: stored } = await service.from('google_calendar_oauth_states').select('*').eq('state_hash', stateHash).maybeSingle();
  await service.from('google_calendar_oauth_states').delete().eq('state_hash', stateHash);
  if (!stored || new Date(stored.expires_at).getTime() < Date.now()) return Response.redirect(`${APP_ORIGIN}/ruang-kawan/activity/?calendar=expired`, 302);
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, code, code_verifier: stored.code_verifier, grant_type: 'authorization_code', redirect_uri: GOOGLE_REDIRECT_URI }) });
  const token = await response.json();
  if (!response.ok) return Response.redirect(`${stored.return_url}${stored.return_url.includes('?') ? '&' : '?'}calendar=error`, 302);
  const infoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
  const userInfo = await infoResponse.json();
  const base = { owner_user_id: stored.user_id, connection_type: stored.connection_type, google_account_email: userInfo.email ?? null, access_token: token.access_token, token_expires_at: new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000).toISOString(), granted_scopes: String(token.scope ?? '').split(' ').filter(Boolean), selected_calendar_ids: stored.connection_type === 'company' ? [COMPANY_CALENDAR_ID] : ['primary'], is_active: true, updated_at: new Date().toISOString() };
  if (stored.connection_type === 'company') {
    const { data: existing } = await service.from('google_calendar_connections').select('id,refresh_token').eq('connection_type', 'company').eq('is_active', true).maybeSingle();
    if (existing) await service.from('google_calendar_connections').update({ ...base, refresh_token: token.refresh_token ?? existing.refresh_token }).eq('id', existing.id);
    else await service.from('google_calendar_connections').insert({ ...base, refresh_token: token.refresh_token ?? null });
  } else {
    const { data: existing } = await service.from('google_calendar_connections').select('refresh_token').eq('owner_user_id', stored.user_id).eq('connection_type', 'personal').maybeSingle();
    await service.from('google_calendar_connections').upsert({ ...base, refresh_token: token.refresh_token ?? existing?.refresh_token ?? null }, { onConflict: 'owner_user_id,connection_type' });
  }
  const returnUrl = new URL(stored.return_url); returnUrl.searchParams.set('calendar', 'connected'); returnUrl.searchParams.set('type', stored.connection_type);
  return Response.redirect(returnUrl.toString(), 302);
}

async function listCalendars(req: Request, origin: string | null) {
  const auth = await authenticatedClient(req); if (!auth) return json({ error: 'Sesi tidak valid.' }, 401, origin);
  const type = new URL(req.url).searchParams.get('type') === 'company' ? 'company' : 'personal';
  let query = service.from('google_calendar_connections').select('*').eq('connection_type', type).eq('is_active', true);
  if (type === 'personal') query = query.eq('owner_user_id', auth.user.id);
  const { data: connection } = await query.maybeSingle();
  if (!connection) return json({ calendars: [], connected: false }, 200, origin);
  if (type === 'company' && !(await canManageCompany(auth.client))) return json({ error: 'Akses ditolak.' }, 403, origin);
  const body = await googleFetch(connection, '/users/me/calendarList?minAccessRole=reader&showHidden=false');
  return json({ connected: true, account: connection.google_account_email, selected: connection.selected_calendar_ids, calendars: (body.items ?? []).map((item: Record<string, any>) => ({ id: item.id, summary: item.summary, primary: Boolean(item.primary), accessRole: item.accessRole })) }, 200, origin);
}

async function listEvents(req: Request, origin: string | null) {
  const auth = await authenticatedClient(req); if (!auth) return json({ error: 'Sesi tidak valid.' }, 401, origin);
  const url = new URL(req.url); const timeMin = url.searchParams.get('timeMin') ?? new Date(Date.now() - 31 * 86_400_000).toISOString(); const timeMax = url.searchParams.get('timeMax') ?? new Date(Date.now() + 62 * 86_400_000).toISOString();
  const { data: connections } = await service.from('google_calendar_connections').select('*').eq('is_active', true).or(`owner_user_id.eq.${auth.user.id},connection_type.eq.company`);
  const events: Record<string, unknown>[] = [];
  for (const connection of connections ?? []) {
    const ids = connection.selected_calendar_ids?.length ? connection.selected_calendar_ids : [connection.connection_type === 'company' ? COMPANY_CALENDAR_ID : 'primary'];
    for (const calendarId of ids) {
      try {
        const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
        const body = await googleFetch(connection, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
        for (const item of body.items ?? []) events.push({ id: item.id, title: item.summary ?? '(Tanpa judul)', start: item.start, end: item.end, status: item.status, htmlLink: item.htmlLink, calendarId, calendarType: connection.connection_type, account: connection.google_account_email });
      } catch (error) { events.push({ calendarId, calendarType: connection.connection_type, error: error instanceof Error ? error.message : 'Gagal memuat event.' }); }
    }
  }
  return json({ events }, 200, origin);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin'); if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  const path = new URL(req.url).pathname.replace(/^.*\/ruang-kawan-calendar/, '') || '/';
  try {
    if (path === '/authorize' && req.method === 'POST') return await authorize(req, origin);
    if (path === '/callback' && req.method === 'GET') return await callback(req);
    if (path === '/calendars' && req.method === 'GET') return await listCalendars(req, origin);
    if (path === '/events' && req.method === 'GET') return await listEvents(req, origin);
    return json({ error: 'Route tidak ditemukan.' }, 404, origin);
  } catch (error) { console.error(error); return json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan pada layanan Calendar.' }, 500, origin); }
});
