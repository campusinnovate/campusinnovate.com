import { NextRequest, NextResponse } from 'next/server';
import { fetchWebsiteText, jsonText, openAiJson, requireRuangKawanUser } from '@/lib/prospect/server';

export const runtime='nodejs';

type AiInput={mode?:unknown;prospect?:Record<string,unknown>};

const services=`Campus Innovate adalah Educational Transformation Partner. Layanan utama: (1) Event Management / EO / MICE / corporate gathering / capacity building / outbound / conference / seminar / workshop; (2) Training & Development untuk leadership, character building, career preparation, people development; (3) Website, landing page, registration system, QR attendance, e-certificate, analytics, dan sistem digital; (4) COREVA, ERP organisasi untuk BEM, himpunan, UKM, OSIS, komunitas, yayasan; (5) Program Development jangka menengah-panjang untuk sekolah, kampus, instansi dan perusahaan.`;

export async function POST(request:NextRequest){
  try{await requireRuangKawanUser(request)}catch{return NextResponse.json({message:'Sesi Ruang Kawan diperlukan.'},{status:401})}
  let input:AiInput;try{input=await request.json() as AiInput}catch{return NextResponse.json({message:'Request tidak valid.'},{status:400})}
  const mode=jsonText(input.mode,30)||'enrich';const prospect=input.prospect??{};const name=jsonText(prospect.account_name,180);
  if(!name)return NextResponse.json({message:'Prospect tidak valid.'},{status:400});
  try{
    if(mode==='enrich'){
      const website=jsonText(prospect.website,700);const websiteText=website?await fetchWebsiteText(website):'';
      const result=await openAiJson(`Kamu adalah Prospect Intelligence Analyst Campus Innovate. ${services}\nAnalisis hanya berdasarkan data yang diberikan. Jangan mengarang fakta. Jika data tidak tersedia, biarkan string kosong. Tentukan segment, service fit, score, dan decision-maker role yang paling relevan. Output WAJIB JSON valid dengan keys: account_type, industry, city, website, phone, email, linkedin_url, instagram_url, fit_score (0-40), intent_score (0-40), accessibility_score (0-20), recommended_pipeline, recommended_service, recommended_business_unit, contact_name, contact_role, ai_summary, evidence (array of objects source,signal_type,content,url,intent,service_match,signal_score). recommended_pipeline hanya salah satu B2B Services, COREVA, Organisasi, Stripmate. Untuk sekolah/kampus/perusahaan umumnya B2B Services. Untuk BEM/Himpunan/UKM/OSIS/komunitas yang cocok ERP gunakan COREVA.`,JSON.stringify({prospect,website_public_text:websiteText}));
      return NextResponse.json({mode,result});
    }
    if(mode==='outreach'){
      const result=await openAiJson(`Kamu adalah Business Development Copywriter Campus Innovate. ${services}\nBuat outreach profesional, natural, tidak agresif, tidak mengklaim fakta yang tidak ada. Gunakan Bahasa Indonesia. Personalisasi berdasarkan signal dan kebutuhan prospect. Output WAJIB JSON valid: recommended_channel, drafts. drafts adalah object dengan keys threads_reply, threads_dm, whatsapp, email_subject, email_body, follow_up_1, follow_up_2. Jika channel tidak relevan tetap isi string kosong. CTA diarahkan ke diskusi singkat/WhatsApp/meeting, bukan hard selling.`,JSON.stringify({prospect}));
      return NextResponse.json({mode,result});
    }
    return NextResponse.json({message:'Mode AI tidak didukung.'},{status:400});
  }catch(error){
    const message=error instanceof Error?error.message:'AI gagal diproses.';
    if(message==='OPENAI_NOT_CONFIGURED')return NextResponse.json({message:'OPENAI_API_KEY belum dikonfigurasi.',configured:false},{status:503});
    return NextResponse.json({message:`AI processing gagal: ${message}`},{status:502});
  }
}
