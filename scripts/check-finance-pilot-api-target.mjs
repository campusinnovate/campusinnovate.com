// Tests the real compiled client adapter against a controlled transport (no browser or live network).
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=ts.transpileModule(await readFile(new URL('../src/lib/finance-pilot/api.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function adapter(target,url='https://lxwqhtuhlddgwfxjtlas.supabase.co',bindError=false){
 const calls=[],buckets=[],keys=new Map();
 const client={rpc:async(name,args)=>{calls.push({name,args});return {data:name,error:bindError&&name==='finance_pilot_dev_bind'?{message:'DEV participant denied'}:null};},auth:{getUser:async()=>({data:{user:{id:'test-user'}},error:null})},storage:{from:bucket=>{buckets.push(bucket);return {upload:async()=>({data:{},error:null}),createSignedUrl:async()=>({data:{signedUrl:'https://example.invalid/private-test'},error:null})};}}};
 const exports={};vm.runInNewContext(code,{exports,require:path=>path.includes('/config')?{getSupabaseConfig:()=>({supabaseUrl:url})}:{createClient:()=>client},process:{env:{NEXT_PUBLIC_FINANCE_PILOT_TARGET:target,NEXT_PUBLIC_FINANCE_PILOT_WRITES_ENABLED:'true'}},crypto:webcrypto,TextEncoder,sessionStorage:{getItem:k=>keys.get(k),setItem:(k,v)=>keys.set(k,v)}});
 return {api:exports,calls,buckets,keys};
}
const checks=[];
const prod=adapter('public');await prod.api.rpc('finance_pilot_snapshot');assert.deepEqual(prod.calls.map(c=>c.name),['finance_pilot_snapshot']);checks.push('Default public transport remains unchanged');
const dev=adapter('shared-dev');await dev.api.rpc('finance_pilot_snapshot');await dev.api.write('finance_next_request_period_change',{p_period_month:'2026-10-01',p_action:'close',p_reason:'DEV test'});
assert.deepEqual(dev.calls.map(c=>c.name),['finance_pilot_dev_bind','finance_pilot_dev_snapshot','finance_pilot_dev_bind','finance_pilot_dev_next_request_period_change']);checks.push('Shared DEV binds allowlisted session and routes every finance RPC to distinct DEV endpoints');
await dev.api.uploadEvidence({size:10,type:'application/pdf'});await dev.api.evidenceUrl('test-user/file.pdf');assert.deepEqual(dev.buckets,['finance-pilot-dev-evidence','finance-pilot-dev-evidence']);checks.push('Upload/signing use DEV-only bucket');
const key=await dev.api.operationKey('invoice',{amount:1});assert.equal(await dev.api.operationKey('invoice',{amount:1}),key);assert.match([...dev.keys.keys()][0],/^finance-pilot:shared-dev:/);checks.push('DEV idempotency keys persist separately from production');
for(const a of [adapter('shared-dev','https://different-project.invalid'),adapter('invalid')]){
 await assert.rejects(()=>a.api.rpc('finance_pilot_snapshot'));await assert.rejects(()=>a.api.uploadEvidence({size:10,type:'application/pdf'}));await assert.rejects(()=>a.api.evidenceUrl('file'));
 assert.equal(a.calls.length,0);assert.equal(a.buckets.length,0);
}checks.push('Wrong project or invalid target fails before RPC or Storage, without fallback');
const rejected=adapter('shared-dev',undefined,true);await assert.rejects(()=>rejected.api.rpc('finance_pilot_snapshot'),/participant denied/);assert.deepEqual(rejected.calls.map(c=>c.name),['finance_pilot_dev_bind']);checks.push('Participant denial never falls back to production API');
await assert.rejects(()=>dev.api.rpc('finance_save_document'));checks.push('Legacy Finance RPC outside pilot scope rejected');
console.log(JSON.stringify({status:'passed',liveNetwork:false,checks},null,2));
