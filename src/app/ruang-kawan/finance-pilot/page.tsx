'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import {
  FiActivity, FiArrowLeft, FiBarChart2, FiBriefcase, FiCheck, FiChevronRight,
  FiClock, FiDollarSign, FiFileText, FiGrid, FiPlus, FiRefreshCw, FiSend,
  FiSettings, FiShield, FiTrash2, FiTrendingUp,
} from 'react-icons/fi';
import styles from './finance-pilot.module.css';

type Account = { code: string; name: string; account_class: string };
type ServiceLine = { service_line_key: string; label: string };
type Project = { id: string; project_code: string; name: string; client_name: string | null };
type Line = { coa_code: string; description: string; debit: string; credit: string; project_id: string; client: string; service_line_key: string };
type JournalLine = { line_number: number; coa_code: string; description: string; debit: number; credit: number; project_name: string | null; client: string | null; service_line_key: string | null };
type Journal = { id: string; entry_date: string; description: string; status: string; finance_next_journal_lines: JournalLine[] };
type Period = { period_month: string; status: string; requested_action: string | null; requested_by_membership_id: string | null; review_note: string | null };
type InvoiceItem = { id: string; line_number: number; description: string; quantity: number; unit_price: number; line_total: number };
type Invoice = { id: string; invoice_number: string; invoice_date: string; due_date: string; client: string; project_name: string | null; service_line_key: string; status: string; subtotal: number; discount: number; tax: number; management_fee: number; other_fees: number; total: number; paid: number; balance: number; installment_scheme: string; payment_schedule: { number: number; label: string; percentage: number; amount: number }[]; finance_next_invoice_items: InvoiceItem[] };
type Receipt = { id: string; receipt_number: string; invoice_id: string; receipt_date: string; amount: number; deposit_coa_code: string; payment_reference: string | null };
type InvoiceForm = { invoiceDate: string; dueDate: string; client: string; clientAddress: string; projectId: string; serviceLineKey: string; itemDescription: string; quantity: string; unitPrice: string; discount: string; tax: string; managementFee: string; otherFees: string; installmentScheme: string; customPercentages: string; notes: string };
type Section = 'overview' | 'transactions' | 'revenue' | 'projects' | 'cash' | 'reports' | 'planning' | 'settings' | 'periods';
type PreviewRole = 'operator' | 'approver' | 'viewer';

const emptyLine = (): Line => ({ coa_code: '', description: '', debit: '', credit: '', project_id: '', client: '', service_line_key: '' });
const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);
const monthStart = (date: string) => date ? `${date.slice(0, 7)}-01` : '';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const emptyInvoice = (): InvoiceForm => ({ invoiceDate: today(), dueDate: '', client: '', clientAddress: '', projectId: '', serviceLineKey: '', itemDescription: '', quantity: '1', unitPrice: '', discount: '0', tax: '0', managementFee: '0', otherFees: '0', installmentScheme: 'full', customPercentages: '', notes: '' });

const demoAccounts: Account[] = [
  { code: '1001', name: 'Bank Mandiri Operasional', account_class: 'Aset' },
  { code: '1101', name: 'Piutang Usaha', account_class: 'Aset' },
  { code: '4001', name: 'Pendapatan Jasa', account_class: 'Pendapatan' },
  { code: '5101', name: 'Beban Langsung Proyek', account_class: 'Beban Langsung Proyek' },
  { code: '6101', name: 'Beban Operasional', account_class: 'Beban' },
];
const demoServices: ServiceLine[] = [
  { service_line_key: 'event', label: 'Event & Experience' },
  { service_line_key: 'training', label: 'Training & Development' },
  { service_line_key: 'digital', label: 'Digital System' },
  { service_line_key: 'creative', label: 'Creative & Media' },
];
const demoProjects: Project[] = [
  { id: 'project-lidar', project_code: 'PRJ-2609-014', name: 'LiDAR Batch 3', client_name: 'PT Geo Investama Mandiri' },
  { id: 'project-ylos', project_code: 'PRJ-2608-009', name: 'Youth Leader Organization Summit', client_name: 'YLOS 2026' },
];
const demoJournals: Journal[] = [
  { id: 'journal-1', entry_date: '2026-10-05', description: 'DP supporting LiDAR Batch 3', status: 'posted', finance_next_journal_lines: [
    { line_number: 1, coa_code: '1001', description: 'Dana diterima', debit: 7358400, credit: 0, project_name: 'LiDAR Batch 3', client: 'PT Geo Investama Mandiri', service_line_key: 'event' },
    { line_number: 2, coa_code: '1101', description: 'Pelunasan sebagian piutang', debit: 0, credit: 7358400, project_name: 'LiDAR Batch 3', client: 'PT Geo Investama Mandiri', service_line_key: 'event' },
  ] },
  { id: 'journal-2', entry_date: '2026-10-05', description: 'Operasional LiDAR Batch 2', status: 'posted', finance_next_journal_lines: [
    { line_number: 1, coa_code: '5101', description: 'Man power dan konsumsi', debit: 14542100, credit: 0, project_name: 'LiDAR Batch 2', client: 'PT Geo Investama Mandiri', service_line_key: 'event' },
    { line_number: 2, coa_code: '1001', description: 'Pembayaran bank', debit: 0, credit: 14542100, project_name: 'LiDAR Batch 2', client: 'PT Geo Investama Mandiri', service_line_key: 'event' },
  ] },
];
const demoPeriods: Period[] = [
  { period_month: '2026-09-01', status: 'close_requested', requested_action: 'close', requested_by_membership_id: 'finance-operator', review_note: 'Rekonsiliasi selesai, menunggu persetujuan.' },
  { period_month: '2026-08-01', status: 'closed', requested_action: null, requested_by_membership_id: null, review_note: 'Disetujui CEO.' },
];
const demoInvoices: Invoice[] = [
  { id: 'invoice-1', invoice_number: 'INV-202610-0001', invoice_date: '2026-10-05', due_date: '2026-10-12', client: 'PT Geo Investama Mandiri', project_name: 'LiDAR Batch 3', service_line_key: 'event', status: 'partially_paid', subtotal: 14716800, discount: 0, tax: 0, management_fee: 0, other_fees: 0, total: 14716800, paid: 7358400, balance: 7358400, installment_scheme: '50-50', payment_schedule: [{ number: 1, label: 'DP', percentage: 50, amount: 7358400 }, { number: 2, label: 'Pelunasan', percentage: 50, amount: 7358400 }], finance_next_invoice_items: [{ id: 'item-1', line_number: 1, description: 'Supporting LiDAR Batch 3', quantity: 1, unit_price: 14716800, line_total: 14716800 }] },
  { id: 'invoice-2', invoice_number: 'DRAFT-0002', invoice_date: '2026-10-06', due_date: '2026-10-20', client: 'YLOS 2026', project_name: 'Youth Leader Organization Summit', service_line_key: 'digital', status: 'draft', subtotal: 8500000, discount: 0, tax: 935000, management_fee: 500000, other_fees: 0, total: 9935000, paid: 0, balance: 9935000, installment_scheme: '50-25-25', payment_schedule: [{ number: 1, label: 'Termin 1', percentage: 50, amount: 4967500 }, { number: 2, label: 'Termin 2', percentage: 25, amount: 2483750 }, { number: 3, label: 'Termin 3', percentage: 25, amount: 2483750 }], finance_next_invoice_items: [{ id: 'item-2', line_number: 1, description: 'Full-stack event website', quantity: 1, unit_price: 8500000, line_total: 8500000 }] },
];
const demoReceipts: Receipt[] = [{ id: 'receipt-1', receipt_number: 'RCPT-202610-0001', invoice_id: 'invoice-1', receipt_date: '2026-10-05', amount: 7358400, deposit_coa_code: '1001', payment_reference: '202610051545913206' }];

const navigation: { key: Section; label: string; icon: typeof FiGrid; ready: boolean }[] = [
  { key: 'overview', label: 'Overview', icon: FiGrid, ready: true },
  { key: 'transactions', label: 'Transactions', icon: FiActivity, ready: true },
  { key: 'revenue', label: 'Revenue', icon: FiTrendingUp, ready: true },
  { key: 'projects', label: 'Projects', icon: FiBriefcase, ready: false },
  { key: 'cash', label: 'Cash & Funds', icon: FiDollarSign, ready: false },
  { key: 'reports', label: 'Reports', icon: FiBarChart2, ready: false },
  { key: 'planning', label: 'Planning', icon: FiFileText, ready: false },
  { key: 'settings', label: 'Settings', icon: FiSettings, ready: false },
];

export default function FinancePilotPage() {
  const [previewRole, setPreviewRole] = useState<PreviewRole>('operator');
  const accounts = demoAccounts;
  const services = demoServices;
  const projects = demoProjects;
  const [journals, setJournals] = useState<Journal[]>(demoJournals);
  const [periods, setPeriods] = useState<Period[]>(demoPeriods);
  const [invoices, setInvoices] = useState<Invoice[]>(demoInvoices);
  const [receipts, setReceipts] = useState<Receipt[]>(demoReceipts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [section, setSection] = useState<Section>('overview');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }));
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [periodDate, setPeriodDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }));
  const [reason, setReason] = useState('');
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>(emptyInvoice());
  const [receiptInvoiceId, setReceiptInvoiceId] = useState('');
  const [receiptDate, setReceiptDate] = useState(today());
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptAccount, setReceiptAccount] = useState('1001');
  const [receiptReference, setReceiptReference] = useState('');

  const canManage = previewRole === 'operator';
  const canApprove = previewRole === 'approver';
  const debit = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0), [lines]);
  const credit = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0), [lines]);
  const postedValue = useMemo(() => journals.reduce((total, entry) => total + entry.finance_next_journal_lines.reduce((sum, line) => sum + Number(line.debit), 0), 0), [journals]);
  const approvalQueue = periods.filter((item) => ['close_requested', 'reopen_requested'].includes(item.status));
  const issuedInvoices = invoices.filter((item) => item.status !== 'draft' && item.status !== 'void');
  const billedValue = issuedInvoices.reduce((sum, item) => sum + Number(item.total), 0);
  const collectedValue = issuedInvoices.reduce((sum, item) => sum + Number(item.paid), 0);
  const outstandingValue = issuedInvoices.reduce((sum, item) => sum + Number(item.balance), 0);

  function resetDemo() {
    setJournals(demoJournals);
    setPeriods(demoPeriods);
    setInvoices(demoInvoices);
    setReceipts(demoReceipts);
    setError('');
    setNotice('Data preview dikembalikan ke contoh awal. Tidak ada data backend yang berubah.');
    setDescription('');
    setLines([emptyLine(), emptyLine()]);
    setInvoiceForm(emptyInvoice());
    setReceiptInvoiceId('');
  }

  function changeLine(index: number, key: keyof Line, value: string) {
    setLines((current) => current.map((line, row) => row !== index ? line : {
      ...line, [key]: value,
      ...(key === 'debit' && value ? { credit: '' } : {}),
      ...(key === 'credit' && value ? { debit: '' } : {}),
    }));
  }

  function post(event: FormEvent) {
    event.preventDefault();
    if (debit <= 0 || debit !== credit) { setError('Jurnal harus seimbang sebelum diposting.'); return; }
    setSaving(true); setError(''); setNotice('');
    const journalLines = lines.map((line, index) => {
      const project = projects.find((item) => item.id === line.project_id);
      return { line_number: index + 1, coa_code: line.coa_code, description: line.description, debit: Number(line.debit) || 0, credit: Number(line.credit) || 0, project_name: project?.name ?? null, client: line.client || null, service_line_key: line.service_line_key || null };
    });
    setJournals((current) => [{ id: `preview-journal-${Date.now()}`, entry_date: date, description, status: 'posted', finance_next_journal_lines: journalLines }, ...current]);
    setSaving(false);
    setNotice('Simulasi jurnal berhasil diposting di frontend. Belum tersimpan ke backend.');
    setDescription(''); setLines([emptyLine(), emptyLine()]);
  }

  function requestPeriod(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    const periodMonth = monthStart(periodDate);
    setPeriods((current) => [{ period_month: periodMonth, status: 'close_requested', requested_action: 'close', requested_by_membership_id: 'preview-operator', review_note: reason }, ...current.filter((item) => item.period_month !== periodMonth)]);
    setSaving(false);
    setReason(''); setNotice('Simulasi permintaan penutupan dikirim ke antrean Approver.');
  }

  function requestReopen(period: Period) {
    const note = window.prompt('Alasan pembukaan kembali periode wajib diisi:');
    if (!note?.trim()) return;
    setPeriods((current) => current.map((item) => item.period_month === period.period_month ? { ...item, status: 'reopen_requested', requested_action: 'reopen', requested_by_membership_id: 'preview-operator', review_note: note.trim() } : item));
    setNotice('Simulasi permintaan membuka kembali periode dikirim ke Approver.');
  }

  function decidePeriod(period: Period, decision: 'approve' | 'reject') {
    const note = decision === 'reject' ? window.prompt('Alasan penolakan wajib diisi:') : '';
    if (decision === 'reject' && !note?.trim()) return;
    setPeriods((current) => current.map((item) => item.period_month !== period.period_month ? item : {
      ...item,
      status: decision === 'approve' ? (item.requested_action === 'reopen' ? 'open' : 'closed') : 'open',
      requested_action: null,
      review_note: decision === 'approve' ? 'Disetujui pada mode preview.' : note?.trim() ?? 'Ditolak.',
    }));
    setNotice(`Simulasi permintaan periode ${decision === 'approve' ? 'disetujui' : 'ditolak'}.`);
  }

  function saveInvoice(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    const customPercentages = invoiceForm.customPercentages.split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0);
    const percentages = invoiceForm.installmentScheme === '50-50' ? [50, 50] : invoiceForm.installmentScheme === '50-25-25' ? [50, 25, 25] : invoiceForm.installmentScheme === 'custom' ? customPercentages : [100];
    if (Math.round(percentages.reduce((sum, value) => sum + value, 0) * 100) !== 10000) { setSaving(false); setError('Total persentase termin harus tepat 100%.'); return; }
    const subtotal = Number(invoiceForm.quantity) * Number(invoiceForm.unitPrice);
    const total = subtotal - Number(invoiceForm.discount || 0) + Number(invoiceForm.tax || 0) + Number(invoiceForm.managementFee || 0) + Number(invoiceForm.otherFees || 0);
    const project = projects.find((item) => item.id === invoiceForm.projectId);
    const id = `preview-invoice-${Date.now()}`;
    const draft: Invoice = {
      id, invoice_number: `DRAFT-${String(invoices.length + 1).padStart(4, '0')}`, invoice_date: invoiceForm.invoiceDate, due_date: invoiceForm.dueDate || invoiceForm.invoiceDate,
      client: invoiceForm.client, project_name: project?.name ?? null, service_line_key: invoiceForm.serviceLineKey, status: 'draft', subtotal,
      discount: Number(invoiceForm.discount || 0), tax: Number(invoiceForm.tax || 0), management_fee: Number(invoiceForm.managementFee || 0), other_fees: Number(invoiceForm.otherFees || 0), total, paid: 0, balance: total,
      installment_scheme: invoiceForm.installmentScheme, payment_schedule: percentages.map((percentage, index) => ({ number: index + 1, label: percentages.length === 1 ? 'Pembayaran penuh' : `Termin ${index + 1}`, percentage, amount: total * percentage / 100 })),
      finance_next_invoice_items: [{ id: `${id}-item`, line_number: 1, description: invoiceForm.itemDescription, quantity: Number(invoiceForm.quantity), unit_price: Number(invoiceForm.unitPrice), line_total: subtotal }],
    };
    setInvoices((current) => [draft, ...current]);
    setSaving(false); setInvoiceForm(emptyInvoice()); setNotice('Draft invoice berhasil dibuat pada mode preview frontend.');
  }

  function issueInvoice(invoice: Invoice) {
    if (!window.confirm(`Simulasikan penerbitan ${invoice.invoice_number}?`)) return;
    setSaving(true); setError('');
    const invoiceNumber = `INV-202610-${String(invoices.filter((item) => item.status !== 'draft').length + 1).padStart(4, '0')}`;
    setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, invoice_number: invoiceNumber, status: 'issued' } : item));
    setSaving(false); setNotice(`${invoiceNumber} diterbitkan dalam simulasi frontend. Jurnal backend belum dibuat.`);
  }

  function prepareReceipt(invoice: Invoice) {
    setReceiptInvoiceId(invoice.id); setReceiptAmount(String(invoice.balance)); setReceiptDate(today()); setReceiptReference('');
  }

  function recordReceipt(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    const amount = Number(receiptAmount);
    const invoice = invoices.find((item) => item.id === receiptInvoiceId);
    if (!invoice || amount <= 0 || amount > invoice.balance) { setSaving(false); setError('Nominal pembayaran tidak valid.'); return; }
    setReceipts((current) => [{ id: `preview-receipt-${Date.now()}`, receipt_number: `RCPT-PREVIEW-${String(current.length + 1).padStart(3, '0')}`, invoice_id: receiptInvoiceId, receipt_date: receiptDate, amount, deposit_coa_code: receiptAccount, payment_reference: receiptReference || null }, ...current]);
    setInvoices((current) => current.map((item) => item.id !== receiptInvoiceId ? item : { ...item, paid: item.paid + amount, balance: item.balance - amount, status: item.balance - amount === 0 ? 'paid' : 'partially_paid' }));
    setSaving(false); setReceiptInvoiceId(''); setReceiptAmount(''); setReceiptReference(''); setNotice('Payment receipt tersimpan pada simulasi frontend. Cash dan AR belum diubah di backend.');
  }

  function openSection(next: Section) {
    setError(''); setNotice(''); setSection(next);
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><Link href="/ruang-kawan/finance/"><FiArrowLeft /> Finance lama</Link><small>FINANCE WORKSPACE · PILOT</small><h1>Finance Pilot</h1><p>Satu alur dari transaksi, approval, posting, rekonsiliasi, sampai laporan.</p></div>
      <div className={styles.headerActions}>
        <label className={styles.rolePreview}><FiShield /><span>Preview sebagai</span><select value={previewRole} onChange={(event) => setPreviewRole(event.target.value as PreviewRole)}><option value="operator">Finance operator</option><option value="approver">Approver / CEO</option><option value="viewer">Viewer</option></select></label>
        <button onClick={resetDemo}><FiRefreshCw /> Reset demo</button>
      </div>
    </header>
    <div className={styles.preservation}><strong>Preview frontend lokal</strong><span>Semua angka dan aksi pada halaman ini adalah data simulasi. Belum tersambung ke Supabase dan tidak mengubah Finance produksi.</span></div>
    {error ? <p className={styles.alert} role="alert">{error}</p> : null}{notice ? <p className={styles.notice} role="status">{notice}</p> : null}

    <nav className={styles.workspaceNav} aria-label="Finance Pilot">
      {navigation.map((item) => <button key={item.key} data-active={section === item.key} onClick={() => openSection(item.key)}><item.icon /><span>{item.label}</span>{item.ready ? null : <small>Next</small>}</button>)}
    </nav>

    {section === 'overview' ? <>
      <section className={styles.overviewHero}>
        <div><small>EXECUTIVE OVERVIEW</small><h2>Kondisi keuangan pilot dalam satu pandangan</h2><p>Angka hanya berasal dari ledger dan invoice pilot. Billed, cash collected, dan outstanding AR tetap dipisahkan agar tidak terbaca sebagai angka yang sama.</p></div>
        <button className={styles.primary} onClick={() => openSection(canManage ? 'transactions' : 'periods')}>{canManage ? 'Tambah transaksi' : 'Lihat approval'} <FiChevronRight /></button>
      </section>
      <section className={styles.metrics}>
        <article><small>Nilai jurnal posted</small><strong>{money(postedValue)}</strong><span>{journals.filter((entry) => entry.status === 'posted').length} jurnal pada ledger pilot</span></article>
        <article><small>Invoice diterbitkan</small><strong>{money(billedValue)}</strong><span>{issuedInvoices.length} invoice issued / paid</span></article>
        <article><small>Cash collected</small><strong>{money(collectedValue)}</strong><span>{receipts.length} payment receipt</span></article>
        <article><small>Outstanding AR</small><strong>{money(outstandingValue)}</strong><span>Belum diterima dari client</span></article>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel}><header><div><small>WORK QUEUE</small><h2>Yang perlu ditindaklanjuti</h2><p>Daftar kerja mengikuti izin pengguna.</p></div></header>
          <div className={styles.taskList}>
            {canApprove && approvalQueue.length ? approvalQueue.map((period) => <button key={period.period_month} onClick={() => openSection('periods')}><span><b>Review perubahan periode</b><small>{new Date(`${period.period_month}T12:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} · {period.status.replaceAll('_', ' ')}</small></span><FiChevronRight /></button>) : null}
            {canManage ? <button onClick={() => openSection('transactions')}><span><b>Catat transaksi rutin</b><small>Buat jurnal dan periksa preview debit-kredit</small></span><FiChevronRight /></button> : null}
            {canManage ? <button onClick={() => openSection('revenue')}><span><b>Buat atau tindak lanjuti invoice</b><small>{invoices.filter((item) => item.status === 'draft').length} draft · {money(outstandingValue)} outstanding</small></span><FiChevronRight /></button> : null}
            {canManage ? <button onClick={() => openSection('periods')}><span><b>Siapkan month-end closing</b><small>Ajukan penutupan periode kepada approver</small></span><FiChevronRight /></button> : null}
            {!canManage && !canApprove ? <p className={styles.empty}>Tidak ada tindakan untuk izin viewer.</p> : null}
          </div>
        </section>
        <section className={styles.panel}><header><div><small>CONTROL STATUS</small><h2>Fondasi PRD</h2><p>Status kemampuan yang benar-benar telah terhubung.</p></div></header>
          <div className={styles.controlList}>
            <span data-ready="true"><FiCheck /><b>Double-entry ledger</b><small>Prototype siap</small></span>
            <span data-ready="true"><FiCheck /><b>Period lock & approval</b><small>Prototype siap</small></span>
            <span data-ready="true"><FiCheck /><b>Invoice & payment receipt</b><small>Prototype siap</small></span>
            <span><FiClock /><b>Bank reconciliation</b><small>Tahap berikutnya</small></span>
          </div>
        </section>
      </div>
    </> : null}

    {section === 'transactions' ? <div className={styles.columns}>
      <section className={styles.panel}>
        <header><div><small>TRANSACTION → POSTED</small><h2>Posting jurnal rutin</h2><p>Debit dan kredit harus sama. Preview ini memakai akun, proyek, client, dan service line sebagai dimensi laporan.</p></div></header>
        {canManage ? <form onSubmit={post} className={styles.form}>
          <div className={styles.topFields}><label>Tanggal<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label className={styles.description}>Keterangan<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} required /></label></div>
          <div className={styles.linesHeading}><strong>Journal preview</strong><button type="button" onClick={() => setLines((current) => [...current, emptyLine()])}><FiPlus /> Tambah baris</button></div>
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
        <header><div><small>GENERAL LEDGER</small><h2>Jurnal terbaru</h2><p>100 entri terbaru dengan jejak baris debit dan kredit.</p></div></header>
        {journals.length ? <div className={styles.journalList}>{journals.map((entry) => <article key={entry.id}><div><strong>{entry.description}</strong><small>{entry.entry_date} · {entry.status}</small>{entry.finance_next_journal_lines.map((line) => <p key={line.line_number}>{line.coa_code} {line.description || ''} · D {money(Number(line.debit))} / K {money(Number(line.credit))}</p>)}</div><b>{money(entry.finance_next_journal_lines.reduce((sum, line) => sum + Number(line.debit), 0))}</b></article>)}</div> : <p className={styles.empty}>Belum ada jurnal di pilot. Finance lama tetap dapat dipakai.</p>}
      </section>
    </div> : null}

    {section === 'revenue' ? <>
      <section className={styles.revenueMetrics}>
        <article><small>Billed</small><strong>{money(billedValue)}</strong><span>Invoice yang sudah diterbitkan</span></article>
        <article><small>Collected</small><strong>{money(collectedValue)}</strong><span>Pembayaran yang sudah diterima</span></article>
        <article><small>Outstanding AR</small><strong>{money(outstandingValue)}</strong><span>Saldo invoice yang belum dibayar</span></article>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel}><header><div><small>INVOICE DRAFT</small><h2>Buat invoice pilot</h2><p>Draft belum memengaruhi ledger. Jurnal AR–Revenue baru terbentuk saat invoice diterbitkan.</p></div></header>
          {canManage ? <form className={styles.form} onSubmit={saveInvoice}>
            <div className={styles.topFields}><label>Tanggal invoice<input type="date" value={invoiceForm.invoiceDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoiceDate: event.target.value })} required /></label><label>Jatuh tempo<input type="date" value={invoiceForm.dueDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, dueDate: event.target.value })} /></label></div>
            <div className={styles.topFields}><label>Client<input value={invoiceForm.client} onChange={(event) => setInvoiceForm({ ...invoiceForm, client: event.target.value })} required /></label><label>Service line<select value={invoiceForm.serviceLineKey} onChange={(event) => setInvoiceForm({ ...invoiceForm, serviceLineKey: event.target.value })} required><option value="">Pilih service line</option>{services.map((item) => <option key={item.service_line_key} value={item.service_line_key}>{item.label}</option>)}</select></label></div>
            <label>Project<select value={invoiceForm.projectId} onChange={(event) => setInvoiceForm({ ...invoiceForm, projectId: event.target.value })}><option value="">Tanpa project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.project_code} · {project.name}</option>)}</select></label>
            <label>Alamat client<textarea value={invoiceForm.clientAddress} onChange={(event) => setInvoiceForm({ ...invoiceForm, clientAddress: event.target.value })} /></label>
            <label>Item / milestone<input value={invoiceForm.itemDescription} onChange={(event) => setInvoiceForm({ ...invoiceForm, itemDescription: event.target.value })} required /></label>
            <div className={styles.topFields}><label>Jumlah<input type="number" min="0.0001" step="0.0001" value={invoiceForm.quantity} onChange={(event) => setInvoiceForm({ ...invoiceForm, quantity: event.target.value })} required /></label><label>Harga satuan<input type="number" min="0" step="0.01" value={invoiceForm.unitPrice} onChange={(event) => setInvoiceForm({ ...invoiceForm, unitPrice: event.target.value })} required /></label></div>
            <div className={styles.chargeGrid}><label>Diskon<input type="number" min="0" value={invoiceForm.discount} onChange={(event) => setInvoiceForm({ ...invoiceForm, discount: event.target.value })} /></label><label>Pajak<input type="number" min="0" value={invoiceForm.tax} onChange={(event) => setInvoiceForm({ ...invoiceForm, tax: event.target.value })} /></label><label>Fee management<input type="number" min="0" value={invoiceForm.managementFee} onChange={(event) => setInvoiceForm({ ...invoiceForm, managementFee: event.target.value })} /></label><label>Biaya lain<input type="number" min="0" value={invoiceForm.otherFees} onChange={(event) => setInvoiceForm({ ...invoiceForm, otherFees: event.target.value })} /></label></div>
            <label>Skema termin<select value={invoiceForm.installmentScheme} onChange={(event) => setInvoiceForm({ ...invoiceForm, installmentScheme: event.target.value })}><option value="full">Pembayaran penuh</option><option value="50-50">50% / 50%</option><option value="50-25-25">50% / 25% / 25%</option><option value="custom">Custom</option></select></label>
            {invoiceForm.installmentScheme === 'custom' ? <label>Persentase custom, pisahkan koma<input placeholder="contoh: 40,30,30" value={invoiceForm.customPercentages} onChange={(event) => setInvoiceForm({ ...invoiceForm, customPercentages: event.target.value })} required /></label> : null}
            <label>Catatan<textarea value={invoiceForm.notes} onChange={(event) => setInvoiceForm({ ...invoiceForm, notes: event.target.value })} /></label>
            <button className={styles.primary} disabled={saving}><FiFileText /> {saving ? 'Menyimpan…' : 'Simpan draft invoice'}</button>
          </form> : <p className={styles.muted}>Izin Finance Pilot kelola dibutuhkan untuk membuat invoice.</p>}
        </section>
        <section className={styles.panel}><header><div><small>INVOICE REGISTER</small><h2>Invoice dan collection</h2><p>Draft dapat diperiksa sebelum issue. Payment receipt mengurangi AR tanpa menambah revenue.</p></div></header>
          {invoices.length ? <div className={styles.invoiceList}>{invoices.map((invoice) => <article key={invoice.id}>
            <div className={styles.invoiceHead}><span><strong>{invoice.invoice_number}</strong><small>{invoice.client} · jatuh tempo {invoice.due_date}</small></span><b data-status={invoice.status}>{invoice.status.replaceAll('_', ' ')}</b></div>
            <div className={styles.invoiceAmounts}><span>Total <b>{money(Number(invoice.total))}</b></span><span>Terbayar <b>{money(Number(invoice.paid))}</b></span><span>Outstanding <b>{money(Number(invoice.balance))}</b></span></div>
            <p>{invoice.finance_next_invoice_items.map((item) => item.description).join(', ')} · {invoice.installment_scheme}</p>
            <div className={styles.invoiceActions}>{canManage && invoice.status === 'draft' ? <button onClick={() => void issueInvoice(invoice)} disabled={saving}><FiSend /> Terbitkan invoice</button> : null}{canManage && ['issued', 'partially_paid', 'overdue'].includes(invoice.status) ? <button onClick={() => prepareReceipt(invoice)}><FiDollarSign /> Catat pembayaran</button> : null}</div>
          </article>)}</div> : <p className={styles.empty}>Belum ada invoice pada Finance Pilot.</p>}
        </section>
      </div>
      {receiptInvoiceId ? <section className={styles.receiptPanel}><header><div><small>PAYMENT RECEIPT</small><h2>Catat penerimaan pembayaran</h2><p>{invoices.find((item) => item.id === receiptInvoiceId)?.invoice_number} · outstanding {money(Number(invoices.find((item) => item.id === receiptInvoiceId)?.balance ?? 0))}</p></div><button onClick={() => setReceiptInvoiceId('')}>Batal</button></header>
        <form className={styles.receiptForm} onSubmit={recordReceipt}><label>Tanggal<input type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} required /></label><label>Nominal<input type="number" min="1" max={Number(invoices.find((item) => item.id === receiptInvoiceId)?.balance ?? 0)} value={receiptAmount} onChange={(event) => setReceiptAmount(event.target.value)} required /></label><label>Akun penerimaan<select value={receiptAccount} onChange={(event) => setReceiptAccount(event.target.value)} required>{accounts.filter((item) => item.account_class === 'Aset' && item.code !== '2000').map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label><label>Referensi pembayaran<input value={receiptReference} onChange={(event) => setReceiptReference(event.target.value)} /></label><button className={styles.primary} disabled={saving}><FiCheck /> {saving ? 'Mencatat…' : 'Simpan payment receipt'}</button></form>
      </section> : null}
    </> : null}

    {section === 'periods' ? <div className={styles.columns}>
      <section className={styles.panel}><header><div><small>MONTH-END CONTROL</small><h2>Ajukan penutupan periode</h2><p>Finance menyiapkan permintaan. Approver menyetujui atau menolak; pemohon tidak dapat menyetujui permintaannya sendiri.</p></div></header>
        {canManage ? <form className={styles.form} onSubmit={requestPeriod}><label>Bulan<input type="month" value={periodDate.slice(0, 7)} onChange={(event) => setPeriodDate(`${event.target.value}-01`)} required /></label><label>Alasan<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={4} required /></label><button className={styles.primary} disabled={saving}><FiClock /> Ajukan penutupan</button></form> : <p className={styles.muted}>Izin Finance Pilot kelola dibutuhkan untuk mengajukan penutupan.</p>}
      </section>
      <section className={styles.panel}><header><div><small>APPROVAL INBOX</small><h2>Status periode</h2><p>Periode tanpa record masih terbuka. Periode tertutup tidak menerima posting.</p></div></header>
        {periods.length ? <div className={styles.journalList}>{periods.map((period) => <article key={period.period_month}><div><strong>{new Date(`${period.period_month}T12:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</strong><small>{period.status.replaceAll('_', ' ')}{period.review_note ? ` · ${period.review_note}` : ''}</small></div>
          {canApprove && ['close_requested', 'reopen_requested'].includes(period.status) ? <span className={styles.actions}><button onClick={() => void decidePeriod(period, 'approve')}><FiCheck /> Setujui</button><button onClick={() => void decidePeriod(period, 'reject')}>Tolak</button></span> : canManage && period.status === 'closed' ? <span className={styles.actions}><button onClick={() => void requestReopen(period)}>Minta buka kembali</button></span> : null}
        </article>)}</div> : <p className={styles.empty}>Belum ada permintaan perubahan periode.</p>}
      </section>
    </div> : null}

    {!['overview', 'transactions', 'revenue', 'periods'].includes(section) ? <section className={styles.roadmap}>
      <span className={styles.roadmapIcon}>{(() => { const ItemIcon = navigation.find((item) => item.key === section)?.icon ?? FiGrid; return <ItemIcon />; })()}</span>
      <small>PRD MODULE · BELUM DIAKTIFKAN</small><h2>{navigation.find((item) => item.key === section)?.label}</h2>
      <p>Struktur modul ini sudah disiapkan, tetapi belum menampilkan angka atau formulir semu. Implementasinya akan memakai source of truth, approval, audit trail, dan drill-down sesuai PRD.</p>
      <div><button onClick={() => openSection('overview')}>Kembali ke overview</button>{section === 'settings' ? <button onClick={() => openSection('periods')}>Buka kontrol periode</button> : null}</div>
    </section> : null}

    <footer className={styles.footer}>Finance Pilot · Frontend preview only · <button onClick={() => openSection('periods')}>Kontrol periode</button> · <Link href="/ruang-kawan/finance/">Finance lama</Link></footer>
  </main>;
}
