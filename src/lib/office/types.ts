export type Signature = { membership_id: string; name: string; path: string; shared: boolean };
export type Placement = { membership_id: string; page: number; x: number; y: number; width: number; height: number };
export type Signer = Placement & { name: string; signature_path: string; approved_at: string | null; rejected_at: string | null };
export type OfficeDocument = { approval_mode: 'required' | 'direct'; id: string; title: string; creator_id: string; source_path: string; source_hash: string; output_path: string | null; output_hash: string | null; page_count: number; status: 'pending' | 'completed' | 'cancelled'; credential: string; created_at: string; completed_at: string | null; signers: Signer[] };
export async function sha256(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join('');
}
export function validPlacement(p: Placement, pages: number) {
  return Number.isInteger(p.page) && p.page >= 1 && p.page <= pages && [p.x,p.y,p.width,p.height].every(Number.isFinite) && p.x >= 0 && p.y >= 0 && p.width >= .05 && p.height >= .03 && p.x + p.width <= 1.00001 && p.y + p.height <= 1.00001;
}
