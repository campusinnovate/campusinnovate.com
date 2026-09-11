import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export async function prospectRequest<T>(name: string, body: unknown): Promise<T> {
  const client = createClient();
  const session = (await client.auth.getSession()).data.session;
  if (!session) throw new Error('Sesi berakhir. Silakan masuk kembali.');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Permintaan tidak valid.');
  const result = await client.functions.invoke(name, { body: body as Record<string, unknown>, headers: { Authorization: `Bearer ${session.access_token}` } });
  if (result.error instanceof FunctionsFetchError) throw new Error(`Layanan ${name} tidak dapat dihubungi. Periksa deployment Edge Function dan koneksi internet.`);
  if (result.error instanceof FunctionsHttpError) {
    const detail = await result.error.context.json().catch(() => null);
    if (result.error.context.status === 404 && detail?.code === 'NOT_FOUND') throw new Error(`Edge Function ${name} belum dideploy di Supabase.`);
    throw new Error(detail?.message || detail?.error || `Layanan gagal (HTTP ${result.error.context.status}).`);
  }
  if (result.error) throw result.error;
  return result.data as T;
}
