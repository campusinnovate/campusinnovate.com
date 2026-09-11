export const googleServices = {
  sheets: { label: 'Drive & Sheets', scopes: ['drive.metadata.readonly', 'spreadsheets.readonly'] },
  search_console: { label: 'Search Console', scopes: ['webmasters.readonly'] },
  analytics: { label: 'Google Analytics', scopes: ['analytics.readonly'] },
  cloud: { label: 'Cloud Console', scopes: ['cloudplatformprojects.readonly'] },
  calendar: { label: 'Google Calendar', scopes: ['calendar.calendarlist.readonly'] },
  youtube: { label: 'YouTube', scopes: ['youtube.readonly'] },
} as const;
export type GoogleService = keyof typeof googleServices;
export function isGoogleService(value: unknown): value is GoogleService {
  return typeof value === 'string' && Object.hasOwn(googleServices, value);
}
export function scopesFor(services: GoogleService[]) {
  return ['openid', 'https://www.googleapis.com/auth/userinfo.email', ...new Set(services.flatMap(key =>
    googleServices[key].scopes.map(scope => `https://www.googleapis.com/auth/${scope}`)))];
}
export function grantedServices(scopes: string[]): GoogleService[] {
  return (Object.keys(googleServices) as GoogleService[]).filter(key =>
    googleServices[key].scopes.every(scope => scopes.includes(`https://www.googleapis.com/auth/${scope}`)));
}
export function safeWebUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.includes('://') ? value.trim() : `https://${value.trim()}`);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : '';
  } catch { return ''; }
}
export function reportDates(start: unknown, end: unknown) {
  const valid = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!valid(start) || !valid(end) || start > end || Date.parse(end) - Date.parse(start) > 366 * 86400000) {
    throw new Error('Pilih rentang tanggal yang valid, maksimal 366 hari.');
  }
  return { startDate: start, endDate: end };
}

export const sheetFields = ['account_name', 'account_type', 'city', 'website', 'phone', 'email', 'contact_name', 'contact_role', 'recommended_service'] as const;
export type SheetField = typeof sheetFields[number];
export type SheetMapping = Partial<Record<SheetField, number>>;
export function guessSheetMapping(headers: string[]): SheetMapping {
  const aliases: Record<SheetField, string[]> = {
    account_name: ['account_name','nama_account','nama_perusahaan','perusahaan','company','company_name','nama_sekolah','nama_organisasi'],
    account_type: ['account_type','type','tipe','jenis'], city: ['city','kota','kabupaten'],
    website: ['website','situs','url'], phone: ['phone','telepon','no_hp','whatsapp','nomor_telepon'],
    email: ['email','alamat_email'], contact_name: ['contact_name','nama_kontak','pic','nama_pic'],
    contact_role: ['contact_role','jabatan','posisi'], recommended_service: ['recommended_service','layanan','service'],
  };
  const normalized = headers.map(h => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  return Object.fromEntries(sheetFields.flatMap(key => {
    const index = normalized.findIndex(h => aliases[key].includes(h));
    return index < 0 ? [] : [[key, index]];
  }));
}
export function sheetCandidates(values: unknown[][], mapping: SheetMapping, fileId: string, sheetId: number, selectedRows: number[]) {
  if (!Number.isInteger(mapping.account_name) || mapping.account_name! < 0 || mapping.account_name! > 25) throw new Error('Kolom nama account wajib dipilih.');
  if (!selectedRows.length || selectedRows.length > 100 || new Set(selectedRows).size !== selectedRows.length) throw new Error('Pilih 1 sampai 100 baris berbeda.');
  for (const [key, index] of Object.entries(mapping)) {
    if (!sheetFields.includes(key as SheetField) || !Number.isInteger(index) || index < 0 || index > 25) throw new Error('Pemetaan kolom tidak valid.');
  }
  return selectedRows.map(rowNumber => {
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > values.length) throw new Error('Baris pilihan tidak tersedia. Muat ulang pratinjau.');
    const row = values[rowNumber - 1];
    const fields = Object.fromEntries(Object.entries(mapping).map(([key,index]) => [key, String(row[index!] ?? '').trim().slice(0, key === 'website' ? 600 : 180)]));
    if (!fields.account_name) throw new Error(`Nama account kosong pada baris ${rowNumber}.`);
    if (fields.website && !safeWebUrl(fields.website)) throw new Error(`Website tidak valid pada baris ${rowNumber}.`);
    if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) throw new Error(`Email tidak valid pada baris ${rowNumber}.`);
    const source = `https://docs.google.com/spreadsheets/d/${fileId}/edit#gid=${sheetId}&range=A${rowNumber}`;
    return { ...fields, website: safeWebUrl(fields.website), provider: 'Google Sheets',
      // Use account identity rather than row position so sorting a sheet cannot replace another prospect.
      external_id: `${fileId}:${sheetId}:${JSON.stringify([fields.account_name.toLowerCase(), (fields.city ?? '').toLowerCase(), (fields.email ?? '').toLowerCase()])}`,
      search_query: `Google Sheets ${fileId}`, signal_type: 'Imported contact', signal_content: `Diimpor dari Google Sheets, baris ${rowNumber}.`,
      signal_url: source, signal_score: 0, fit_score: 0, intent_score: 0, accessibility_score: 0,
      raw_data: { spreadsheet_id: fileId, sheet_id: sheetId, row: rowNumber },
    };
  });
}
