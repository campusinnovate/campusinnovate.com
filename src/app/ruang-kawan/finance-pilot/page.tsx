'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Snapshot, Payload, rpc, write, saveRequest, uploadEvidence, evidenceUrl, reportCsv, operationKey, writesEnabled } from '@/lib/finance-pilot/api';
import {
  FiActivity, FiArrowLeft, FiBarChart2, FiBriefcase, FiCheck, FiChevronRight,
  FiClock, FiDollarSign, FiFileText, FiGrid, FiPlus, FiRefreshCw, FiSend,
  FiSettings, FiShield, FiTrash2, FiTrendingUp,
} from 'react-icons/fi';
import styles from './finance-pilot.module.css';
import ScopedWorkspace from './scoped-workspace';

type Account = { code: string; name: string; account_class: string };
type ServiceLine = { service_line_key: string; label: string };
type Project = { id: string; project_code: string; name: string; client_name: string | null; service_line_key: string; contract_value: number; recognized_revenue: number; billed_amount: number; cash_collected: number; budgeted_hpp: number; committed_cost: number; actual_hpp: number; status: string; financially_closed_at?: string | null; delivery_confirmed_at?: string | null };
type Line = { coa_code: string; description: string; debit: string; credit: string; project_id: string; client: string; service_line_key: string };
type JournalLine = { project_id: string | null; line_number: number; coa_code: string; description: string; debit: number; credit: number; project_name: string | null; client: string | null; service_line_key: string | null };
type Journal = { source_type: string; reversal_of_id: string | null; id: string; entry_date: string; description: string; status: string; finance_next_journal_lines: JournalLine[] };
type Period = { period_month: string; status: string; requested_action: string | null; requested_by_membership_id: string | null; review_note: string | null };
type InvoiceItem = { id?: string; line_number?: number; description: string; quantity: number; unit_price: number; line_total?: number };
type Invoice = { pilot_evidence_path?: string; pilot_journal_id?: string; project_id?: string; id: string; invoice_number: string; invoice_date: string; due_date: string; client: string; project_name: string | null; service_line_key: string; status: string; subtotal: number; discount: number; tax: number; management_fee: number; other_fees: number; total: number; paid: number; balance: number; installment_scheme: string; payment_schedule: { number: number; label: string; percentage: number; amount: number }[]; finance_next_invoice_items: InvoiceItem[] };
type Receipt = { id: string; receipt_number: string; invoice_id: string; receipt_date: string; amount: number; deposit_coa_code: string; payment_reference: string | null };
type InvoiceForm = { invoiceDate: string; dueDate: string; client: string; clientAddress: string; projectId: string; serviceLineKey: string; itemDescription: string; quantity: string; unitPrice: string; discount: string; tax: string; managementFee: string; otherFees: string; installmentScheme: string; customPercentages: string; notes: string };
type Section = 'overview' | 'transactions' | 'revenue' | 'projects' | 'cash' | 'reports' | 'planning' | 'settings' | 'periods';
type Access = { membership_id: string; position: string; manage: boolean; approve: boolean };
type Options = { id: string; project_code: string; name: string; client_name: string | null; service_line_key: string | null; status: string };
type PeriodView = 'MTD' | 'QTD' | 'YTD' | 'Custom';
type FundBucket = { key: string; label: string; amount: number; restricted: boolean };
type TargetPlan = { fiscalYear: number; annualTarget: number; approvedTarget: number; forecast: number; status: 'draft' | 'approval_requested' | 'approved'; version: number };

const emptyLine = (): Line => ({ coa_code: '', description: '', debit: '', credit: '', project_id: '', client: '', service_line_key: '' });
const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);
const monthStart = (date: string) => date ? `${date.slice(0, 7)}-01` : '';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const emptyInvoice = (): InvoiceForm => ({ invoiceDate: today(), dueDate: '', client: '', clientAddress: '', projectId: '', serviceLineKey: '', itemDescription: '', quantity: '1', unitPrice: '', discount: '0', tax: '0', managementFee: '0', otherFees: '0', installmentScheme: 'full', customPercentages: '', notes: '' });

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
  const [scoped, setScoped] = useState(false);
  const [access, setAccess] = useState<Access | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [services, setServices] = useState<ServiceLine[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectOptions, setProjectOptions] = useState<Options[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
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
  const [receiptAccount, setReceiptAccount] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [periodView, setPeriodView] = useState<PeriodView>('MTD');
  const [comparison, setComparison] = useState('Previous Year');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [reportView, setReportView] = useState('income');
  const [bankStatementBalance, setBankStatementBalance] = useState('');
  const [targetInput, setTargetInput] = useState('');
  const [approvalThreshold, setApprovalThreshold] = useState('');
  const [fiscalStart, setFiscalStart] = useState('');
  const [asof, setAsof] = useState(today());
  const [customStart, setCustomStart] = useState(monthStart(today()));
  const [customEnd, setCustomEnd] = useState(today());
  const [clientFilter, setClientFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [evidencePath, setEvidencePath] = useState('');
  const [milestoneEvidence, setMilestoneEvidence] = useState('');
  const [businessEvent, setBusinessEvent] = useState('manual');
  const [transactionReference, setTransactionReference] = useState('');
  const [eventAmount, setEventAmount] = useState('');
  const [expenseAccount, setExpenseAccount] = useState('');
  const [settlementAccount, setSettlementAccount] = useState('');
  const [eventProject, setEventProject] = useState('');
  const [eventClient, setEventClient] = useState('');
  const [eventDueDate, setEventDueDate] = useState('');
  const [vendorBillId, setVendorBillId] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetClass, setAssetClass] = useState('');
  const [usefulLife, setUsefulLife] = useState('');
  const [custodian, setCustodian] = useState('');
  const [duplicateReason, setDuplicateReason] = useState('');
  const [claimId, setClaimId] = useState<string | null>(null);
  const [forecastInput, setForecastInput] = useState('');
  const [allocations, setAllocations] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fundInputs, setFundInputs] = useState<Record<string, string>>({});
  const [reserveTargetInput, setReserveTargetInput] = useState('');
  const [policyReason, setPolicyReason] = useState('');
  const [reportAccount, setReportAccount] = useState<string | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    const sequence = ++generation.current;
    setLoadState('loading');
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) { window.location.replace('/ruang-kawan/'); return; }
      const identity = await rpc<{ scoped: boolean }>('finance_pilot_identity');
      if (identity.scoped) { setScoped(true); setLoadState('ready'); return; }
      const rights = await rpc<Access>('finance_pilot_access');
      const result = await rpc<Snapshot>('finance_pilot_snapshot', {
        p_view: periodView, p_asof: asof, p_start: customStart, p_end: customEnd,
        p_service: serviceFilter === 'all' ? null : serviceFilter,
        p_project: projectFilter === 'all' ? null : projectFilter,
        p_client: clientFilter.trim() || null, p_compare: comparison, p_payment: paymentFilter || null,
      });
      if (sequence !== generation.current) return;
      setAccess(rights); setSnapshot(result);
      setAccounts(result.accounts as Account[]); setServices(result.services as ServiceLine[]);
      setProjectOptions(result.project_options as Options[]); setProjects(result.projects as Project[]);
      setJournals(result.journals as Journal[]); setPeriods(result.periods as Period[]);
      const persisted = result.invoices as Invoice[];
      const drafts: Invoice[] = result.requests.filter(r => r.kind === 'invoice' && r.state === 'draft').map(r => {
        const f = r.payload;
        const subtotal = Number(f.quantity) * Number(f.unit_price);
        const total = subtotal - Number(f.discount) + Number(f.tax) + Number(f.management_fee) + Number(f.other_fees);
        return { id: r.id, invoice_number: `DRAFT-${r.id.slice(0, 8)}`, invoice_date: String(f.date), due_date: String(f.due_date), client: String(f.client), project_name: (result.project_options as Options[]).find(p => p.id === f.project_id)?.name ?? null, service_line_key: String(f.service_line_key), status: 'draft', subtotal, discount: Number(f.discount), tax: Number(f.tax), management_fee: Number(f.management_fee), other_fees: Number(f.other_fees), total, paid: 0, balance: total, installment_scheme: String(f.installment_scheme), payment_schedule: [], finance_next_invoice_items: [{ description: String(f.item_description), quantity: Number(f.quantity), unit_price: Number(f.unit_price) }] };
      });
      setInvoices([...drafts, ...persisted]); setReceipts(result.receipts as Receipt[]);
      setMapping(result.policy?.accounts ?? {});
      setApprovalThreshold(result.policy ? String(result.policy.approval_threshold) : '1000000');
      setFiscalStart(result.policy ? String(result.policy.fiscal_start) : '1');
      setReceiptAccount(result.policy?.accounts.cash ?? '');
      setFundInputs(Object.fromEntries(result.cash.buckets.map(b => [b.key, String(b.amount)])));
      setReserveTargetInput(result.cash.operating_target === null ? '' : String(result.cash.operating_target));
      setLoadState('ready');
    } catch (e) { if (sequence === generation.current) { setError(e instanceof Error ? e.message : 'Gagal memuat backend.'); setLoadState('error'); } }
  }, [periodView, asof, customStart, customEnd, serviceFilter, projectFilter, clientFilter, comparison, paymentFilter]);
  useEffect(() => { void load(); return () => { ++generation.current; }; }, [load]);
  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setSnapshot(null); setAccess(null); window.location.replace('/ruang-kawan/'); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const canManage = access?.manage === true && writesEnabled && loadState === 'ready';
  const canApprove = access?.approve === true && writesEnabled && loadState === 'ready';
  const debit = useMemo(() => lines.reduce((sum, line) => sum + Math.round((Number(line.debit) || 0) * 100), 0) / 100, [lines]);
  const credit = useMemo(() => lines.reduce((sum, line) => sum + Math.round((Number(line.credit) || 0) * 100), 0) / 100, [lines]);
  const postedValue = snapshot?.posted_value ?? 0;
  const approvalQueue = periods.filter(item => ['close_requested', 'reopen_requested'].includes(item.status));
  const issuedInvoices = invoices.filter(item => !['draft', 'void'].includes(item.status));
  const billedValue = snapshot?.totals.billed ?? 0;
  const collectedValue = snapshot?.totals.collected ?? 0;
  const outstandingValue = snapshot?.totals.outstanding ?? 0;
  const filteredProjects = projects;
  const recognizedRevenue = snapshot?.totals.revenue ?? 0;
  const actualHpp = snapshot?.totals.hpp ?? 0;
  const grossProfit = snapshot?.totals.gross_profit ?? 0;
  const opex = snapshot?.totals.opex ?? 0;
  const operatingProfit = snapshot?.totals.operating_profit ?? 0;
  const funds = snapshot?.cash.buckets ?? [];
  const reconciledCash = snapshot?.cash.book_cash ?? 0;
  const restrictedCash = snapshot?.cash.restrictions ?? 0;
  const payablesAndAccruals = (snapshot?.cash.payables ?? 0) + (snapshot?.cash.taxes ?? 0) + (snapshot?.cash.distribution ?? 0);
  const freeCash = snapshot?.cash.free_cash ?? 0;
  const operatingReserve = funds.find(f => f.key === 'operating')?.amount ?? 0;
  const operatingReserveTarget = snapshot?.cash.operating_target ?? 0;
  const reserveCoverage = operatingReserveTarget ? operatingReserve / operatingReserveTarget * 100 : 0;
  const latestTarget = snapshot?.target.latest;
  const pendingTarget = snapshot?.requests.find(r => r.kind === 'target' && ['submitted','approved'].includes(r.state));
  const targetPlan: TargetPlan = { fiscalYear: snapshot?.period.fiscal_year ?? new Date().getFullYear(), annualTarget: Number(pendingTarget?.payload.annual_target ?? latestTarget?.payload.annual_target ?? 0), approvedTarget: Number(latestTarget?.payload.annual_target ?? 0), forecast: Number(latestTarget?.payload.forecast ?? 0), status: pendingTarget ? 'approval_requested' : latestTarget ? 'approved' : 'draft', version: snapshot?.requests.filter(r => r.kind === 'target').length ?? 0 };
  const monthlyTarget = snapshot?.target.monthly.map(m => m.target) ?? [];
  const targetActual = snapshot?.target.actual ?? 0;
  const annualGap = Math.max(targetPlan.approvedTarget - targetActual, 0);
  const elapsedMonths = snapshot?.period.fiscal_start ? (new Date(asof).getUTCFullYear() - new Date(snapshot.period.fiscal_start).getUTCFullYear()) * 12 + new Date(asof).getUTCMonth() - new Date(snapshot.period.fiscal_start).getUTCMonth() + 1 : 0;
  const requiredMonthlyPace = 12 - elapsedMonths > 0 ? annualGap / (12 - elapsedMonths) : annualGap;
  const targetAchievement = targetPlan.approvedTarget ? targetActual / targetPlan.approvedTarget * 100 : 0;
  const bankDifference = Number(bankStatementBalance || 0) - reconciledCash;

  async function mutate(action: () => Promise<unknown>, success: string) {
    if (inFlight.current) return;
    inFlight.current = true; setSaving(true); setError(''); setNotice('');
    try { await action(); setNotice(success); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Operasi gagal.'); }
    finally { inFlight.current = false; setSaving(false); }
  }
  async function attach(file?: File) {
    if (!file) return;
    try { setSaving(true); setEvidencePath(await uploadEvidence(file)); setNotice('Bukti tersimpan di storage privat.'); }
    catch(e) { setError(e instanceof Error ? e.message : 'Upload gagal.'); }
    finally { setSaving(false); }
  }
  const evidenceInput = <label>Bukti privat (PDF/PNG/JPEG, maks. 10 MB)<input type="file" accept="application/pdf,image/png,image/jpeg" disabled={saving || !canManage} onChange={e => void attach(e.target.files?.[0])} /><small>{evidencePath || 'Belum ada bukti terunggah'}</small></label>;

  function changeLine(index: number, key: keyof Line, value: string) {
    setLines((current) => current.map((line, row) => row !== index ? line : {
      ...line, [key]: value,
      ...(key === 'debit' && value ? { credit: '' } : {}),
      ...(key === 'credit' && value ? { debit: '' } : {}),
    }));
  }

  const journalPayload = (): Payload => {
    const common = { date, description, lines, evidence_path: evidencePath, business_event: businessEvent, reference: transactionReference, duplicate_reason: duplicateReason };
    if (['manual', 'opening_adjustment'].includes(businessEvent)) return common;
    return { ...common, amount: eventAmount, expense_account: expenseAccount, settlement_account: settlementAccount, project_id: eventProject || null, client: eventClient, due_date: eventDueDate || null, vendor_bill_id: vendorBillId || null, ...(businessEvent==='asset_purchase' ? { asset_name: assetName, asset_class: assetClass, useful_life_months: usefulLife, custodian } : {}), ...(claimId ? { claim_id: claimId } : {}) };
  };
  function templatePreview() { void mutate(async () => { const preview = await rpc<Line[]>('finance_pilot_journal_preview', { p_payload: journalPayload() }); setLines(preview.map(l => ({ ...l, debit: String(l.debit ?? ''), credit: String(l.credit ?? ''), project_id: l.project_id ?? '', client: l.client ?? '', service_line_key: l.service_line_key ?? '' }))); }, 'Journal preview dihitung oleh backend. Belum diposting.'); }
  function post(event: FormEvent) {
    event.preventDefault();
    void mutate(async () => { await saveRequest('journal', journalPayload(), true); setDescription(''); setLines([emptyLine(), emptyLine()]); setEvidencePath(''); setClaimId(null); }, 'Transaksi tersimpan. Lihat status posted atau antrean approval.');
  }
  function requestPeriod(event: FormEvent) {
    event.preventDefault();
    void mutate(() => write('finance_next_request_period_change', { p_period_month: monthStart(periodDate), p_action: 'close', p_reason: reason }), 'Permintaan penutupan tersimpan.');
  }
  function requestReopen(period: Period) {
    const note = window.prompt('Alasan pembukaan kembali periode:'); if (!note?.trim()) return;
    void mutate(() => write('finance_next_request_period_change', { p_period_month: period.period_month, p_action: 'reopen', p_reason: note }), 'Permintaan pembukaan tersimpan.');
  }
  function decidePeriod(period: Period, decision: 'approve' | 'reject') {
    const note = window.prompt('Komentar keputusan wajib:'); if (!note?.trim()) return;
    void mutate(() => write('finance_next_review_period_change', { p_period_month: period.period_month, p_decision: decision, p_note: note }), 'Keputusan periode tersimpan.');
  }
  function saveInvoice(event: FormEvent) {
    event.preventDefault();
    const percentages = invoiceForm.installmentScheme === '50-50' ? [50,50] : invoiceForm.installmentScheme === '50-25-25' ? [50,25,25] : invoiceForm.installmentScheme === 'custom' ? invoiceForm.customPercentages.split(',').map(Number) : [100];
    void mutate(async () => { await saveRequest('invoice', { date: invoiceForm.invoiceDate, due_date: invoiceForm.dueDate || invoiceForm.invoiceDate, client: invoiceForm.client, client_address: invoiceForm.clientAddress, project_id: invoiceForm.projectId || null, service_line_key: invoiceForm.serviceLineKey, item_description: invoiceForm.itemDescription, quantity: invoiceForm.quantity, unit_price: invoiceForm.unitPrice, discount: invoiceForm.discount, tax: invoiceForm.tax, management_fee: invoiceForm.managementFee, other_fees: invoiceForm.otherFees, installment_scheme: invoiceForm.installmentScheme, percentages, notes: invoiceForm.notes, evidence_path: evidencePath, milestone_evidence: milestoneEvidence }); setInvoiceForm(emptyInvoice()); }, 'Draft invoice tersimpan. Belum memengaruhi ledger.');
  }
  function issueInvoice(invoice: Invoice) {
    void mutate(() => write('finance_pilot_submit', { p_id: invoice.id }), 'Invoice dikirim. Nilai material menunggu approval CEO.');
  }
  function prepareReceipt(invoice: Invoice) { setReceiptInvoiceId(invoice.id); setReceiptAmount(String(invoice.balance)); setReceiptDate(today()); setReceiptReference(''); setEvidencePath(''); }
  function recordReceipt(event: FormEvent) {
    event.preventDefault();
    void mutate(async () => { await saveRequest('receipt', { date: receiptDate, invoice_id: receiptInvoiceId, amount: receiptAmount, deposit_coa_code: receiptAccount, reference: receiptReference, evidence_path: evidencePath }, true); setReceiptInvoiceId(''); setReceiptAmount(''); }, 'Receipt tersimpan. Status terbaru dimuat dari database.');
  }
  function openSection(next: Section) { setError(''); setNotice(''); setSection(next); setReportAccount(null); }
  function saveFund(key: string, value: string) { setFundInputs(current => ({ ...current, [key]: value })); }
  function submitFunds() {
    const note = window.prompt('Alasan perubahan alokasi:'); if (!note) return;
    void mutate(() => saveRequest('funds', { as_of: asof, operating_target: reserveTargetInput, reason: note, buckets: ['project','operating','emergency'].map(key => ({ key, label: key === 'project' ? 'Project Funds (di luar utang tercatat)' : key === 'operating' ? 'Next Month Operating Reserve' : 'Emergency Reserve', amount: fundInputs[key] || '0' })) }, true), 'Alokasi dana diajukan untuk approval; saldo kas tidak diubah.');
  }
  function reconcileBank() {
    const payload = { asof, balance: bankStatementBalance, evidence_path: evidencePath };
    void mutate(async () => write('finance_pilot_reconcile', { p_key: await operationKey('reconcile', payload), p_asof: asof, p_balance: bankStatementBalance, p_evidence: evidencePath }), 'Rekonsiliasi tersimpan; saldo dihitung dari ledger.');
  }
  function submitTarget() {
    const note = window.prompt('Alasan versi target ini:'); if (!note) return;
    void mutate(() => saveRequest('target', { fiscal_year: targetPlan.fiscalYear, annual_target: targetInput, allocations: JSON.parse(allocations), forecast: forecastInput || null, reason: note }, true), 'Versi target tersimpan dan menunggu approval CEO.');
  }
  function decideTarget(approve: boolean) { if (pendingTarget) reviewRequest(pendingTarget.id, approve); }
  function reviewRequest(id: string, approve: boolean) {
    const note = window.prompt('Komentar keputusan:'); if (!note) return;
    void mutate(() => write('finance_pilot_review', { p_id: id, p_decision: approve ? 'approve' : 'reject', p_note: note }), 'Approval tersimpan. COO menerapkan request yang disetujui.');
  }
  function applyRequest(id: string) { void mutate(() => write('finance_pilot_execute', { p_id: id }), 'Request diterapkan secara atomik.'); }
  function savePolicy() {
    void mutate(() => saveRequest('policy', { approval_threshold: approvalThreshold, fiscal_start: fiscalStart, accounts: mapping, reason: policyReason }, true), 'Kebijakan diajukan ke CEO. Tidak langsung aktif.');
  }
  function addAccount() {
    const code = window.prompt('Kode akun baru (jangan mengganti kode existing):'); const name = window.prompt('Nama akun:');
    const accountClass = window.prompt('Klasifikasi: Aset / Kewajiban / Ekuitas / Pendapatan / Beban Operasional / Beban Langsung Proyek / Beban Non-Operasional / Pajak');
    const category = window.prompt('Arus kas: Operasional / Investasi / Pendanaan / Non-Kas');
    if (!code || !name || !accountClass || !category) return;
    void mutate(() => saveRequest('account', { code, name, account_class: accountClass, cash_flow_category: category, reason: 'Penambahan akun oleh COO' }, true), 'Akun baru menunggu approval CEO. Akun existing tidak diubah.');
  }
  function budgetProject(project: Options) {
    const contract = window.prompt('Nilai kontrak disetujui:'); const budget = window.prompt('Budget HPP:'); const committed = window.prompt('Committed cost belum diposting:');
    const service = window.prompt(`Service line key: ${services.map(s => s.service_line_key).join(', ')}`, project.service_line_key ?? '');
    const note = window.prompt('Alasan/bukti persetujuan kontrak dan budget:'); if (!note) return;
    void mutate(() => saveRequest('budget', { project_id: project.id, service_line_key: service, contract_value: contract, budgeted_hpp: budget, committed_cost: committed, reason: note }, true), 'Budget project menunggu approval CEO.');
  }
  function closeProject(project: Project) {
    const handover = window.prompt('Bukti handover:'); if (!handover) return;
    void mutate(() => saveRequest('project_closure', { project_id: project.id, handover_evidence: handover, reason: 'Penutupan finansial setelah handover' }, true), 'Status closure tersimpan.');
  }
  function reverseJournal(journal: Journal) {
    const reason = window.prompt('Alasan reversal:'); if (!reason) return;
    void mutate(() => saveRequest('reversal', { date: asof, journal_id: journal.id, reason, evidence_path: evidencePath }, true), 'Permintaan reversal menunggu approval CEO.');
  }
  function chooseVendorBill(id: string) {
    const bill = snapshot?.vendor_bills.find(b => b.id === id);
    setVendorBillId(id); setBusinessEvent('vendor_payment'); setClaimId(null);
    setEventClient(bill?.vendor ?? ''); setEventProject(bill?.project_id ?? '');
    setEventAmount(bill ? String(bill.balance) : ''); setEventDueDate(bill?.due_date ?? '');
    setSettlementAccount(snapshot?.policy?.accounts.cash ?? ''); setExpenseAccount('');
    setDescription(bill ? `Pembayaran vendor ${bill.reference}` : ''); setLines([emptyLine(), emptyLine()]);
    setTransactionReference(''); setEvidencePath(''); setSection('transactions');
  }
  function drill(label: string, account?: string) { setReportAccount(account ?? null); setSection('transactions'); setNotice(`Sumber: ${label}. Filter global dipertahankan.`); }
  function previewExport(label: string) {
    void mutate(async () => {
      if (!snapshot) throw new Error('Data belum dimuat.');
      await write('finance_pilot_audit_export', { p_filters: { report: reportView, period: snapshot.period, service: serviceFilter, project: projectFilter, client: clientFilter, payment: paymentFilter } });
      const blob = new Blob([reportCsv(snapshot.reports[reportView] ?? [])], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `finance-${reportView}-${snapshot.period.start}-${snapshot.period.end}.csv`; link.click(); URL.revokeObjectURL(url);
    }, `${label} CSV diunduh dengan filter aktif.`);
  }
  if (scoped) return <ScopedWorkspace />;
  if (loadState === 'loading' && !snapshot) return <main className={styles.page}><h1>Finance Pilot</h1><p>Memuat sesi dan database…</p></main>;
  if (loadState === 'error') return <main className={styles.page}><h1>Finance Pilot</h1><p role="alert">{error}</p><p>Data simulasi tidak digunakan sebagai fallback. Migration DEV mungkin belum diterapkan.</p><button onClick={() => void load()}>Coba lagi</button><Link href="/ruang-kawan/finance/">Finance lama</Link></main>;

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><Link href="/ruang-kawan/finance/"><FiArrowLeft /> Finance lama</Link><small>FINANCE WORKSPACE · PILOT</small><h1>Finance Pilot</h1><p>Satu alur dari transaksi, approval, posting, rekonsiliasi, sampai laporan.</p></div>
      <div className={styles.headerActions}>
        <span className={styles.rolePreview}><FiShield /> {access?.position.toUpperCase()} · sesi terverifikasi</span>
        <button disabled={saving || loadState === 'loading'} onClick={() => void load()}><FiRefreshCw /> Refresh data</button>
      </div>
    </header>
    <div className={styles.preservation}><strong>Ledger pilot · belum cutover</strong><span>{snapshot?.quality.scope} · {snapshot?.quality.unmapped_legacy_count} transaksi historis belum dikonversi. {writesEnabled ? "Write gate DEV aktif." : "Write gate belum aktif."}</span></div>
    {error ? <p className={styles.alert} role="alert">{error}</p> : null}{notice ? <p className={styles.notice} role="status">{notice}</p> : null}

    <nav className={styles.workspaceNav} aria-label="Finance Pilot">
      {navigation.map((item) => <button key={item.key} data-active={section === item.key} onClick={() => openSection(item.key)}><item.icon /><span>{item.label}</span></button>)}
    </nav>

    <section className={styles.globalControls} aria-label="Filter laporan global">
      <label>Periode<select value={periodView} onChange={(event) => setPeriodView(event.target.value as PeriodView)}><option>MTD</option><option>QTD</option><option>YTD</option><option>Custom</option></select></label>
      <label>Perbandingan<select value={comparison} onChange={(event) => setComparison(event.target.value)}><option>Previous Period</option><option>Previous Year</option><option>Budget</option><option>Target</option></select></label>
      <label>Service line<select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}><option value="all">Semua service line</option>{services.map((service) => <option key={service.service_line_key} value={service.service_line_key}>{service.label}</option>)}</select></label>
      <label>Project<select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">Semua project</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.project_code} · {project.name}</option>)}</select></label>
      <label>As of<input type="date" value={asof} onChange={e => setAsof(e.target.value)} /></label>
      {periodView === 'Custom' ? <><label>Dari<input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} /></label><label>Sampai<input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} /></label></> : null}
      <label>Client<input value={clientFilter} onChange={e => setClientFilter(e.target.value)} placeholder="Nama persis" /></label>
      <label>Payment status<select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}><option value="">Semua</option>{['issued','partially_paid','paid','overdue'].map(v => <option key={v}>{v}</option>)}</select></label>
      <div className={styles.dataState}><b>Accrual</b><span>{periodView} · {comparison}</span><small>{snapshot?.period.start ?? 'Periode fiskal belum dikonfigurasi'} — {snapshot?.period.end} · {snapshot?.cash.reconciled ? 'Bank reconciled' : 'Belum reconciled'} · {snapshot?.updated_at ? new Date(snapshot.updated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : ''}</small></div>
    </section>

    {section === 'overview' ? <>
      <section className={styles.overviewHero}>
        <div><small>EXECUTIVE OVERVIEW</small><h2>Kondisi keuangan pilot dalam satu pandangan</h2><p>Angka hanya berasal dari ledger dan invoice pilot. Billed, cash collected, dan outstanding AR tetap dipisahkan agar tidak terbaca sebagai angka yang sama.</p></div>
        <button className={styles.primary} onClick={() => openSection(canManage ? 'transactions' : 'periods')}>{canManage ? 'Tambah transaksi' : 'Lihat approval'} <FiChevronRight /></button>
      </section>
      <section className={styles.metrics}>
        <article><small>Nilai jurnal posted</small><strong>{money(postedValue)}</strong><span>{snapshot?.journal_count ?? 0} jurnal pada ledger pilot</span></article>
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
            <span data-ready="true"><FiCheck /><b>Double-entry ledger</b><small>Backend RPC · verifikasi DEV</small></span>
            <span data-ready="true"><FiCheck /><b>Period lock & approval</b><small>Backend RPC · verifikasi DEV</small></span>
            <span data-ready="true"><FiCheck /><b>Invoice & payment receipt</b><small>Backend RPC · verifikasi DEV</small></span>
            <span data-ready={bankDifference === 0}><FiCheck /><b>Bank reconciliation</b><small>{bankDifference === 0 ? 'Seimbang · selisih Rp0' : `Perlu ditinjau · ${money(bankDifference)}`}</small></span>
          </div>
        </section>
      </div>
    </> : null}

    {section === 'transactions' ? <div className={styles.columns}>
      <section className={styles.panel}>
        <header><div><small>TRANSACTION → POSTED</small><h2>Posting jurnal rutin</h2><p>Debit dan kredit harus sama. Akun produksi dipakai tanpa mengganti klasifikasi existing. Transaksi tersimpan atomik setelah validasi dan approval bila diperlukan.</p></div></header>
        {canManage ? <form onSubmit={post} className={styles.form}>
          <label>Business event<select value={businessEvent} onChange={e => { setBusinessEvent(e.target.value); setLines([emptyLine(),emptyLine()]); }}>{['manual','customer_advance','project_expense','operating_expense','vendor_bill','vendor_payment','owner_receivable','asset_purchase','opening_adjustment'].map(v => <option key={v}>{v}</option>)}</select></label><label>Referensi transaksi<input value={transactionReference} onChange={e => setTransactionReference(e.target.value)} required /></label><label>Alasan bila potential duplicate<input value={duplicateReason} onChange={e => setDuplicateReason(e.target.value)} /></label>{evidenceInput}
          {!['manual','opening_adjustment'].includes(businessEvent) ? <fieldset className={styles.form}><legend>Business event fields</legend>{businessEvent==='vendor_payment' ? <label>Sumber tagihan vendor<select value={vendorBillId} onChange={e => chooseVendorBill(e.target.value)} required><option value="">Pilih AP posted</option>{snapshot?.vendor_bills.filter(b=>Number(b.balance)>0).map(b=><option key={b.id} value={b.id}>{b.reference} · {b.vendor} · {money(b.balance)}</option>)}</select></label> : null}<label>Nominal<input type="number" min="0.01" step="0.01" value={eventAmount} onChange={e => setEventAmount(e.target.value)} required /></label><label>Vendor / client / owner<input disabled={businessEvent==='vendor_payment'} value={eventClient} onChange={e => setEventClient(e.target.value)} /></label><label>Project<select disabled={businessEvent==='vendor_payment'} value={eventProject} onChange={e => setEventProject(e.target.value)}><option value="">Tanpa project</option>{projectOptions.map(p => <option key={p.id} value={p.id}>{p.project_code} · {p.name}</option>)}</select></label><label>Akun expense<select disabled={businessEvent==='vendor_payment'} value={expenseAccount} onChange={e => setExpenseAccount(e.target.value)}><option value="">Pilih jika expense/bill</option>{accounts.filter(a => ['Beban Operasional','Beban Langsung Proyek'].includes(a.account_class)).map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></label><label>Settlement<select disabled={businessEvent==='vendor_payment'} value={settlementAccount} onChange={e => setSettlementAccount(e.target.value)}><option value="">Pilih kas / AP</option>{accounts.filter(a => [snapshot?.policy?.accounts.cash,snapshot?.policy?.accounts.payable].includes(a.code)).map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></label><label>Jatuh tempo<input type="date" value={eventDueDate} onChange={e => setEventDueDate(e.target.value)} /></label>{businessEvent==='asset_purchase' ? <><label>Nama aset<input value={assetName} onChange={e => setAssetName(e.target.value)} required /></label><label>Asset class<input value={assetClass} onChange={e => setAssetClass(e.target.value)} /></label><label>Umur manfaat (bulan)<input type="number" min="1" value={usefulLife} onChange={e => setUsefulLife(e.target.value)} required /></label><label>Custodian<input value={custodian} onChange={e => setCustodian(e.target.value)} required /></label></> : null}<button type="button" disabled={saving} onClick={templatePreview}>Hitung journal preview</button></fieldset> : null}
          <div className={styles.topFields}><label>Tanggal<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label className={styles.description}>Keterangan<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} required /></label></div>
          <div className={styles.linesHeading}><strong>Journal preview · business event dihitung ulang oleh backend saat simpan</strong><button type="button" onClick={() => setLines((current) => [...current, emptyLine()])}><FiPlus /> Tambah baris</button></div>
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
              {true ? <label className={styles.account}>Project ID<select value={line.project_id} onChange={(event) => { changeLine(index, 'project_id', event.target.value); const p = projectOptions.find(p => p.id === event.target.value); if (p?.service_line_key) changeLine(index, 'service_line_key', p.service_line_key); }} required={projectRequired}><option value="">Pilih project</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.project_code} · {project.name}</option>)}</select></label> : null}
              <label>Client<input value={line.client} onChange={(event) => changeLine(index, 'client', event.target.value)} /></label>
              {lines.length > 2 ? <button className={styles.remove} type="button" onClick={() => setLines((current) => current.filter((_, row) => row !== index))} aria-label={`Hapus baris ${index + 1}`}><FiTrash2 /></button> : null}
            </fieldset>;
          })}
          <div className={styles.totals}><span>Total debit <strong>{money(debit)}</strong></span><span>Total kredit <strong>{money(credit)}</strong></span><b data-balanced={debit > 0 && debit === credit}>{debit > 0 && debit === credit ? <><FiCheck /> Seimbang</> : 'Belum seimbang'}</b></div>
          <button className={styles.primary} disabled={saving || debit <= 0 || debit !== credit}><FiSend />{saving ? 'Memposting…' : 'Posting jurnal'}</button>
        </form> : <p className={styles.muted}>Izin Finance Pilot kelola dibutuhkan untuk memposting jurnal.</p>}
      </section>
      <section className={styles.panel}>
        <header><div><small>GENERAL LEDGER</small><h2>Jurnal terbaru</h2><p>100 entri terbaru pada filter aktif. Total laporan dihitung dari seluruh ledger, tanpa batas 100 entri.</p></div></header>
        {journals.length ? <div className={styles.journalList}>{journals.filter(entry => !reportAccount || entry.finance_next_journal_lines.some(l => l.coa_code === reportAccount)).map((entry) => <article key={entry.id}><div><strong>{entry.description}</strong><small>{entry.entry_date} · {entry.status} · source {entry.source_type} / {entry.id}</small>{canManage && ['request','finance_document'].includes(entry.source_type) && !entry.reversal_of_id ? <button disabled={saving} onClick={() => reverseJournal(entry)}>Minta reversal</button> : null}{entry.finance_next_journal_lines.map((line) => <p key={line.line_number}>{line.coa_code} {line.description || ''} · D {money(Number(line.debit))} / K {money(Number(line.credit))}</p>)}</div><b>{money(entry.finance_next_journal_lines.reduce((sum, line) => sum + Number(line.debit), 0))}</b></article>)}</div> : <p className={styles.empty}>Belum ada jurnal di pilot. Finance lama tetap dapat dipakai.</p>}
      </section>
    </div> : null}

    {section === 'overview' || section === 'revenue' ? <>
      <section className={styles.metrics}>
        <article><small>Recognized revenue</small><button onClick={() => drill('Recognized Revenue')}><strong>{money(recognizedRevenue)}</strong></button><span>{snapshot?.period.start} — {snapshot?.period.end}</span></article>
        <article><small>Gross profit</small><button onClick={() => { setReportView('income'); setSection('reports'); }}><strong>{money(grossProfit)}</strong></button><span>{recognizedRevenue ? (grossProfit / recognizedRevenue * 100).toFixed(1) : '0'}% margin</span></article>
        <article><small>Net profit</small><button onClick={() => { setReportView('income'); setSection('reports'); }}><strong>{money(snapshot?.totals.net_profit ?? 0)}</strong></button><span>Posted ledger · accrual</span></article>
        <article><small>Free cash · company scope</small><button onClick={() => setSection('cash')}><strong>{snapshot?.cash.free_cash === null ? 'Belum reconciled / reserve belum disetujui' : money(freeCash)}</strong></button><span>As of {snapshot?.period.end}</span></article>
      </section>
      <div className={styles.columns}><section className={styles.panel}><h2>Revenue & gross profit by service</h2><div className={styles.statement}>{snapshot?.service_stats.map(service => <button key={service.service_line_key} onClick={() => { setServiceFilter(service.service_line_key); drill(service.label); }}><span>{service.label}</span><b>{money(service.revenue)}</b><small>GP {money(service.revenue-service.hpp)} · {service.revenue ? ((service.revenue-service.hpp)/service.revenue*100).toFixed(1) : '0'}%</small></button>)}</div></section>
      <section className={styles.panel}><h2>Commercial outcomes · pipeline existing</h2>{(() => { const won=snapshot?.outcomes.filter(o=>o.stage==='Won') ?? []; const lost=snapshot?.outcomes.filter(o=>o.stage==='Lost') ?? []; const wonValue=won.reduce((sum,o)=>sum+Number(o.won_value ?? 0),0); const lostValue=lost.reduce((sum,o)=>sum+Number(o.proposal_value ?? 0),0); return <><p>Won {won.length} · {money(wonValue)} | Lost {lost.length} · {money(lostValue)}</p><p>Win rate count: {won.length+lost.length ? (won.length/(won.length+lost.length)*100).toFixed(1) : '0'}% · Win rate value: {wonValue+lostValue ? (wonValue/(wonValue+lostValue)*100).toFixed(1) : '0'}%</p><p>Lost opportunity tidak dibukukan sebagai beban. {snapshot?.quality.unmapped_deals} deal belum lengkap mapping/date.</p></>; })()}<div className={styles.taskList}>{snapshot?.outcomes.map(o=><a key={o.id} href={`/ruang-kawan/pipeline/?lead=${o.id}`}><span><b>{o.lead_code} · {o.account_name} · {o.stage}</b><small>{o.outcome_date} · {o.win_loss_reason ?? 'Alasan belum diklasifikasikan'}</small></span></a>)}</div></section></div>
    </> : null}

    {section === 'revenue' ? <>
      <section className={styles.revenueMetrics}>
        <article><small>Billed</small><strong>{money(billedValue)}</strong><span>Invoice yang sudah diterbitkan</span></article>
        <article><small>Collected</small><strong>{money(collectedValue)}</strong><span>Pembayaran yang sudah diterima</span></article>
        <article><small>Outstanding AR</small><strong>{money(outstandingValue)}</strong><span>Saldo invoice yang belum dibayar</span></article>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel}><header><div><small>INVOICE DRAFT</small><h2>Buat invoice pilot</h2><p>Draft belum memengaruhi ledger. Jurnal AR–Revenue baru terbentuk saat invoice diterbitkan setelah bukti milestone dan validasi.</p></div></header>
          {canManage ? <form className={styles.form} onSubmit={saveInvoice}>
            {evidenceInput}<label>Bukti milestone/obligation selesai<input value={milestoneEvidence} onChange={e => setMilestoneEvidence(e.target.value)} /></label><div className={styles.topFields}><label>Tanggal invoice<input type="date" value={invoiceForm.invoiceDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoiceDate: event.target.value })} required /></label><label>Jatuh tempo<input type="date" value={invoiceForm.dueDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, dueDate: event.target.value })} /></label></div>
            <div className={styles.topFields}><label>Client<input value={invoiceForm.client} onChange={(event) => setInvoiceForm({ ...invoiceForm, client: event.target.value })} required /></label><label>Service line<select value={invoiceForm.serviceLineKey} onChange={(event) => setInvoiceForm({ ...invoiceForm, serviceLineKey: event.target.value })} required><option value="">Pilih service line</option>{services.map((item) => <option key={item.service_line_key} value={item.service_line_key}>{item.label}</option>)}</select></label></div>
            <label>Project<select value={invoiceForm.projectId} onChange={(event) => setInvoiceForm({ ...invoiceForm, projectId: event.target.value })}><option value="">Tanpa project</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.project_code} · {project.name}</option>)}</select></label>
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
        <form className={styles.receiptForm} onSubmit={recordReceipt}>{evidenceInput}<label>Tanggal<input type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} required /></label><label>Nominal<input type="number" min="1" max={Number(invoices.find((item) => item.id === receiptInvoiceId)?.balance ?? 0)} value={receiptAmount} onChange={(event) => setReceiptAmount(event.target.value)} required /></label><label>Akun penerimaan<select value={receiptAccount} onChange={(event) => setReceiptAccount(event.target.value)} required>{accounts.filter(item => item.code === snapshot?.policy?.accounts.cash).map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label><label>Referensi pembayaran<input value={receiptReference} onChange={(event) => setReceiptReference(event.target.value)} required /></label><button className={styles.primary} disabled={saving}><FiCheck /> {saving ? 'Mencatat…' : 'Simpan payment receipt'}</button></form>
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
      {canManage ? <section className={styles.panel}><h3>Mapping & budget project existing</h3>{projectOptions.map(project => <button key={project.id} disabled={saving} onClick={() => budgetProject(project)}>{project.project_code} · {project.name} — Siapkan budget</button>)}</section> : null}
      <section className={styles.projectGrid}>{filteredProjects.map((project) => {
        const margin = project.recognized_revenue ? (project.recognized_revenue - project.actual_hpp) / project.recognized_revenue * 100 : 0;
        const budgetUse = project.budgeted_hpp ? (project.actual_hpp + project.committed_cost) / project.budgeted_hpp * 100 : 0;
        return <article key={project.id} className={styles.projectCard}>
          <header><div><small>{project.project_code} · {services.find((item) => item.service_line_key === project.service_line_key)?.label}</small><h3>{project.name}</h3><p>{project.client_name}</p></div><b data-status={budgetUse > 100 ? 'risk' : project.status}>{project.status.replaceAll('_', ' ')}</b></header>
          <div className={styles.projectNumbers}><span>Contract<b>{money(project.contract_value)}</b></span><span>Recognized<b>{money(project.recognized_revenue)}</b></span><span>Billed<b>{money(project.billed_amount)}</b></span><span>Collected<b>{money(project.cash_collected)}</b></span><span>Budgeted HPP<b>{money(project.budgeted_hpp)}</b></span><span>Committed<b>{money(project.committed_cost)}</b></span><span>Actual HPP<b>{money(project.actual_hpp)}</b></span><span>Gross margin<b>{margin.toFixed(1)}%</b></span></div>
          <div className={styles.progress}><span style={{ width: `${Math.min(budgetUse, 100)}%` }} /><b>{budgetUse.toFixed(1)}% budget terpakai</b></div>
          <footer><button onClick={() => { setProjectFilter(project.id); drill(project.name); }}>Drill down sumber</button>{canManage ? <button disabled={saving || !!project.financially_closed_at} onClick={() => closeProject(project)}>Ajukan closure</button> : null}</footer>
        </article>;
      })}</section>
    </> : null}

    {section === 'cash' ? <>
      <section className={styles.moduleHero}><div><small>CASH & FUND CONTROL</small><h2>Kas bank tidak sama dengan kas yang aman dipakai</h2><p>Free Cash mengikuti formula PRD setelah restricted funds, payables, reserve, dan distribusi yang sudah disetujui.</p></div><span>Asia/Jakarta · {periodView}</span></section>
      <section className={styles.metrics}>
        <article><small>Reconciled cash</small><strong>{money(reconciledCash)}</strong><span>{snapshot?.cash.reconciled ? 'Reconciled pada as-of aktif' : 'Book cash · belum reconciled'}</span></article>
        <article><small>Restricted funds</small><strong>{money(restrictedCash)}</strong><span>Tidak termasuk Free Cash</span></article>
        <article><small>Payables & accruals</small><strong>{money(payablesAndAccruals)}</strong><span>Komitmen yang belum dibayar</span></article>
        <article><small>Free Cash</small><strong className={freeCash < 0 ? styles.negative : ''}>{snapshot?.cash.free_cash === null ? "Belum tersedia" : money(freeCash)}</strong><span>Reconciled cash dikurangi seluruh pembatasan</span></article>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel}><header><div><small>FUND BUCKETS</small><h2>Alokasi dana terikat</h2><p>Alokasi tambahan di luar kewajiban ledger memerlukan approval CEO. Pajak dan distribusi dihitung dari ledger agar tidak menjadi saldo ganda.</p></div></header>
          <div className={styles.fundList}>{['project','operating','emergency'].map(key => <label key={key}><span><b>{key}</b><small>Restricted · alokasi disetujui</small></span><input type="number" min="0" value={fundInputs[key] ?? ''} disabled={!canManage} onChange={e => saveFund(key, e.target.value)} /></label>)}</div>
          <label>Target reserve operasi<input type="number" min="1" value={reserveTargetInput} disabled={!canManage} onChange={e => setReserveTargetInput(e.target.value)} /></label>
          {canManage ? <button disabled={saving} onClick={submitFunds}>Ajukan versi alokasi & reserve</button> : null}
          <div className={styles.formula}>Free Cash = {money(reconciledCash)} − {money(restrictedCash)} − {money(payablesAndAccruals)} = <b>{money(freeCash)}</b></div>
        </section>
        <section className={styles.stack}>
          <section className={styles.panel}><header><div><small>BANK RECONCILIATION</small><h2>Akun kas yang disetujui</h2><p>Target selisih tidak terjelaskan adalah Rp0.</p></div></header>
            <div className={styles.reconciliation}><span>Book balance<b>{money(reconciledCash)}</b></span><label>Bank statement<input type="number" value={bankStatementBalance} disabled={!canManage} onChange={(event) => setBankStatementBalance(event.target.value)} /></label><span>Difference<b className={bankDifference ? styles.negative : ''}>{money(bankDifference)}</b></span></div>
            {canManage ? <>{evidenceInput}<button disabled={saving} className={styles.primary} onClick={reconcileBank}><FiCheck /> Finalisasi rekonsiliasi</button></> : <p className={styles.muted}>CEO dan viewer hanya melihat status rekonsiliasi.</p>}
          </section>
          <section className={styles.panel}><header><div><small>OPERATING RESERVE</small><h2>Coverage bulan berikutnya</h2><p>Distribusi laba diblokir sampai coverage mencapai 100%.</p></div></header>
            <div className={styles.coverage}><strong>{reserveCoverage.toFixed(0)}%</strong><span data-status={reserveCoverage >= 100 ? 'funded' : reserveCoverage >= 75 ? 'attention' : 'critical'}>{reserveCoverage > 100 ? 'Buffered' : reserveCoverage === 100 ? 'Funded' : reserveCoverage >= 75 ? 'Attention' : 'Critical'}</span><small>{money(operatingReserve)} dari target {money(operatingReserveTarget)}</small></div>
          </section>
        </section>
      </div>
    </> : null}

    {section === 'cash' ? <section className={styles.panel}><header><div><small>VENDOR PAYABLES</small><h2>Tagihan & pembayaran vendor</h2><p>Outstanding dihitung dari AP ledger per {snapshot?.period.end}; pembayaran tidak membebankan expense dua kali.</p></div></header>
      {snapshot?.quality.unallocated_ap ? <p className={styles.alert}>AP ledger yang belum terhubung tagihan: {money(snapshot.quality.unallocated_ap)}. Perlu penelusuran sumber.</p> : null}
      <div className={styles.statement}>{snapshot?.vendor_bills.map(b=><article key={b.id}><b>{b.reference} · {b.vendor}</b><p>Jatuh tempo {b.due_date} · Tagihan {money(b.amount)} · Outstanding {money(b.balance)}</p><button onClick={()=>drill(b.reference,snapshot.policy?.accounts.payable)}>Buka ledger AP</button>{canManage && Number(b.balance)>0 ? <button disabled={saving} onClick={()=>chooseVendorBill(b.id)}>Siapkan pembayaran vendor</button> : null}<button onClick={()=>{void evidenceUrl(b.evidence_path).then(url=>window.open(url,'_blank','noopener,noreferrer')).catch(e=>setError(e.message));}}>Buka bukti tagihan</button></article>)}</div>
    </section> : null}

    {section === 'reports' ? <>
      <section className={styles.moduleHero}><div><small>ACCOUNTING REPORTS</small><h2>Laporan formal dari jurnal posted</h2><p>Dashboard manajemen tidak menggantikan laporan akuntansi. Nilai memakai filter global dan dapat ditelusuri ke General Ledger.</p></div><button onClick={() => previewExport('Ekspor laporan')}>Export CSV</button></section>
      <div className={styles.reportTabs}>{[
        ['income', 'Income Statement'], ['position', 'Financial Position'], ['cashflow', 'Cash Flow'], ['equity', 'Changes in Equity'], ['trial', 'Trial Balance'], ['aging', 'AR / AP Aging'],
      ].map(([key, label]) => <button key={key} data-active={reportView === key} onClick={() => setReportView(key)}>{label}</button>)}</div>
      <div className={styles.columns}>
        <section className={styles.panel}><header><div><small>{periodView} · {comparison}</small><h2>{reportView === 'income' ? 'Laporan Laba Rugi' : reportView === 'position' ? 'Laporan Posisi Keuangan' : reportView === 'cashflow' ? 'Laporan Arus Kas' : reportView === 'equity' ? 'Laporan Perubahan Ekuitas' : reportView === 'trial' ? 'Neraca Saldo' : 'Aging Receivables & Payables'}</h2><p>Accrual basis · posted entries only.</p></div></header>
          <div className={styles.statement}>{(snapshot?.reports[reportView] ?? []).map(row => <button key={row.label} onClick={() => drill(row.label, row.coa_code)}><span>{row.label}{row.days_overdue !== undefined ? ` · ${row.aging_bucket ?? ''} · overdue ${row.days_overdue} hari` : ''}</span><b className={row.value < 0 ? styles.negative : ''}>{money(row.value)}</b>{reportView === 'trial' ? <small>Opening {money(row.opening ?? 0)} · D {money(row.debit ?? 0)} / K {money(row.credit ?? 0)}</small> : null}</button>)}</div>
        </section>
        <section className={styles.panel}><header><div><small>CONTROL & TRACEABILITY</small><h2>Status laporan</h2><p>Setiap kontrol menandai apakah laporan siap dipakai.</p></div></header>
          <div className={styles.controlList}><span data-ready={snapshot?.quality.ledger_difference === 0}><FiCheck /><b>Jurnal posted seimbang</b><small>{money(snapshot?.quality.ledger_difference ?? 0)} difference</small></span><span data-ready={snapshot?.cash.reconciled}><FiCheck /><b>Bank reconciliation</b><small>{money(bankDifference)} difference</small></span><span data-ready="true"><FiCheck /><b>Periode aktif</b><small>{snapshot?.period.start ?? "Fiscal policy belum aktif"} — {snapshot?.period.end}</small></span><span data-ready="true"><FiCheck /><b>Source drill-down</b><small>Journal, invoice, receipt, project</small></span></div>
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
        <article><small>Forecast</small><strong>{latestTarget?.payload.forecast === null || !latestTarget ? 'Belum diisi' : money(targetPlan.forecast)}</strong><span>{targetPlan.approvedTarget ? (targetPlan.forecast / targetPlan.approvedTarget * 100).toFixed(1) : '0'}% forecast achievement</span></article>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel}><header><div><small>TARGET GOVERNANCE</small><h2>Annual Revenue Target</h2><p>COO menyiapkan perubahan. CEO menyetujui setiap versi baru.</p></div></header>
          <div className={styles.targetStatus}><b data-status={targetPlan.status}>{targetPlan.status.replaceAll('_', ' ')}</b><span>Original {money(Number(snapshot?.target.original?.annual_target ?? 0))} · Latest approved {money(targetPlan.approvedTarget)}</span></div>
          {canManage ? <div className={styles.form}><label>Target tahunan<input type="number" min="1" value={targetInput} onChange={(event) => setTargetInput(event.target.value)} /></label><label>Management forecast (opsional)<input type="number" min="0" value={forecastInput} onChange={e => setForecastInput(e.target.value)} /></label><label>Alokasi JSON [{'{'}"month":1,"service_line_key":"event_management","amount":1000000{'}'}, …] (month=bulan fiskal)<textarea value={allocations} onChange={e => setAllocations(e.target.value)} placeholder="12 bulan, per service, total = target tahunan" /></label><button disabled={saving} className={styles.primary} onClick={submitTarget}>Kirim versi untuk approval</button></div> : null}
          {canApprove && targetPlan.status === 'approval_requested' ? <div className={styles.approvalBox}><p>Perubahan target: {money(targetPlan.approvedTarget)} → {money(targetPlan.annualTarget)}</p><button onClick={() => decideTarget(true)}><FiCheck /> Setujui</button><button onClick={() => decideTarget(false)}>Tolak</button></div> : null}
          {!canManage && !canApprove ? <p className={styles.muted}>Viewer hanya dapat melihat target yang telah disetujui.</p> : null}
        </section>
        <section className={styles.panel}><header><div><small>MONTHLY ALLOCATION</small><h2>Actual vs target bulanan</h2><p>Alokasi harus merekonsiliasi ke annual target.</p></div></header>
          <div className={styles.monthBars}>{monthlyTarget.map((target, index) => { const actual = snapshot?.target.monthly[index]?.actual ?? 0; return <div key={index}><span>{new Date(targetPlan.fiscalYear, (Number(snapshot?.policy?.fiscal_start ?? 1) - 1) + index, 1).toLocaleDateString('id-ID', { month: 'short' })}</span><i><em style={{ width: `${target ? Math.min(actual / target * 100, 100) : 0}%` }} /></i><b>{money(actual)} / {money(target)}</b></div>; })}</div>
        </section>
      </div>
    </> : null}

    {section === 'settings' ? <>
      <section className={styles.moduleHero}><div><small>CONTROLLED CONFIGURATION</small><h2>Master data dan aturan finance</h2><p>Pengaturan teknis tidak memberi hak approval. COO mengelola konfigurasi operasional; keputusan gated tetap milik CEO.</p></div><span>Audit trail aktif</span></section>
      <div className={styles.settingsGrid}>
        <section className={styles.panel}><header><div><small>CHART OF ACCOUNTS</small><h2>Akun pilot</h2><p>Kode, nama, dan klasifikasi laporan.</p></div></header><div className={styles.masterList}>{accounts.map((account) => <span key={account.code}><b>{account.code}</b><strong>{account.name}</strong><small>{account.account_class}</small></span>)}</div>{canManage ? <button className={styles.secondary} disabled={saving} onClick={addAccount}>Tambah akun</button> : null}</section>
        <section className={styles.panel}><header><div><small>SERVICE LINES</small><h2>Enam taxonomy resmi</h2><p>Revenue wajib memakai salah satu service line PRD.</p></div></header><div className={styles.masterList}>{services.map((service, index) => <span key={service.service_line_key}><b>{String(index + 1).padStart(2, '0')}</b><strong>{service.label}</strong><small>{service.service_line_key}</small></span>)}</div></section>
        <section className={styles.panel}><header><div><small>APPROVAL RULES</small><h2>Material transaction</h2><p>Transaksi sebesar threshold atau lebih memerlukan approval CEO. Keputusan owner: mulai Rp1.000.000.</p></div></header><div className={styles.form}><label>Threshold<input type="number" min="0" value={approvalThreshold} disabled={!canManage} onChange={(event) => setApprovalThreshold(event.target.value)} /></label><label>Approver<input value="CEO" disabled /></label><label>Alasan perubahan<input value={policyReason} onChange={e => setPolicyReason(e.target.value)} disabled={!canManage} /></label><label>Awal tahun fiskal<select value={fiscalStart} disabled={!canManage} onChange={e => setFiscalStart(e.target.value)}><option value="">Belum ditetapkan</option>{Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
          {['cash','receivable','payable','advance','tax_payable','retained_earnings','distribution_payable','fixed_asset','related_receivable'].map(key => <label key={key}>{key}<select disabled={!canManage} value={mapping[key] ?? ''} onChange={e => setMapping(current => ({...current,[key]:e.target.value}))}><option value="">Belum dimapping</option>{accounts.map(account => <option key={account.code} value={account.code}>{account.code} · {account.name} ({account.account_class})</option>)}</select></label>)}{canManage ? <button className={styles.primary} disabled={saving} onClick={savePolicy}>Simpan aturan</button> : null}</div></section>
        <section className={styles.panel}><header><div><small>FISCAL PERIOD</small><h2>Kalender dan closing</h2><p>Posting ke periode tertutup memerlukan approved reopening.</p></div></header><div className={styles.form}><label>Awal tahun fiskal<select value={fiscalStart} disabled={!canManage} onChange={(event) => setFiscalStart(event.target.value)}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1)}>{new Date(targetPlan.fiscalYear, index, 1).toLocaleDateString('id-ID', { month: 'long' })}</option>)}</select></label><button className={styles.secondary} onClick={() => openSection('periods')}>Kelola closing & reopening</button></div></section>
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

    {snapshot?.requests.length ? <section className={styles.panel}><header><h2>Draft, approval & penerapan</h2><p>COO menyiapkan dan menerapkan; CEO hanya memberi keputusan. Detail payload dipertahankan untuk review.</p></header>{snapshot.requests.filter(r => r.state !== 'posted').map(r => <article key={r.id} className={styles.approvalBox}><b>{r.kind} · {r.state} · {r.id.slice(0,8)}</b><details><summary>Review detail</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(r.payload, null, 2)}</pre>{typeof r.payload.evidence_path === 'string' ? <button onClick={() => { void evidenceUrl(String(r.payload.evidence_path)).then(url => window.open(url, '_blank', 'noopener,noreferrer')).catch(e => setError(e.message)); }}>Buka bukti privat</button> : null}</details>{r.review_note ? <p>{r.review_note}</p> : null}{canManage && ['claim','estimate'].includes(r.kind) && r.state==='submitted' ? <button disabled={saving} onClick={() => { const note=window.prompt('Catatan triage COO:'); if(note) void mutate(()=>write('finance_pilot_review_scoped',{p_id:r.id,p_note:note,p_accept:true}), 'Triage tersimpan. Siapkan transaksi atau budget dari sumber ini.'); }}>Terima untuk persiapan</button> : null}{canManage && r.state === 'draft' ? <button disabled={saving} onClick={() => void mutate(() => write('finance_pilot_submit', { p_id:r.id }), 'Request dikirim.')}>Submit</button> : null}{canApprove && r.state === 'submitted' && !['claim','estimate'].includes(r.kind) ? <><button disabled={saving} onClick={() => reviewRequest(r.id,true)}>Setujui</button><button disabled={saving} onClick={() => reviewRequest(r.id,false)}>Tolak</button></> : null}{canManage && r.state === 'approved' && r.kind==='claim' ? <button onClick={() => { setClaimId(r.id); setEventAmount(String(r.payload.amount)); setEventProject(String(r.payload.project_id ?? '')); setEvidencePath(String(r.payload.evidence_path)); setDescription(String(r.payload.description)); setBusinessEvent(r.payload.project_id ? 'project_expense' : 'operating_expense'); setSection('transactions'); }}>Siapkan jurnal dari claim</button> : null}{canManage && r.state === 'approved' && !['claim','estimate'].includes(r.kind) ? <button disabled={saving} onClick={() => applyRequest(r.id)}>Terapkan approval</button> : null}</article>)}</section> : null}
    {!snapshot?.quality.policy_configured ? <p className={styles.alert}>Kebijakan belum disetujui: threshold, tahun fiskal dan mapping akun wajib ditetapkan. Posting diblokir.</p> : null}
    {(snapshot && comparison === 'Previous Period' || comparison === 'Previous Year') ? <p className={styles.notice}>Comparison revenue: {money(snapshot?.comparison.revenue ?? 0)} · {snapshot?.period.comparison_start} — {snapshot?.period.comparison_end}</p> : <p className={styles.notice}>Perbandingan {comparison} belum ditampilkan lengkap; gunakan Planning. Filter akuntansi tetap aktif.</p>}
    <footer className={styles.footer}>Finance Pilot · Supabase RPC · belum deployment/cutover produksi · <button onClick={() => openSection('periods')}>Kontrol periode</button> · <Link href="/ruang-kawan/finance/">Finance lama</Link></footer>
  </main>;
}
