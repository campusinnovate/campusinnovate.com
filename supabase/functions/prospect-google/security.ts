export function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function decode(value: string) {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
}
export async function digest(value: string) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}
async function key(secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('Kunci enkripsi Google belum dikonfigurasi.');
  return crypto.subtle.importKey('raw', Uint8Array.from(secret.match(/../g)!, s => parseInt(s, 16)), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(value: unknown, secret: string, owner: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(owner) }, await key(secret), new TextEncoder().encode(JSON.stringify(value)));
  return `${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`;
}
export async function unseal(value: string, secret: string, owner: string) {
  const [iv, ciphertext] = value.split('.');
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: new TextEncoder().encode(owner) }, await key(secret), decode(ciphertext));
  return JSON.parse(new TextDecoder().decode(bytes));
}
