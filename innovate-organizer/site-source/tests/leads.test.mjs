import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { handleBrief } from '../worker/leads.mjs';
const origin = 'https://io.campusinnovate.com';
const valid = { id:'b93adbbd-fbbe-46e8-bacf-11f1ae33cd56', nama:'QA Company', kontak:'0858 1234 5678', jenis:'Team Building', tanggal:'November 2026', jumlah:80, kebutuhan:'Test brief', consent:true, attribution:{utm_source:'test', email:'do-not-store'} };
const request = (data = valid, extra = {}) => new Request(origin+'/api/brief', {method:'POST',headers:{origin,'content-type':'application/json',...extra},body:JSON.stringify(data)});
function database(fail=false) {
 const rows = new Map(); let inserts = 0;
 return {rows, get inserts(){return inserts;}, prepare(sql) { assert.match(sql,/INSERT INTO event_leads/); assert.match(sql,/ON CONFLICT\(id\) DO NOTHING/); return {bind(...values) {return {async run(){ if(fail)throw new Error('database offline'); if(!rows.has(values[0])){rows.set(values[0],values);inserts++;}return {success:true};}};}};}};
}
test('stores an anonymous brief once and strips unknown attribution fields', async()=>{
 const db=database(); const res=await handleBrief(request(),{DB:db}); assert.equal(res.status,201); assert.deepEqual(await res.json(),{ok:true,id:valid.id});
 await handleBrief(request(),{DB:db}); assert.equal(db.inserts,1); assert.equal(db.rows.get(valid.id)[7],valid.kebutuhan); assert.equal(db.rows.get(valid.id)[8],'{"utm_source":"test"}');
});
test('requires consent, contact, positive participants, and a known service', async()=>{
 for(const invalid of [{consent:false},{kontak:''},{kontak:'12----34'},{jumlah:-1},{jumlah:1.5},{jenis:'injected'},{id:'bad'},{website:'spam'}]) assert.equal((await handleBrief(request({...valid,...invalid}),{DB:database()})).status,400);
});
test('rejects cross-origin requests, read access, large bodies, invalid JSON', async()=>{
 assert.equal((await handleBrief(request(valid,{origin:'https://other.test'}),{DB:database()})).status,403);
 assert.equal((await handleBrief(new Request(origin+'/api/brief'),{DB:database()})).status,405);
 assert.equal((await handleBrief(request({...valid,kebutuhan:'x'.repeat(9000)}),{DB:database()})).status,413);
 assert.equal((await handleBrief(new Request(origin+'/api/brief',{method:'POST',headers:{origin,'content-type':'application/json'},body:'bad'}),{DB:database()})).status,400);
});
test('never reports saved when storage is unavailable',async()=>{
 assert.equal((await handleBrief(request(),{})).status,503);
 assert.equal((await handleBrief(request(),{DB:database(true)})).status,503);
});
test('bounds bursts from one edge IP',async()=>{
 for(let i=0;i<8;i++)assert.equal((await handleBrief(request(valid,{'cf-connecting-ip':'192.0.2.9'}),{DB:database()})).status,201);
 assert.equal((await handleBrief(request(valid,{'cf-connecting-ip':'192.0.2.9'}),{DB:database()})).status,429);
});
function analytics(hostname='io.campusinnovate.com') {
 const events=[];let click;
 const context={window:{gtag:(...args)=>events.push(args)},document:{addEventListener:(name,handler)=>{assert.equal(name,'click');click=handler;}},location:{hostname,href:origin+'/'},URL,Set};
 vm.runInNewContext(readFileSync(new URL('../public/assets/tracking.js',import.meta.url),'utf8'),context);
 return {events,context,click(href,dataset={},id='hero-wa'){click({target:{closest:()=>({href,dataset,id,closest:()=>({id:'layanan'})})}});}};
}
test('delegated tracking covers WhatsApp URLs and nested targets with one conversion',()=>{
 const a=analytics();
 for(const href of ['https://wa.me/62858','https://api.whatsapp.com/send?phone=62858','https://web.whatsapp.com/send'])a.click(href);
 assert.equal(a.events.filter(e=>e[1]==='conversion').length,3);
 assert.ok(a.events.filter(e=>e[1]==='conversion').every(e=>e[2].send_to==='AW-18473450758/iaLBCN-i35AdEIb66ehE'));
 a.click('https://wa.me.attacker.test/');a.click('https://example.org');assert.equal(a.events.length,6);
 assert.ok(a.events.every(e=>e[2].event_source==='whatsapp_button'));
 assert.ok(a.events.every(e=>!JSON.stringify(e).includes('62858')));
});
test('saved briefs are deduplicated and never use the button conversion action',()=>{
 const a=analytics();a.context.window.IOTracking.briefSaved(valid.id);a.context.window.IOTracking.briefSaved(valid.id);
 assert.equal(a.events.length,1);assert.equal(a.events[0][1],'brief_submit');assert.equal(a.events[0][2].transaction_id,valid.id);
 a.click('https://wa.me/62858',{conversionSource:'brief'});assert.equal(a.events.length,1);
});
test('preview interactions do not pollute production conversions',()=>{
 const a=analytics('127.0.0.1');a.click('https://wa.me/62858');a.context.window.IOTracking.briefSaved(valid.id);assert.equal(a.events.length,0);
});
function briefUI({save=true,popupAllowed=true}={}) {
 let submit, requests=0, conversions=0, opened='', closed=false;
 const values={nama:'QA',kontak:'085812345678',jenis:'Team Building',tanggal:'',jumlah:'20',kebutuhan:'test',consent:'on',website:''};
 const elements={
  'brief-form':{reportValidity:()=>true,addEventListener:(event,fn)=>submit=fn,setAttribute(){},removeAttribute(){}},
  'brief-submit':{disabled:false},'brief-status':{textContent:''},'brief-continue':{hidden:true,href:''}
 };
 const context={document:{getElementById:id=>elements[id]},location:{search:'?utm_source=test'},URLSearchParams,AbortSignal,crypto:{randomUUID:()=>valid.id},FormData:class {constructor(){return Object.entries(values);}},window:{IOTracking:{briefSaved(){conversions++;}},open:()=>popupAllowed?{opener:{},closed:false,close(){closed=true;},location:{replace(url){opened=url;}}}:null},fetch:async(url,options)=>{requests++;assert.equal(url,'/api/brief');assert.equal(JSON.parse(options.body).consent,true);return {ok:save,json:async()=>({ok:save,id:valid.id})};}};
 vm.runInNewContext(readFileSync(new URL('../public/assets/brief.js',import.meta.url),'utf8'),context);
 return {elements, async submit(){await submit({preventDefault(){}});}, get result(){return {requests,conversions,opened,closed};}};
}
test('form opens WhatsApp only after a server-confirmed save',async()=>{
 const ui=briefUI();await ui.submit();assert.equal(ui.result.conversions,1);assert.match(ui.result.opened,/^https:\/\/wa.me\//);assert.match(ui.elements['brief-status'].textContent,/tersimpan/);assert.equal(ui.elements['brief-submit'].disabled,false);
});
test('failed form retains inputs, closes popup and does not report a lead',async()=>{
 const ui=briefUI({save:false});await ui.submit();assert.equal(ui.result.conversions,0);assert.equal(ui.result.opened,'');assert.equal(ui.result.closed,true);assert.match(ui.elements['brief-status'].textContent,/belum tersimpan/);assert.equal(ui.elements['brief-continue'].hidden,true);
});
test('popup blockers leave an accessible continuation link after saving',async()=>{
 const ui=briefUI({popupAllowed:false});await ui.submit();assert.equal(ui.elements['brief-continue'].hidden,false);assert.match(ui.elements['brief-continue'].href,/^https:\/\/wa.me\//);
});
test('accepts Event Support from the updated service selector', async()=>{
 const res=await handleBrief(request({...valid,jenis:'Event Support'}),{DB:database()});assert.equal(res.status,201);
});
