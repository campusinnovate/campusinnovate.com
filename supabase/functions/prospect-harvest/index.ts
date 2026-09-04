import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const GOOGLE_PLACES_API_KEY=Deno.env.get('GOOGLE_PLACES_API_KEY')??'';
const THREADS_ACCESS_TOKEN=Deno.env.get('THREADS_ACCESS_TOKEN')??'';
const THREADS_API_HOST=Deno.env.get('THREADS_API_HOST')??'https://graph.threads.net';
const APP_ORIGIN=Deno.env.get('APP_ORIGIN')??'https://campusinnovate.com';

type Candidate={provider:string;external_id:string;search_query?:string;account_name:string;account_type?:string;address?:string;website?:string;phone?:string;threads_url?:string;google_maps_url?:string;fit_score?:number;intent_score?:number;accessibility_score?:number;recommended_pipeline?:string;recommended_service?:string;recommended_business_unit?:string;ai_summary?:string;signal_content?:string;signal_type?:string;signal_url?:string;signal_detected_at?:string;signal_intent?:string;signal_service_match?:string;signal_score?:number;raw_data?:Record<string,unknown>};

function cors(origin:string|null){const allowed=origin===APP_ORIGIN||origin?.startsWith('http://localhost:');return{'Access-Control-Allow-Origin':allowed?origin!:APP_ORIGIN,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'}}
function json(body:unknown,status=200,origin:string|null=null){return new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
function clean(value:unknown,max=10000){return typeof value==='string'?value.trim().slice(0,max):''}
function mapsType(types:unknown){const list=Array.isArray(types)?types.map(String):[];if(list.some(x=>/school|secondary_school/.test(x)))return'School';if(list.some(x=>/university|college/.test(x)))return'Campus';return'Company'}
function serviceFromQuery(query:string){const q=query.toLowerCase();if(/website|landing|digital|system/.test(q))return'Website/Landing Page & Sistem Digital';if(/trainer|training|capacity|leadership|pelatihan/.test(q))return'Training & Development';return'EO/Event Experience'}

Deno.serve(async(req)=>{
 const origin=req.headers.get('Origin');
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=='POST')return json({message:'Metode tidak didukung.'},405,origin);
 const authorization=req.headers.get('Authorization');
 if(!authorization?.startsWith('Bearer '))return json({message:'Sesi Ruang Kawan diperlukan.'},401,origin);
 const client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const{data:{user},error:userError}=await client.auth.getUser();if(userError||!user)return json({message:'Sesi Ruang Kawan tidak valid.'},401,origin);
 const access=await client.rpc('get_my_access');const accessValue=Array.isArray(access.data)?access.data[0]:access.data;
 if(access.error||!accessValue?.permissions?.includes('pipeline.manage_self'))return json({message:'Akses kelola Pipeline BD diperlukan.'},403,origin);
 const input=await req.json().catch(()=>({})) as Record<string,unknown>;const provider=clean(input.provider,40);const query=clean(input.query,180);const limit=Math.min(20,Math.max(1,Number(input.limit)||10));
 if(!query)return json({message:'Query wajib diisi.'},400,origin);
 if(provider==='google_maps'){
  if(!GOOGLE_PLACES_API_KEY)return json({message:'GOOGLE_PLACES_API_KEY belum dikonfigurasi.',configured:false},503,origin);
  const response=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':GOOGLE_PLACES_API_KEY,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.types,places.businessStatus'},body:JSON.stringify({textQuery:query,pageSize:limit,languageCode:'id',regionCode:'ID'})});
  if(!response.ok)return json({message:`Google Places menolak request (${response.status}).`},502,origin);
  const data=await response.json() as{places?:Array<Record<string,unknown>>};
  const candidates:Candidate[]=(data.places??[]).map(place=>{const display=place.displayName as{text?:string}|undefined;const accountType=mapsType(place.types);const website=clean(place.websiteUri,500);const phone=clean(place.nationalPhoneNumber,100);const address=clean(place.formattedAddress,500);const fit=accountType==='School'||accountType==='Campus'?30:24;const accessScore=Math.min(20,(website?8:0)+(phone?8:0)+(address?4:0));return{provider:'Google Maps',external_id:clean(place.id,180),search_query:query,account_name:clean(display?.text,180)||'Unknown Place',account_type:accountType,address,website,phone,google_maps_url:clean(place.googleMapsUri,600),fit_score:fit,intent_score:4,accessibility_score:accessScore,recommended_pipeline:'B2B Services',recommended_service:accountType==='School'||accountType==='Campus'?'Training & Development':'EO/Event Experience',recommended_business_unit:'EO/Event Experience',signal_type:'Discovery',signal_content:`Ditemukan melalui Google Maps untuk query “${query}”.`,signal_url:clean(place.googleMapsUri,600),signal_score:35,raw_data:place}});
  return json({provider,query,count:candidates.length,candidates},200,origin);
 }
 if(provider==='threads'){
  if(!THREADS_ACCESS_TOKEN)return json({message:'THREADS_ACCESS_TOKEN belum dikonfigurasi.',configured:false},503,origin);
  const searchType=['TOP','RECENT'].includes(clean(input.search_type,20).toUpperCase())?clean(input.search_type,20).toUpperCase():'RECENT';
  const params=new URLSearchParams({q:query,search_type:searchType,fields:'id,permalink,username,text,timestamp,shortcode,is_quote_post,has_replies',limit:String(limit),access_token:THREADS_ACCESS_TOKEN});
  const response=await fetch(`${THREADS_API_HOST}/keyword_search?${params}`);if(!response.ok)return json({message:`Threads menolak request (${response.status}).`},502,origin);
  const data=await response.json() as{data?:Array<Record<string,unknown>>};const service=serviceFromQuery(query);
  const candidates:Candidate[]=(data.data??[]).map(post=>{const text=clean(post.text,5000);const username=clean(post.username,180);const permalink=clean(post.permalink,700);return{provider:'Threads',external_id:clean(post.id,180),search_query:query,account_name:username?`@${username}`:'Threads Prospect',account_type:'Unknown',threads_url:permalink,fit_score:18,intent_score:34,accessibility_score:8,recommended_pipeline:'B2B Services',recommended_service:service,recommended_business_unit:service.includes('Website')?'Website/Landing Page':'EO/Event Experience',ai_summary:text.slice(0,500),signal_type:'Buying Intent',signal_content:text,signal_url:permalink,signal_detected_at:clean(post.timestamp,100),signal_intent:'Explicit public need detected',signal_service_match:service,signal_score:85,raw_data:post}});
  return json({provider,query,count:candidates.length,candidates},200,origin);
 }
 return json({message:'Provider belum didukung.'},400,origin);
});
