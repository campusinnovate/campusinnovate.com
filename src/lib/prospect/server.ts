import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/config';

export type ProspectCandidate = {
  provider:string; external_id:string; search_query?:string; account_name:string; account_type?:string; industry?:string;
  city?:string; address?:string; website?:string; phone?:string; email?:string; linkedin_url?:string; threads_url?:string;
  instagram_url?:string; google_maps_url?:string; fit_score?:number; intent_score?:number; accessibility_score?:number;
  recommended_pipeline?:string; recommended_service?:string; recommended_business_unit?:string; contact_name?:string;
  contact_role?:string; ai_summary?:string; signal_content?:string; signal_type?:string; signal_url?:string;
  signal_detected_at?:string; signal_intent?:string; signal_service_match?:string; signal_score?:number; raw_data?:Record<string,unknown>;
};

export async function requireRuangKawanUser(request:Request){
  const authorization=request.headers.get('authorization')??'';
  if(!authorization.toLowerCase().startsWith('bearer ')) throw new Error('AUTH_REQUIRED');
  const response=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:supabasePublishableKey,Authorization:authorization},cache:'no-store'});
  if(!response.ok) throw new Error('AUTH_REQUIRED');
  return response.json() as Promise<{id:string;email?:string}>;
}

export function jsonText(value:unknown,max=10000){return typeof value==='string'?value.trim().slice(0,max):''}

export async function fetchWebsiteText(url:string){
  if(!/^https?:\/\//i.test(url)) return '';
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(url,{headers:{'User-Agent':'CampusInnovateProspectBot/1.0 (+https://campusinnovate.com)'},redirect:'follow',signal:controller.signal,cache:'no-store'});
    if(!response.ok)return'';
    const contentType=response.headers.get('content-type')??'';if(!contentType.includes('text/html'))return'';
    const html=(await response.text()).slice(0,500000);
    return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().slice(0,18000);
  }catch{return''}finally{clearTimeout(timeout)}
}

export async function openAiJson(instructions:string,input:string){
  const key=process.env.OPENAI_API_KEY;if(!key)throw new Error('OPENAI_NOT_CONFIGURED');
  const model=process.env.OPENAI_PROSPECT_MODEL||'gpt-5-mini';
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,instructions,input,text:{format:{type:'json_object'}}}),cache:'no-store'});
  if(!response.ok)throw new Error(`OPENAI_${response.status}`);
  const data=await response.json() as {output_text?:string;output?:Array<{content?:Array<{type?:string;text?:string}>}>};
  const text=data.output_text||data.output?.flatMap(item=>item.content??[]).map(item=>item.text??'').join('')||'';
  if(!text)throw new Error('OPENAI_EMPTY');return JSON.parse(text) as Record<string,unknown>;
}
