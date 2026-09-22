import { createClient } from 'npm:@supabase/supabase-js@2.112.3'

const allowedOrigins = new Set([
  'https://campusinnovate.com',
  'https://www.campusinnovate.com',
  'http://localhost:2242',
])

const rsvpSelect = [
  'id', 'created_at', 'invited_guest_id', 'invited_guest_name', 'parent_name',
  'whatsapp', 'email', 'adult_count', 'child_count', 'children', 'arrival_slot',
  'attendance_confidence', 'documentation_consent', 'privacy_consent', 'status', 'source',
].join(',')

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : 'https://campusinnovate.com'
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function jsonResponse(origin: string | null, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function csvResponse(rows: unknown[][]) {
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline; filename="noortura-rsvp.csv"',
    },
  })
}

function jakartaTimestamp(value: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date(value))
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

function rsvpStatus(status: string) {
  return status === 'tentative' ? 'Tentatif' : status === 'cancelled' ? 'Tidak Hadir' : 'Hadir'
}

function childDetails(children: Array<Record<string, unknown>> | null) {
  return (children || [])
    .map((child) => `${child.name || 'Anak'} (${child.age || '-'} tahun)`)
    .join(', ')
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function adminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
  const secretKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !secretKey) throw new Error('Konfigurasi backend belum tersedia.')
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function authorizeSheetExport(admin: ReturnType<typeof createClient>, token: string | null) {
  if (!token || token.length !== 64) return false
  const tokenHash = await sha256(token)
  const { data, error } = await admin
    .from('noortura_sheet_export_tokens')
    .select('id')
    .eq('token_hash', tokenHash)
    .eq('is_active', true)
    .maybeSingle()
  if (error || !data) return false

  await admin
    .from('noortura_sheet_export_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
  return true
}

async function exportForGoogleSheet(req: Request) {
  const url = new URL(req.url)
  const view = url.searchParams.get('view')
  const admin = adminClient()

  if (!await authorizeSheetExport(admin, url.searchParams.get('token'))) {
    return new Response('Akses ditolak.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  if (view !== 'guest' && view !== 'public') {
    return new Response('View tidak valid.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  let query = admin
    .from('noortura_open_house_rsvps')
    .select(rsvpSelect)
    .eq('event_code', 'NOORTURA_OH_2026')
    .order('created_at', { ascending: true })

  query = view === 'guest'
    ? query.not('invited_guest_id', 'is', null)
    : query.is('invited_guest_id', null)

  const { data, error } = await query
  if (error) throw error

  if (view === 'guest') {
    const latestByGuest = new Map<string, Record<string, unknown>>()
    for (const row of data || []) latestByGuest.set(String(row.invited_guest_id), row)
    const rows: unknown[][] = [[
      'ID Tamu', 'WhatsApp', 'Email', 'Jumlah Dewasa', 'Jumlah Anak',
      'Status RSVP', 'Slot Kedatangan', 'Nama Pengisi RSVP', 'Waktu RSVP',
    ]]
    for (const row of latestByGuest.values()) {
      rows.push([
        row.invited_guest_id, row.whatsapp, row.email, row.adult_count, row.child_count,
        rsvpStatus(String(row.status)), row.arrival_slot, row.parent_name,
        jakartaTimestamp(String(row.created_at)),
      ])
    }
    return csvResponse(rows)
  }

  const rows: unknown[][] = [[
    'Waktu Daftar', 'ID RSVP', 'Nama Orang Tua / Pendamping', 'WhatsApp', 'Email',
    'Jumlah Dewasa', 'Jumlah Anak', 'Detail Anak', 'Slot Kedatangan', 'Kepastian Hadir',
    'Status RSVP', 'Izin Dokumentasi', 'Persetujuan Privasi', 'Sumber', 'Catatan Admin',
  ]]
  for (const row of data || []) {
    rows.push([
      jakartaTimestamp(String(row.created_at)),
      row.id,
      row.parent_name,
      row.whatsapp,
      row.email,
      row.adult_count,
      row.child_count,
      childDetails(row.children as Array<Record<string, unknown>> | null),
      row.arrival_slot,
      `${row.attendance_confidence}%`,
      rsvpStatus(String(row.status)),
      row.documentation_consent,
      row.privacy_consent,
      row.source,
      '',
    ])
  }
  return csvResponse(rows)
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })

  try {
    if (req.method === 'GET') return await exportForGoogleSheet(req)
    if (req.method !== 'POST') return jsonResponse(origin, { error: 'Metode tidak diizinkan.' }, 405)
    if (origin && !allowedOrigins.has(origin)) {
      return jsonResponse(origin, { error: 'Origin tidak diizinkan.' }, 403)
    }

    const contentLength = Number(req.headers.get('content-length') || '0')
    if (contentLength > 16_384) return jsonResponse(origin, { error: 'Data terlalu besar.' }, 413)

    const payload = await req.json()
    const admin = adminClient()
    const { data, error } = await admin.rpc('register_noortura_open_house_rsvp', { payload })
    if (error) {
      const message = error.message || 'RSVP belum dapat disimpan.'
      const status = message.includes('sudah penuh') || message.includes('sudah terdaftar') ? 409 : 400
      return jsonResponse(origin, { error: message }, status)
    }

    await admin
      .from('noortura_open_house_rsvps')
      .update({
        sheet_sync_status: 'synced',
        sheet_synced_at: new Date().toISOString(),
        sheet_sync_error: null,
      })
      .eq('id', data.id)

    return jsonResponse(origin, { ok: true, registration: data, sheetSync: 'available' }, 201)
  } catch (error) {
    console.error('noortura-rsvp', error)
    return jsonResponse(origin, {
      error: error instanceof Error ? error.message : 'Terjadi kendala pada server.',
    }, 500)
  }
})
