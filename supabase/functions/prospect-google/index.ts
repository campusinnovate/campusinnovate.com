import { createClient } from 'npm:@supabase/supabase-js@2';
import { grantedServices, isGoogleService, reportDates, scopesFor, sheetCandidates, type SheetMapping } from '../../../src/lib/prospects/google.ts';
import { base64url, digest, seal, unseal } from './security.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const clientId = Deno.env.get('GOOGLE_PROSPECT_CLIENT_ID') ?? '';
const clientSecret = Deno.env.get('GOOGLE_PROSPECT_CLIENT_SECRET') ?? '';
const encryptionKey = Deno.env.get('GOOGLE_PROSPECT_ENCRYPTION_KEY') ?? '';
const origin = Deno.env.get('APP_ORIGIN') ?? 'https://campusinnovate.com';
const callbackUrl = `${url}/functions/v1/prospect-google/callback`;
const returnUrl = `${origin}/ruang-kawan/prospects/`;
const configured = () => Boolean(clientId && clientSecret && /^[a-f0-9]{64}$/i.test(encryptionKey));
const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', Vary: 'Origin' };
function json(body: unknown, status = 200, requestOrigin?: string | null) {
  const allowed = requestOrigin && /^http:\/\/localhost:\d+$/.test(requestOrigin) ? requestOrigin : origin;
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
class RequestError extends Error { constructor(message: string, public status = 400) { super(message); } }
function check(error: { message: string } | null) { if (error) throw new RequestError('Database koneksi Google belum siap. Jalankan migrasi Prospect Google terbaru.', 503); }
function redirect(status: string) { const target = new URL(returnUrl); target.searchParams.set('google', status); return Response.redirect(target.toString(), 302); }
async function requestJson(target: string, init?: RequestInit) {
  let response: Response;
  try { response = await fetch(target, { ...init, signal: AbortSignal.timeout(20000) }); }
  catch { throw new RequestError('Google tidak dapat dihubungi. Coba kembali.', 502); }
  const data = await response.json().catch(() => ({}));
  return { response, data };
}
async function oauthCallback(req: Request) {
  const params = new URL(req.url).searchParams;
  const state = params.get('state');
  if (!state) return redirect('expired');
  // DELETE ... RETURNING consumes a state atomically, including declined consent.
  const consumed = await service.from('prospect_google_oauth_states').delete().eq('state_hash', await digest(state)).select('*').maybeSingle();
  if (consumed.error || !consumed.data || Date.parse(consumed.data.expires_at) < Date.now()) return redirect('expired');
  if (params.has('error') || !params.get('code')) return redirect('cancelled');
  const stored = consumed.data;
  const { response, data: token } = await requestJson('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
    client_id: clientId, client_secret: clientSecret, code: params.get('code')!, code_verifier: stored.code_verifier,
    grant_type: 'authorization_code', redirect_uri: callbackUrl,
  }) });
  if (!response.ok || !token.access_token) return redirect('error');
  const info = await requestJson('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!info.response.ok || !info.data.sub || !info.data.email || !info.data.email_verified) return redirect('error');
  const existing = await service.from('prospect_google_connections').select('*').eq('owner_user_id', stored.owner_user_id).eq('google_subject', info.data.sub).maybeSingle();
  check(existing.error);
  const previous = existing.data ? await unseal(existing.data.encrypted_tokens, encryptionKey, stored.owner_user_id) : null;
  const refreshToken = token.refresh_token || previous?.refresh_token;
  if (!refreshToken) return redirect('consent_required');
  const tokens = { access_token: token.access_token, refresh_token: refreshToken, expires_at: Date.now() + Number(token.expires_in ?? 3600) * 1000 };
  const saved = await service.from('prospect_google_connections').upsert({ owner_user_id: stored.owner_user_id, google_subject: info.data.sub,
    email: info.data.email, encrypted_tokens: await seal(tokens, encryptionKey, stored.owner_user_id),
    granted_scopes: String(token.scope ?? '').split(' ').filter(Boolean), updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_user_id,google_subject' });
  check(saved.error);
  return redirect('connected');
}

type Connection = { id: string; owner_user_id: string; encrypted_tokens: string; granted_scopes: string[] };
async function accessToken(connection: Connection) {
  const tokens = await unseal(connection.encrypted_tokens, encryptionKey, connection.owner_user_id);
  if (tokens.expires_at > Date.now() + 90000) return tokens.access_token as string;
  const { response, data } = await requestJson('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
    client_id: clientId, client_secret: clientSecret, refresh_token: tokens.refresh_token, grant_type: 'refresh_token',
  }) });
  if (!response.ok || !data.access_token) throw new RequestError('Koneksi Google kedaluwarsa atau dicabut. Hubungkan ulang akun.', 409);
  const updated = { ...tokens, access_token: data.access_token, refresh_token: data.refresh_token ?? tokens.refresh_token, expires_at: Date.now() + Number(data.expires_in ?? 3600) * 1000 };
  const saved = await service.from('prospect_google_connections').update({ encrypted_tokens: await seal(updated, encryptionKey, connection.owner_user_id), updated_at: new Date().toISOString() }).eq('id', connection.id).eq('owner_user_id', connection.owner_user_id);
  check(saved.error);
  return updated.access_token as string;
}
async function google(token: string, target: string, body?: unknown) {
  const { response, data } = await requestJson(target, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) {
    const disabled = data.error?.details?.some((d: { reason?: string }) => d.reason === 'SERVICE_DISABLED');
    throw new RequestError(disabled ? 'API layanan ini belum diaktifkan di Google Cloud Console.' :
      response.status === 401 ? 'Sesi Google ditolak. Hubungkan ulang akun.' :
      response.status === 403 ? 'Google menolak akses. Periksa izin akun, scope, dan aktivasi API di Cloud Console.' :
      response.status === 429 ? 'Kuota Google tercapai. Coba kembali nanti.' : `Google gagal membaca sumber (HTTP ${response.status}).`, response.status === 429 ? 429 : 502);
  }
  return data;
}
function fileId(value: unknown) { if (typeof value !== 'string' || !/^[\w-]{10,200}$/.test(value)) throw new RequestError('Spreadsheet tidak valid.'); return value; }
async function readSheet(token: string, id: string, sheetId: unknown) {
  if (!Number.isInteger(sheetId) || Number(sheetId) < 0) throw new RequestError('Pilih tab spreadsheet.');
  const metadata = await google(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=spreadsheetId,properties(title),sheets(properties(sheetId,title))`);
  const sheet = metadata.sheets?.find((s: { properties: { sheetId: number } }) => s.properties.sheetId === sheetId);
  if (!sheet) throw new RequestError('Tab spreadsheet tidak ditemukan.');
  const range = `'${sheet.properties.title.replaceAll("'", "''")}'!A1:Z101`;
  const data = await google(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`);
  const values: unknown[][] = data.values ?? [];
  return { values, version: await digest(JSON.stringify(values)), title: metadata.properties.title, range };
}

export async function handle(req: Request) {
  const requestOrigin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return json({}, 200, requestOrigin);
  const path = new URL(req.url).pathname.split('/prospect-google')[1] || '/';
  try {
    if (path === '/callback' && req.method === 'GET') {
      if (!configured()) return redirect('setup_required');
      try { return await oauthCallback(req); } catch { return redirect('error'); }
    }
    if (req.method !== 'POST') return json({ message: 'Metode tidak didukung.' }, 405, requestOrigin);
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ message: 'Silakan masuk ke Ruang Kawan.' }, 401, requestOrigin);
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const user = await caller.auth.getUser();
    if (user.error || !user.data.user) return json({ message: 'Sesi tidak valid.' }, 401, requestOrigin);
    const access = await caller.rpc('get_my_access');
    const permissions = (Array.isArray(access.data) ? access.data[0] : access.data)?.permissions ?? [];
    if (access.error || !permissions.includes('pipeline.manage_self')) return json({ message: 'Izin kelola Pipeline BD diperlukan.' }, 403, requestOrigin);
    const owner = user.data.user.id;
    const input = await req.json().catch(() => null);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RequestError('Permintaan tidak valid.');
    if (input.action === 'status') {
      const rows = await service.from('prospect_google_connections').select('id,email,granted_scopes,updated_at').eq('owner_user_id', owner).order('created_at');
      check(rows.error);
      return json({ configured: configured(), placesConfigured: Boolean(Deno.env.get('GOOGLE_PLACES_API_KEY')), accounts: (rows.data ?? []).map(row => ({ id: row.id, email: row.email, services: grantedServices(row.granted_scopes), updated_at: row.updated_at })) }, 200, requestOrigin);
    }
    if (input.action === 'disconnect') {
      if (typeof input.connectionId !== 'string') throw new RequestError('Pilih akun Google.');
      const removed = await service.from('prospect_google_connections').delete().eq('id', input.connectionId).eq('owner_user_id', owner).select('id');
      check(removed.error);
      if (!removed.data?.length) throw new RequestError('Koneksi tidak tersedia.', 404);
      return json({ disconnected: true }, 200, requestOrigin);
    }
    if (!configured()) throw new RequestError('OAuth Prospect Google belum dikonfigurasi di Supabase.', 503);
    if (input.action === 'authorize') {
      if (!Array.isArray(input.services) || !input.services.length || input.services.length > 6 || !input.services.every(isGoogleService)) throw new RequestError('Pilih layanan Google.');
      const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
      check((await service.from('prospect_google_oauth_states').delete().lt('expires_at', new Date().toISOString())).error);
      check((await service.from('prospect_google_oauth_states').insert({ state_hash: await digest(state), owner_user_id: owner, code_verifier: verifier, expires_at: new Date(Date.now() + 600000).toISOString() })).error);
      const params = new URLSearchParams({ client_id: clientId, redirect_uri: callbackUrl, response_type: 'code', scope: scopesFor(input.services).join(' '), state,
        access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true', code_challenge: await digest(verifier), code_challenge_method: 'S256' });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }, 200, requestOrigin);
    }
    const result = await service.from('prospect_google_connections').select('*').eq('id', String(input.connectionId ?? '')).eq('owner_user_id', owner).maybeSingle();
    check(result.error);
    if (!result.data) throw new RequestError('Koneksi akun tidak tersedia.', 404);
    const connection = result.data as Connection;
    if (!isGoogleService(input.service) || !grantedServices(connection.granted_scopes).includes(input.service)) throw new RequestError('Layanan belum diizinkan. Hubungkan ulang akun dengan layanan yang dipilih.', 409);
    const token = await accessToken(connection);
    const pageToken = typeof input.pageToken === 'string' ? input.pageToken.slice(0, 4000) : '';
    const page = new URLSearchParams(pageToken ? { pageToken } : {});
    if (input.action === 'resources') {
      let items: { id: string; name: string; detail?: string }[] = []; let nextPageToken = '';
      if (input.service === 'sheets') {
        page.set('q', "trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet'");
        page.set('fields', 'nextPageToken,files(id,name)'); page.set('pageSize', '100'); page.set('includeItemsFromAllDrives', 'true'); page.set('supportsAllDrives', 'true');
        const data = await google(token, `https://www.googleapis.com/drive/v3/files?${page}`);
        items = data.files ?? []; nextPageToken = data.nextPageToken ?? '';
      } else if (input.service === 'search_console') {
        const data = await google(token, 'https://www.googleapis.com/webmasters/v3/sites');
        items = (data.siteEntry ?? []).filter((s: { permissionLevel: string }) => s.permissionLevel !== 'siteUnverifiedUser').map((s: { siteUrl: string; permissionLevel: string }) => ({ id: s.siteUrl, name: s.siteUrl, detail: s.permissionLevel }));
      } else if (input.service === 'analytics') {
        page.set('pageSize', '100');
        const data = await google(token, `https://analyticsadmin.googleapis.com/v1beta/accountSummaries?${page}`);
        items = (data.accountSummaries ?? []).flatMap((a: { displayName: string; propertySummaries?: { property: string; displayName: string }[] }) => (a.propertySummaries ?? []).map(p => ({ id: p.property, name: p.displayName, detail: a.displayName })));
        nextPageToken = data.nextPageToken ?? '';
      } else if (input.service === 'cloud') {
        page.set('pageSize', '100');
        const data = await google(token, `https://cloudresourcemanager.googleapis.com/v3/projects:search?${page}`);
        items = (data.projects ?? []).map((p: { projectId: string; displayName: string; state: string }) => ({ id: p.projectId, name: p.displayName, detail: p.state })); nextPageToken = data.nextPageToken ?? '';
      } else if (input.service === 'calendar') {
        page.set('maxResults', '100');
        const data = await google(token, `https://www.googleapis.com/calendar/v3/users/me/calendarList?${page}`);
        items = (data.items ?? []).map((c: { id: string; summary: string; accessRole: string }) => ({ id: c.id, name: c.summary, detail: c.accessRole })); nextPageToken = data.nextPageToken ?? '';
      } else {
        page.set('part', 'snippet,statistics'); page.set('mine', 'true'); page.set('maxResults', '50');
        const data = await google(token, `https://www.googleapis.com/youtube/v3/channels?${page}`);
        items = (data.items ?? []).map((c: { id: string; snippet: { title: string }; statistics: { videoCount: string } }) => ({ id: c.id, name: c.snippet.title, detail: `${c.statistics.videoCount} video` })); nextPageToken = data.nextPageToken ?? '';
      }
      return json({ items, nextPageToken }, 200, requestOrigin);
    }
    if (input.service === 'sheets') {
      const id = fileId(input.resourceId);
      if (input.action === 'tabs') {
        const data = await google(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets(properties(sheetId,title))`);
        return json({ tabs: (data.sheets ?? []).map((s: { properties: unknown }) => s.properties) }, 200, requestOrigin);
      }
      if (input.action === 'preview' || input.action === 'import') {
        const sheet = await readSheet(token, id, input.sheetId);
        if (input.action === 'preview') return json(sheet, 200, requestOrigin);
        if (input.version !== sheet.version) throw new RequestError('Spreadsheet berubah sejak pratinjau. Muat ulang dan pilih baris kembali.', 409);
        if (!input.mapping || typeof input.mapping !== 'object' || Array.isArray(input.mapping) || !Array.isArray(input.selectedRows)) throw new RequestError('Pilihan impor tidak valid.');
        const candidates = sheetCandidates(sheet.values, input.mapping as SheetMapping, id, input.sheetId, input.selectedRows);
        const saved = await caller.rpc('import_google_prospect_candidates', { candidates });
        if (saved.error) throw new RequestError(`Impor dibatalkan: ${saved.error.message}`);
        return json(saved.data, 200, requestOrigin);
      }
    }
    if (input.action === 'report' && (input.service === 'search_console' || input.service === 'analytics')) {
      const dates = reportDates(input.startDate, input.endDate);
      if (typeof input.resourceId !== 'string' || input.resourceId.length > 2048) throw new RequestError('Pilih properti.');
      let columns: string[]; let rows: string[][];
      if (input.service === 'search_console') {
        const data = await google(token, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.resourceId)}/searchAnalytics/query`, { ...dates, dimensions: ['query', 'page'], rowLimit: 100, type: 'web', dataState: 'final' });
        columns = ['Query', 'Halaman', 'Klik', 'Impresi', 'CTR (%)', 'Posisi'];
        rows = (data.rows ?? []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => [...r.keys, String(r.clicks), String(r.impressions), (r.ctr * 100).toFixed(2), r.position.toFixed(1)]);
      } else {
        if (!/^properties\/\d+$/.test(input.resourceId)) throw new RequestError('Properti Analytics tidak valid.');
        const data = await google(token, `https://analyticsdata.googleapis.com/v1beta/${input.resourceId}:runReport`, { dateRanges: [dates], dimensions: [{ name: 'sessionSourceMedium' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'keyEvents' }], limit: '100' });
        columns = ['Sumber / Medium', 'Sesi', 'Pengguna aktif', 'Key events'];
        rows = (data.rows ?? []).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => [...r.dimensionValues, ...r.metricValues].map(v => v.value));
      }
      return json({ columns, rows, ...dates, fetchedAt: new Date().toISOString() }, 200, requestOrigin);
    }
    throw new RequestError('Aksi tidak tersedia.');
  } catch (error) {
    return json({ message: error instanceof RequestError ? error.message : error instanceof Error && /Kolom|baris|Pilih|Pemetaan|Website|Email|Nama account/.test(error.message) ? error.message : 'Koneksi Google gagal diproses. Periksa konfigurasi dan hubungkan ulang akun.' }, error instanceof RequestError ? error.status : 400, requestOrigin);
  }
}
if (import.meta.main) Deno.serve(handle);
