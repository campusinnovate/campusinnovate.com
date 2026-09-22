const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
const context = {
  console,
  ContentService: {
    MimeType: { JAVASCRIPT: 'JAVASCRIPT' },
    createTextOutput(value) {
      return { value, setMimeType() { return this; } };
    },
  },
  HtmlService: {
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
    createHtmlOutput(value) {
      return { value, mode: null, setXFrameOptionsMode(mode) { this.mode = mode; return this; } };
    },
  },
};

vm.createContext(context);
vm.runInContext(`${source}\nthis.__test = { getFullSlots_, assertSlotAvailable_, htmlResponse_, validateRegistration_ };`, context);

function makeSheet(rows, columns) {
  return {
    getLastRow() { return rows.length + 4; },
    getRange(startRow, startColumn, rowCount, columnCount) {
      const key = `${startColumn}:${columnCount}`;
      const values = columns[key] || [];
      return { getDisplayValues() { return values.slice(0, rowCount); } };
    },
  };
}

function makeSpreadsheet() {
  const guestRows = [
    ['Hadir', '08.00'], ['Hadir', '08.00'], ['Tentatif', '08.00'], ['Hadir', '08.00'],
  ];
  const publicRows = [
    ['08.00', '100%', 'Hadir'], ['08.00', '100%', 'Hadir'],
    ['08.00', '80%', 'Tentatif'], ['08.00', '100%', 'Hadir'],
  ];
  const guest = makeSheet(guestRows, { '10:2': guestRows });
  const publicSheet = makeSheet(publicRows, { '9:3': publicRows });
  return {
    getSheetByName(name) { return name === 'Guest List' ? guest : publicSheet; },
  };
}

const spreadsheet = makeSpreadsheet();
assert.deepEqual(Array.from(context.__test.getFullSlots_(spreadsheet)), ['08.00']);
assert.throws(
  () => context.__test.assertSlotAvailable_(spreadsheet, '08.00', null),
  error => error.code === 'SLOT_FULL',
);
assert.doesNotThrow(() => context.__test.assertSlotAvailable_(spreadsheet, '08.00', 5));

const response = context.__test.htmlResponse_({ ok: false, requestId: 'request-1', code: 'SLOT_FULL' });
assert.equal(response.mode, 'ALLOWALL');
assert.match(response.value, /parent\.postMessage/);
assert.match(response.value, /request-1/);
assert.match(response.value, /SLOT_FULL/);

assert.doesNotThrow(() => context.__test.validateRegistration_({
  parentName: 'Amilia',
  whatsapp: '083812327019',
  email: 'amilia@example.com',
  adultCount: 1,
  childCount: 0,
  children: [],
  slot: '08.00',
  certainty: 100,
  documentation: true,
  privacy: true,
}));

console.log('Noortura Apps Script tests passed.');
