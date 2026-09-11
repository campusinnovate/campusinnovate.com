'use client';

import { useEffect, useState } from 'react';
import { FiCloud, FiExternalLink, FiLink, FiRefreshCw, FiTrash2, FiDownload } from 'react-icons/fi';
import { googleServices, guessSheetMapping, sheetFields, type GoogleService, type SheetMapping } from '@/lib/prospects/google';
import { prospectRequest } from '@/lib/prospects/request';
import styles from './ProspectGoogle.module.css';

type Account = { id: string; email: string; services: GoogleService[]; updated_at: string };
type Status = { configured: boolean; placesConfigured: boolean; accounts: Account[] };
type Resource = { id: string; name: string; detail?: string };
type Preview = { values: string[][]; version: string; title: string; range: string };
type Report = { columns: string[]; rows: string[][]; startDate: string; endDate: string; fetchedAt: string };
const fieldNames = { account_name: 'Nama account', account_type: 'Tipe', city: 'Kota', website: 'Website', phone: 'Telepon', email: 'Email', contact_name: 'Nama PIC', contact_role: 'Jabatan', recommended_service: 'Layanan' };
const day = (offset: number) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);

export default function ProspectGoogle({ onImported }: { onImported: () => Promise<void> }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [accountId, setAccountId] = useState('');
  const [services, setServices] = useState<GoogleService[]>(['sheets', 'search_console']);
  const [service, setService] = useState<GoogleService>('sheets');
  const [resources, setResources] = useState<Resource[]>([]), [resourceId, setResourceId] = useState('');
  const [loaded, setLoaded] = useState(false), [nextPage, setNextPage] = useState('');
  const [tabs, setTabs] = useState<{ sheetId: number; title: string }[]>([]), [sheetId, setSheetId] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null), [mapping, setMapping] = useState<SheetMapping>({});
  const [selectedRows, setSelectedRows] = useState<number[]>([]), [report, setReport] = useState<Report | null>(null);
  const [startDate, setStartDate] = useState(day(30)), [endDate, setEndDate] = useState(day(3));
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const account = status?.accounts.find(a => a.id === accountId);
  const request = <T,>(action: string, extra: Record<string, unknown> = {}) => prospectRequest<T>('prospect-google', { action, connectionId: accountId, service, ...extra });
  async function refresh() {
    const value = await prospectRequest<Status>('prospect-google', { action: 'status' });
    setStatus(value); setAccountId(current => value.accounts.some(a => a.id === current) ? current : value.accounts[0]?.id ?? '');
  }
  async function run(name: string, action: () => Promise<void>) {
    setBusy(name); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Google belum dapat dimuat.'); }
    finally { setBusy(''); }
  }
  useEffect(() => {
    void run('status', refresh);
    const url = new URL(window.location.href), result = url.searchParams.get('google');
    if (result) {
      const messages: Record<string, string> = { connected: 'Akun Google terhubung. Pilih akun dan muat sumber.', cancelled: 'Koneksi Google dibatalkan.', expired: 'Permintaan koneksi kedaluwarsa. Hubungkan kembali.', error: 'Koneksi Google gagal. Periksa konfigurasi OAuth dan coba kembali.', setup_required: 'Konfigurasi OAuth Google belum lengkap.', consent_required: 'Izin akses offline belum diberikan. Hubungkan kembali akun.' };
      setMessage(messages[result] ?? 'Periksa status koneksi Google.');
      url.searchParams.delete('google'); window.history.replaceState(null, '', url);
    }
  }, []);
  function clearSource() { setResourceId(''); setTabs([]); setSheetId(''); setPreview(null); setMapping({}); setSelectedRows([]); setReport(null); }
  function clearResources() { clearSource(); setResources([]); setNextPage(''); setLoaded(false); }
  async function listResources(more = false) {
    const data = await request<{ items: Resource[]; nextPageToken: string }>('resources', { pageToken: more ? nextPage : '' });
    setResources(current => more ? [...new Map([...current, ...data.items].map(r => [r.id, r])).values()] : data.items);
    setNextPage(data.nextPageToken); setLoaded(true);
    if (!more) clearSource();
  }
  async function selectResource(id: string) {
    clearSource(); setResourceId(id);
    if (service === 'sheets' && id) {
      const data = await request<{ tabs: { sheetId: number; title: string }[] }>('tabs', { resourceId: id });
      setTabs(data.tabs); setSheetId(String(data.tabs[0]?.sheetId ?? ''));
    }
  }
  async function previewSheet() {
    setPreview(null); setSelectedRows([]);
    const data = await request<Preview>('preview', { resourceId, sheetId: Number(sheetId) });
    setPreview(data); setMapping(guessSheetMapping((data.values[0] ?? []).map(String)));
  }
  async function importSheet() {
    const result = await request<{ processed: number; prospects: number }>('import', { resourceId, sheetId: Number(sheetId), version: preview?.version, mapping, selectedRows });
    setSelectedRows([]);
    setMessage(`${result.processed} baris diproses menjadi ${result.prospects} prospek unik. Prospek lama dicocokkan otomatis.`);
    await onImported();
  }
  function resourceLink(r: Resource) {
    if (service === 'cloud') return `https://console.cloud.google.com/home/dashboard?project=${encodeURIComponent(r.id)}`;
    if (service === 'youtube') return `https://www.youtube.com/channel/${encodeURIComponent(r.id)}`;
    return `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(r.id)}`;
  }
  return <section className={styles.section} aria-labelledby="prospect-google-title">
    <header className={styles.header}><h2 id="prospect-google-title"><FiCloud /> Sumber Google</h2><button type="button" disabled={!!busy} title="Perbarui status akun" onClick={() => void run('status', refresh)}><FiRefreshCw /> Perbarui status</button></header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status" className={styles.message}>{message}</p>}
    {busy && <p role="status">{busy === 'import' ? 'Mengimpor prospek...' : 'Memproses Google...'}</p>}
    <div className={styles.connection}>
      <fieldset disabled={!!busy}><legend>Layanan akun</legend><div className={styles.checks}>{(Object.keys(googleServices) as GoogleService[]).map(key => <label key={key}><input type="checkbox" checked={services.includes(key)} onChange={e => setServices(current => e.target.checked ? [...current, key] : current.filter(k => k !== key))} />{googleServices[key].label}</label>)}</div></fieldset>
      <button disabled={!!busy || !status?.configured || !services.length} onClick={() => void run('authorize', async () => {
        const result = await request<{ url: string }>('authorize', { services });
        window.location.assign(result.url);
      })}><FiLink /> Hubungkan akun Google</button>
      {status && <span className={styles.badge} data-ready={status.placesConfigured}>Google Maps: {status.placesConfigured ? 'API key tersedia' : 'Belum dikonfigurasi'}</span>}
      {status && !status.configured && <p className={styles.error}>Konfigurasi OAuth Google belum lengkap.</p>}
    </div>
    {status?.accounts.length === 0 && <p className={styles.empty}>Belum ada akun Google yang terhubung ke Prospect Harvester.</p>}
    {!!status?.accounts.length && <>
      <div className={styles.controls}>
        <label>Akun<select value={accountId} disabled={!!busy} onChange={e => { setAccountId(e.target.value); clearResources(); }}><option value="">Pilih akun</option>{status.accounts.map(a => <option key={a.id} value={a.id}>{a.email}</option>)}</select></label>
        <label>Sumber<select value={service} disabled={!!busy} onChange={e => { setService(e.target.value as GoogleService); clearResources(); }}>{(Object.keys(googleServices) as GoogleService[]).map(key => <option key={key} value={key}>{googleServices[key].label}{account && !account.services.includes(key) ? ' - belum diizinkan' : ''}</option>)}</select></label>
        <button disabled={!!busy || !account?.services.includes(service)} onClick={() => void run('resources', () => listResources())}><FiRefreshCw /> Muat sumber</button>
        <button className={styles.disconnect} disabled={!!busy || !account} onClick={() => {
          if (!window.confirm(`Putuskan koneksi ${account?.email} dari Prospect Harvester?`)) return;
          void run('disconnect', async () => { await request('disconnect'); clearResources(); await refresh(); setMessage('Koneksi dihapus dari Prospect Harvester.'); });
        }} title="Putuskan koneksi akun"><FiTrash2 /><span>Putuskan</span></button>
      </div>
      {account && !account.services.includes(service) && <p className={styles.empty}>Izin {googleServices[service].label} belum diberikan pada akun ini.</p>}
      {loaded && !resources.length && <p className={styles.empty}>Tidak ada sumber yang dapat diakses akun ini.</p>}
      {!!resources.length && (['sheets', 'search_console', 'analytics'].includes(service) ? <div className={styles.controls}>
        <label className={styles.grow}>Sumber data<select value={resourceId} disabled={!!busy} onChange={e => void run('source', () => selectResource(e.target.value))}><option value="">Pilih sumber data</option>{resources.map(r => <option key={r.id} value={r.id}>{r.name}{r.detail ? ` (${r.detail})` : ''}</option>)}</select></label>
        {service === 'sheets' && !!tabs.length && <><label>Tab<select value={sheetId} disabled={!!busy} onChange={e => { setSheetId(e.target.value); setPreview(null); setSelectedRows([]); }}>{tabs.map(t => <option key={t.sheetId} value={t.sheetId}>{t.title}</option>)}</select></label><button disabled={!!busy || !resourceId || sheetId === ''} onClick={() => void run('preview', previewSheet)}><FiRefreshCw /> Pratinjau</button></>}
      </div> : <div className={styles.tableWrap}><table><thead><tr><th>Nama</th><th>ID</th><th>Status</th><th>Tautan</th></tr></thead><tbody>{resources.map(r => <tr key={r.id}><td>{r.name}</td><td>{r.id}</td><td>{r.detail}</td><td><a href={resourceLink(r)} target="_blank" rel="noopener noreferrer" title={`Buka ${r.name}`}><FiExternalLink /></a></td></tr>)}</tbody></table></div>)}
      {nextPage && <button disabled={!!busy} onClick={() => void run('resources', () => listResources(true))}>Muat sumber berikutnya</button>}
      {resourceId && (service === 'search_console' || service === 'analytics') && <div className={styles.controls}><label>Dari<input type="date" value={startDate} disabled={!!busy} onChange={e => { setStartDate(e.target.value); setReport(null); }} /></label><label>Sampai<input type="date" value={endDate} disabled={!!busy} onChange={e => { setEndDate(e.target.value); setReport(null); }} /></label><button disabled={!!busy || !startDate || !endDate} onClick={() => void run('report', async () => { setReport(null); setReport(await request<Report>('report', { resourceId, startDate, endDate })); })}><FiDownload /> Tarik laporan</button></div>}
      {report && <><p className={styles.caption}>{report.startDate} - {report.endDate} · {report.rows.length} hasil (maks. 100) · {new Date(report.fetchedAt).toLocaleString('id-ID')}</p><div className={styles.tableWrap}><table><thead><tr>{report.columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{report.rows.map((row,i) => <tr key={i}>{row.map((cell,j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table>{!report.rows.length && <p className={styles.empty}>Tidak ada data pada rentang tanggal ini.</p>}</div></>}
      {preview && <div className={styles.preview}>
        <h3>{preview.title}</h3><p className={styles.caption}>{preview.range} · {Math.max(0, preview.values.length - 1)} baris data · Baris 1: header</p>
        <div className={styles.mapping}>{sheetFields.map(key => <label key={key}>{fieldNames[key]}{key === 'account_name' ? ' *' : ''}<select disabled={!!busy} value={mapping[key] ?? ''} onChange={e => setMapping(current => { const next = { ...current }; if (e.target.value === '') delete next[key]; else next[key] = Number(e.target.value); return next; })}><option value="">Tidak dipetakan</option>{(preview.values[0] ?? []).map((h,i) => <option key={i} value={i}>{String.fromCharCode(65+i)}: {h || '(kosong)'}</option>)}</select></label>)}</div>
        <div className={styles.tableWrap}><table><thead><tr><th><input type="checkbox" aria-label="Pilih semua baris" disabled={!!busy || preview.values.length < 2} checked={preview.values.length > 1 && selectedRows.length === preview.values.length - 1} onChange={e => setSelectedRows(e.target.checked ? preview.values.slice(1).map((_,i) => i+2) : [])} /></th><th>Baris</th>{(preview.values[0] ?? []).map((h,i) => <th key={i}>{h || String.fromCharCode(65+i)}</th>)}</tr></thead><tbody>{preview.values.slice(1).map((row,i) => <tr key={i}><td><input type="checkbox" disabled={!!busy} aria-label={`Pilih baris ${i+2}`} checked={selectedRows.includes(i+2)} onChange={e => setSelectedRows(current => e.target.checked ? [...current,i+2] : current.filter(n => n !== i+2))} /></td><td>{i+2}</td>{(preview.values[0] ?? []).map((_,j) => <td key={j}>{row[j] ?? ''}</td>)}</tr>)}</tbody></table></div>
        <button disabled={!!busy || !selectedRows.length || mapping.account_name === undefined} onClick={() => void run('import', importSheet)}><FiDownload /> Impor {selectedRows.length} baris ke prospek</button>
      </div>}
    </>}
  </section>;
}
