import { createClient } from 'npm:@supabase/supabase-js@2';

const URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const GROQ_KEY=Deno.env.get('GROQ_API_KEY')!;
const MODEL=Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-20b';
const ORIGIN=Deno.env.get('APP_ORIGIN') ?? 'https://campusinnovate.com';

function cors(origin:string|null){const ok=origin===ORIGIN||origin?.startsWith('http://localhost:');return{'Access-Control-Allow-Origin':ok?origin!:ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'};}
function json(value:unknown,status:number,origin:string|null){return new Response(JSON.stringify(value),{status,headers:{...cors(origin),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
function clean(value:unknown,max:number){return typeof value==='string'?value.trim().slice(0,max):'';}
function sources(context:Record<string,unknown>){const seen=new Set<string>();const out:Array<{label:string;url:string}>[]=[];const visit=(value:unknown)=>{if(!value||typeof value!=='object')return;const item=value as Record<string,unknown>;const url=typeof item.module_route==='string'?item.module_route:typeof item.action_url==='string'?item.action_url:'';const title=typeof item.title==='string'?item.title:'';if(url&&title&&!seen.has(url)){seen.add(url);out.push({label:title,url});}Object.values(item).forEach(v=>Array.isArray(v)?v.forEach(visit):undefined);};visit(context);return out.slice(0,16);}

Deno.serve(async req=>{
 const origin=req.headers.get('Origin');
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=='POST')return json({error:'Metode tidak didukung.'},405,origin);
 if(!GROQ_KEY)return json({error:'Kawan AI belum dikonfigurasi.'},503,origin);
 const authorization=req.headers.get('Authorization');
 if(!authorization?.startsWith('Bearer '))return json({error:'Sesi tidak valid.'},401,origin);
 const client=createClient(URL,KEY,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await client.auth.getUser();
 if(userError||!user)return json({error:'Sesi tidak valid.'},401,origin);
 const body=await req.json().catch(()=>({})) as Record<string,unknown>;
 const mode=clean(body.mode,24)||'chat';
 const prompt=clean(body.prompt,2000);
 if(mode!=='morning_briefing'&&!prompt)return json({error:'Pertanyaan wajib diisi.'},400,origin);
 const contextResult=await client.rpc('kawan_ai_ceo_context');
 if(contextResult.error)return json({error:contextResult.error.code==='42501'?'Kawan AI Asisten CEO tidak tersedia untuk akun ini.':'Konteks CEO belum dapat dimuat.'},contextResult.error.code==='42501'?403:400,origin);
 const context=contextResult.data as Record<string,unknown>;
 const today=String(context.today??'');
 const historyResult=await client.rpc('kawan_ai_ceo_history');
 const history=historyResult.error?[]:historyResult.data;
 if(mode==='morning_briefing'){
   const already=Array.isArray(history)&&history.find((item:Record<string,unknown>)=>item.message_kind==='morning_briefing'&&String(item.briefing_date)===today);
   if(already)return json({message:already,existing:true},200,origin);
 }
 const schema={type:'object',additionalProperties:false,required:['answer'],properties:{answer:{type:'string',minLength:1,maxLength:6000}}};
 const instruction='Kamu adalah Kawan AI — Asisten CEO Campus Innovate. Jawab dalam Bahasa Indonesia yang ringkas, akurat, dan action-oriented. Hanya gunakan konteks terotorisasi. Jangan mengarang data, tanggal, meeting, keputusan, atau status. Jika data tidak tersedia, katakan jelas. Zona waktu selalu Asia/Jakarta. Aturan prioritas CEO: deadline dan keterlambatan selalu menjadi faktor utama; deadline hari ini atau pekerjaan overdue wajib ditandai sebagai mendesak. Setelah itu gunakan urgency, dampak bisnis, nilai klien, dependensi, dan keterlibatan CEO sebagai tie-breaker. Project berisiko wajib disorot bila memenuhi salah satu indikator: berstatus blocked/terhambat, progres di bawah 50% ketika deadline mendekat, tidak ada update selama tujuh hari, atau status tidak berubah saat deadline dekat. Approval dideteksi dari kombinasi status dan kata kunci yang relevan dalam judul/detail—misalnya approval, review, proposal, pricing, negosiasi, quotation, deck, materi, keputusan, scope, revisi—dan wajib disorot bila terkait proposal/pricing/negosiasi klien, finalisasi deck/materi, keputusan project, atau perubahan scope. Untuk rekomendasi delegasi, sertakan peran atau PIC yang cocok hanya bila didukung konteks; selalu berikan deadline usulan dan draft assignment. Jangan mengklaim assignment sudah dibuat. Kelompokkan rekomendasi menjadi: Kerjakan sekarang, Selesaikan hari ini, Delegasikan, Pantau, Bisa ditunda. Saat diminta menjadwalkan, rekomendasikan slot waktu otomatis bila data memungkinkan, tetapi hanya sebagai draft. Jangan pernah membuat, mengubah, atau membatalkan agenda maupun deadline; semua tindakan tersebut wajib menunggu konfirmasi eksplisit pengguna.';
 const input=mode==='morning_briefing'
   ? 'Buat briefing CEO lengkap untuk hari ini. Cantumkan: seluruh tugas hari ini, overdue penting, deadline tujuh hari ke depan, meeting, follow-up pipeline, project berisiko, approval yang memerlukan keputusan CEO, notifikasi penting, lalu prioritas dengan kelompok Kerjakan sekarang, Selesaikan hari ini, Delegasikan, Pantau, dan Bisa ditunda. Gunakan heading yang mudah dipindai dan tetap ringkas pada tiap item. Akhiri dengan satu pertanyaan tindak lanjut.'
   : prompt;
 const response=await fetch('https://api.groq.com/openai/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${GROQ_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,max_output_tokens:1800,instructions:instruction,input:`Pertanyaan: ${input}\n\nKonteks terotorisasi: ${JSON.stringify(context).slice(0,26000)}`,text:{format:{type:'json_schema',name:'kawan_ai_ceo_response',strict:true,schema}}})});
 const raw=await response.json().catch(()=>({}));
 if(!response.ok)return json({error:'Kawan AI belum dapat memproses permintaan.'},502,origin);
 const output=raw.output_text??raw.output?.flatMap((x:Record<string,unknown>)=>Array.isArray(x.content)?x.content:[]).find((x:Record<string,unknown>)=>x.type==='output_text')?.text;
 let answer='';try{answer=JSON.parse(String(output??'')).answer;}catch{return json({error:'Jawaban Kawan AI tidak dapat dibaca.'},502,origin);}
 const membershipResult=await client.rpc('current_membership_id');\n const membership=membershipResult.data as string | null;\n if(!membership)return json({error:'Keanggotaan aktif tidak ditemukan.'},403,origin);
 const cited=sources(context);
 if(mode==='chat')await client.from('kawan_ai_ceo_messages').insert({membership_id:membership,role:'user',message_kind:'chat',content:prompt,sources:[]});
 const saved=await client.from('kawan_ai_ceo_messages').insert({membership_id:membership,role:'assistant',message_kind:mode==='morning_briefing'?'morning_briefing':'chat',content:answer,sources:cited,briefing_date:mode==='morning_briefing'?today:null}).select().single();
 if(saved.error)return json({error:'Jawaban tersedia, tetapi riwayat tidak tersimpan.'},500,origin);
 return json({message:saved.data,existing:false,model:MODEL},200,origin);
});