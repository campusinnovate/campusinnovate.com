export function normalizePhone(value: string): string {
  let phone = value.replace(/[\s()+.-]/g, '');
  if (phone.startsWith('0')) phone = `62${phone.slice(1)}`;
  if (!/^[1-9]\d{6,14}$/.test(phone)) throw new Error('Invalid phone');
  return phone;
}
export async function verifySignature(raw: string, signature: string | null, secret: string) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = Uint8Array.from(signature.slice(7).match(/../g)!, hex => parseInt(hex, 16));
  return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(raw));
}
export function messageContent(message: Record<string, any>): string {
  if (message.type === 'text') return String(message.text?.body ?? '');
  if (message.type === 'button') return String(message.button?.text ?? '[Button]');
  if (message.type === 'interactive') return String(message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? '[Interactive]');
  const media = message[message.type];
  return `[${String(message.type ?? 'unknown')}]${media?.caption ? ` ${media.caption}` : ''}`;
}
