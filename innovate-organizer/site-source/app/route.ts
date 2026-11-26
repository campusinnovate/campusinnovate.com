import html from '../site.html?raw';
export async function GET() {
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
