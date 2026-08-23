export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://lxwqhtuhlddgwfxjtlas.supabase.co';
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_2HRATr5AEimytbHaCk00zQ_qq5XUrHi';

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function getSupabaseConfig() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Konfigurasi Supabase belum tersedia.');
  }

  return { supabaseUrl, supabasePublishableKey };
}
