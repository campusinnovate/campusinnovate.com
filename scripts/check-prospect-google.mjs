import assert from 'node:assert/strict';

const origin = 'https://campusinnovate.com';
for (const name of ['prospect-google', 'prospect-harvest']) {
  const endpoint = `https://lxwqhtuhlddgwfxjtlas.supabase.co/functions/v1/${name}`;
  const headers = ['authorization', 'apikey', 'content-type', 'x-client-info'];
  const result = await fetch(endpoint, { method: 'OPTIONS', headers: { Origin: origin,
    'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': headers.join(', '),
  }, signal: AbortSignal.timeout(15000) });
  const body = await result.text();
  assert.ok(result.ok, `${name}: OPTIONS HTTP ${result.status}. ${body}`);
  assert.ok([origin, '*'].includes(result.headers.get('access-control-allow-origin')), `${name}: origin tidak diizinkan`);
  const allowed = (result.headers.get('access-control-allow-headers') ?? '').toLowerCase().split(',').map(v => v.trim());
  for (const header of headers) assert.ok(allowed.includes(header), `${name}: header ${header} tidak diizinkan`);
  const unauthenticated = await fetch(endpoint, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000) });
  assert.equal(unauthenticated.status, 401, `${name}: request tanpa sesi harus ditolak`);
  assert.ok([origin, '*'].includes(unauthenticated.headers.get('access-control-allow-origin')), `${name}: respons tanpa sesi harus memiliki CORS`);
  assert.equal((await unauthenticated.json()).message, name === 'prospect-google' ? 'Silakan masuk ke Ruang Kawan.' : 'Sesi Ruang Kawan diperlukan.', `${name}: respons harus berasal dari handler`);
  console.log(`${name}: preflight dan autentikasi berhasil diverifikasi.`);
}
