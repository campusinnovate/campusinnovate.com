import { createClient } from 'npm:@supabase/supabase-js@2';
import { base64url, digest, seal, unseal } from '../prospect-google/security.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const clientId = Deno.env.get('GOOGLE_RAB_CLIENT_ID') ?? '';
const clientSecret = Deno.env.get('GOOGLE_RAB_CLIENT_SECRET') ?? '';
const encryptionKey = Deno.env.get('GOOGLE_RAB_ENCRYPTION_KEY') ?? '';
const templateId = Deno.env.get('GOOGLE_RAB_TEMPLATE_ID') ?? '';
const folderId = Deno.env.get('GOOGLE_RAB_OUTPUT_FOLDER_ID') ?? '';
const appOrigin = Deno.env.get('APP_ORIGIN') ?? 'https://campusinnovate.com';
const callbackUrl = `${supabaseUrl}/functions/v1/rab-generator/callback`;
const returnUrl = `${appOrigin}/ruang-kawan/marketing/?tab=rab`;
const scope = 'openid email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets';
const configured = () => Boolean(clientId && clientSecret && /^[a-f0-9]{64}$/i.test(encryptionKey) && /^[\w-]{10,}$/.test(templateId) && /^[\w-]{10,}$/.test(folderId));

class RequestError extends Error { constructor(message: string, public status = 400) { super(message); } }
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && /^http:\/\/localhost:\d+$/.test(origin) ? origin : appOrigin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin', 'Cache-Control': 'no-store',
});
const reply = (value: unknown, status = 200, origin?: string | null) =>
  new Response(JSON.stringify(value), { status, headers: { ...cors(origin ?? null), 'Content-Type': 'application/json' } });
function requireDb(error: { message: string } | null) {
  if (error) throw new RequestError('Database RAB belum siap. Jalankan migrasi RAB Generator.', 503);
}
function name(value: unknown, label: string, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new RequestError(`${label} wajib diisi (maksimal ${max} karakter).`);
  return value.trim();
}
function optional(value: unknown, label: string, max = 400) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.length > max) throw new RequestError(`${label} tidak valid.`);
  return value.trim();
}
function amount(value: unknown, label: string, maximum = 1e12) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) throw new RequestError(`${label} tidak valid.`);
  return value;
}
function oneOf(value: unknown, choices: readonly string[], label: string) {
  if (typeof value !== 'string' || !choices.includes(value)) throw new RequestError(`${label} tidak valid.`);
  return value;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError('Form RAB tidak valid.');
  return value as Record<string, unknown>;
}
type Connection = { id: string; owner_user_id: string; encrypted_tokens: string; granted_scopes: string[] };
async function fetchGoogle(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) }).catch(() => { throw new RequestError('Google tidak dapat dihubungi.', 502); });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new RequestError(response.status === 401 ? 'Akses Google kedaluwarsa. Hubungkan ulang akun.' :
      response.status === 403 ? 'Akun Google tidak berhak atas master template atau folder tujuan. Periksa sharing Drive dan scope OAuth.' :
      response.status === 429 ? 'Kuota Google sedang penuh. Coba kembali.' :
      `Google menolak permintaan (HTTP ${response.status}): ${String(error?.error?.message ?? 'Coba kembali.').slice(0,180)}`, response.status === 429 ? 429 : 502);
  }
  return response;
}
async function googleJson(token: string, url: string, method = 'GET', body?: unknown) {
  const response = await fetchGoogle(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return response.json();
}
async function accessToken(connection: Connection) {
  const tokens = await unseal(connection.encrypted_tokens, encryptionKey, connection.owner_user_id);
  if (tokens.expires_at > Date.now() + 90000) return tokens.access_token as string;
  const response = await fetchGoogle('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: tokens.refresh_token, grant_type: 'refresh_token' }) });
  const result = await response.json();
  const updated = { access_token: result.access_token, refresh_token: result.refresh_token ?? tokens.refresh_token, expires_at: Date.now() + Number(result.expires_in ?? 3600) * 1000 };
  requireDb((await admin.from('rab_google_connections').update({ encrypted_tokens: await seal(updated, encryptionKey, connection.owner_user_id), updated_at: new Date().toISOString() }).eq('id', connection.id)).error);
  return updated.access_token as string;
}
async function connectionFor(owner: string, id: unknown) {
  if (typeof id !== 'string') throw new RequestError('Pilih akun Google Drive.');
  const result = await admin.from('rab_google_connections').select('*').eq('owner_user_id', owner).eq('id', id).maybeSingle();
  requireDb(result.error);
  if (!result.data) throw new RequestError('Koneksi Google tidak ditemukan.', 404);
  const connection = result.data as Connection;
  if (!['https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/spreadsheets'].every(s => connection.granted_scopes.includes(s))) throw new RequestError('Izin Drive dan Sheets belum lengkap. Hubungkan ulang akun.', 409);
  return connection;
}
function redirect(status: string) { const url = new URL(returnUrl); url.searchParams.set('rab_google', status); return Response.redirect(url.toString(), 302); }
async function callback(req: Request) {
  if (!configured()) return redirect('setup_required');
  const params = new URL(req.url).searchParams;
  const state = params.get('state');
  if (!state) return redirect('expired');
  const used = await admin.from('rab_google_oauth_states').delete().eq('state_hash', await digest(state)).select('*').maybeSingle();
  requireDb(used.error);
  if (!used.data || Date.parse(used.data.expires_at) < Date.now()) return redirect('expired');
  if (params.has('error') || !params.get('code')) return redirect('cancelled');
  const response = await fetchGoogle('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: params.get('code')!, code_verifier: used.data.code_verifier, grant_type: 'authorization_code', redirect_uri: callbackUrl }) });
  const token = await response.json();
  const info = await googleJson(token.access_token, 'https://openidconnect.googleapis.com/v1/userinfo');
  if (!info.sub || !info.email || !info.email_verified) return redirect('error');
  const existing = await admin.from('rab_google_connections').select('*').eq('owner_user_id', used.data.owner_user_id).eq('google_subject', info.sub).maybeSingle();
  requireDb(existing.error);
  const previous = existing.data ? await unseal(existing.data.encrypted_tokens, encryptionKey, used.data.owner_user_id) : null;
  const refresh = token.refresh_token ?? previous?.refresh_token;
  if (!refresh) return redirect('consent_required');
  const saved = await admin.from('rab_google_connections').upsert({ owner_user_id: used.data.owner_user_id, google_subject: info.sub, email: info.email, granted_scopes: String(token.scope ?? '').split(' ').filter(Boolean), encrypted_tokens: await seal({ access_token: token.access_token, refresh_token: refresh, expires_at: Date.now() + Number(token.expires_in ?? 3600) * 1000 }, encryptionKey, used.data.owner_user_id), updated_at: new Date().toISOString() }, { onConflict: 'owner_user_id,google_subject' });
  requireDb(saved.error);
  return redirect('connected');
}

type Write = { range: string; majorDimension: 'ROWS'; values: (string | number)[][] };
function cells(input: Record<string, unknown>) {
  const project = name(input.projectName, 'Nama proyek');
  const client = name(input.clientName, 'Nama client');
  const service = oneOf(input.serviceFamily, ['EO / Event','Program Development','Website / System','Creative / Media','Custom'], 'Layanan');
  const mode = oneOf(input.pricingMode, ['Hybrid','Fixed Package','Open-book'], 'Pricing mode');
  const proposal = name(input.proposalNumber, 'Nomor penawaran', 80);
  const assumptions = record(input.assumptions);
  const numbers: Record<string, [string, number]> = {
    targetMargin: ['E5', 1], managementFeeRate: ['E7', 1], managementFeeFixed: ['E8', 1e12], overhead: ['E9', 1], commission: ['E10', 1], tax: ['E11', 1], vat: ['E12', 1], units: ['B10', 1e7],
  };
  const writes: Write[] = [];
  const put = (sheet: string, address: string, value: string | number) => writes.push({ range: `'${sheet}'!${address}`, majorDimension: 'ROWS', values: [[value]] });
  put('Pricing Control','B5',project); put('Pricing Control','B6',client); put('Pricing Control','B7',service); put('Pricing Control','B8',mode); put('Pricing Control','B9',proposal);
  put('Pricing Control','E6',oneOf(assumptions.managementFeeBasis, ['% of Total Offer','Fixed Amount'], 'Dasar management fee'));
  for (const [key,[cell,max]] of Object.entries(numbers)) put('Pricing Control',cell,amount(assumptions[key],key,max));
  const components = input.components;
  if (!Array.isArray(components) || components.length > 12) throw new RequestError('Maksimal 12 komponen penawaran.');
  const componentFields: Record<string, string> = { title:'B',scope:'C',type:'D',include:'E',method:'F',adjustment:'H',notes:'J' };
  const seenComponents = new Set<number>();
  for (const item of components) {
    const data = record(item); const row = data.row;
    if (!Number.isInteger(row) || (row as number) < 30 || (row as number) > 41 || seenComponents.has(row as number)) throw new RequestError('Baris komponen tidak valid atau duplikat.');
    seenComponents.add(row as number);
    const changes = record(data.changes);
    for (const [key,value] of Object.entries(changes)) {
      const column = componentFields[key]; if (!column) throw new RequestError('Field komponen tidak didukung.');
      const valid = key === 'type' ? oneOf(value,['Core','Optional','Custom'],key) : key === 'include' ? oneOf(value,['YES','NO'],key) : key === 'method' ? oneOf(value,['Package','Hybrid','Pass-through','Fixed / Retainer','Fee'],key) : key === 'adjustment' ? amount(value,key,100) : optional(value,key,key === 'notes' ? 500 : 250);
      put('Pricing Control',`${column}${row}`,valid ?? '');
    }
  }
  const costs = input.costs;
  if (!Array.isArray(costs) || costs.length > 30) throw new RequestError('Maksimal 30 baris HPP.');
  const seen = new Set<number>();
  for (const item of costs) {
    const data = record(item); const row = data.row;
    if (!Number.isInteger(row) || (row as number) < 10 || (row as number) > 39 || seen.has(row as number)) throw new RequestError('Baris HPP tidak valid atau duplikat.');
    seen.add(row as number);
    const component = name(data.component,'Komponen HPP',250); const detail = name(data.detail,'Detail HPP',250);
    put('RAB Internal',`B${row}`,component); put('RAB Internal',`C${row}`,detail);
    if (data.costClass !== undefined && data.costClass !== '') put('RAB Internal',`D${row}`,oneOf(data.costClass,['Vendor','Internal Delivery','Direct Labor','Material','Other'],'Kategori HPP'));
    if (data.unit !== undefined && data.unit !== '') put('RAB Internal',`E${row}`,name(data.unit,'Unit',80));
    put('RAB Internal',`F${row}`,amount(data.qty,'Qty',1e7)); put('RAB Internal',`G${row}`,amount(data.days,'Days',1e7)); put('RAB Internal',`H${row}`,amount(data.rate,'HPP per unit'));
    put('RAB Internal',`J${row}`,oneOf(data.include,['YES','NO'],'Include cost'));
  }
  return { writes, project, client, mode };
}

async function generate(owner: string, connection: Connection, input: Record<string, unknown>) {
  const { writes, project, client, mode } = cells(input);
  const token = await accessToken(connection);
  const title = `RAB - ${project} - ${client}`.slice(0,180);
  const inserted = await admin.from('rab_generations').insert({ owner_user_id: owner, connection_id: connection.id, project_name: project, client_name: client, pricing_mode: mode, template_file_id: templateId }).select('id').single();
  requireDb(inserted.error);
  const jobId = inserted.data.id as string;
  let fileId = '';
  try {
    const copy = await googleJson(token, `https://www.googleapis.com/drive/v3/files/${templateId}/copy?supportsAllDrives=true&fields=id,name,mimeType,webViewLink`, 'POST', { name: title, parents: [folderId] });
    if (!copy.id || copy.id === templateId || copy.mimeType !== 'application/vnd.google-apps.spreadsheet') throw new RequestError('Salinan Google Sheet gagal dibuat.', 502);
    fileId = copy.id;
    requireDb((await admin.from('rab_generations').update({ drive_file_id: fileId, updated_at: new Date().toISOString() }).eq('id', jobId)).error);
    await googleJson(token, `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values:batchUpdate`, 'POST', { valueInputOption: 'RAW', data: writes });
    const verify = await googleJson(token, `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets(properties(title))`);
    const titles = (verify.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title);
    if (JSON.stringify(titles) !== JSON.stringify(['Dashboard','Pricing Control','RAB Internal','Client Proposal','Project P&L','Component Library','Read Me'])) throw new RequestError('Struktur salinan berbeda dari master.', 502);
    requireDb((await admin.from('rab_generations').update({ status: 'ready', updated_at: new Date().toISOString() }).eq('id', jobId)).error);
    return { id: jobId, url: `https://docs.google.com/spreadsheets/d/${fileId}/edit`, title };
  } catch (error) {
    await admin.from('rab_generations').update({ status: 'failed', drive_file_id: fileId || null, error_message: error instanceof Error ? error.message.slice(0,300) : 'Gagal membuat RAB.', updated_at: new Date().toISOString() }).eq('id', jobId);
    throw error;
  }
}

export async function handle(req: Request) {
  const requestOrigin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return reply({}, 200, requestOrigin);
  const path = new URL(req.url).pathname.split('/rab-generator')[1] || '/';
  try {
    if (path === '/callback' && req.method === 'GET') return await callback(req);
    if (req.method !== 'POST') return reply({ message: 'Metode tidak didukung.' }, 405, requestOrigin);
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return reply({ message: 'Masuk ke Ruang Kawan terlebih dahulu.' }, 401, requestOrigin);
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const user = await caller.auth.getUser();
    if (user.error || !user.data.user) return reply({ message: 'Sesi tidak valid.' }, 401, requestOrigin);
    const access = await caller.rpc('get_my_access');
    const permissions = (Array.isArray(access.data) ? access.data[0] : access.data)?.permissions ?? [];
    if (access.error || (Array.isArray(access.data) ? access.data[0] : access.data)?.membership_status !== 'active' || !permissions.includes('marketing.rab.manage')) return reply({ message: 'Izin RAB Generator diperlukan.' }, 403, requestOrigin);
    const owner = user.data.user.id;
    const input = record(await req.json().catch(() => null));
    if (input.action === 'status') {
      const [connections, history] = await Promise.all([
        admin.from('rab_google_connections').select('id,email,granted_scopes,updated_at').eq('owner_user_id', owner).order('updated_at',{ascending:false}),
        admin.from('rab_generations').select('id,project_name,client_name,pricing_mode,connection_id,drive_file_id,status,error_message,created_at').eq('owner_user_id', owner).order('created_at',{ascending:false}).limit(40),
      ]);
      requireDb(connections.error); requireDb(history.error);
      return reply({ configured: configured(), accounts: connections.data, history: history.data }, 200, requestOrigin);
    }
    if (!configured()) throw new RequestError('Integrasi RAB belum dikonfigurasi. Isi secrets Google dan ID folder output di Supabase.', 503);
    if (input.action === 'authorize') {
      const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
      requireDb((await admin.from('rab_google_oauth_states').delete().lt('expires_at',new Date().toISOString())).error);
      requireDb((await admin.from('rab_google_oauth_states').insert({ state_hash: await digest(state), owner_user_id: owner, code_verifier: verifier, expires_at: new Date(Date.now()+600000).toISOString() })).error);
      const params = new URLSearchParams({ client_id: clientId, redirect_uri: callbackUrl, response_type: 'code', scope, state, access_type: 'offline', prompt: 'consent select_account', code_challenge: await digest(verifier), code_challenge_method: 'S256' });
      return reply({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }, 200, requestOrigin);
    }
    const connection = await connectionFor(owner,input.connectionId);
    if (input.action === 'template') {
      const token = await accessToken(connection);
      const parameters = new URLSearchParams();
      for (const range of ["'Pricing Control'!B7:B10","'Pricing Control'!E5:E12","'Component Library'!A5:G23"]) parameters.append('ranges',range);
      parameters.set('valueRenderOption','UNFORMATTED_VALUE');
      const data = await googleJson(token, `https://sheets.googleapis.com/v4/spreadsheets/${templateId}/values:batchGet?${parameters}`);
      return reply({ serviceFamily: data.valueRanges?.[0]?.values?.[0]?.[0] ?? 'EO / Event', pricingMode: data.valueRanges?.[0]?.values?.[1]?.[0] ?? 'Open-book', proposalNumber: data.valueRanges?.[0]?.values?.[2]?.[0] ?? 'OFF-000', units: data.valueRanges?.[0]?.values?.[3]?.[0] ?? 0, assumptions: data.valueRanges?.[1]?.values ?? [], library: data.valueRanges?.[2]?.values ?? [] }, 200, requestOrigin);
    }
    if (input.action === 'generate') return reply(await generate(owner, connection, record(input.payload)), 200, requestOrigin);
    if (input.action === 'export') {
      const job = await admin.from('rab_generations').select('drive_file_id,project_name,status,connection_id').eq('id',String(input.jobId ?? '')).eq('owner_user_id',owner).maybeSingle();
      requireDb(job.error);
      if (!job.data || job.data.status !== 'ready' || job.data.connection_id !== connection.id || !job.data.drive_file_id) throw new RequestError('RAB siap unduh tidak ditemukan.', 404);
      const token = await accessToken(connection);
      const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const response = await fetchGoogle(`https://www.googleapis.com/drive/v3/files/${job.data.drive_file_id}/export?mimeType=${encodeURIComponent(mime)}`, { headers: { Authorization: `Bearer ${token}` } });
      const safeName = String(job.data.project_name).replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,80) || 'Project';
      return new Response(response.body, { status: 200, headers: { ...cors(requestOrigin), 'Content-Type': mime, 'Content-Disposition': `attachment; filename="RAB - ${safeName}.xlsx"` } });
    }
    throw new RequestError('Aksi tidak dikenal.');
  } catch (error) {
    return reply({ message: error instanceof Error ? error.message : 'RAB gagal diproses.' }, error instanceof RequestError ? error.status : 500, requestOrigin);
  }
}

Deno.serve(handle);
