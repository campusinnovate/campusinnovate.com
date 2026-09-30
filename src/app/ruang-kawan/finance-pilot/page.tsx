'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiCheck, FiClock, FiPlus, FiRefreshCw, FiSend, FiTrash2 } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import styles from './finance-pilot.module.css';

type Account = { code: string; name: string; account_class: string };
type ServiceLine = { service_line_key: string; label: string };
type Project = { id: string; project_code: string; name: string; client_name: string | null };
type Line = { coa_code: string; description: string; debit: string; credit: string; project_id: string; client: string; service_line_key: string };
type JournalLine = { line_number: number; coa_code: string; description: string; debit: number; credit: number; project_name: string | null; client: string | null; service_line_key: string | null };
type Journal = { id: string; entry_date: string; description: string; status: string; finance_next_journal_lines: JournalLine[] };
type Period = { period_month: string; status: string; requested_action: string | null; requested_by_membership_id: string | null; review_note: string | null };

const emptyLine = (): Line => ({ coa_code: '', description: '', debit: '', credit: '', project_id: '', client: '', service_line_key: '' });
const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);
const monthStart = (date: string) => date ? `${date.slice(0, 7)}-01` : '';

export default function FinancePilotPage() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [services, setServices] = useState<ServiceLine[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [section, setSection] = useState<'journal' | 'periods'>('journal');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }));
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [periodDate, setPeriodDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }));
  const [reason, setReason] = useState('');

  const canManage = permissions.includes('finance_next.manage');
  const canApprove = permissions.includes('finance_next.approve');
  const debit = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0), [lines]);
  const credit = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0), [lines]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const db = createClient();
    const { data: { session } } = await db.auth.getSession();
    if (!session) { window.location.replace('/ruang-kawan/'); return; }
    const accessResult = await db.rpc('get_my_access');
    const access = (Array.isArray(accessResult.data) ? accessResult.data[0] : accessResult.data) as { permissions?: string[]; membership_status?: string } | null;
    const memberPermissions = access?.permissions ?? [];
    setPermissions(memberPermissions);
    if (access?.membership_status !== 'active' || !memberPermissions.includes('finance_next.view')) {
      setError('Akses Finance Pilot belum tersedia. Admin perlu memasang migrasi pilot dan memberikan izin Finance Pilot.');
      setLoading(false);
      return;
    }
    const [coa, service, project, entry, period] = await Promise.all([
      db.from('finance_coa').select('code,name,account_class').eq('is_active', true).order('code'),
      db.from('finance_next_service_lines').select('service_line_key,label').eq('is_active', true).order('label'),
      db.from('projects').select('id,project_code,name,client_name').is('deleted_at', null).order('name'),
      db.from('finance_next_journal_entries').select('id,entry_date,description,status,finance_next_journal_lines(line_number,coa_code,description,debit,credit,project_name,client,service_line_key)').order('entry_date', { ascending: false }).limit(100),
      db.from('finance_next_periods').select('period_month,status,requested_action,requested_by_membership_id,review_note').order('period_month', { ascending: false }).limit(24),
    ]);
    const failed = [coa, service, project, entry, period].find((result) => result.error);
    if (failed?.error) {
      setError(`Data Finance Pilot belum tersedia: ${failed.error.message}`);
      setLoading(false);
      return;
    }
    setAccounts((coa.data ?? []) as Account[]);
    setServices((service.data ?? []) as ServiceLine[]);
    setProjects((project.data ?? []) as Project[]);
    setJournals((entry.data ?? []) as unknown as Journal[]);
    setPeriods((period.data ?? []) as Period[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function changeLine(index: number, key: keyof Line, value: string) {
    setLines((current) => current.map((line, row) => row !== index ? line : {
      ...line, [key]: value,
      ...(key === 'debit' && value ? { credit: '' } : {}),
      ...(key === 'credit' && value ? { debit: '' } : {}),
    }));
  }

  async function post(event: FormEvent) {
    event.preventDefault();
    if (debit <= 0 || debit !== credit) { setError('Jurnal harus seimbang sebelum diposting.'); return; }
    setSaving(true); setError(''); setNotice('');
    const payload = lines.map((line) => ({ ...line, debit: Number(line.debit) || 0, credit: Number(line.credit) || 0, project_id: line.project_id || null, client: line.client || null, service_line_key: line.service_line_key || null }));
    const result = await createClient().rpc('finance_next_post_journal', { p_entry_date: date, p_description: description, p_lines: payload });
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setNotice('Jurnal berpasangan berhasil diposting. Jurnal posted tidak dapat diedit atau dihapus.');
    setDescription(''); setLines([emptyLine(), emptyLine()]); await load();
  }

  async function requestPeriod(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    const result = await createClient().rpc('finance_next_request_period_change', { p_period_month: monthStart(periodDate), p_action: 'close', p_reason: reason });
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setReason(''); setNotice('Permintaan penutupan periode dikirim untuk persetujuan CEO.'); await load();
  }

  async function requestReopen(period: Period) {
    const note = window.prompt('Alasan pembukaan kembali periode wajib diisi:');
    if (!note?.trim()) return;
    const result = await createClient().rpc('finance_next_request_period_change', { p_period_month: period.period_month, p_action: 'reopen', p_reason: note.trim() });
    if (result.error) { setError(result.error.message); return; }
    setNotice('Permintaan membuka kembali periode dikirim untuk persetujuan CEO.'); await load();
  }

  async function decidePeriod(period: Period, decision: 'approve' | 'reject') {
    const note = decision === 'reject' ? window.prompt('Alasan penolakan wajib diisi:') : '';
    if (decision === 'reject' && !note?.trim()) return;
    const result = await createClient().rpc('finance_next_review_period_change', { p_period_month: period.period_month, p_decision: decision, p_note: note ?? '' });
    if (result.error) { setError(result.error.message); return; }
    setNotice(`Permintaan periode ${decision === 'approve' ? 'disetujui' : 'ditolak'}.`); await load();
  }

  if (loading) return <main className={styles.page}><p>Memuat Finance Pilot…</p></main>;
  return <main className={styles.page}>
    <header className={styles.header}>
      <div><Link href="/ruang-kawan/finance/"><FiArrowLeft /> Finance lama</Link><small>ADDITIVE PILOT · PHASE 1</small><h1>Finance Pilot</h1><p>Pembukuan berpasangan dan kontrol periode, berjalan berdampingan dengan Finance yang sudah ada.</p></div>
      <button onClick={() => void load()}><FiRefreshCw /> Muat ulang</button>
    </header>
    <div className={styles.preservation}><strong>Mode pilot terpisah</strong><span>Data Finance lama tidak dipindah, ditimpa, atau dihapus. Data pilot tersimpan pada tabel baru.</span></div>
    {error ? <p className={styles.alert} role="alert">{error}</p> : null}{notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    <section className={styles.metrics}>
      <article><small>Entri jurnal pilot</small><strong>{journals.length}</strong><span>{journals.filter((entry) => entry.status === 'posted').length} posted</span></article>
      <article><small>Chart of Accounts aktif</small><strong>{accounts.length}</strong><span>Menggunakan daftar akun Finance yang ada</span></article>
      <article><small>Service line</small><strong>{services.length}</strong><span>6 kategori sesuai PRD</span></article>
      <article><small>Periode disetujui</small><strong>{periods.filter((item) => item.status === 'closed').length}</strong><span>Periode tertutup terkunci dari posting</span></article>
    </section>
    <nav className={styles.tabs}><button data-active={section === 'journal'} onClick={() => setSection('journal')}>Jurnal berpasangan</button><button data-active={section === 'periods'} onClick={() => setSection('periods')}>Kontrol periode</button></nav>
    {section === 'journal' ? <div className={styles.columns}>
      <section className={styles.panel}>
        <header><div><small>DOUBLE ENTRY</small><h2>Posting jurnal rutin</h2><p>Debit dan kredit harus sama. Jurnal yang diposting bersifat permanen.</p></div></header>
        {canManage ? <form onSubmit={post} className={styles.form}>
          <div className={styles.topFields}><label>Tanggal<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label className={styles.description}>Keterangan<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} required /></label></div>
          <div className={styles.linesHeading}><strong>Baris jurnal</strong><button type="button" onClick={() => setLines((current) => [...current, emptyLine()])}><FiPlus /> Tambah baris</button></div>
          {lines.map((line, index) => {
            const account = accounts.find((item) => item.code === line.coa_code);
            const serviceRequired = account?.account_class === 'Pendapatan' || account?.account_class === 'Beban Langsung Proyek';
            const projectRequired = account?.account_class === 'Beban Langsung Proyek';
            return <fieldset className={styles.line} key={index}>
              <legend>Baris {index + 1}</legend>
              <label className={styles.account}>Akun<select value={line.coa_code} onChange={(event) => changeLine(index, 'coa_code', event.target.value)} required><option value="">Pilih akun</option>{accounts.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label>
              <label>Debit<input type="number" min="0" step="0.01" value={line.debit} onChange={(event) => changeLine(index, 'debit', event.target.value)} /></label>
              <label>Kredit<input type="number" min="0" step="0.01" value={line.credit} onChange={(event) => changeLine(index, 'credit', event.target.value)} /></label>
              <label className={styles.account}>Keterangan baris<input value={line.description} onChange={(event) => changeLine(index, 'description', event.target.value)} /></label>
              {serviceRequired ? <label>Service line<select value={line.service_line_key} onChange={(event) => changeLine(index, 'service_line_key', event.target.value)} required><option value="">Pilih service line</option>{services.map((item) => <option key={item.service_line_key} value={item.service_line_key}>{item.label}</option>)}</select></label> : null}
              {projectRequired ? <label className={styles.account}>Project ID<select value={line.project_id} onChange={(event) => changeLine(index, 'project_id', event.target.value)} required><option value="">Pilih project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.project_code} · {project.name}</option>)}</select></label> : null}
              <label>Client<input value={line.client} onChange={(event) => changeLine(index, 'client', event.target.value)} /></label>
              {lines.length > 2 ? <button className={styles.remove} type="button" onClick={() => setLines((current) => current.filter((_, row) => row !== index))} aria-label={`Hapus baris ${index + 1}`}><FiTrash2 /></button> : null}
            </fieldset>;
          })}
          <div className={styles.totals}><span>Total debit <strong>{money(debit)}</strong></span><span>Total kredit <strong>{money(credit)}</strong></span><b data-balanced={debit > 0 && debit === credit}>{debit > 0 && debit === credit ? <><FiCheck /> Seimbang</> : 'Belum seimbang'}</b></div>
          <button className={styles.primary} disabled={saving || debit <= 0 || debit !== credit}><FiSend />{saving ? 'Memposting…' : 'Posting jurnal'}</button>
        </form> : <p className={styles.muted}>Izin Finance Pilot kelola dibutuhkan untuk memposting jurnal.</p>}
      </section>
      <section className={styles.panel}>
        <header><div><small>RECENT POSTINGS</small><h2>Jurnal terbaru</h2><p>100 entri terbaru, dengan jejak baris debit dan kredit.</p></div></header>
        {journals.length ? <div className={styles.journalList}>{journals.map((entry) => <article key={entry.id}><div><strong>{entry.description}</strong><small>{entry.entry_date} · {entry.status}</small>{entry.finance_next_journal_lines.map((line) => <p key={line.line_number}>{line.coa_code} {line.description || ''} · D {money(Number(line.debit))} / K {money(Number(line.credit))}</p>)}</div><b>{money(entry.finance_next_journal_lines.reduce((sum, line) => sum + Number(line.debit), 0))}</b></article>)}</div> : <p className={styles.empty}>Belum ada jurnal di pilot. Finance lama tetap dapat dipakai.</p>}
      </section>
    </div> : <div className={styles.columns}>
      <section className={styles.panel}><header><div><small>MONTH END CONTROL</small><h2>Ajukan penutupan periode</h2><p>Finance menyiapkan permintaan. Approver menyetujui atau menolak; pemohon tidak dapat menyetujui permintaannya sendiri.</p></div></header>
        {canManage ? <form className={styles.form} onSubmit={requestPeriod}><label>Bulan<input type="month" value={periodDate.slice(0, 7)} onChange={(event) => setPeriodDate(`${event.target.value}-01`)} required /></label><label>Alasan<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={4} required /></label><button className={styles.primary} disabled={saving}><FiClock /> Ajukan penutupan</button></form> : <p className={styles.muted}>Izin Finance Pilot kelola dibutuhkan untuk mengajukan penutupan.</p>}
      </section>
      <section className={styles.panel}><header><div><small>APPROVAL QUEUE</small><h2>Status periode</h2><p>Periode tanpa record masih terbuka. Periode tertutup tidak menerima posting.</p></div></header>
        {periods.length ? <div className={styles.journalList}>{periods.map((period) => <article key={period.period_month}><div><strong>{new Date(`${period.period_month}T12:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</strong><small>{period.status.replaceAll('_', ' ')}{period.review_note ? ` · ${period.review_note}` : ''}</small></div>
          {canApprove && ['close_requested', 'reopen_requested'].includes(period.status) ? <span className={styles.actions}><button onClick={() => void decidePeriod(period, 'approve')}><FiCheck /> Setujui</button><button onClick={() => void decidePeriod(period, 'reject')}>Tolak</button></span> : canManage && period.status === 'closed' ? <span className={styles.actions}><button onClick={() => void requestReopen(period)}>Minta buka kembali</button></span> : null}
        </article>)}</div> : <p className={styles.empty}>Belum ada permintaan perubahan periode.</p>}
      </section>
    </div>}
    <footer className={styles.footer}>Core accounting pilot · Supabase remains the source of truth · <Link href="/ruang-kawan/finance/">Kembali ke Finance yang ada</Link></footer>
  </main>;
}
