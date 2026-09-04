import { NextRequest, NextResponse } from 'next/server';
import { ProspectCandidate, jsonText, requireRuangKawanUser } from '@/lib/prospect/server';

export const runtime='nodejs';

type HarvestInput={provider?:unknown;query?:unknown;search_type?:unknown;limit?:unknown};

function mapsType(types:unknown):string{
  const list=Array.isArray(types)?types.map(String):[];
  if(list.some(x=>/school|secondary_school/.test(x)))return'School';
  if(list.some(x=>/university|college/.test(x)))return'Campus';
  return'Company';
}

function serviceFromQuery(query:string){
  const q=query.toLowerCase();
  if(/website|landing|digital|system/.test(q))return'Website/Landing Page & Sistem Digital';
  if(/trainer|training|capacity|leadership|pelatihan/.test(q))return'Training & Development';
  return'EO/Event Experience';
}

export async function POST(request:NextRequest){
  try{await requireRuangKawanUser(request)}catch{return NextResponse.json({message:'Sesi Ruang Kawan diperlukan.'},{status:401})}
  let input:HarvestInput;try{input=await request.json() as HarvestInput}catch{return NextResponse.json({message:'Request tidak valid.'},{status:400})}
  const provider=jsonText(input.provider,40);const query=jsonText(input.query,180);const limit=Math.min(20,Math.max(1,Number(input.limit)||10));
  if(!query)return NextResponse.json({message:'Query wajib diisi.'},{status:400});

  if(provider==='google_maps'){
    const key=process.env.GOOGLE_PLACES_API_KEY;if(!key)return NextResponse.json({message:'GOOGLE_PLACES_API_KEY belum dikonfigurasi.',configured:false},{status:503});
    const response=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.types,places.businessStatus'},body:JSON.stringify({textQuery:query,pageSize:limit,languageCode:'id',regionCode:'ID'}),cache:'no-store'});
    if(!response.ok)return NextResponse.json({message:`Google Places menolak request (${response.status}).`},{status:502});
    const data=await response.json() as {places?:Array<Record<string,unknown>>};
    const candidates:ProspectCandidate[]=(data.places??[]).map(place=>{
      const display=place.displayName as {text?:string}|undefined;const types=place.types;const accountType=mapsType(types);
      const website=jsonText(place.websiteUri,500);const phone=jsonText(place.nationalPhoneNumber,100);const address=jsonText(place.formattedAddress,500);
      const fit=accountType==='School'||accountType==='Campus'?30:24;const access=Math.min(20,(website?8:0)+(phone?8:0)+(address?4:0));
      return {provider:'Google Maps',external_id:jsonText(place.id,180),search_query:query,account_name:jsonText(display?.text,180)||'Unknown Place',account_type:accountType,address,website,phone,google_maps_url:jsonText(place.googleMapsUri,600),fit_score:fit,intent_score:4,accessibility_score:access,recommended_pipeline:'B2B Services',recommended_service:accountType==='School'||accountType==='Campus'?'Training & Development':'EO/Event Experience',recommended_business_unit:accountType==='School'||accountType==='Campus'?'EO/Event Experience':'EO/Event Experience',signal_type:'Discovery',signal_content:`Ditemukan melalui Google Maps untuk query “${query}”.`,signal_url:jsonText(place.googleMapsUri,600),signal_score:35,raw_data:place};
    });
    return NextResponse.json({provider,query,count:candidates.length,candidates});
  }

  if(provider==='threads'){
    const token=process.env.THREADS_ACCESS_TOKEN;if(!token)return NextResponse.json({message:'THREADS_ACCESS_TOKEN belum dikonfigurasi.',configured:false},{status:503});
    const base=process.env.THREADS_API_HOST||'https://graph.threads.net';const searchType=['TOP','RECENT'].includes(jsonText(input.search_type,20).toUpperCase())?jsonText(input.search_type,20).toUpperCase():'RECENT';
    const params=new URLSearchParams({q:query,search_type:searchType,fields:'id,permalink,username,text,timestamp,shortcode,is_quote_post,has_replies',limit:String(limit),access_token:token});
    const response=await fetch(`${base}/keyword_search?${params}`,{cache:'no-store'});if(!response.ok)return NextResponse.json({message:`Threads menolak request (${response.status}).`},{status:502});
    const data=await response.json() as {data?:Array<Record<string,unknown>>};const service=serviceFromQuery(query);
    const candidates:ProspectCandidate[]=(data.data??[]).map(post=>{const text=jsonText(post.text,5000);const username=jsonText(post.username,180);const permalink=jsonText(post.permalink,700);return {provider:'Threads',external_id:jsonText(post.id,180),search_query:query,account_name:username?`@${username}`:'Threads Prospect',account_type:'Unknown',threads_url:permalink,fit_score:18,intent_score:34,accessibility_score:8,recommended_pipeline:service.includes('Website')?'B2B Services':'B2B Services',recommended_service:service,recommended_business_unit:service.includes('Website')?'Website/Landing Page':service.includes('Training')?'EO/Event Experience':'EO/Event Experience',ai_summary:text.slice(0,500),signal_type:'Buying Intent',signal_content:text,signal_url:permalink,signal_detected_at:jsonText(post.timestamp,100),signal_intent:'Explicit public need detected',signal_service_match:service,signal_score:85,raw_data:post};});
    return NextResponse.json({provider,query,count:candidates.length,candidates});
  }
  return NextResponse.json({message:'Provider belum didukung.'},{status:400});
}
