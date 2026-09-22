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

async function syncToGoogleSheets(
  admin: ReturnType<typeof createClient>,
  registrationId: string,
) {
  const webhookUrl = Deno.env.get('GOOGLE_SHEETS_WEBHOOK_URL')
  const sharedSecret = Deno.env.get('NOORTURA_SHEETS_SECRET')

  if (!webhookUrl || !sharedSecret) {
    await admin
      .from('noortura_open_house_rsvps')
      .update({ sheet_sync_status: 'disabled', sheet_sync_error: 'Webhook Google Sheets belum dikonfigurasi.' })
      .eq('id', registrationId)
    return 'disabled'
  }

  const { data: registration, error: registrationError } = await admin
    .from('noortura_open_house_rsvps')
    .select('id,created_at,invited_guest_id,invited_guest_name,parent_name,whatsapp,email,adult_count,child_count,children,arrival_slot,attendance_confidence,documentation_consent,privacy_consent,status,source')
    .eq('id', registrationId)
    .single()

  if (registrationError || !registration) throw registrationError || new Error('Data RSVP tidak ditemukan.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)

  try {
    const sheetResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: sharedSecret, registration }),
      signal: controller.signal,
    })
    const result = await sheetResponse.json().catch(() => ({}))
    if (!sheetResponse.ok || result?.ok !== true) {
      throw new Error(result?.error || `Google Sheets merespons ${sheetResponse.status}.`)
    }

    await admin
      .from('noortura_open_house_rsvps')
      .update({ sheet_sync_status: 'synced', sheet_synced_at: new Date().toISOString(), sheet_sync_error: null })
      .eq('id', registrationId)
    return 'synced'
  } finally {
    clearTimeout(timeout)
  }
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

    let sheetSync = 'failed'
    try {
      sheetSync = await syncToGoogleSheets(admin, data.id)
    } catch (syncError) {
      const syncMessage = syncError instanceof Error ? syncError.message : 'Sinkronisasi Google Sheets gagal.'
      console.error('noortura-rsvp sheets sync', syncError)
      await admin
        .from('noortura_open_house_rsvps')
        .update({ sheet_sync_status: 'failed', sheet_sync_error: syncMessage.slice(0, 500) })
        .eq('id', data.id)
    }

    return response(origin, { ok: true, registration: data, sheetSync }, 201)
  } catch (error) {
    console.error('noortura-rsvp', error)
    return response(origin, { error: error instanceof Error ? error.message : 'Terjadi kendala pada server.' }, 500)
  }
})
