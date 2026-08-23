import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/ruang-kawan') || value.startsWith('//')) {
    return '/ruang-kawan/dashboard';
  }
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const providerError = url.searchParams.get('error_description') ?? url.searchParams.get('error');

  if (providerError || !code) {
    const loginUrl = new URL('/ruang-kawan', url.origin);
    loginUrl.searchParams.set('error', providerError ?? 'Kode login tidak ditemukan. Silakan coba kembali.');
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL('/ruang-kawan', url.origin);
    loginUrl.searchParams.set('error', 'Sesi tidak dapat dibuat. Silakan coba kembali.');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(safeNextPath(url.searchParams.get('next')), url.origin));
}
