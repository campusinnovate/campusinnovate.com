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


function contextList(context:Record<string,unknown>,key:string){return Array.isArray(context[key])?context[key] as Array<Record<string,unknown>>:[];}
function itemTitle(item:Record<string,unknown>){return clean(item.title,140)||'Aktivitas tanpa judul';}
function itemDate(item:Record<string,unknown>){return clean(item.activity_date,32);}
function compactList(items:Array<Record<string,unknown>>,limit=6){const shown=items.slice(0,limit).map((item,index)=>`${index+1}. ${itemTitle(item)}${itemDate(item)?` — ${itemDate(item)}`:''}`).join('\n');return items.length>limit?`${shown}\n… ${items.length-limit} item lain tersedia di prioritas aktif.`:shown;}
function compactContext(context:Record<string,unknown>){const brief=(key:string,limit:number)=>contextList(context,key).slice(0,limit).map(item=>({id:item.id,title:clean(item.title,180),activity_date:clean(item.activity_date,32),priority:clean(item.priority,24),status:clean(item.status,32),feed_kind:clean(item.feed_kind,32),module_route:clean(item.module_route,240),action_url:clean(item.action_url,240),next_action:clean(item.next_action,240),detail:clean(item.detail,300),custom_data:item.custom_data&&typeof item.custom_data==='object'?{pipeline_lead_id:clean((item.custom_data as Record<string,unknown>).pipeline_lead_id,64)}:{}}));return {timezone:context.timezone,today:context.today,today_tasks:brief('today_tasks',16),overdue_tasks:brief('overdue_tasks',12),today_meetings:brief('today_meetings',8),ceo_approvals:brief('ceo_approvals',8),pipeline_followups:brief('pipeline_followups',10),project_risks:brief('project_risks',8),unread_notifications:brief('unread_notifications',8)};}
async function executeAction(client: ReturnType<typeof createClient>, authorization:string, action:Record<string,unknown>, command:string) {
  const type=clean(action.type,64);
  const payload=action.payload&&typeof action.payload==='object'?action.payload as Record<string,unknown>:{};
  if (!['create_task','update_pipeline','save_project_task','save_project_record','complete_activity','create_calendar_meeting'].includes(type)) return null;
  if(type==='create_calendar_meeting'){
    const response=await fetch(URL+'/functions/v1/ruang-kawan-calendar/ceo/meetings',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({title:payload.title,agenda:payload.agenda??'',startsAt:payload.starts_at,endsAt:payload.ends_at,timezone:'Asia/Jakarta'})});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(clean(body.error,300)||'Agenda belum dapat dibuat.');
    return {type,label:clean(payload.title,140),url:clean(body.htmlLink,500)||clean(body.meetUrl,500)};
  }
  const result=await client.rpc('kawan_ai_ceo_execute_action',{action_type:type,action_payload:payload,command_text:command});
  if(result.error)throw new Error(result.error.message);
  const output=result.data&&typeof result.data==='object'?result.data as Record<string,unknown>:{};
  return {type,label:clean(output.label,140)||type,url:clean(output.url,500)};
}
function fallbackAnswer(context:Record<string,unknown>,prompt:string,mode:string){
 const today=contextList(context,'today_tasks'), overdue=contextList(context,'overdue_tasks');
 const meetings=contextList(context,'today_meetings'), approvals=contextList(context,'ceo_approvals'), pipeline=contextList(context,'pipeline_followups'), risks=contextList(context,'project_risks');
 const q=prompt.toLowerCase();
 const section=(title:string,items:Array<Record<string,unknown>>,empty:string)=>`**${title}**\n${items.length?compactList(items):empty}`;
 if(q.includes('meeting')||q.includes('besok'))return section('Meeting hari ini',meetings,'Belum ada meeting internal yang tercatat untuk hari ini.');
 if(q.includes('approval')||q.includes('setuju')||q.includes('review'))return section('Butuh approval CEO',approvals,'Belum ada approval yang terdeteksi dari status pekerjaan saat ini.');
 if(q.includes('kelewat')||q.includes('overdue')||q.includes('terlambat'))return section('Pekerjaan terlambat',overdue,'Tidak ada pekerjaan terlambat yang tercatat.');
 if(q.includes('pipeline')||q.includes('follow'))return section('Follow-up pipeline',pipeline,'Belum ada follow-up pipeline aktif yang tercatat.');
 if(q.includes('risiko')||q.includes('bermasalah')||q.includes('project'))return section('Project yang perlu perhatian',risks,'Belum ada project berisiko yang terdeteksi.');
 const headline=mode==='morning_briefing'?'Selamat pagi, Fauzan 👋\n\n':'';
 return headline+`Berikut fokus kerja Anda berdasarkan data Ruang Kawan saat ini.\n\n`+
   section('Kerjakan sekarang',[...overdue,...today],'Belum ada deadline hari ini atau pekerjaan terlambat.')+`\n\n`+
   section('Agenda hari ini',meetings,'Belum ada meeting internal yang tercatat hari ini.')+`\n\n`+
   section('Butuh keputusan CEO',approvals,'Belum ada approval yang terdeteksi.')+`\n\n`+
   (pipeline.length?`**Follow-up pipeline**\n${compactList(pipeline)}\n\n`:'')+
   'Mau saya rinci salah satu prioritas di atas?';
}

Deno.serve(async req=>{
 const origin=req.headers.get('Origin');
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=='POST')return json({error:'Metode tidak didukung.'},405,origin);
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
 const instruction='Kamu adalah Kawan AI — Asisten CEO Campus Innovate. Jawab dalam Bahasa Indonesia yang ringkas, akurat, dan action-oriented. Hanya gunakan konteks terotorisasi. Jangan mengarang data, tanggal, meeting, keputusan, atau status. Jika data tidak tersedia, katakan jelas. Zona waktu selalu Asia/Jakarta. Aturan prioritas CEO: deadline dan keterlambatan selalu menjadi faktor utama; deadline hari ini atau pekerjaan overdue wajib ditandai sebagai mendesak. Setelah itu gunakan urgency, dampak bisnis, nilai klien, dependensi, dan keterlibatan CEO sebagai tie-breaker. Project berisiko wajib disorot bila memenuhi salah satu indikator: berstatus blocked/terhambat, progres di bawah 50% ketika deadline mendekat, tidak ada update selama tujuh hari, atau status tidak berubah saat deadline dekat. Approval dideteksi dari kombinasi status dan kata kunci yang relevan dalam judul/detail—misalnya approval, review, proposal, pricing, negosiasi, quotation, deck, materi, keputusan, scope, revisi—dan wajib disorot bila terkait proposal/pricing/negosiasi klien, finalisasi deck/materi, keputusan project, atau perubahan scope. Untuk rekomendasi delegasi, sertakan peran atau PIC yang cocok hanya bila didukung konteks; selalu berikan deadline usulan dan draft assignment. Jangan mengklaim assignment sudah dibuat. Kelompokkan rekomendasi menjadi: Kerjakan sekarang, Selesaikan hari ini, Delegasikan, Pantau, Bisa ditunda. Briefing default hanya boleh memuat task deadline hari ini, pekerjaan overdue, meeting hari ini, approval, risiko, follow-up pipeline, dan notifikasi penting. Jangan tampilkan deadline tujuh hari ke depan kecuali pengguna secara eksplisit menanyakan deadline mendatang, besok, atau minggu ini. Saat pengguna memberi perintah eksplisit untuk membuat atau mengubah data (misalnya buat task, ubah stage pipeline, buat project task/record, tandai task selesai, atau masukkan agenda), kamu BOLEH mengeksekusi hanya jika judul/entity dan data wajibnya sudah jelas. Untuk itu keluarkan actions berisi maksimal 3 aksi. Jika entity/PIC/waktu belum jelas, jangan buat action; tanyakan klarifikasi. Jangan pernah menghapus, membatalkan, mengirim email/WhatsApp, atau menjalankan aksi finansial. Format wajib satu objek JSON valid: {"answer":"...","actions":[{"type":"create_task|update_pipeline|save_project_task|save_project_record|complete_activity|create_calendar_meeting","payload":{...}}]}. Untuk create_task wajib title, due_date YYYY-MM-DD, priority. Untuk update_pipeline wajib pipeline_lead_id, stage, next_action, due_date. Untuk calendar wajib title, starts_at dan ends_at ISO-8601 dengan offset +07:00. Jika perintah kalender sudah menyebut judul, tanggal, dan jam mulai tetapi durasi tidak disebutkan, gunakan durasi default 60 menit lalu keluarkan action create_calendar_meeting. Jangan gunakan actions untuk pertanyaan informasi atau briefing.';
 const input=mode==='morning_briefing'
   ? 'Buat briefing CEO untuk hari ini. Cantumkan seluruh task dengan deadline hari ini dan seluruh task overdue yang masih aktif, lalu meeting hari ini, follow-up pipeline, project berisiko, approval yang memerlukan keputusan CEO, dan notifikasi penting. Jangan memasukkan deadline tujuh hari ke depan. Kelompokkan prioritas menjadi Kerjakan sekarang, Selesaikan hari ini, Delegasikan, Pantau, dan Bisa ditunda. Setiap task wajib mencantumkan deadline dan tingkat urgensi: Mendesak, Tinggi, Sedang, atau Rendah. Gunakan heading yang mudah dipindai, ringkas pada tiap item, dan akhiri dengan satu pertanyaan tindak lanjut.'
   : prompt;
 const response=GROQ_KEY?await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${GROQ_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,max_completion_tokens:1800,messages:[{role:'system',content:instruction},{role:'user',content:`Pertanyaan: ${input}\n\nKonteks terotorisasi ringkas: ${JSON.stringify(compactContext(context)).slice(0,12000)}`}],response_format:{type:'json_object'}})}):null;
 const raw=response?await response.json().catch(()=>({})):{};
 let answer=''; let actions:Array<Record<string,unknown>>=[];
 if(response?.ok){
   const output=raw.choices?.[0]?.message?.content;
   try{const parsed=JSON.parse(String(output??''));answer=clean(parsed.answer,6000);actions=Array.isArray(parsed.actions)?parsed.actions.filter((item:unknown)=>item&&typeof item==='object').slice(0,3) as Array<Record<string,unknown>>:[];}catch{console.error('Groq returned unreadable output',raw);}
 }else if(response){console.error('Groq chat completion failed',response.status,raw);}
 if(!answer)answer=fallbackAnswer(context,input,mode);
 const executed:Array<{type:string;label:string;url:string}>=[];
 if(mode==='chat'&&actions.length){
   for(const action of actions){
     try{const done=await executeAction(client,authorization,action,prompt);if(done)executed.push(done);}
     catch(error){answer+='\n\nAksi belum dijalankan: '+(error instanceof Error?error.message:'data aksi belum lengkap.');}
   }
 }
 if(executed.length)answer+='\n\n✅ Sudah diperbarui:\n'+executed.map(item=>'• '+item.label+(item.url?' — '+item.url:'')).join('\n');
 const membershipResult=await client.rpc('current_membership_id');
 const membership=membershipResult.data as string | null;
 if(!membership)return json({error:'Keanggotaan aktif tidak ditemukan.'},403,origin);
 const cited=sources({today_tasks:context.today_tasks,overdue_tasks:context.overdue_tasks,today_meetings:context.today_meetings,ceo_approvals:context.ceo_approvals,pipeline_followups:context.pipeline_followups,project_risks:context.project_risks,unread_notifications:context.unread_notifications});
 if(mode==='chat')await client.from('kawan_ai_ceo_messages').insert({membership_id:membership,role:'user',message_kind:'chat',content:prompt,sources:[]});
 const saved=await client.from('kawan_ai_ceo_messages').insert({membership_id:membership,role:'assistant',message_kind:mode==='morning_briefing'?'morning_briefing':'chat',content:answer,sources:cited,briefing_date:mode==='morning_briefing'?today:null}).select().single();
 if(saved.error)return json({error:'Jawaban tersedia, tetapi riwayat tidak tersimpan.'},500,origin);
 return json({message:saved.data,existing:false,model:MODEL},200,origin);
});