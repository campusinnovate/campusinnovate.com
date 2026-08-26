import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET')!;
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI') ?? `${SUPABASE_URL}/functions/v1/ruang-kawan-calendar/callback`;
const COMPANY_CALENDAR_ID = 'innovatecampus@gmail.com';
const APP_ORIGIN = 'https://campusinnovate.com';
const WORKSPACE_SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/presentations'];
const SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events', ...WORKSPACE_SCOPES];

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
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY } });
  const user = await userResponse.json();
  if (!userResponse.ok) throw new Error(`Sesi Supabase ditolak: ${user.message ?? 'token tidak valid'}`);
  return !user?.id ? null : { client, user };
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
  const body = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'Google Calendar request gagal.');
  return body;
}

async function googleApi(connection: Record<string, any>, url: string, init?: RequestInit, parseJson = true) {
  const ready = await refreshConnection(connection);
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${ready.access_token}`, ...(init?.headers ?? {}) } });
  const body = parseJson ? await response.json() : await response.arrayBuffer();
  if (!response.ok) {
    const message = parseJson ? (body as Record<string, any>).error?.message : '';
    throw new Error(message || 'Google Workspace request gagal.');
  }
  return body;
}
async function activeWorkspaceEmails() {
  const { data, error } = await service.from('memberships').select('email').in('status', ['active','invited']);
  if (error) throw new Error(`Daftar anggota belum dapat dimuat: ${error.message}`);
  return [...new Set((data ?? []).map((member) => String(member.email ?? '').trim().toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))];
}
async function shareDriveFile(connection: Record<string, any>, fileId: string, emails: string[], role: 'reader'|'writer') {
  const ownerEmail = String(connection.google_account_email ?? '').toLowerCase();
  const results = { shared: [] as string[], failed: [] as string[] };
  for (const email of [...new Set(emails.map((item) => item.toLowerCase()))]) {
    if (email === ownerEmail) { results.shared.push(email); continue; }
    try {
      await googleApi(connection, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false&fields=id`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type:'user', role, emailAddress:email }),
      });
      results.shared.push(email);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('already') || message.includes('permission')) results.shared.push(email);
      else results.failed.push(email);
    }
  }
  return results;
}
function driveId(value: unknown) {
  const text = String(value ?? '').trim();
  return text.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? text.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] ?? (text.match(/^[a-zA-Z0-9_-]{10,}$/)?.[0] ?? '');
}
function readPath(source: Record<string, any>, path: string) {
  return path.split('.').reduce<any>((value, key) => value == null ? '' : value[key], source);
}
function stringify(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => typeof item === 'object' ? Object.values(item as Record<string, unknown>).filter(Boolean).join(' · ') : String(item)).join('\n');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value == null ? '' : String(value);
}
function formatMetric(value: unknown, suffix = '') {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(number)}${suffix}`;
}
function formatKpis(value: unknown) {
  if (!Array.isArray(value) || !value.length) return 'Belum ada KPI pada snapshot ini.';
  return value.map((entry: Record<string, any>) => {
    const source = entry?.source_data && typeof entry.source_data === 'object' ? entry.source_data : {};
    const name = source.name ?? source.kpi_name ?? source.indicator_name ?? entry.category ?? 'KPI';
    const category = entry.category && entry.category !== name ? ` · ${entry.category}` : '';
    return `${name}${category}\nTarget ${formatMetric(entry.target)} · Aktual ${formatMetric(entry.actual)} · Capaian ${formatMetric(entry.achievement, '%')} · ${entry.status ?? 'Belum dinilai'}`;
  }).join('\n\n');
}
function reportReplacements(context: Record<string, any>) {
  const snapshot = context.snapshot ?? {}; const payload = snapshot.payload ?? {}; const items = payload.items ?? [];
  const values: Record<string, unknown> = {
    report_type: snapshot.report_type, period_start: snapshot.period_start, period_end: snapshot.period_end,
    score: snapshot.score, owner_name: snapshot.owner_name, generated_at: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
    kpis: formatKpis(context.kpis),
  };
  for (const section of ['progress','problem','plan','priority','notes','insight']) values[section] = items.filter((item: Record<string, any>) => item.section === section).map((item: Record<string, any>) => item.text).join('\n• ');
  const source = { ...context, ...values };
  for (const [token, path] of Object.entries(context.template?.placeholder_map ?? {})) values[token.replace(/^\{\{|\}\}$/g, '')] = readPath(source, String(path));
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [`{{${key}}}`, stringify(value)]));
}
async function companyWorkspaceConnection() {
  const { data } = await service.from('google_calendar_connections').select('*').eq('connection_type','company').eq('is_active',true).order('updated_at',{ascending:false}).limit(1).maybeSingle();
  return data;
}
function workspaceReady(connection: Record<string, any> | null) {
  const scopes = connection?.granted_scopes ?? [];
  return Boolean(connection && WORKSPACE_SCOPES.every((scope) => scopes.includes(scope)));
}
async function workspaceStatus(req: Request, origin: string | null) {
  const auth = await authenticatedClient(req); if (!auth) return json({ error: 'Sesi tidak valid.' },401,origin);
  const connection = await companyWorkspaceConnection();
  return json({ connected:Boolean(connection),ready:workspaceReady(connection),account:connection?.google_account_email ?? null,canManage:await canManageCompany(auth.client) },200,origin);
}
async function generateWorkspaceReport(req: Request, origin: string | null) {
  const auth = await authenticatedClient(req); if (!auth) return json({ error:'Sesi tidak valid.' },401,origin);
  const body = await req.json().catch(() => ({}));
  const snapshotId = String(body.snapshotId ?? ''); const templateId = String(body.templateId ?? ''); const kind = ['document','presentation','pdf'].includes(body.kind) ? body.kind : 'document';
  if (!snapshotId || !templateId) return json({ error:'Snapshot dan template wajib dipilih.' },400,origin);
  const { data: context, error } = await auth.client.rpc('get_report_generation_payload',{target_snapshot:snapshotId,target_template:templateId});
  if (error) return json({ error:error.message },403,origin);
  const connection = await companyWorkspaceConnection();
  if (!workspaceReady(connection)) return json({ error:'Google Workspace perusahaan belum diaktifkan.',needsAuthorization:true },409,origin);
  const templateFileId = driveId(context.template.drive_template_url); const folderId = driveId(context.template.output_folder_url);
  if (!templateFileId) return json({ error:'Link file template Google Drive tidak valid.' },400,origin);
  const baseTitle = `Campus Innovate - ${String(context.snapshot.report_type)} - ${context.snapshot.period_start} to ${context.snapshot.period_end}`;
  const copyPayload:Record<string,unknown> = { name:baseTitle }; if (folderId) copyPayload.parents=[folderId];
  const copied = await googleApi(connection!,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(templateFileId)}/copy?fields=id,name,mimeType,webViewLink`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(copyPayload)}) as Record<string,any>;
  const replacements = reportReplacements(context);
  const requests = Object.entries(replacements).map(([text,replaceText]) => ({replaceAllText:{containsText:{text,matchCase:true},replaceText}}));
  const fileType = context.template.google_file_type;
  if (fileType === 'presentation') await googleApi(connection!,`https://slides.googleapis.com/v1/presentations/${copied.id}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests})});
  else await googleApi(connection!,`https://docs.googleapis.com/v1/documents/${copied.id}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests})});
  let fileId=copied.id; let url=copied.webViewLink ?? `https://drive.google.com/open?id=${copied.id}`;
  if (kind === 'pdf') {
    const bytes = await googleApi(connection!,`https://www.googleapis.com/drive/v3/files/${copied.id}/export?mimeType=${encodeURIComponent('application/pdf')}`,undefined,false) as ArrayBuffer;
    const boundary=`rk_${crypto.randomUUID()}`; const metadata={name:`${baseTitle}.pdf`,mimeType:'application/pdf',...(folderId?{parents:[folderId]}:{})};
    const prefix=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`;
    const suffix=`\r\n--${boundary}--`; const p=new TextEncoder().encode(prefix); const s=new TextEncoder().encode(suffix); const all=new Uint8Array(p.length+bytes.byteLength+s.length); all.set(p);all.set(new Uint8Array(bytes),p.length);all.set(s,p.length+bytes.byteLength);
    const pdf=await googleApi(connection!,`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body:all}) as Record<string,any>;
    fileId=pdf.id;url=pdf.webViewLink ?? `https://drive.google.com/open?id=${pdf.id}`;
  }
  const sharing=await shareDriveFile(connection!,fileId,await activeWorkspaceEmails(),'reader');
  const registered=await auth.client.rpc('register_generated_report_artifact',{target_snapshot:snapshotId,kind,url_value:url,drive_id:fileId,template_ver:context.template.version});
  if (registered.error) return json({ error:`File berhasil dibuat, tetapi registrasi gagal: ${registered.error.message}`,url },500,origin);
  return json({ ready:true,fileId,url,name:baseTitle,sharing },200,origin);
}

async function personalSpreadsheet(req: Request, origin: string | null) {
  const auth = await authenticatedClient(req); if (!auth) return json({ error:'Sesi tidak valid.' },401,origin);
  const { data: membership, error: memberError } = await service.from('memberships').select('id,email,full_name,status').eq('user_id',auth.user.id).in('status',['active','invited']).maybeSingle();
  if (memberError || !membership) return json({ error:'Keanggotaan Ruang Kawan tidak ditemukan.' },403,origin);
  const { data: existing } = await service.from('personal_spreadsheets').select('*').eq('owner_membership_id',membership.id).maybeSingle();
  if (existing) return json({ ready:true,sheet:existing },200,origin);
  if (req.method !== 'POST') return json({ ready:false,sheet:null },200,origin);
  const connection = await companyWorkspaceConnection();
  if (!workspaceReady(connection)) return json({ error:'Google Workspace perusahaan belum diaktifkan.',needsAuthorization:true },409,origin);
  const title=`Coret-coret Spreadsheet — ${membership.full_name || membership.email}`;
  const created=await googleApi(connection!,`https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:title,mimeType:'application/vnd.google-apps.spreadsheet'}),
  }) as Record<string,any>;
  const sharing=await shareDriveFile(connection!,created.id,[String(membership.email)],'writer');
  if (!sharing.shared.length) return json({ error:'Spreadsheet dibuat, tetapi akses akunmu belum berhasil diberikan.',url:created.webViewLink },500,origin);
  const sheet={
    owner_membership_id:membership.id,drive_file_id:created.id,
    drive_file_url:created.webViewLink ?? `https://docs.google.com/spreadsheets/d/${created.id}/edit`,
    embed_url:`https://docs.google.com/spreadsheets/d/${created.id}/edit?rm=minimal&widget=true`,status:'ready',updated_at:new Date().toISOString(),
  };
  const { data:saved,error:saveError }=await service.from('personal_spreadsheets').upsert(sheet,{onConflict:'owner_membership_id'}).select('*').single();
  if (saveError) return json({ error:`Spreadsheet dibuat, tetapi registrasi gagal: ${saveError.message}`,url:sheet.drive_file_url },500,origin);
  return json({ ready:true,sheet:saved },200,origin);
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
    await service.from('google_calendar_connections').update({ is_active: false, updated_at: new Date().toISOString() }).eq('connection_type', 'company');
    const { data: ownerConnection } = await service.from('google_calendar_connections').select('id,refresh_token').eq('owner_user_id', stored.user_id).eq('connection_type', 'company').maybeSingle();
    const { data: fallbackConnection } = ownerConnection ? { data: null } : await service.from('google_calendar_connections').select('id,refresh_token').eq('connection_type', 'company').order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const existing = ownerConnection ?? fallbackConnection;
    const saveResult = existing
      ? await service.from('google_calendar_connections').update({ ...base, refresh_token: token.refresh_token ?? existing.refresh_token }).eq('id', existing.id)
      : await service.from('google_calendar_connections').insert({ ...base, refresh_token: token.refresh_token ?? null });
    if (saveResult.error) throw new Error(`Koneksi company belum tersimpan: ${saveResult.error.message}`);
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
  const uniqueEvents = new Map<string, Record<string, unknown>>();
  for (const event of events) {
    const key = `${String(event.calendarId)}:${String(event.id ?? event.error)}`;
    const existing = uniqueEvents.get(key);
    if (!existing || event.calendarType === 'company') uniqueEvents.set(key, event);
  }
  return json({ events: [...uniqueEvents.values()] }, 200, origin);
}

async function createChatMeeting(req: Request, origin: string | null) {
  const auth = await authenticatedClient(req); if (!auth) return json({ error: 'Sesi tidak valid.' }, 401, origin);
  const body = await req.json().catch(() => ({}));
  const conversationId = String(body.conversationId ?? '');
  const title = String(body.title ?? '').trim();
  const startsAt = String(body.startsAt ?? ''); const endsAt = String(body.endsAt ?? '');
  const timezone = String(body.timezone ?? 'Asia/Jakarta');
  const attendeeIds = Array.isArray(body.attendeeMembershipIds) ? body.attendeeMembershipIds.map(String) : [];
  if (!conversationId || !title || !startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) return json({ error: 'Judul serta waktu meeting tidak valid.' }, 400, origin);
  const [{ data: memberAllowed }, { data: accessData }] = await Promise.all([
    auth.client.rpc('is_chat_member', { target_conversation_id: conversationId }), auth.client.rpc('get_my_access'),
  ]);
  const access = Array.isArray(accessData) ? accessData[0] : accessData;
  if (!memberAllowed || !access?.permissions?.includes('meeting.create')) return json({ error: 'Akses membuat meeting ditolak.' }, 403, origin);
  const { data: allowedMembers } = attendeeIds.length
    ? await service.from('chat_conversation_members').select('membership_id,memberships!inner(email)').eq('conversation_id',conversationId).is('left_at',null).in('membership_id',attendeeIds)
    : { data: [] };
  const attendees = (allowedMembers ?? []).map((row: any) => String(row.memberships?.email ?? '')).filter((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).map((email: string) => ({ email }));
  const { data: personal } = await service.from('google_calendar_connections').select('*').eq('connection_type','personal').eq('owner_user_id',auth.user.id).eq('is_active',true).maybeSingle();
  const connection = personal ?? await companyWorkspaceConnection();
  if (!connection) return json({ error: 'Google Calendar belum dihubungkan.', needsAuthorization: true }, 409, origin);
  const calendarId = connection.selected_calendar_ids?.[0] ?? (connection.connection_type === 'company' ? COMPANY_CALENDAR_ID : 'primary');
  const requestId = crypto.randomUUID();
  const event = await googleFetch(connection, `/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'POST', body: JSON.stringify({
      summary: title, description: String(body.agenda ?? ''), attendees,
      start: { dateTime: startsAt, timeZone: timezone }, end: { dateTime: endsAt, timeZone: timezone },
      conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      extendedProperties: { private: { ruangKawanConversationId: conversationId, source: 'kawan-chat' } },
    }),
  });
  const meetUrl = event.hangoutLink ?? event.conferenceData?.entryPoints?.find((item: Record<string,any>) => item.entryPointType === 'video')?.uri ?? null;
  const payload = {
    title, agenda: String(body.agenda ?? ''), starts_at: startsAt, ends_at: endsAt, timezone,
    attendee_membership_ids: attendeeIds, google_event_id: event.id, google_calendar_id: calendarId,
    meet_url: meetUrl, html_link: event.htmlLink ?? null,
  };
  const registered = await auth.client.rpc('register_chat_meeting', { target_conversation_id: conversationId, target_message_id: body.sourceMessageId || null, meeting_payload: payload });
  if (registered.error) {
    await googleFetch(connection, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}?sendUpdates=none`, { method: 'DELETE' }).catch(() => null);
    return json({ error: `Meeting dibatalkan karena registrasi Ruang Kawan gagal: ${registered.error.message}` }, 500, origin);
  }
  return json({ ready: true, meetingId: registered.data, eventId: event.id, meetUrl, htmlLink: event.htmlLink ?? null }, 200, origin);
}

async function uploadChatAttachment(req: Request, origin: string | null) {
  const auth = await authenticatedClient(req); if (!auth) return json({ error: 'Sesi tidak valid.' }, 401, origin);
  const form = await req.formData(); const file = form.get('file'); const conversationId = String(form.get('conversationId') ?? '');
  const registerDocument = String(form.get('registerDocument') ?? 'true') !== 'false';
  if (!conversationId || !(file instanceof File)) return json({ error: 'Percakapan dan file wajib dipilih.' }, 400, origin);
  if (file.size <= 0 || file.size > 25 * 1024 * 1024) return json({ error: 'Ukuran file harus antara 1 byte dan 25 MB.' }, 400, origin);
  const { data: memberAllowed } = await auth.client.rpc('is_chat_member', { target_conversation_id: conversationId });
  if (!memberAllowed) return json({ error: 'Percakapan tidak dapat diakses.' }, 403, origin);
  const { data: accessData } = await auth.client.rpc('get_my_access');
  const access = Array.isArray(accessData) ? accessData[0] : accessData;
  const registersCompanyDocument = registerDocument && Boolean(access?.permissions?.includes('documents.create'));
  const company = await companyWorkspaceConnection();
  const { data: personal } = await service.from('google_calendar_connections').select('*').eq('connection_type','personal').eq('owner_user_id',auth.user.id).eq('is_active',true).maybeSingle();
  const connection = workspaceReady(company) ? company : workspaceReady(personal) ? personal : null;
  if (!connection) return json({ error: 'Google Drive belum dihubungkan untuk upload lampiran.', needsAuthorization: true }, 409, origin);
  const safeName = file.name.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').slice(0, 180) || 'Lampiran Kawan Chat';
  const metadata = { name: safeName, mimeType: file.type || 'application/octet-stream', appProperties: { source: 'kawan-chat', conversationId } };
  const boundary = `rk_chat_${crypto.randomUUID()}`; const bytes = new Uint8Array(await file.arrayBuffer());
  const prefix = new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`);
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--`); const multipart = new Uint8Array(prefix.length + bytes.length + suffix.length); multipart.set(prefix); multipart.set(bytes, prefix.length); multipart.set(suffix, prefix.length + bytes.length);
  const uploaded = await googleApi(connection!, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart }) as Record<string,any>;
  const { data: conversationMembers } = await service.from('chat_conversation_members').select('memberships!inner(email)').eq('conversation_id',conversationId).is('left_at',null);
  const participantEmails = (conversationMembers ?? []).map((row: any) => String(row.memberships?.email ?? '')).filter((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  // Document Center files are company artifacts, while conversation-only files keep participant access.
  // Personal Coret-coret spreadsheets are created by a separate route and remain owner-only.
  const emails = registersCompanyDocument ? await activeWorkspaceEmails() : participantEmails;
  const sharing = await shareDriveFile(connection!, String(uploaded.id), emails, 'reader');
  const fileUrl = uploaded.webViewLink ?? `https://drive.google.com/open?id=${uploaded.id}`;
  const registered = await auth.client.rpc('register_chat_attachment', { target_conversation_id: conversationId, register_document: registersCompanyDocument, file_payload: { file_name: safeName, file_url: fileUrl, drive_file_id: uploaded.id, mime_type: uploaded.mimeType ?? metadata.mimeType, size_bytes: Number(uploaded.size ?? file.size) } });
  if (registered.error) {
    await googleApi(connection!, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}`, { method: 'DELETE' }, false).catch(() => null);
    return json({ error: `File dibatalkan karena registrasi Kawan Chat gagal: ${registered.error.message}` }, 500, origin);
  }
  return json({ ready: true, attachment: { id: registered.data, name: safeName, url: fileUrl, mime_type: uploaded.mimeType ?? metadata.mimeType, size_bytes: Number(uploaded.size ?? file.size) }, sharing }, 200, origin);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin'); if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  const path = new URL(req.url).pathname.replace(/^.*\/ruang-kawan-calendar/, '') || '/';
  try {
    if (path === '/authorize' && req.method === 'POST') return await authorize(req, origin);
    if (path === '/callback' && req.method === 'GET') return await callback(req);
    if (path === '/calendars' && req.method === 'GET') return await listCalendars(req, origin);
    if (path === '/events' && req.method === 'GET') return await listEvents(req, origin);
    if (path === '/meetings' && req.method === 'POST') return await createChatMeeting(req, origin);
    if (path === '/chat/attachments' && req.method === 'POST') return await uploadChatAttachment(req, origin);
    if (path === '/workspace/status' && req.method === 'GET') return await workspaceStatus(req, origin);
    if (path === '/workspace/generate-report' && req.method === 'POST') return await generateWorkspaceReport(req, origin);
    if (path === '/workspace/personal-spreadsheet' && ['GET','POST'].includes(req.method)) return await personalSpreadsheet(req, origin);
    return json({ error: 'Route tidak ditemukan.' }, 404, origin);
  } catch (error) { console.error(error); return json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan pada layanan Calendar.' }, 500, origin); }
});
