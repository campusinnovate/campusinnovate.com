const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
function load(file) {
  const context = { exports: {}, URL, crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, Uint8Array };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports;
}
const { sheetCandidates, guessSheetMapping, scopesFor, grantedServices, isGoogleService, safeWebUrl, reportDates } = load('src/lib/prospects/google.ts');
const { seal, unseal } = load('supabase/functions/prospect-google/security.ts');

test('only granted Google services are usable; prototype keys cannot request scopes', () => {
  assert.equal(isGoogleService('__proto__'), false);
  assert.equal(isGoogleService('constructor'), false);
  assert.equal(isGoogleService('sheets'), true);
  const scopes = scopesFor(['sheets', 'search_console']);
  assert.deepEqual(Array.from(grantedServices(scopes)), ['sheets', 'search_console']);
  assert.equal(grantedServices(['https://www.googleapis.com/auth/spreadsheets.readonly']).length, 0);
  assert.ok(scopes.every(s => s === 'openid' || s.includes('readonly') || s.endsWith('userinfo.email')));
});
test('sheet mapping supports Indonesian headers and identities survive row reordering', () => {
  const headers = ['Nama Perusahaan', 'Kota', 'Email', 'Website'];
  const mapping = guessSheetMapping(headers);
  assert.equal(mapping.account_name, 0);
  const a = ['Sekolah A', 'Bogor', 'a@example.test', 'example.test'];
  const b = ['Sekolah B', 'Jakarta', '', ''];
  const first = sheetCandidates([headers, a, b], mapping, 'file1234567', 0, [2,3]);
  const sorted = sheetCandidates([headers, b, a], mapping, 'file1234567', 0, [2,3]);
  assert.equal(first[0].external_id, sorted[1].external_id);
  assert.equal(first[0].website, 'https://example.test/');
  assert.equal(first[0].intent_score, 0);
  assert.ok(first[0].signal_url.endsWith('range=A2'));
  assert.equal(Object.hasOwn(first[0].raw_data, 'email'), false);
});
test('sheet imports reject missing identities, invalid mappings, invalid URLs and invalid row selections', () => {
  const values = [['Company', 'Website'], ['A', 'https://example.test']];
  assert.throws(() => sheetCandidates(values, {}, 'file1234567', 0, [2]), /nama account/);
  for (const selected of [[], [1], [3], [2,2], [2.5]]) assert.throws(() => sheetCandidates(values, { account_name: 0 }, 'file1234567', 0, selected));
  assert.throws(() => sheetCandidates(values, { account_name: 0, website: -1 }, 'file1234567', 0, [2]), /Pemetaan/);
  assert.throws(() => sheetCandidates([values[0], ['', '']], { account_name: 0 }, 'file1234567', 0, [2]), /kosong/);
  assert.throws(() => sheetCandidates([values[0], ['A', 'javascript://alert(1)']], { account_name: 0, website: 1 }, 'file1234567', 0, [2]), /Website/);
  assert.equal(safeWebUrl('https://user:secret@example.test'), '');
});
test('report date range rejects invalid calendar days and unbounded reads', () => {
  assert.equal(reportDates('2026-09-01', '2026-09-10').endDate, '2026-09-10');
  for (const dates of [['2026-02-30','2026-03-10'], ['2026-09-10','2026-09-01'], ['2024-01-01','2026-09-10'], ['wrong','2026-09-10']]) assert.throws(() => reportDates(...dates));
});
test('Google token encryption detects tampering and binds secrets to their owner', async () => {
  const key = 'ab'.repeat(32), token = { access_token: 'secret-access', refresh_token: 'secret-refresh' };
  const ciphertext = await seal(token, key, 'owner-a');
  assert.ok(!ciphertext.includes('secret'));
  assert.equal((await unseal(ciphertext, key, 'owner-a')).refresh_token, token.refresh_token);
  await assert.rejects(unseal(ciphertext, key, 'owner-b'));
  await assert.rejects(unseal(ciphertext, 'cd'.repeat(32), 'owner-a'));
  const [iv, data] = ciphertext.split('.');
  await assert.rejects(unseal(`${iv}.${data[0] === 'a' ? 'b' : 'a'}${data.slice(1)}`, key, 'owner-a'));
});
test('Google secrets are inaccessible to users; batch imports require permission and roll back on failure', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema extensions;
      create table auth.users(id uuid primary key);
      create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;
      create function public.current_membership_id() returns uuid language sql as $$select '00000000-0000-4000-8000-000000000001'::uuid$$;
      create function public.current_user_has_permission(text) returns boolean language sql as $$select current_setting('test.allowed',true) = 'yes'$$;
      create table public.imported(id uuid default gen_random_uuid(), name text check(name <> 'FAIL'));
      create function public.ingest_prospect_candidate(payload jsonb) returns uuid language plpgsql as $$declare result uuid; begin insert into public.imported(name) values(payload->>'account_name') returning id into result; return result; end;$$;
      grant usage on schema public to authenticated,anon,service_role;
    `);
    await db.exec(fs.readFileSync('supabase/migrations/20260910140000_prospect_google_connections.sql','utf8'));
    await db.exec('set role authenticated');
    for (const table of ['prospect_google_connections','prospect_google_oauth_states']) {
      await assert.rejects(db.query(`select * from ${table}`), /permission denied/);
      await assert.rejects(db.query(`delete from ${table}`), /permission denied/);
    }
    const candidate = name => ({ provider: 'Google Sheets', account_name: name });
    await db.exec("set test.allowed='no'");
    await assert.rejects(db.query('select import_google_prospect_candidates($1)', [[candidate('A')]]), /Izin/);
    await db.exec("set test.allowed='yes'");
    await assert.rejects(db.query('select import_google_prospect_candidates($1)', [[candidate('A'), candidate('FAIL')]]), /check constraint/);
    await db.exec('reset role');
    assert.equal((await db.query('select * from imported')).rows.length, 0);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select import_google_prospect_candidates($1)', [[{ ...candidate('A'), provider: 'Manual' }]]), /Google Sheets/);
    const saved = await db.query('select import_google_prospect_candidates($1) result', [[candidate('A'), candidate('B')]]);
    assert.equal(saved.rows[0].result.processed, 2);
    await db.exec('reset role; set role service_role');
    assert.equal((await db.query('select * from prospect_google_connections')).rows.length, 0);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select import_google_prospect_candidates($1)', [[candidate('C')]]), /permission denied/);
  } finally { await db.close(); }
});
