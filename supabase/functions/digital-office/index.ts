import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, degrees, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import QRCode from 'npm:qrcode@1.5.4';
import { pdfPlacement } from '../../../src/lib/office/geometry.ts';
import { validPlacement } from '../../../src/lib/office/types.ts';
const url = Deno.env.get('SUPABASE_URL')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const origin = Deno.env.get('APP_ORIGIN') ?? 'https://campusinnovate.com';
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } }); }
async function hash(bytes: Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer))).map(n => n.toString(16).padStart(2, '0')).join(''); }
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return response({});
  if (req.method !== 'POST' || !new URL(req.url).pathname.endsWith('/finalize')) return response({ error: 'Route tidak tersedia.' }, 404);
  try {
    const authorization = req.headers.get('Authorization') ?? '';
    if (!authorization.startsWith('Bearer ')) return response({ error: 'Silakan masuk kembali.' }, 401);
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const user = await caller.auth.getUser(); if (user.error || !user.data.user) return response({ error: 'Sesi tidak valid.' }, 401);
    const actor = await caller.rpc('current_membership_id'); if (!actor.data) return response({ error: 'Keanggotaan aktif diperlukan.' }, 403);
    const body = await req.json();
    const result = await service.from('office_documents').select('*').eq('id', String(body.documentId ?? '')).single();
    const doc = result.data;
    if (!doc || doc.creator_id !== actor.data) return response({ error: 'Hanya pembuat dokumen yang dapat melakukan finalisasi.' }, 403);
    if (doc.status !== 'pending') return response({ error: 'Dokumen tidak sedang menunggu finalisasi.' }, 409);
    const signers = await service.from('office_signers').select('*').eq('document_id', doc.id);
    if (signers.error || !signers.data?.length || signers.data.some(s => (doc.approval_mode !== 'direct' && !s.approved_at) || s.rejected_at)) return response({ error: 'Persetujuan seluruh pemilik tanda tangan diperlukan.' }, 409);
    const source = await service.storage.from('office-documents').download(doc.source_path); if (source.error) throw new Error('PDF sumber tidak dapat dimuat.');
    const sourceBytes = new Uint8Array(await source.data.arrayBuffer());
    if (await hash(sourceBytes) !== doc.source_hash) throw new Error('Hash PDF sumber tidak cocok.');
    const pdf = await PDFDocument.load(sourceBytes);
    if (pdf.getPageCount() !== doc.page_count || signers.data.some(s => !validPlacement(s, doc.page_count))) throw new Error('Halaman atau posisi tanda tangan tidak valid.');
    for (const signer of signers.data) {
      const asset = await service.storage.from('office-signatures').download(signer.signature_path); if (asset.error) throw new Error('Data tanda tangan tidak dapat dibaca.');
      const image = await pdf.embedPng(await asset.data.arrayBuffer());
      const page = pdf.getPage(signer.page - 1), box = page.getCropBox();
      const pos = pdfPlacement(signer, box.width, box.height, page.getRotation().angle);
      const scale = Math.min(pos.width / image.width, pos.height / image.height);
      const fit = { ...signer, width: signer.width * image.width * scale / pos.width, height: signer.height * image.height * scale / pos.height };
      fit.x += (signer.width - fit.width) / 2; fit.y += (signer.height - fit.height) / 2;
      const placement = pdfPlacement(fit, box.width, box.height, page.getRotation().angle);
      page.drawImage(image, { ...placement, x: placement.x + box.x, y: placement.y + box.y, rotate: degrees(placement.rotate) });
    }
    // A dedicated final credential page avoids covering source document content.
    const credentialPage = pdf.addPage([595, 842]); const font = await pdf.embedFont(StandardFonts.Helvetica);
    const qrData = await QRCode.toDataURL(`${origin}/ruang-kawan/digital-office/verify/?credential=${doc.credential}`, { width: 300, margin: 2, errorCorrectionLevel: 'M' });
    const qr = await pdf.embedPng(qrData);
    credentialPage.drawText('CAMPUS INNOVATE', { x: 48, y: 770, size: 24, font, color: rgb(.09,.22,.35) });
    credentialPage.drawText('Digital Office - Kredensial Internal', { x: 48, y: 733, size: 18, font });
    credentialPage.drawImage(qr, { x: 48, y: 500, width: 200, height: 200 });
    credentialPage.drawText(doc.credential, { x: 48, y: 466, size: 12, font });
    credentialPage.drawText(doc.approval_mode === 'direct' ? `${signers.data.length} tanda tangan digunakan tanpa approval per dokumen.` : `${signers.data.length} persetujuan pemilik tanda tangan tercatat.`, { x: 48, y: 430, size: 12, font });
    credentialPage.drawText('Pindai QR dengan akun peserta untuk memeriksa penggunaan TTD dan hash PDF.', { x: 48, y: 405, size: 11, font });
    const output = await pdf.save(); const outputHash = await hash(output);
    const path = `${user.data.user.id}/${doc.id}/${crypto.randomUUID()}.pdf`;
    const upload = await service.storage.from('office-documents').upload(path, output, { contentType: 'application/pdf', upsert: false }); if (upload.error) throw new Error('PDF hasil gagal diunggah.');
    const saved = await service.rpc('complete_office_document', { target: doc.id, file_path: path, file_hash: outputHash });
    if (saved.error) { await service.storage.from('office-documents').remove([path]); throw new Error('Dokumen telah berubah atau finalisasi sudah diproses. Muat ulang sebelum mencoba kembali.'); }
    return response({ ready: true, hash: outputHash });
  } catch (error) { return response({ error: error instanceof Error ? error.message : 'Finalisasi PDF gagal.' }, 400); }
});
