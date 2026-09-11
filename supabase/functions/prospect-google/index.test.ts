import { assertEquals, assert } from 'jsr:@std/assert@1';

Deno.env.set('SUPABASE_URL', 'https://test.supabase.co');
Deno.env.set('SUPABASE_ANON_KEY', 'anon-test');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-test');
Deno.env.set('GOOGLE_PROSPECT_CLIENT_ID', 'client-test');
Deno.env.set('GOOGLE_PROSPECT_CLIENT_SECRET', 'secret-test');
Deno.env.set('GOOGLE_PROSPECT_ENCRYPTION_KEY', 'ab'.repeat(32));
const { handle } = await import('./index.ts');
const owner = '00000000-0000-4000-8000-000000000001';
const endpoint = 'https://test.supabase.co/functions/v1/prospect-google';
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }); }
function request(body: unknown) { return new Request(endpoint, { method: 'POST', headers: { Authorization: 'Bearer user-test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
async function mocked(action: () => Promise<void>, route: (url: URL, init?: RequestInit) => Response | Promise<Response>, permissions = ['pipeline.manage_self']) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/user') return json({ id: owner, aud: 'authenticated', role: 'authenticated' });
    if (url.pathname === '/rest/v1/rpc/get_my_access') return json({ permissions });
    return route(url, init);
  };
  try { await action(); } finally { globalThis.fetch = original; }
}
Deno.test('preflight succeeds without credentials; data requests require login', async () => {
  const preflight = await handle(new Request(endpoint, { method: 'OPTIONS', headers: { Origin: 'https://campusinnovate.com' } }));
  assertEquals(preflight.status, 200);
  assertEquals(preflight.headers.get('access-control-allow-origin'), 'https://campusinnovate.com');
  const denied = await handle(new Request(endpoint, { method: 'POST' }));
  assertEquals(denied.status, 401);
});
Deno.test('pipeline permission is required before service-role database access', async () => {
  await mocked(async () => { assertEquals((await handle(request({ action: 'status' }))).status, 403); }, () => { throw new Error('Unexpected database read'); }, []);
});
Deno.test('account status only selects non-secret fields for the current owner', async () => {
  await mocked(async () => {
    const result = await handle(request({ action: 'status' }));
    assertEquals(result.status, 200);
    const body = await result.json();
    assertEquals(body.accounts[0].email, 'team@example.test');
    assertEquals(body.accounts[0].encrypted_tokens, undefined);
  }, url => {
    assertEquals(url.searchParams.get('owner_user_id'), `eq.${owner}`);
    assertEquals(url.searchParams.get('select'), 'id,email,granted_scopes,updated_at');
    return json([{ id: 'connection', email: 'team@example.test', granted_scopes: [], updated_at: '2026-09-10' }]);
  });
});
Deno.test('another user connection cannot be used to fetch Google data', async () => {
  await mocked(async () => {
    const result = await handle(request({ action: 'resources', connectionId: 'other-connection', service: 'sheets' }));
    assertEquals(result.status, 404);
  }, url => {
    assertEquals(url.hostname, 'test.supabase.co');
    assertEquals(url.searchParams.get('owner_user_id'), `eq.${owner}`);
    return json(null);
  });
});
Deno.test('declining consent consumes state atomically without exchanging a token', async () => {
  let deleted = false;
  await mocked(async () => {
    const result = await handle(new Request(`${endpoint}/callback?state=opaque-state&error=access_denied`));
    assertEquals(result.status, 302);
    assert(result.headers.get('location')?.endsWith('google=cancelled'));
    assert(deleted);
  }, (url, init) => {
    assertEquals(url.pathname, '/rest/v1/prospect_google_oauth_states');
    assertEquals(init?.method, 'DELETE');
    assert(url.searchParams.get('state_hash') !== 'eq.opaque-state');
    deleted = true;
    return json({ owner_user_id: owner, expires_at: new Date(Date.now()+60000).toISOString() });
  });
});
Deno.test('expired or replayed OAuth state cannot exchange a code', async () => {
  await mocked(async () => {
    const result = await handle(new Request(`${endpoint}/callback?state=replayed&code=code`));
    assert(result.headers.get('location')?.endsWith('google=expired'));
  }, (url, init) => {
    assertEquals(url.pathname, '/rest/v1/prospect_google_oauth_states');
    assertEquals(init?.method, 'DELETE');
    return json(null);
  });
});
