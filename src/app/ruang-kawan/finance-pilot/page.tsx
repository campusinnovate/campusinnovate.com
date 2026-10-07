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
type Project = { id: string; project_code: string; name: string; client_name: string | null; service_line_key: string; contract_value: number; recognized_revenue: number; billed_amount: number; cash_collected: number; budgeted_hpp: number; committed_cost: number; actual_hpp: number; status: string };
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
type PeriodView = 'MTD' | 'QTD' | 'YTD' | 'Custom';
type FundBucket = { key: string; label: string; amount: number; restricted: boolean };
type TargetPlan = { fiscalYear: number; annualTarget: number; approvedTarget: number; forecast: number; status: 'draft' | 'approval_requested' | 'approved'; version: number };

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
  { service_line_key: 'event', label: 'Event Management' },
  { service_line_key: 'digital', label: 'Digital System' },
  { service_line_key: 'coreva', label: 'COREVA' },
  { service_line_key: 'program', label: 'Program Development' },
  { service_line_key: 'stripmate', label: 'Stripmate' },
  { service_line_key: 'creative', label: 'Creative & Media Production' },
];
const demoProjects: Project[] = [
  { id: 'project-lidar', project_code: 'PRJ-2609-014', name: 'LiDAR Batch 3', client_name: 'PT Geo Investama Mandiri', service_line_key: 'event', contract_value: 36792000, recognized_revenue: 14716800, billed_amount: 14716800, cash_collected: 7358400, budgeted_hpp: 21500000, committed_cost: 3100000, actual_hpp: 8420000, status: 'active' },
  { id: 'project-ylos', project_code: 'PRJ-2608-009', name: 'Youth Leader Organization Summit', client_name: 'YLOS 2026', service_line_key: 'digital', contract_value: 9935000, recognized_revenue: 0, billed_amount: 0, cash_collected: 0, budgeted_hpp: 5600000, committed_cost: 1200000, actual_hpp: 0, status: 'preparation' },
  { id: 'project-wunproq', project_code: 'PRJ-2607-004', name: 'WUNPROQ 2026', client_name: 'World University Network', service_line_key: 'creative', contract_value: 28500000, recognized_revenue: 28500000, billed_amount: 28500000, cash_collected: 28500000, budgeted_hpp: 17000000, committed_cost: 0, actual_hpp: 15800000, status: 'closure_review' },
];
const demoFunds: FundBucket[] = [
  { key: 'project', label: 'Project Funds', amount: 9200000, restricted: true },
  { key: 'tax', label: 'Tax Reserve', amount: 2750000, restricted: true },
  { key: 'operating', label: 'Next Month Operating Reserve', amount: 11800000, restricted: true },
  { key: 'emergency', label: 'Emergency Reserve', amount: 5000000, restricted: true },
  { key: 'distribution', label: 'Owner Distribution Payable', amount: 0, restricted: true },
];
const monthlyTarget = [12000000, 14000000, 15000000, 16000000, 18000000, 20000000, 22000000, 22000000, 24000000, 26000000, 28000000, 33000000];
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

const navigation: { key: Section; label: string; icon: typeof FiGrid }[] = [
  { key: 'overview', label: 'Overview', icon: FiGrid },
  { key: 'transactions', label: 'Transactions', icon: FiActivity },
  { key: 'revenue', label: 'Revenue', icon: FiTrendingUp },
  { key: 'projects', label: 'Projects', icon: FiBriefcase },
  { key: 'cash', label: 'Cash & Funds', icon: FiDollarSign },
  { key: 'reports', label: 'Reports', icon: FiBarChart2 },
  { key: 'planning', label: 'Planning', icon: FiFileText },
  { key: 'settings', label: 'Settings', icon: FiSettings },
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
  const [periodView, setPeriodView] = useState<PeriodView>('YTD');
  const [comparison, setComparison] = useState('Previous Year');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [reportView, setReportView] = useState('income');
  const [funds, setFunds] = useState<FundBucket[]>(demoFunds);
  const [reconciledCash, setReconciledCash] = useState(42750000);
  const [bankStatementBalance, setBankStatementBalance] = useState('42750000');
  const [targetPlan, setTargetPlan] = useState<TargetPlan>({ fiscalYear: 2026, annualTarget: 250000000, approvedTarget: 250000000, forecast: 238000000, status: 'approved', version: 1 });
  const [targetInput, setTargetInput] = useState('250000000');
  const [approvalThreshold, setApprovalThreshold] = useState('10000000');
  const [fiscalStart, setFiscalStart] = useState('01');

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
  const filteredProjects = projects.filter((project) => (serviceFilter === 'all' || project.service_line_key === serviceFilter) && (projectFilter === 'all' || project.id === projectFilter));
  const recognizedRevenue = filteredProjects.reduce((sum, project) => sum + project.recognized_revenue, 0);
  const actualHpp = filteredProjects.reduce((sum, project) => sum + project.actual_hpp, 0);
  const grossProfit = recognizedRevenue - actualHpp;
  const opex = 503000 + 751200 + 1784703;
  const operatingProfit = grossProfit - opex;
  const restrictedCash = funds.filter((fund) => fund.restricted).reduce((sum, fund) => sum + fund.amount, 0);
  const payablesAndAccruals = 3100000;
  const freeCash = reconciledCash - restrictedCash - payablesAndAccruals;
  const operatingReserve = funds.find((fund) => fund.key === 'operating')?.amount ?? 0;
  const operatingReserveTarget = 15000000;
  const reserveCoverage = operatingReserveTarget ? operatingReserve / operatingReserveTarget * 100 : 0;
  const targetActual = demoProjects.reduce((sum, project) => sum + project.recognized_revenue, 0);
  const annualGap = Math.max(targetPlan.approvedTarget - targetActual, 0);
  const requiredMonthlyPace = annualGap / 3;
  const targetAchievement = targetPlan.approvedTarget ? targetActual / targetPlan.approvedTarget * 100 : 0;
  const bankDifference = Number(bankStatementBalance || 0) - reconciledCash;

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
    setFunds(demoFunds);
    setReconciledCash(42750000);
    setBankStatementBalance('42750000');
    setTargetPlan({ fiscalYear: 2026, annualTarget: 250000000, approvedTarget: 250000000, forecast: 238000000, status: 'approved', version: 1 });
    setTargetInput('250000000');
    setApprovalThreshold('10000000');
    setFiscalStart('01');
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

  function saveFund(key: string, value: string) {
    setFunds((current) => current.map((fund) => fund.key === key ? { ...fund, amount: Math.max(Number(value) || 0, 0) } : fund));
    setNotice('Alokasi dana diperbarui pada simulasi frontend. Free Cash dihitung ulang otomatis.');
  }

  function reconcileBank() {
    if (bankDifference !== 0) { setError(`Selisih rekonsiliasi masih ${money(bankDifference)}. Tambahkan reconciling item sebelum finalisasi.`); return; }
    setError(''); setNotice('Rekonsiliasi bank seimbang Rp0 pada simulasi frontend.');
  }

  function submitTarget() {
    const value = Number(targetInput);
    if (value <= 0) { setError('Target tahunan harus lebih besar dari nol.'); return; }
    setError('');
    setTargetPlan((current) => ({ ...current, annualTarget: value, status: 'approval_requested', version: current.version + 1 }));
    setNotice('Versi target baru dikirim COO ke antrean approval CEO.');
  }

  function decideTarget(approve: boolean) {
    setTargetPlan((current) => ({ ...current, approvedTarget: approve ? current.annualTarget : current.approvedTarget, status: approve ? 'approved' : 'draft' }));
    setTargetInput(String(approve ? Number(targetInput) : targetPlan.approvedTarget));
    setNotice(approve ? 'Target versi terbaru disetujui pada simulasi frontend.' : 'Perubahan target ditolak dan dikembalikan ke draft.');
  }

  function previewExport(label: string) {
    setNotice(`${label} disiapkan dengan filter ${periodView}, ${comparison}. Ekspor file akan aktif setelah backend report terhubung.`);
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><Link href="/ruang-kawan/finance/"><FiArrowLeft /> Finance lama</Link><small>FINANCE WORKSPACE · PILOT</small><h1>Finance Pilot</h1><p>Satu alur dari transaksi, approval, posting, rekonsiliasi, sampai laporan.</p></div>
      <div className={styles.headerActions}>
        <label className={styles.rolePreview}><FiShield /><span>Preview sebagai</span><select value={previewRole} onChange={(event) => setPreviewRole(event.target.value as PreviewRole)}><option value="operator">COO / Finance Owner</option><option value="approver">CEO / Approver</option><option value="viewer">Viewer</option></select></label>
        <button onClick={resetDemo}><FiRefreshCw /> Reset demo</button>
      </div>
    </header>
    <div className={styles.preservation}><strong>Preview frontend lokal</strong><span>Semua angka dan aksi pada halaman ini adalah data simulasi. Belum tersambung ke Supabase dan tidak mengubah Finance produksi.</span></div>
    {error ? <p className={styles.alert} role="alert">{error}</p> : null}{notice ? <p className={styles.notice} role="status">{notice}</p> : null}

    <nav className={styles.workspaceNav} aria-label="Finance Pilot">
      {navigation.map((item) => <button key={item.key} data-active={section === item.key} onClick={() => openSection(item.key)}><item.icon /><span>{item.label}</span></button>)}
    </nav>

    <section className={styles.globalControls} aria-label="Filter laporan global">
      <label>Periode<select value={periodView} onChange={(event) => setPeriodView(event.target.value as PeriodView)}><option>MTD</option><option>QTD</option><option>YTD</option><option>Custom</option></select></label>
      <label>Perbandingan<select value={comparison} onChange={(event) => setComparison(event.target.value)}><option>Previous Period</option><option>Previous Year</option><option>Budget</option><option>Target</option></select></label>
      <label>Service line<select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}><option value="all">Semua service line</option>{services.map((service) => <option key={service.service_line_key} value={service.service_line_key}>{service.label}</option>)}</select></label>
      <label>Project<select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">Semua project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.project_code} · {project.name}</option>)}</select></label>
      <div className={styles.dataState}><b>Accrual</b><span>{periodView} · {comparison}</span><small>Closed through Aug 2026 · Reconciled · updated 07 Oct 2026 09:42 WIB</small></div>
    </section>

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
            <span data-ready={bankDifference === 0}><FiCheck /><b>Bank reconciliation</b><small>{bankDifference === 0 ? 'Seimbang · selisih Rp0' : `Perlu ditinjau · ${money(bankDifference)}`}</small></span>
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

    {section === 'projects' ? <>
      <section className={styles.moduleHero}><div><small>PROJECT ACCOUNTING</small><h2>Profitabilitas dan kontrol biaya per proyek</h2><p>Contract value, revenue, billing, collection, budget, committed cost, dan actual HPP dipisahkan sesuai definisi PRD.</p></div><span>{filteredProjects.length} project · {periodView}</span></section>
      <section className={styles.metrics}>
        <article><small>Contract value</small><strong>{money(filteredProjects.reduce((sum, item) => sum + item.contract_value, 0))}</strong><span>Nilai kontrak disetujui</span></article>
        <article><small>Recognized revenue</small><strong>{money(recognizedRevenue)}</strong><span>Bukan nilai invoice atau kas</span></article>
        <article><small>Actual HPP</small><strong>{money(actualHpp)}</strong><span>Direct cost dengan Project ID</span></article>
        <article><small>Gross profit</small><strong>{money(grossProfit)}</strong><span>{recognizedRevenue ? (grossProfit / recognizedRevenue * 100).toFixed(1) : '0.0'}% gross margin</span></article>
      </section>
      <section className={styles.projectGrid}>{filteredProjects.map((project) => {
        const margin = project.recognized_revenue ? (project.recognized_revenue - project.actual_hpp) / project.recognized_revenue * 100 : 0;
        const budgetUse = project.budgeted_hpp ? (project.actual_hpp + project.committed_cost) / project.budgeted_hpp * 100 : 0;
        return <article key={project.id} className={styles.projectCard}>
          <header><div><small>{project.project_code} · {services.find((item) => item.service_line_key === project.service_line_key)?.label}</small><h3>{project.name}</h3><p>{project.client_name}</p></div><b data-status={budgetUse > 100 ? 'risk' : project.status}>{project.status.replaceAll('_', ' ')}</b></header>
          <div className={styles.projectNumbers}><span>Contract<b>{money(project.contract_value)}</b></span><span>Recognized<b>{money(project.recognized_revenue)}</b></span><span>Billed<b>{money(project.billed_amount)}</b></span><span>Collected<b>{money(project.cash_collected)}</b></span><span>Budgeted HPP<b>{money(project.budgeted_hpp)}</b></span><span>Committed<b>{money(project.committed_cost)}</b></span><span>Actual HPP<b>{money(project.actual_hpp)}</b></span><span>Gross margin<b>{margin.toFixed(1)}%</b></span></div>
          <div className={styles.progress}><span style={{ width: `${Math.min(budgetUse, 100)}%` }} /><b>{budgetUse.toFixed(1)}% budget terpakai</b></div>
          <footer><button onClick={() => setNotice(`Drill-down ${project.name}: journal, invoice, receipt, dan source document akan mempertahankan filter aktif.`)}>Drill down sumber</button>{canManage ? <button onClick={() => setNotice(`${project.name} dikirim untuk review penutupan finansial pada mode preview.`)}>Ajukan closure</button> : null}</footer>
        </article>;
      })}</section>
    </> : null}

    {section === 'cash' ? <>
      <section className={styles.moduleHero}><div><small>CASH & FUND CONTROL</small><h2>Kas bank tidak sama dengan kas yang aman dipakai</h2><p>Free Cash mengikuti formula PRD setelah restricted funds, payables, reserve, dan distribusi yang sudah disetujui.</p></div><span>Asia/Jakarta · {periodView}</span></section>
      <section className={styles.metrics}>
        <article><small>Reconciled cash</small><strong>{money(reconciledCash)}</strong><span>Book cash setelah rekonsiliasi</span></article>
        <article><small>Restricted funds</small><strong>{money(restrictedCash)}</strong><span>Tidak termasuk Free Cash</span></article>
        <article><small>Payables & accruals</small><strong>{money(payablesAndAccruals)}</strong><span>Komitmen yang belum dibayar</span></article>
        <article><small>Free Cash</small><strong className={freeCash < 0 ? styles.negative : ''}>{money(freeCash)}</strong><span>Reconciled cash dikurangi seluruh pembatasan</span></article>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel}><header><div><small>FUND BUCKETS</small><h2>Alokasi dana terikat</h2><p>Perubahan COO memperbarui Free Cash, tetapi tidak mengubah saldo bank.</p></div></header>
          <div className={styles.fundList}>{funds.map((fund) => <label key={fund.key}><span><b>{fund.label}</b><small>{fund.restricted ? 'Restricted · tidak masuk Free Cash' : 'Unrestricted'}</small></span><input type="number" min="0" value={fund.amount} disabled={!canManage} onChange={(event) => saveFund(fund.key, event.target.value)} /></label>)}</div>
          <div className={styles.formula}>Free Cash = {money(reconciledCash)} − {money(restrictedCash)} − {money(payablesAndAccruals)} = <b>{money(freeCash)}</b></div>
        </section>
        <section className={styles.stack}>
          <section className={styles.panel}><header><div><small>BANK RECONCILIATION</small><h2>Mandiri Operasional</h2><p>Target selisih tidak terjelaskan adalah Rp0.</p></div></header>
            <div className={styles.reconciliation}><span>Book balance<b>{money(reconciledCash)}</b></span><label>Bank statement<input type="number" value={bankStatementBalance} disabled={!canManage} onChange={(event) => setBankStatementBalance(event.target.value)} /></label><span>Difference<b className={bankDifference ? styles.negative : ''}>{money(bankDifference)}</b></span></div>
            {canManage ? <button className={styles.primary} onClick={reconcileBank}><FiCheck /> Finalisasi rekonsiliasi</button> : <p className={styles.muted}>CEO dan viewer hanya melihat status rekonsiliasi.</p>}
          </section>
          <section className={styles.panel}><header><div><small>OPERATING RESERVE</small><h2>Coverage bulan berikutnya</h2><p>Distribusi laba diblokir sampai coverage mencapai 100%.</p></div></header>
            <div className={styles.coverage}><strong>{reserveCoverage.toFixed(0)}%</strong><span data-status={reserveCoverage >= 100 ? 'funded' : reserveCoverage >= 75 ? 'attention' : 'critical'}>{reserveCoverage >= 100 ? 'Funded' : reserveCoverage >= 75 ? 'Attention' : 'Critical'}</span><small>{money(operatingReserve)} dari target {money(operatingReserveTarget)}</small></div>
          </section>
        </section>
      </div>
    </> : null}

    {section === 'reports' ? <>
      <section className={styles.moduleHero}><div><small>ACCOUNTING REPORTS</small><h2>Laporan formal dari jurnal posted</h2><p>Dashboard manajemen tidak menggantikan laporan akuntansi. Nilai memakai filter global dan dapat ditelusuri ke General Ledger.</p></div><button onClick={() => previewExport('Ekspor laporan')}>Export XLSX / CSV / PDF</button></section>
      <div className={styles.reportTabs}>{[
        ['income', 'Income Statement'], ['position', 'Financial Position'], ['cashflow', 'Cash Flow'], ['equity', 'Changes in Equity'], ['trial', 'Trial Balance'], ['aging', 'AR / AP Aging'],
      ].map(([key, label]) => <button key={key} data-active={reportView === key} onClick={() => setReportView(key)}>{label}</button>)}</div>
      <div className={styles.columns}>
        <section className={styles.panel}><header><div><small>{periodView} · {comparison}</small><h2>{reportView === 'income' ? 'Laporan Laba Rugi' : reportView === 'position' ? 'Laporan Posisi Keuangan' : reportView === 'cashflow' ? 'Laporan Arus Kas' : reportView === 'equity' ? 'Laporan Perubahan Ekuitas' : reportView === 'trial' ? 'Neraca Saldo' : 'Aging Receivables & Payables'}</h2><p>Accrual basis · posted entries only.</p></div></header>
          <div className={styles.statement}>{(reportView === 'income' ? [
            ['Recognized Revenue', recognizedRevenue], ['Direct Project Cost / HPP', -actualHpp], ['Gross Profit', grossProfit], ['Operating Expense', -opex], ['Operating Profit', operatingProfit],
          ] : reportView === 'position' ? [
            ['Cash and Bank', reconciledCash], ['Trade Receivables', outstandingValue], ['Total Assets', reconciledCash + outstandingValue], ['Payables and Accruals', -payablesAndAccruals], ['Equity', -(reconciledCash + outstandingValue - payablesAndAccruals)],
          ] : reportView === 'cashflow' ? [
            ['Operating activities', collectedValue - actualHpp - opex], ['Investing activities', 0], ['Financing activities', 0], ['Net change in cash', collectedValue - actualHpp - opex], ['Closing cash', reconciledCash],
          ] : reportView === 'equity' ? [
            ['Opening equity', 30000000], ['Current period profit', operatingProfit], ['Owner distribution', 0], ['Closing equity', 30000000 + operatingProfit],
          ] : reportView === 'trial' ? [
            ['1001 · Bank Mandiri Operasional', reconciledCash], ['1101 · Piutang Usaha', outstandingValue], ['4001 · Pendapatan Jasa', -recognizedRevenue], ['5101 · Beban Langsung Proyek', actualHpp], ['6101 · Beban Operasional', opex],
          ] : [
            ['AR Current', outstandingValue], ['AR 1–30 days', 0], ['AR 31–60 days', 0], ['AR > 60 days', 0], ['AP outstanding', payablesAndAccruals],
          ]).map(([label, value], index) => <button key={String(label)} data-total={index >= 2 && reportView !== 'trial'} onClick={() => setNotice(`Drill-down ${label} mempertahankan filter ${periodView} dan menuju jurnal sumber.`)}><span>{label}</span><b className={Number(value) < 0 ? styles.negative : ''}>{money(Number(value))}</b></button>)}</div>
        </section>
        <section className={styles.panel}><header><div><small>CONTROL & TRACEABILITY</small><h2>Status laporan</h2><p>Setiap kontrol menandai apakah laporan siap dipakai.</p></div></header>
          <div className={styles.controlList}><span data-ready="true"><FiCheck /><b>Jurnal posted seimbang</b><small>Rp0 difference</small></span><span data-ready="true"><FiCheck /><b>Bank reconciled</b><small>{money(bankDifference)} difference</small></span><span data-ready="true"><FiCheck /><b>Periode aktif</b><small>{periodView} · closing Aug 2026</small></span><span data-ready="true"><FiCheck /><b>Source drill-down</b><small>Journal, invoice, receipt, project</small></span></div>
          <button className={styles.secondary} onClick={() => openSection('transactions')}>Buka General Ledger <FiChevronRight /></button>
        </section>
      </div>
    </> : null}

    {section === 'planning' ? <>
      <section className={styles.moduleHero}><div><small>BUDGET · TARGET · FORECAST</small><h2>Rencana tahunan dengan versi dan approval</h2><p>Actual memakai recognized revenue. Cash collected tetap menjadi indikator pendamping dan tidak menggantikan pencapaian target.</p></div><span>FY {targetPlan.fiscalYear} · v{targetPlan.version}</span></section>
      <section className={styles.metrics}>
        <article><small>Approved annual target</small><strong>{money(targetPlan.approvedTarget)}</strong><span>Original target tetap tersimpan</span></article>
        <article><small>YTD actual</small><strong>{money(targetActual)}</strong><span>{targetAchievement.toFixed(1)}% achievement</span></article>
        <article><small>Annual gap</small><strong>{money(annualGap)}</strong><span>Required pace {money(requiredMonthlyPace)} / bulan</span></article>
        <article><small>Forecast</small><strong>{money(targetPlan.forecast)}</strong><span>{targetPlan.approvedTarget ? (targetPlan.forecast / targetPlan.approvedTarget * 100).toFixed(1) : '0'}% forecast achievement</span></article>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel}><header><div><small>TARGET GOVERNANCE</small><h2>Annual Revenue Target</h2><p>COO menyiapkan perubahan. CEO menyetujui setiap versi baru.</p></div></header>
          <div className={styles.targetStatus}><b data-status={targetPlan.status}>{targetPlan.status.replaceAll('_', ' ')}</b><span>Original {money(250000000)} · Latest approved {money(targetPlan.approvedTarget)}</span></div>
          {canManage ? <div className={styles.form}><label>Target tahunan<input type="number" min="1" value={targetInput} onChange={(event) => setTargetInput(event.target.value)} /></label><button className={styles.primary} onClick={submitTarget}>Kirim versi untuk approval</button></div> : null}
          {canApprove && targetPlan.status === 'approval_requested' ? <div className={styles.approvalBox}><p>Perubahan target: {money(targetPlan.approvedTarget)} → {money(targetPlan.annualTarget)}</p><button onClick={() => decideTarget(true)}><FiCheck /> Setujui</button><button onClick={() => decideTarget(false)}>Tolak</button></div> : null}
          {!canManage && !canApprove ? <p className={styles.muted}>Viewer hanya dapat melihat target yang telah disetujui.</p> : null}
        </section>
        <section className={styles.panel}><header><div><small>MONTHLY ALLOCATION</small><h2>Actual vs target bulanan</h2><p>Alokasi harus merekonsiliasi ke annual target.</p></div></header>
          <div className={styles.monthBars}>{monthlyTarget.map((target, index) => { const actual = index < 9 ? Math.round(target * (.72 + index * .035)) : 0; return <div key={index}><span>{new Date(2026, index, 1).toLocaleDateString('id-ID', { month: 'short' })}</span><i><em style={{ width: `${Math.min(actual / target * 100, 100)}%` }} /></i><b>{money(actual)} / {money(target)}</b></div>; })}</div>
        </section>
      </div>
    </> : null}

    {section === 'settings' ? <>
      <section className={styles.moduleHero}><div><small>CONTROLLED CONFIGURATION</small><h2>Master data dan aturan finance</h2><p>Pengaturan teknis tidak memberi hak approval. COO mengelola konfigurasi operasional; keputusan gated tetap milik CEO.</p></div><span>Audit trail aktif</span></section>
      <div className={styles.settingsGrid}>
        <section className={styles.panel}><header><div><small>CHART OF ACCOUNTS</small><h2>Akun pilot</h2><p>Kode, nama, dan klasifikasi laporan.</p></div></header><div className={styles.masterList}>{accounts.map((account) => <span key={account.code}><b>{account.code}</b><strong>{account.name}</strong><small>{account.account_class}</small></span>)}</div>{canManage ? <button className={styles.secondary} onClick={() => setNotice('Form tambah akun dibuka pada simulasi; posting tetap memerlukan mapping report.')}>Tambah akun</button> : null}</section>
        <section className={styles.panel}><header><div><small>SERVICE LINES</small><h2>Enam taxonomy resmi</h2><p>Revenue wajib memakai salah satu service line PRD.</p></div></header><div className={styles.masterList}>{services.map((service, index) => <span key={service.service_line_key}><b>{String(index + 1).padStart(2, '0')}</b><strong>{service.label}</strong><small>{service.service_line_key}</small></span>)}</div></section>
        <section className={styles.panel}><header><div><small>APPROVAL RULES</small><h2>Material transaction</h2><p>Transaksi di atas threshold memerlukan approval CEO.</p></div></header><div className={styles.form}><label>Threshold<input type="number" min="0" value={approvalThreshold} disabled={!canManage} onChange={(event) => setApprovalThreshold(event.target.value)} /></label><label>Approver<input value="CEO" disabled /></label>{canManage ? <button className={styles.primary} onClick={() => setNotice(`Threshold ${money(Number(approvalThreshold))} disimpan pada simulasi dan menunggu penerapan backend.`)}>Simpan aturan</button> : null}</div></section>
        <section className={styles.panel}><header><div><small>FISCAL PERIOD</small><h2>Kalender dan closing</h2><p>Posting ke periode tertutup memerlukan approved reopening.</p></div></header><div className={styles.form}><label>Awal tahun fiskal<select value={fiscalStart} disabled={!canManage} onChange={(event) => setFiscalStart(event.target.value)}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1).padStart(2, '0')}>{new Date(2026, index, 1).toLocaleDateString('id-ID', { month: 'long' })}</option>)}</select></label><button className={styles.secondary} onClick={() => openSection('periods')}>Kelola closing & reopening</button></div></section>
      </div>
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

    <footer className={styles.footer}>Finance Pilot · Frontend preview only · <button onClick={() => openSection('periods')}>Kontrol periode</button> · <Link href="/ruang-kawan/finance/">Finance lama</Link></footer>
  </main>;
}
