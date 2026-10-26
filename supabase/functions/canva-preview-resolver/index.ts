import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appOrigin = Deno.env.get('APP_ORIGIN') ?? 'https://campusinnovate.com';

function response(value: unknown, status: number, origin: string | null) {
  const allowedOrigin = origin === appOrigin || /^http:\/\/localhost:\d+$/.test(origin ?? '') ? origin! : appOrigin;
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
      Vary: 'Origin',
    },
  });
}

async function resolveCanvaDesign(shortUrl: string): Promise<string | null> {
  let current: URL;
  try { current = new URL(shortUrl); } catch { return null; }
  if (current.protocol !== 'https:' || current.hostname.toLowerCase() !== 'canva.link') return null;

  for (let hop = 0; hop < 5; hop += 1) {
    const host = current.hostname.toLowerCase();
    if (host === 'canva.com' || host === 'www.canva.com') {
      return current.pathname.startsWith('/design/') ? `${current.origin}${current.pathname}` : null;
    }
    if (host !== 'canva.link') return null;

    let upstream: Response;
    try {
      upstream = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CampusInnovateCanvaPreview/1.0)' },
        signal: AbortSignal.timeout(6000),
      });
    } catch { return null; }
    await upstream.body?.cancel();
    if (![301, 302, 303, 307, 308].includes(upstream.status)) return null;
    const location = upstream.headers.get('location');
    if (!location) return null;
    try { current = new URL(location, current); } catch { return null; }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return response({}, 204, origin);
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405, origin);
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return response({ error: 'Unauthorized' }, 401, origin);

  const caller = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return response({ error: 'Unauthorized' }, 401, origin);

  // This authenticated RPC both checks marketing.proposal.view and returns only captured Canva links.
  const { data: rows, error: libraryError } = await caller.rpc('marketing_canva_library');
  if (libraryError) return response({ error: 'Marketing access required' }, 403, origin);

  const unresolved = (rows ?? []).filter((row: { id: string; url: string; preview_url: string | null }) =>
    row.url.startsWith('https://canva.link/') && !row.preview_url
  ).slice(0, 25);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const outcomes = await Promise.all(unresolved.map(async (row: { id: string; url: string }) => {
    const previewUrl = await resolveCanvaDesign(row.url);
    if (!previewUrl) return false;
    const { error } = await admin.from('chat_canva_links').update({ preview_url: previewUrl }).eq('id', row.id).is('preview_url', null);
    return !error;
  }));

  return response({ resolved: outcomes.filter(Boolean).length, checked: unresolved.length }, 200, origin);
});
