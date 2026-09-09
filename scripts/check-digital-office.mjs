import assert from 'node:assert/strict';

const endpoint = 'https://lxwqhtuhlddgwfxjtlas.supabase.co/functions/v1/digital-office/finalize';
const origin = 'https://campusinnovate.com';
const headers = ['authorization', 'apikey', 'content-type', 'x-client-info'];
const preflight = await fetch(endpoint, {
  method: 'OPTIONS',
  headers: {
    Origin: origin,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': headers.join(', '),
  },
  signal: AbortSignal.timeout(15000),
});
assert.ok(preflight.ok, `Preflight HTTP ${preflight.status}: ${await preflight.text()}`);
assert.ok(['*', origin].includes(preflight.headers.get('access-control-allow-origin')), 'Origin website tidak diizinkan');
const allowedHeaders = (preflight.headers.get('access-control-allow-headers') ?? '').toLowerCase().split(',').map(value => value.trim());
for (const header of headers) assert.ok(allowedHeaders.includes(header), `Header ${header} tidak diizinkan`);
assert.ok((preflight.headers.get('access-control-allow-methods') ?? '').split(',').map(value => value.trim()).includes('POST'), 'POST tidak diizinkan');

// No credentials or document ID: verify authentication without modifying data.
const unauthorized = await fetch(endpoint, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: '{}',
  signal: AbortSignal.timeout(15000),
});
assert.equal(unauthorized.status, 401, 'Permintaan tanpa sesi harus ditolak');
assert.ok(['*', origin].includes(unauthorized.headers.get('access-control-allow-origin')), 'Respons autentikasi harus memiliki header CORS');
assert.equal((await unauthorized.json()).error, 'Silakan masuk kembali.', 'Respons harus berasal dari handler Digital Office');
console.log('Digital Office: preflight CORS dan autentikasi berhasil diverifikasi.');
