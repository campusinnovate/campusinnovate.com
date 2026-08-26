import webpush from 'npm:web-push@3.6.7';
import {createClient} from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DISPATCH_SECRET=Deno.env.get('PUSH_DISPATCH_SECRET')!;
const PUBLIC_KEY=Deno.env.get('VAPID_PUBLIC_KEY')!;
const PRIVATE_KEY=Deno.env.get('VAPID_PRIVATE_KEY')!;
const SUBJECT=Deno.env.get('VAPID_SUBJECT')??'mailto:innovatecampus@gmail.com';
const service=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});

webpush.setVapidDetails(SUBJECT,PUBLIC_KEY,PRIVATE_KEY);

function response(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}

Deno.serve(async req=>{if(req.method!=='POST')return response({error:'Method tidak didukung.'},405);if(!DISPATCH_SECRET||req.headers.get('x-push-secret')!==DISPATCH_SECRET)return response({error:'Dispatcher tidak diizinkan.'},401);
 const{data:rows,error}=await service.from('push_delivery_queue').select('id,notification_id,subscription_id,status,attempts,notifications(title,message,action_url,priority),push_subscriptions(endpoint,p256dh,auth,failure_count)').in('status',['pending','failed']).lte('next_attempt_at',new Date().toISOString()).order('created_at').limit(100);if(error)return response({error:error.message},500);
 let sent=0,failed=0,expired=0;
 for(const row of rows??[]){const claimed=await service.from('push_delivery_queue').update({status:'processing',locked_at:new Date().toISOString(),attempts:Number(row.attempts??0)+1}).eq('id',row.id).in('status',['pending','failed']).select('id').maybeSingle();if(!claimed.data)continue;const notification=row.notifications as any;const subscription=row.push_subscriptions as any;
  try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},JSON.stringify({title:notification.title,body:notification.message??'Ada pembaruan pekerjaan.',url:notification.action_url??'/ruang-kawan/notifications/',tag:row.notification_id,icon:'/assets/brand/campus-innovate-official.png'}),{TTL:3600,urgency:notification.priority==='urgent'?'high':'normal'});await Promise.all([service.from('push_delivery_queue').update({status:'sent',delivered_at:new Date().toISOString(),locked_at:null,error_message:null}).eq('id',row.id),service.from('push_subscriptions').update({last_success_at:new Date().toISOString(),failure_count:0}).eq('id',row.subscription_id)]);sent++;
  }catch(cause){const statusCode=Number((cause as {statusCode?:number}).statusCode??0);const message=cause instanceof Error?cause.message:'Push gagal.';if([404,410].includes(statusCode)){await Promise.all([service.from('push_delivery_queue').update({status:'expired',locked_at:null,error_message:message}).eq('id',row.id),service.from('push_subscriptions').update({is_active:false,expires_at:new Date().toISOString(),last_failure_at:new Date().toISOString()}).eq('id',row.subscription_id)]);expired++;}else{const attempts=Number(row.attempts??0)+1;await Promise.all([service.from('push_delivery_queue').update({status:'failed',locked_at:null,error_message:message,next_attempt_at:new Date(Date.now()+Math.min(3600,2**attempts*30)*1000).toISOString()}).eq('id',row.id),service.from('push_subscriptions').update({last_failure_at:new Date().toISOString(),failure_count:Number(subscription.failure_count??0)+1}).eq('id',row.subscription_id)]);failed++;}}
 }
 return response({ready:true,processed:(rows??[]).length,sent,failed,expired});});
