import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const OPENAI_API_KEY=Deno.env.get('OPENAI_API_KEY')??'';
const OPENAI_PROSPECT_MODEL=Deno.env.get('OPENAI_PROSPECT_MODEL')??'gpt-5-mini';
const APP_ORIGIN=Deno.env.get('APP_ORIGIN')??'https://campusinnovate.com';
const services=`Campus Innovate adalah Educational Transformation Partner. Layanan utama: (1) Event Management / EO / MICE / corporate gathering / capacity building / outbound / conference / seminar / workshop; (2) Training & Development untuk leadership, character building, career preparation, people development; (3) Website, landing page, registration system, QR attendance, e-certificate, analytics, dan sistem digital; (4) COREVA, ERP organisasi untuk BEM, himpunan, UKM, OSIS, komunitas, yayasan; (5) Program Development jangka menengah-panjang untuk sekolah, kampus, instansi dan perusahaan.`;
function cors(origin:string|null){const allowed=origin===APP_ORIGIN||origin?.startsWith('http://localhost:');return{'Access-Control-Allow-Origin':allowed?origin!:APP_ORIGIN,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'}}
function json(body:unknown,status=200,origin:string|null=null){return new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
function clean(value:unknown,max=10000){return typeof value==='string'?value.trim().slice(0,max):''}
function isBlockedHostname(hostname:string){
  const host=hostname.toLowerCase().replace(/^\[|\]$/g,'');
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host==='metadata.google.internal')return true;
  if(host==='::1'||host==='::'||host.startsWith('fc')||host.startsWith('fd')||/^fe[89ab]/.test(host))return true;
  const parts=host.split('.').map(Number);
  if(parts.length!==4||parts.some(part=>!Number.isInteger(part)||part<0||part>255))return false;
  const[a,b]=parts;
  return a===0||a===10||a===127||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||a>=224;
}
function safePublicUrl(value:string,base?:URL){
  const url=new URL(value,base);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||isBlockedHostname(url.hostname))throw new Error('WEBSITE_URL_BLOCKED');
  return url;
}
async function readTextLimited(response:Response,limit=500000){
  if(!response.body)return'';
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let text='';
  let size=0;
  while(size<limit){
    const{done,value}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    text+=decoder.decode(value.slice(0,Math.max(0,limit-(size-value.byteLength))),{stream:true});
  }
  await reader.cancel().catch(()=>undefined);
  return text+decoder.decode();
}
async function fetchWebsiteText(value:string){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    let url=safePublicUrl(value);
    for(let redirectCount=0;redirectCount<=3;redirectCount+=1){
      const response=await fetch(url,{headers:{'User-Agent':'CampusInnovateProspectBot/1.0 (+https://campusinnovate.com)'},redirect:'manual',signal:controller.signal});
      if(response.status>=300&&response.status<400){
        const location=response.headers.get('location');
        if(!location||redirectCount===3)return'';
        url=safePublicUrl(location,url);
        continue;
      }
      if(!response.ok)return'';
      const contentType=response.headers.get('content-type')??'';
      if(!contentType.toLowerCase().includes('text/html'))return'';
      const html=await readTextLimited(response);
      return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().slice(0,18000);
    }
    return'';
  }catch{return''}finally{clearTimeout(timeout)}
}
const stringField={type:'string'} as const;
const enrichSchema={
  type:'object',additionalProperties:false,
  properties:{
    account_type:stringField,industry:stringField,city:stringField,website:stringField,phone:stringField,email:stringField,linkedin_url:stringField,instagram_url:stringField,
    fit_score:{type:'integer',minimum:0,maximum:40},intent_score:{type:'integer',minimum:0,maximum:40},accessibility_score:{type:'integer',minimum:0,maximum:20},
    recommended_pipeline:{type:'string',enum:['B2B Services','COREVA','Organisasi','Stripmate']},recommended_service:stringField,recommended_business_unit:stringField,
    contact_name:stringField,contact_role:stringField,ai_summary:stringField,
    evidence:{type:'array',items:{type:'object',additionalProperties:false,properties:{source:stringField,signal_type:stringField,content:stringField,url:stringField,intent:stringField,service_match:stringField,signal_score:{type:'integer',minimum:0,maximum:100}},required:['source','signal_type','content','url','intent','service_match','signal_score']}}
  },
  required:['account_type','industry','city','website','phone','email','linkedin_url','instagram_url','fit_score','intent_score','accessibility_score','recommended_pipeline','recommended_service','recommended_business_unit','contact_name','contact_role','ai_summary','evidence']
};
const outreachSchema={
  type:'object',additionalProperties:false,
  properties:{recommended_channel:stringField,drafts:{type:'object',additionalProperties:false,properties:{threads_reply:stringField,threads_dm:stringField,whatsapp:stringField,email_subject:stringField,email_body:stringField,follow_up_1:stringField,follow_up_2:stringField},required:['threads_reply','threads_dm','whatsapp','email_subject','email_body','follow_up_1','follow_up_2']}},
  required:['recommended_channel','drafts']
};
async function openAiJson(instructions:string,input:string,name:string,schema:Record<string,unknown>){if(!OPENAI_API_KEY)throw new Error('OPENAI_NOT_CONFIGURED');const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:OPENAI_PROSPECT_MODEL,instructions,input,store:false,max_output_tokens:2500,text:{format:{type:'json_schema',name,strict:true,schema}}})});if(!response.ok)throw new Error(`OPENAI_${response.status}`);const data=await response.json() as{output_text?:string;output?:Array<{content?:Array<{text?:string}>}>};const text=data.output_text||data.output?.flatMap(item=>item.content??[]).map(item=>item.text??'').join('')||'';if(!text)throw new Error('OPENAI_EMPTY');return JSON.parse(text) as Record<string,unknown>}
Deno.serve(async(req)=>{const origin=req.headers.get('Origin');if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});if(req.method!=='POST')return json({message:'Metode tidak didukung.'},405,origin);const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return json({message:'Sesi Ruang Kawan diperlukan.'},401,origin);const client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});const{data:{user},error:userError}=await client.auth.getUser();if(userError||!user)return json({message:'Sesi Ruang Kawan tidak valid.'},401,origin);const access=await client.rpc('get_my_access');const accessValue=Array.isArray(access.data)?access.data[0]:access.data;if(access.error||!accessValue?.permissions?.includes('pipeline.manage_self'))return json({message:'Akses kelola Pipeline BD diperlukan.'},403,origin);const input=await req.json().catch(()=>({})) as Record<string,unknown>;const mode=clean(input.mode,30)||'enrich';const prospect=(input.prospect??{}) as Record<string,unknown>;const name=clean(prospect.account_name,180);if(!name)return json({message:'Prospect tidak valid.'},400,origin);try{if(mode==='enrich'){const website=clean(prospect.website,700);const websiteText=website?await fetchWebsiteText(website):'';const result=await openAiJson(`Kamu adalah Prospect Intelligence Analyst Campus Innovate. ${services}\nAnalisis hanya berdasarkan data yang diberikan. Jangan mengarang fakta. Jika data tidak tersedia, biarkan string kosong. Tentukan segment, service fit, score, dan decision-maker role yang paling relevan. recommended_pipeline hanya salah satu B2B Services, COREVA, Organisasi, Stripmate. Untuk sekolah/kampus/perusahaan umumnya B2B Services. Untuk BEM/Himpunan/UKM/OSIS/komunitas yang cocok ERP gunakan COREVA.`,JSON.stringify({prospect,website_public_text:websiteText}),'prospect_enrichment',enrichSchema);return json({mode,result},200,origin)}if(mode==='outreach'){const result=await openAiJson(`Kamu adalah Business Development Copywriter Campus Innovate. ${services}\nBuat outreach profesional, natural, tidak agresif, tidak mengklaim fakta yang tidak ada. Gunakan Bahasa Indonesia. Personalisasi berdasarkan signal dan kebutuhan prospect. Jika channel tidak relevan tetap isi string kosong. CTA diarahkan ke diskusi singkat/WhatsApp/meeting, bukan hard selling.`,JSON.stringify({prospect}),'prospect_outreach',outreachSchema);return json({mode,result},200,origin)}return json({message:'Mode AI tidak didukung.'},400,origin)}catch(error){const message=error instanceof Error?error.message:'AI gagal diproses.';if(message==='OPENAI_NOT_CONFIGURED')return json({message:'OPENAI_API_KEY belum dikonfigurasi.',configured:false},503,origin);return json({message:`AI processing gagal: ${message}`},502,origin)}});
