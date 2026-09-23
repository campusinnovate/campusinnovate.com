const productionOrigins = new Set([
  'https://campusinnovate.com',
  'https://www.campusinnovate.com',
]);

const APPS_SCRIPT_RSVP_URL =
  'https://script.google.com/macros/s/AKfycbylLK7XLqMvRSZQGPrhOz2zjkzQu8zYBE73oNqXb0b7fEo3lDLv3ZTnPvMP6fKOIwHx9A/exec';
const UPSTREAM_ATTEMPTS = 2;
const UPSTREAM_TIMEOUT_MS = 18_000;

type JsonObject = Record<string, unknown>;

function isAllowedOrigin(origin: string | null) {
  if (!origin) return true;
  if (productionOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && isAllowedOrigin(origin)
    ? origin
    : 'https://campusinnovate.com';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'content-type, x-client-info, apikey, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonResponse(origin: string | null, body: JsonObject, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function validRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{15,99}$/.test(value);
}

function upstreamErrorStatus(code: string) {
  if (code === 'SLOT_FULL' || code === 'DUPLICATE_RSVP') return 409;
  if (code === 'VALIDATION_ERROR' || code === 'GUEST_NOT_FOUND') return 400;
  return 502;
}

async function sendToAppsScript(payload: JsonObject) {
  let lastError: unknown = new Error('Google Sheet belum merespons.');

  for (let attempt = 1; attempt <= UPSTREAM_ATTEMPTS; attempt += 1) {
    try {
      const form = new URLSearchParams({
        payload: JSON.stringify({ ...payload, responseMode: 'json' }),
      });
      const response = await fetch(APPS_SCRIPT_RSVP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: form.toString(),
        redirect: 'follow',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Google Apps Script merespons HTTP ${response.status}.`);
      }

      const contentType = response.headers.get('content-type') || '';
      const body = await response.text();
      if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error('Google Apps Script belum mengirim respons JSON.');
      }

      const result = JSON.parse(body) as JsonObject;
      if (result.requestId !== payload.requestId) {
        throw new Error('Request ID balasan Google Sheet tidak cocok.');
      }

      return result;
    } catch (error) {
      lastError = error;
      console.warn('noortura-rsvp-submit upstream attempt failed', { attempt, error });
    }
  }

  throw lastError;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) return jsonResponse(origin, { ok: false, code: 'ORIGIN_DENIED', error: 'Origin tidak diizinkan.' }, 403);
    return new Response('ok', { headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') return jsonResponse(origin, { ok: false, code: 'METHOD_NOT_ALLOWED', error: 'Metode tidak diizinkan.' }, 405);
  if (!isAllowedOrigin(origin)) return jsonResponse(origin, { ok: false, code: 'ORIGIN_DENIED', error: 'Origin tidak diizinkan.' }, 403);

  const contentLength = Number(req.headers.get('content-length') || '0');
  if (contentLength > 16_384) return jsonResponse(origin, { ok: false, code: 'PAYLOAD_TOO_LARGE', error: 'Data terlalu besar.' }, 413);

  try {
    const payload = await req.json() as JsonObject;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return jsonResponse(origin, { ok: false, code: 'VALIDATION_ERROR', error: 'Data RSVP tidak valid.' }, 400);
    }
    if (!validRequestId(payload.requestId)) {
      return jsonResponse(origin, { ok: false, code: 'VALIDATION_ERROR', error: 'Request ID RSVP belum valid.' }, 400);
    }
    if (String(payload.website || '')) {
      return jsonResponse(origin, { ok: true, requestId: payload.requestId, filtered: true }, 201);
    }

    const result = await sendToAppsScript(payload);
    if (!result.ok) {
      const code = String(result.code || 'RSVP_ERROR');
      return jsonResponse(origin, {
        ok: false,
        requestId: payload.requestId,
        code,
        error: String(result.error || 'RSVP belum dapat disimpan.'),
      }, upstreamErrorStatus(code));
    }

    return jsonResponse(origin, {
      ok: true,
      requestId: payload.requestId,
      mode: result.mode || null,
      row: result.row || null,
      replayed: result.replayed === true,
    }, result.replayed === true ? 200 : 201);
  } catch (error) {
    console.error('noortura-rsvp-submit', error);
    const timeout = error instanceof DOMException && error.name === 'TimeoutError';
    return jsonResponse(origin, {
      ok: false,
      code: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
      error: timeout
        ? 'Server RSVP belum memberi kepastian. Silakan kirim ulang; permintaan yang sama tidak akan tercatat dua kali.'
        : 'Server RSVP belum dapat memberi kepastian. Silakan coba kembali.',
    }, timeout ? 504 : 502);
  }
});
