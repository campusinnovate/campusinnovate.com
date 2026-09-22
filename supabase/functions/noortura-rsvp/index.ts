import { createClient } from 'npm:@supabase/supabase-js@2.112.3'

const allowedOrigins = new Set([
  'https://campusinnovate.com',
  'https://www.campusinnovate.com',
  'http://localhost:2242',
])

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : 'https://campusinnovate.com'
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function response(origin: string | null, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return response(origin, { error: 'Metode tidak diizinkan.' }, 405)
  if (origin && !allowedOrigins.has(origin)) return response(origin, { error: 'Origin tidak diizinkan.' }, 403)

  try {
    const contentLength = Number(req.headers.get('content-length') || '0')
    if (contentLength > 16_384) return response(origin, { error: 'Data terlalu besar.' }, 413)

    const payload = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
    const secretKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !secretKey) throw new Error('Konfigurasi backend belum tersedia.')

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await admin.rpc('register_noortura_open_house_rsvp', { payload })
    if (error) {
      const message = error.message || 'RSVP belum dapat disimpan.'
      const status = message.includes('sudah penuh') || message.includes('sudah terdaftar') ? 409 : 400
      return response(origin, { error: message }, status)
    }

    return response(origin, { ok: true, registration: data }, 201)
  } catch (error) {
    console.error('noortura-rsvp', error)
    return response(origin, { error: error instanceof Error ? error.message : 'Terjadi kendala pada server.' }, 500)
  }
})
