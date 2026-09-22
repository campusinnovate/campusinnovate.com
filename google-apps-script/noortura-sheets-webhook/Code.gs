const NOORTURA_SPREADSHEET_ID = '18BmluvyFClHJwjAuJRocDcj-Wdkeumd9gSBcx-nd74M';
const GUEST_SHEET = 'Guest List';
const PUBLIC_SHEET = 'RSVP Publik';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const expectedSecret = PropertiesService.getScriptProperties().getProperty('NOORTURA_SHEETS_SECRET');
    if (!expectedSecret || body.secret !== expectedSecret) return jsonResponse_({ ok: false, error: 'Unauthorized' });
    const registration = body.registration || {};
    if (!registration.id) throw new Error('ID RSVP tidak tersedia.');
    const spreadsheet = SpreadsheetApp.openById(NOORTURA_SPREADSHEET_ID);
    const result = registration.invited_guest_id ? updateGuestRow_(spreadsheet, registration) : upsertPublicRow_(spreadsheet, registration);
    return jsonResponse_({ ok: true, mode: result.mode, row: result.row });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok: false, error: String(error && error.message || error) });
  } finally {
    lock.releaseLock();
  }
}

function updateGuestRow_(spreadsheet, registration) {
  const sheet = spreadsheet.getSheetByName(GUEST_SHEET);
  if (!sheet) throw new Error('Tab Guest List tidak ditemukan.');
  const match = sheet.getRange('A5:A').createTextFinder(String(registration.invited_guest_id)).matchEntireCell(true).findNext();
  if (!match) throw new Error('ID tamu tidak ditemukan di Guest List.');
  const row = match.getRow();
  const status = registration.status === 'tentative' ? 'Tentatif' : 'Hadir';
  sheet.getRange(row, 5, 1, 4).setValues([[registration.whatsapp, registration.email, registration.adult_count, registration.child_count]]);
  sheet.getRange(row, 10, 1, 4).setValues([[status, registration.arrival_slot, registration.parent_name, new Date(registration.created_at)]]);
  return { mode: 'personal', row };
}

function upsertPublicRow_(spreadsheet, registration) {
  const sheet = spreadsheet.getSheetByName(PUBLIC_SHEET);
  if (!sheet) throw new Error('Tab RSVP Publik tidak ditemukan.');
  const existing = sheet.getRange('B5:B').createTextFinder(String(registration.id)).matchEntireCell(true).findNext();
  const row = existing ? existing.getRow() : Math.max(sheet.getLastRow() + 1, 5);
  const children = (registration.children || []).map(child => `${child.name} (${child.age} tahun)`).join(', ');
  const status = registration.status === 'tentative' ? 'Tentatif' : 'Hadir';
  sheet.getRange(row, 1, 1, 15).setValues([[
    new Date(registration.created_at), registration.id, registration.parent_name,
    registration.whatsapp, registration.email, registration.adult_count,
    registration.child_count, children, registration.arrival_slot,
    `${registration.attendance_confidence}%`, status,
    registration.documentation_consent ? 'Ya' : 'Tidak',
    registration.privacy_consent ? 'Ya' : 'Tidak', registration.source, '',
  ]]);
  return { mode: 'public', row };
}

function jsonResponse_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
