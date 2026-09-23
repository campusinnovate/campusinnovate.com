const NOORTURA_SPREADSHEET_ID = '18BmluvyFClHJwjAuJRocDcj-Wdkeumd9gSBcx-nd74M';
const GUEST_SHEET = 'Guest List';
const PUBLIC_SHEET = 'RSVP Publik';
const MAX_PER_SLOT = 8;
const ARRIVAL_SLOTS = [
  '08.00', '08.20', '08.40', '09.00', '09.20', '09.40',
  '10.00', '10.20', '10.40', '11.00', '11.20', '11.40',
  '13.00', '13.20', '13.40', '14.00', '14.20', '14.40',
];

function doGet(e) {
  const callback = String(e && e.parameter && e.parameter.callback || '');
  if (!/^[A-Za-z_$][0-9A-Za-z_$]{0,80}$/.test(callback)) {
    return ContentService.createTextOutput('Invalid callback');
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(NOORTURA_SPREADSHEET_ID);
    return javascriptResponse_(callback, {
      ok: true,
      fullSlots: getFullSlots_(spreadsheet),
    });
  } catch (error) {
    console.error(error);
    return javascriptResponse_(callback, { ok: false, error: 'Ketersediaan slot belum dapat dimuat.' });
  }
}

function doPost(e) {
  let requestId = '';
  let responseMode = 'html';
  const lock = LockService.getScriptLock();

  function respond(body) {
    return responseMode === 'json' ? jsonResponse_(body) : htmlResponse_(body);
  }

  try {
    const raw = e && e.parameter && e.parameter.payload
      ? e.parameter.payload
      : (e && e.postData && e.postData.contents || '{}');
    const input = JSON.parse(raw);
    requestId = String(input.requestId || '').slice(0, 100);
    responseMode = String(input.responseMode || '').toLowerCase() === 'json' ? 'json' : 'html';

    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,99}$/.test(requestId)) {
      fail_('VALIDATION_ERROR', 'Request ID RSVP belum valid.');
    }

    if (input.website) return respond({ ok: true, requestId: requestId, filtered: true });

    const registration = normalizeRegistration_(input);
    validateRegistration_(registration);
    lock.waitLock(20000);

    const spreadsheet = SpreadsheetApp.openById(NOORTURA_SPREADSHEET_ID);
    ensureRequestColumns_(spreadsheet);
    const previous = findRequest_(spreadsheet, requestId);
    if (previous) {
      return respond({
        ok: true,
        requestId: requestId,
        mode: previous.mode,
        row: previous.row,
        replayed: true,
      });
    }

    const result = registration.invitedGuestId
      ? registerGuest_(spreadsheet, registration, requestId)
      : registerPublic_(spreadsheet, registration, requestId);

    return respond({
      ok: true,
      requestId: requestId,
      mode: result.mode,
      row: result.row,
      replayed: false,
    });
  } catch (error) {
    console.error(error);
    return respond({
      ok: false,
      requestId: requestId,
      code: error && error.code || 'RSVP_ERROR',
      error: String(error && error.message || 'RSVP belum dapat disimpan.'),
    });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function normalizeRegistration_(input) {
  const children = Array.isArray(input.children) ? input.children : [];
  return {
    invitedGuestId: String(input.invitedGuestId || '').trim().toUpperCase().slice(0, 32),
    invitedGuestName: String(input.invitedGuestName || '').trim().slice(0, 120),
    parentName: String(input.parentName || '').trim().slice(0, 120),
    whatsapp: String(input.whatsapp || '').trim().slice(0, 40),
    email: String(input.email || '').trim().toLowerCase().slice(0, 160),
    adultCount: Number(input.adultCount),
    childCount: Number(input.childCount),
    children: children.slice(0, 3).map(function (child) {
      return {
        name: String(child && child.name || '').trim().slice(0, 120),
        age: Number(child && child.age),
      };
    }),
    slot: String(input.slot || '').trim(),
    certainty: Number(input.certainty),
    documentation: input.documentation === true,
    privacy: input.privacy === true,
  };
}

function validateRegistration_(registration) {
  if (!registration.parentName) fail_('VALIDATION_ERROR', 'Nama orang tua atau pendamping wajib diisi.');
  if (registration.whatsapp.replace(/\D/g, '').length < 8) fail_('VALIDATION_ERROR', 'Nomor WhatsApp belum valid.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registration.email)) fail_('VALIDATION_ERROR', 'Alamat email belum valid.');
  if ([1, 2, 3, 4].indexOf(registration.adultCount) === -1) fail_('VALIDATION_ERROR', 'Jumlah pendamping belum valid.');
  if ([0, 1, 2, 3].indexOf(registration.childCount) === -1) fail_('VALIDATION_ERROR', 'Jumlah anak belum valid.');
  if (registration.children.length !== registration.childCount) fail_('VALIDATION_ERROR', 'Data anak belum lengkap.');
  registration.children.forEach(function (child) {
    if (!child.name || !isFinite(child.age) || child.age < 0 || child.age > 18) {
      fail_('VALIDATION_ERROR', 'Nama dan usia anak belum lengkap.');
    }
  });
  if (ARRIVAL_SLOTS.indexOf(registration.slot) === -1) fail_('VALIDATION_ERROR', 'Pilihan waktu kedatangan belum valid.');
  if (!isFinite(registration.certainty) || registration.certainty < 0 || registration.certainty > 100) fail_('VALIDATION_ERROR', 'Kepastian hadir belum valid.');
  if (!registration.documentation || !registration.privacy) fail_('VALIDATION_ERROR', 'Persetujuan RSVP wajib dicentang.');
}

function registerGuest_(spreadsheet, registration, requestId) {
  const sheet = spreadsheet.getSheetByName(GUEST_SHEET);
  if (!sheet) fail_('CONFIG_ERROR', 'Tab Guest List tidak ditemukan.');

  const match = sheet.getRange('A5:A').createTextFinder(registration.invitedGuestId).matchEntireCell(true).findNext();
  if (!match) fail_('GUEST_NOT_FOUND', 'ID tamu tidak ditemukan di Guest List.');

  const row = match.getRow();
  assertNoDuplicate_(spreadsheet, registration, row);
  assertSlotAvailable_(spreadsheet, registration.slot, row);

  const status = registration.certainty === 100 ? 'Hadir' : 'Tentatif';
  const childNames = registration.children.map(function (child) { return child.name; }).join(', ');
  sheet.getRange(row, 5, 1, 4).setValues([[
    safeCell_(registration.whatsapp),
    safeCell_(registration.email),
    registration.adultCount,
    registration.childCount,
  ]]);
  sheet.getRange(row, 10, 1, 4).setValues([[
    status,
    textCell_(registration.slot),
    safeCell_(childNames),
    new Date(),
  ]]);
  sheet.getRange(row, 15).setValue(requestId);

  return { mode: 'personal', row: row };
}

function registerPublic_(spreadsheet, registration, requestId) {
  const sheet = spreadsheet.getSheetByName(PUBLIC_SHEET);
  if (!sheet) fail_('CONFIG_ERROR', 'Tab RSVP Publik tidak ditemukan.');

  assertNoDuplicate_(spreadsheet, registration, null);
  assertSlotAvailable_(spreadsheet, registration.slot, null);

  const row = Math.max(sheet.getLastRow() + 1, 5);
  const id = 'RSVP-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(1000 + Math.random() * 9000);
  const childDetails = registration.children.map(function (child) {
    return child.name + ' (' + child.age + ' tahun)';
  }).join(', ');
  const status = registration.certainty === 100 ? 'Hadir' : 'Tentatif';

  sheet.getRange(row, 1, 1, 16).setValues([[
    new Date(),
    id,
    safeCell_(registration.parentName),
    safeCell_(registration.whatsapp),
    safeCell_(registration.email),
    registration.adultCount,
    registration.childCount,
    safeCell_(childDetails),
    textCell_(registration.slot),
    registration.certainty + '%',
    status,
    registration.documentation ? 'Ya' : 'Tidak',
    registration.privacy ? 'Ya' : 'Tidak',
    'Website publik',
    '',
    requestId,
  ]]);

  return { mode: 'public', row: row };
}

function ensureRequestColumns_(spreadsheet) {
  const guestSheet = spreadsheet.getSheetByName(GUEST_SHEET);
  const publicSheet = spreadsheet.getSheetByName(PUBLIC_SHEET);

  if (guestSheet && !guestSheet.getRange(4, 15).getDisplayValue()) {
    guestSheet.getRange(4, 14).copyTo(guestSheet.getRange(4, 15), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    guestSheet.getRange(4, 15).setValue('Request ID');
    guestSheet.hideColumns(15);
  }

  if (publicSheet && !publicSheet.getRange(4, 16).getDisplayValue()) {
    publicSheet.getRange(4, 15).copyTo(publicSheet.getRange(4, 16), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    publicSheet.getRange(4, 16).setValue('Request ID');
    publicSheet.hideColumns(16);
  }
}

function findRequest_(spreadsheet, requestId) {
  const guestSheet = spreadsheet.getSheetByName(GUEST_SHEET);
  const publicSheet = spreadsheet.getSheetByName(PUBLIC_SHEET);
  const guestMatch = findRequestInSheet_(guestSheet, 15, requestId);
  if (guestMatch) return { mode: 'personal', row: guestMatch.getRow() };

  const publicMatch = findRequestInSheet_(publicSheet, 16, requestId);
  if (publicMatch) return { mode: 'public', row: publicMatch.getRow() };
  return null;
}

function findRequestInSheet_(sheet, column, requestId) {
  if (!sheet || sheet.getLastRow() < 5) return null;
  return sheet
    .getRange(5, column, sheet.getLastRow() - 4, 1)
    .createTextFinder(requestId)
    .matchEntireCell(true)
    .findNext();
}

function assertNoDuplicate_(spreadsheet, registration, excludedGuestRow) {
  const phone = normalizePhone_(registration.whatsapp);
  const email = registration.email.toLowerCase();
  const guestSheet = spreadsheet.getSheetByName(GUEST_SHEET);
  const publicSheet = spreadsheet.getSheetByName(PUBLIC_SHEET);

  if (guestSheet && guestSheet.getLastRow() >= 5) {
    const rows = guestSheet.getRange(5, 5, guestSheet.getLastRow() - 4, 2).getDisplayValues();
    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 5;
      if (rowNumber === excludedGuestRow) continue;
      if ((phone && normalizePhone_(rows[index][0]) === phone) || (email && String(rows[index][1]).toLowerCase() === email)) {
        fail_('DUPLICATE_RSVP', 'WhatsApp atau email ini sudah terdaftar.');
      }
    }
  }

  if (publicSheet && publicSheet.getLastRow() >= 5) {
    const rows = publicSheet.getRange(5, 4, publicSheet.getLastRow() - 4, 2).getDisplayValues();
    for (let index = 0; index < rows.length; index += 1) {
      if ((phone && normalizePhone_(rows[index][0]) === phone) || (email && String(rows[index][1]).toLowerCase() === email)) {
        fail_('DUPLICATE_RSVP', 'WhatsApp atau email ini sudah terdaftar.');
      }
    }
  }
}

function assertSlotAvailable_(spreadsheet, slot, excludedGuestRow) {
  const counts = getSlotCounts_(spreadsheet, excludedGuestRow);
  if ((counts[slot] || 0) >= MAX_PER_SLOT) {
    fail_('SLOT_FULL', 'Slot ini sudah penuh. Silakan pilih waktu lain.');
  }
}

function getFullSlots_(spreadsheet) {
  const counts = getSlotCounts_(spreadsheet, null);
  return ARRIVAL_SLOTS.filter(function (slot) {
    return (counts[slot] || 0) >= MAX_PER_SLOT;
  });
}

function getSlotCounts_(spreadsheet, excludedGuestRow) {
  const counts = {};
  const guestSheet = spreadsheet.getSheetByName(GUEST_SHEET);
  const publicSheet = spreadsheet.getSheetByName(PUBLIC_SHEET);

  if (guestSheet && guestSheet.getLastRow() >= 5) {
    const rows = guestSheet.getRange(5, 10, guestSheet.getLastRow() - 4, 2).getDisplayValues();
    rows.forEach(function (row, index) {
      const slot = normalizeSlot_(row[1]);
      if (index + 5 !== excludedGuestRow && row[0] && ARRIVAL_SLOTS.indexOf(slot) !== -1) {
        counts[slot] = (counts[slot] || 0) + 1;
      }
    });
  }

  if (publicSheet && publicSheet.getLastRow() >= 5) {
    const rows = publicSheet.getRange(5, 9, publicSheet.getLastRow() - 4, 3).getDisplayValues();
    rows.forEach(function (row) {
      const slot = normalizeSlot_(row[0]);
      if (row[2] && ARRIVAL_SLOTS.indexOf(slot) !== -1) {
        counts[slot] = (counts[slot] || 0) + 1;
      }
    });
  }

  return counts;
}

function htmlResponse_(body) {
  const json = JSON.stringify(body)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const html = '<!doctype html><meta charset="utf-8"><script>parent.postMessage(' + json + ', "*");<\/script>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function javascriptResponse_(callback, body) {
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(body) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function safeCell_(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function textCell_(value) {
  return "'" + String(value == null ? '' : value);
}

function normalizeSlot_(value) {
  const text = String(value == null ? '' : value).trim().replace(':', '.');
  if (ARRIVAL_SLOTS.indexOf(text) !== -1) return text;
  const numeric = Number(text);
  return isFinite(numeric) ? numeric.toFixed(2) : text;
}

function normalizePhone_(value) {
  let phone = String(value || '').replace(/\D/g, '');
  if (phone.indexOf('0') === 0) phone = '62' + phone.slice(1);
  return phone;
}

function fail_(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
