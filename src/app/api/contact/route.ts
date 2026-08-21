import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const attempts = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 4;

type InquiryInput = {
  name?: unknown;
  organization?: unknown;
  email?: unknown;
  message?: unknown;
  website?: unknown;
};

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const clientId = forwarded?.split(',')[0]?.trim() || request.ip || 'local';
  const now = Date.now();
  const recent = (attempts.get(clientId) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) return NextResponse.json({ message: 'Too many inquiries. Please wait a moment and try again.' }, { status: 429 });
  recent.push(now);
  attempts.set(clientId, recent);

  let input: InquiryInput;
  try {
    input = await request.json() as InquiryInput;
  } catch {
    return NextResponse.json({ message: 'The inquiry could not be read.' }, { status: 400 });
  }

  if (clean(input.website, 200)) return NextResponse.json({ received: true }, { status: 202 });

  const name = clean(input.name, 120);
  const organization = clean(input.organization, 180);
  const email = clean(input.email, 180).toLowerCase();
  const message = clean(input.message, 4000);
  if (!name) return NextResponse.json({ message: 'Please enter your name.' }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ message: 'Please enter a valid email address.' }, { status: 400 });
  if (!message) return NextResponse.json({ message: 'Please tell us a little about your inquiry.' }, { status: 400 });

  const webhookUrl = process.env.CONTACT_WEBHOOK_URL;
  if (!webhookUrl) return NextResponse.json({ message: 'Online inquiry is being connected. Please contact us through WhatsApp or email for now.' }, { status: 503 });

  const payload = { name, organization: organization || undefined, email, message, source: 'website-contact', status: 'new', submittedAt: new Date().toISOString() };
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CONTACT_WEBHOOK_SECRET ? { Authorization: `Bearer ${process.env.CONTACT_WEBHOOK_SECRET}` } : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Webhook rejected the inquiry.');
    return NextResponse.json({ received: true }, { status: 201 });
  } catch {
    return NextResponse.json({ message: 'Something went wrong. Please try again or contact us through WhatsApp.' }, { status: 502 });
  }
}
