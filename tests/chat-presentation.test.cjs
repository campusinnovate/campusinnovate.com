const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const compiled = ts.transpileModule(fs.readFileSync('src/lib/chat/presentation.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = { exports: {}, URL };
vm.runInNewContext(compiled, context);
const { linkParts, dayKey, dayLabel, meetingActive, driveFileId, safeUrl } = context.exports;

test('links retain text, query strings and balanced parentheses, exclude trailing punctuation', () => {
  const body = 'Cek https://example.com/a_(b)?x=1&y=2 dan (www.example.org/path).';
  const parts = linkParts(body);
  assert.equal(parts.map(p => p.text).join(''), body);
  assert.equal(parts.filter(p => p.href)[0].href, 'https://example.com/a_(b)?x=1&y=2');
  assert.equal(parts.filter(p => p.href)[1].href, 'https://www.example.org/path');
  assert.equal(linkParts('javascript:alert(1) <script>x</script>').some(p => p.href), false);
  assert.equal(safeUrl('data:text/html,test'), null);
});

test('day separators switch at midnight WIB, including year boundary', () => {
  assert.notEqual(dayKey('2026-12-31T16:59:59Z'), dayKey('2026-12-31T17:00:00Z'));
  const now = Date.parse('2026-12-31T17:01:00Z');
  assert.equal(dayLabel('2026-12-31T17:00:00Z', now), 'Hari ini');
  assert.equal(dayLabel('2026-12-31T16:59:59Z', now), 'Kemarin');
});

test('meeting resets exactly at scheduled end and ignores cancelled/completed events', () => {
  const now = Date.parse('2026-09-08T17:00:00Z');
  assert.equal(meetingActive({ status: 'scheduled', ends_at: '2026-09-08T17:00:00Z' }, now), false);
  assert.equal(meetingActive({ status: 'scheduled', ends_at: '2026-09-09T17:00:00Z' }, now), true);
  for (const status of ['cancelled', 'completed']) assert.equal(meetingActive({ status, ends_at: '2026-09-09T17:00:00Z' }, now), false);
  assert.equal(meetingActive({ status: 'scheduled', ends_at: 'invalid' }, now), false);
});

test('Drive previews only recognize trusted Drive hosts and valid file IDs', () => {
  assert.equal(driveFileId('https://drive.google.com/file/d/abc_123/view'), 'abc_123');
  assert.equal(driveFileId('https://drive.google.com/open?id=abc-123'), 'abc-123');
  assert.equal(driveFileId('https://docs.google.com/document/d/abc/edit'), 'abc');
  assert.equal(driveFileId('https://drive.google.com.evil.test/file/d/abc/view'), null);
});
