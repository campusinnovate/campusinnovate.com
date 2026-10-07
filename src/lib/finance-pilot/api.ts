import { createClient } from '@/lib/supabase/client';
import { getSupabaseConfig } from '@/lib/supabase/config';

export type Payload = Record<string, unknown>;
export type Request = { id: string; request_key: string; kind: string; state: string; payload: Payload; prepared_by: string; approved_by: string | null; review_note: string | null; created_at: string };
export type ReportRow = { label: string; value: number; coa_code?: string; opening?: number; debit?: number; credit?: number; due_date?: string; days_overdue?: number; aging_bucket?: string; request_id?: string; journal_id?: string; document_id?: string };
export type Snapshot = {
 period: { start: string | null; end: string; fiscal_year: number | null; fiscal_start: string | null; comparison_start: string | null; comparison_end: string | null };
 updated_at: string;
 policy: { approval_threshold: number; fiscal_start: number; accounts: Record<string, string> } | null;
 accounts: unknown[]; services: unknown[]; projects: unknown[]; project_options: unknown[]; journals: unknown[]; periods: unknown[]; invoices: unknown[]; receipts: unknown[];
 vendor_bills: { id: string; reference: string; vendor: string; bill_date: string; due_date: string; project_id: string | null; journal_id: string; evidence_path: string; amount: number; balance: number }[];
 requests: Request[]; journal_count: number; posted_value: number;
 totals: { revenue: number; hpp: number; opex: number; gross_profit: number; operating_profit: number; net_profit: number; billed: number; collected: number; outstanding: number };
 comparison: { revenue: number; hpp: number; opex: number };
 reports: Record<string, ReportRow[]>;
 service_stats: { service_line_key: string; label: string; revenue: number; hpp: number }[];
 cash: { book_cash: number; payables: number; taxes: number; distribution: number; reconciled: boolean; free_cash: number | null; restrictions: number; operating_target: number | null; buckets: { key: string; label: string; amount: number; restricted: boolean }[] };
 target: { latest: Request | null; original: Payload | null; actual: number; monthly: { month: number; target: number; actual: number }[] };
 outcomes: { id: string; lead_code: string; account_name: string; stage: string; proposal_value: number | null; won_value: number | null; outcome_date: string; win_loss_reason: string | null; project_id: string | null }[];
 quality: { policy_configured: boolean; unmapped_legacy_count: number; ledger_difference: number; unmapped_deals: number; unallocated_ap: number; scope: string };
};
export const writesEnabled = process.env.NEXT_PUBLIC_FINANCE_PILOT_WRITES_ENABLED === 'true';
const pilotTarget = process.env.NEXT_PUBLIC_FINANCE_PILOT_TARGET ?? 'public';
export const sharedDev = pilotTarget === 'shared-dev';
const evidenceBucket = sharedDev ? 'finance-pilot-dev-evidence' : 'finance-pilot-evidence';
function assertTarget() {
 if (!['public', 'shared-dev'].includes(pilotTarget)) throw new Error('Target Finance Pilot tidak valid; akses diblokir.');
 if (sharedDev && getSupabaseConfig().supabaseUrl.replace(/\/$/, '') !== 'https://lxwqhtuhlddgwfxjtlas.supabase.co') throw new Error('Project shared DEV tidak cocok.');
}
export async function rpc<T>(name: string, args: Payload = {}): Promise<T> {
 assertTarget();
 if (!/^finance_(pilot|next)_[a-z_]+$/.test(name)) throw new Error('RPC di luar scope Finance Pilot.');
 const client = createClient();
 let targetName = name;
 if (sharedDev) {
  const bound = await client.rpc('finance_pilot_dev_bind');
  if (bound.error) throw new Error(bound.error.message);
  targetName = name.startsWith('finance_pilot_') ? name.replace('finance_pilot_', 'finance_pilot_dev_') : name.replace('finance_next_', 'finance_pilot_dev_next_');
 }
 const { data, error } = await client.rpc(targetName, args);
 if (error) throw new Error(error.message);
 return data as T;
}
export async function write<T>(name: string, args: Payload = {}): Promise<T> {
 if (!writesEnabled) throw new Error('Write gate belum diaktifkan. Gunakan environment DEV terisolasi; produksi memerlukan persetujuan.');
 return rpc<T>(name, args);
}
// Persist keys before sending, so a network failure/reload can retry the same operation.
// Only operation metadata is stored; evidence/financial payloads remain in Supabase.
export async function operationKey(scope: string, payload: Payload): Promise<string> {
 const serialized = JSON.stringify(payload);
 const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
 const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
 const storageKey = `finance-pilot:${sharedDev ? 'shared-dev:' : ''}operation:${scope}:${hash}`;
 const saved = sessionStorage.getItem(storageKey);
 if (saved) return saved;
 const key = crypto.randomUUID(); sessionStorage.setItem(storageKey, key); return key;
}
export async function saveRequest(kind: string, payload: Payload, submit = false): Promise<string> {
 const id = await write<string>('finance_pilot_save_request', { p_key: await operationKey(kind, payload), p_kind: kind, p_payload: payload });
 if (submit) await write('finance_pilot_submit', { p_id: id });
 return id;
}
export async function uploadEvidence(file: File): Promise<string> {
 assertTarget();
 if (!writesEnabled) throw new Error('Write gate belum aktif.');
 if (file.size > 10485760 || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) throw new Error('Bukti harus PDF/PNG/JPEG maksimum 10 MB.');
 if (sharedDev) await rpc('finance_pilot_identity');
 const client = createClient(); const { data, error } = await client.auth.getUser();
 if (error || !data.user) throw new Error('Sesi aktif diperlukan.');
 const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
 const path = `${data.user.id}/${crypto.randomUUID()}.${ext}`;
 const result = await client.storage.from(evidenceBucket).upload(path, file, { upsert: false, contentType: file.type });
 if (result.error) throw new Error(result.error.message);
 return path;
}
export async function evidenceUrl(path: string): Promise<string> {
 assertTarget();
 if (sharedDev) await rpc('finance_pilot_identity');
 const { data, error } = await createClient().storage.from(evidenceBucket).createSignedUrl(path, 60);
 if (error || !data) throw new Error(error?.message || 'Bukti tidak tersedia.');
 return data.signedUrl;
}
export function reportCsv(rows: ReportRow[]): string {
 // Formula injection protection on text. Numeric negatives are legitimate accounting values.
 const cell = (v: unknown) => { let s = String(v ?? ''); if (/^[=+@\t\r-]/.test(s) && typeof v !== 'number') s = `'${s}`; return `"${s.replaceAll('"', '""')}"`; };
 return '\uFEFF' + [['Account / label', 'Amount', 'Opening', 'Debit', 'Credit', 'Due date', 'Days overdue', 'Aging bucket', 'Document ID', 'Request ID', 'Journal ID'], ...rows.map(r => [r.label, r.value, r.opening ?? '', r.debit ?? '', r.credit ?? '', r.due_date ?? '', r.days_overdue ?? '', r.aging_bucket ?? '', r.document_id ?? '', r.request_id ?? '', r.journal_id ?? ''])].map(row => row.map(cell).join(',')).join('\r\n');
}
