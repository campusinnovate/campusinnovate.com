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
  const spreadsheetId = '18BmluvyFClHJwjAuJRocDcj-Wdkeumd9gSBcx-nd74M'
  const googleClientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID')
  const googleClientSecret = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET')

  if (!googleClientId || !googleClientSecret) throw new Error('Konfigurasi Google Workspace belum tersedia.')

  const { data: registration, error: registrationError } = await admin
    .from('noortura_open_house_rsvps')
    .select('id,created_at,invited_guest_id,invited_guest_name,parent_name,whatsapp,email,adult_count,child_count,children,arrival_slot,attendance_confidence,documentation_consent,privacy_consent,status,source')
    .eq('id', registrationId)
    .single()

  if (registrationError || !registration) throw registrationError || new Error('Data RSVP tidak ditemukan.')

  const { data: connection, error: connectionError } = await admin
    .from('google_calendar_connections')
    .select('id,access_token,refresh_token,token_expires_at')
    .eq('google_account_email', 'innovatecampus@gmail.com')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (connectionError || !connection?.refresh_token) {
    throw connectionError || new Error('Akun Google Campus Innovate belum terhubung.')
  }

  let accessToken = connection.access_token
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0
  if (!accessToken || expiresAt <= Date.now() + 90_000) {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const token = await tokenResponse.json()
    if (!tokenResponse.ok || !token.access_token) {
      throw new Error(token.error_description || 'Token Google tidak dapat diperbarui.')
    }
    accessToken = token.access_token
    await admin.from('google_calendar_connections').update({
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id)
  }

  const sheetsRequest = async (path: string, init?: RequestInit) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)
    try {
      const googleResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
        signal: controller.signal,
      })
      const result = await googleResponse.json().catch(() => ({}))
      if (!googleResponse.ok) throw new Error(result?.error?.message || `Google Sheets merespons ${googleResponse.status}.`)
      return result
    } finally {
      clearTimeout(timeout)
    }
  }

  const timestamp = new Date(registration.created_at).getTime() / 86_400_000 + 25_569
  const rsvpStatus = registration.status === 'tentative' ? 'Tentatif' : 'Hadir'

  if (registration.invited_guest_id) {
    const range = encodeURIComponent("'Guest List'!A5:A1000")
    const guestIds = await sheetsRequest(`/values/${range}?majorDimension=ROWS`)
    const index = (guestIds.values || []).findIndex((row: unknown[]) => row?.[0] === registration.invited_guest_id)
    if (index < 0) throw new Error(`ID tamu ${registration.invited_guest_id} tidak ditemukan di Guest List.`)
    const row = index + 5

    await sheetsRequest('/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'Guest List'!E${row}:H${row}`, values: [[registration.whatsapp, registration.email, registration.adult_count, registration.child_count]] },
          { range: `'Guest List'!J${row}:M${row}`, values: [[rsvpStatus, registration.arrival_slot, registration.parent_name, timestamp]] },
        ],
      }),
    })
  } else {
    const idRange = encodeURIComponent("'RSVP Publik'!B5:B1000")
    const publicIds = await sheetsRequest(`/values/${idRange}?majorDimension=ROWS`)
    const index = (publicIds.values || []).findIndex((row: unknown[]) => row?.[0] === registration.id)
    const children = (registration.children || [])
      .map((child: Record<string, unknown>) => `${child.name} (${child.age} tahun)`)
      .join(', ')
    const values = [[
      timestamp,
      registration.id,
      registration.parent_name,
      registration.whatsapp,
      registration.email,
      registration.adult_count,
      registration.child_count,
      children,
      registration.arrival_slot,
      `${registration.attendance_confidence}%`,
      rsvpStatus,
      registration.documentation_consent,
      registration.privacy_consent,
      registration.source,
      '',
    ]]

    if (index >= 0) {
      const row = index + 5
      const range = encodeURIComponent(`'RSVP Publik'!A${row}:O${row}`)
      await sheetsRequest(`/values/${range}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values }) })
    } else {
      const range = encodeURIComponent("'RSVP Publik'!A:O")
      await sheetsRequest(`/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        body: JSON.stringify({ values }),
      })
    }
  }

  await admin
    .from('noortura_open_house_rsvps')
    .update({ sheet_sync_status: 'synced', sheet_synced_at: new Date().toISOString(), sheet_sync_error: null })
    .eq('id', registrationId)
  return 'synced'
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
