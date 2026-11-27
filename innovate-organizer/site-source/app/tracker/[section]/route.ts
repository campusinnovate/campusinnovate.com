import rundown from '../../../public/tracker/rundown.html?raw';
import panitia from '../../../public/tracker/panitia.html?raw';
import peserta from '../../../public/tracker/peserta.html?raw';
import logistik from '../../../public/tracker/logistik.html?raw';
import kontak from '../../../public/tracker/kontak.html?raw';
const pages: Record<string,string> = {rundown,panitia,peserta,logistik,kontak};
export async function GET(request: Request) {
 const name = new URL(request.url).pathname.replace(/\/$/, "").split("/").pop() || "";
 const html = pages[name];
 return new Response(html || "Halaman tidak ditemukan", {status:html?200:404,headers:{"content-type":"text/html; charset=utf-8","x-robots-tag":"noindex, nofollow"}});
}
