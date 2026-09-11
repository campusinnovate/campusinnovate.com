const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function handler(options={}) {
 let serve, sends=0; const writes=[];
 const db={auth:{getUser:async()=>({data:{user:options.loggedOut?null:{id:'user'}},error:null})},
 rpc:async(name)=>({data:name==='get_my_access'?{membership_status:'active',permissions:options.denied?[]:['pipeline.view','pipeline.manage_self']}:'member'}),
 from(table){return {
 select(){return this},eq(){return this},
 async single(){return {data:{id:'conversation',phone:'628123456789',whatsapp_number_id:'123',last_incoming_at:new Date(Date.now()-(options.expired?90000000:1000)).toISOString()}}},
 insert(data){writes.push(data);return {select(){return {single:async()=>options.duplicate?{error:{code:'23505'}}:{data:{id:'message'}}}}}},
 update(data){writes.push(data);return {eq:async()=>({error:null})}}
 }}};
 const code=fs.readFileSync('supabase/functions/whatsapp-send/index.ts','utf8').replace(/import .*?;\n/,'');
 vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{
 createClient:()=>db,Deno:{serve:fn=>serve=fn,env:{get:name=>({WHATSAPP_ACCESS_TOKEN:'secret',WHATSAPP_PHONE_NUMBER_ID:'123',WHATSAPP_GRAPH_VERSION:'v25.0'}[name]??'test')}},
 Response,Request,Date,JSON,AbortSignal,fetch:async(url,request)=>{sends++;assert.equal(JSON.parse(request.body).to,'628123456789');if(options.timeout)throw Error('timeout');return Response.json({messages:[{id:'wamid.out'}]})}
 });
 return {run:()=>serve(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({conversation_id:'00000000-0000-4000-8000-000000000001',request_id:'00000000-0000-4000-8000-000000000002',content:'Halo'})})),sends:()=>sends,writes};
}
test('Send refuses unauthenticated, unprivileged, expired and duplicate requests without contacting Meta',async()=>{
 for(const [options,status] of [[{loggedOut:true},401],[{denied:true},403],[{expired:true},409],[{duplicate:true},409]]){
 const h=handler(options);assert.equal((await h.run()).status,status);assert.equal(h.sends(),0);
 }
});
test('Send claims durable request before Meta and persists wamid',async()=>{
 const h=handler();assert.equal((await h.run()).status,200);assert.equal(h.sends(),1);
 assert.equal(h.writes[0].delivery_status,'sending');assert.equal(h.writes[1].whatsapp_message_id,'wamid.out');
});
test('Network uncertainty is persisted without automatic resend',async()=>{
 const h=handler({timeout:true});assert.equal((await h.run()).status,502);assert.equal(h.sends(),1);assert.equal(h.writes[1].delivery_status,'unknown');
});
