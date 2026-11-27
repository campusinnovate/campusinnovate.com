import html from '../../public/ittinerary/index.html?raw';
export async function GET() { return new Response(html, {headers: {'content-type':'text/html; charset=utf-8','x-robots-tag':'noindex, nofollow'}}); }
