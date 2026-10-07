import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
const read = path => readFile(new URL('../'+path, import.meta.url),'utf8');
const schema = JSON.parse(await read('scripts/finance-pilot-schema-fixture.json'));
const checks = [];
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
await db.exec(`create schema auth; create schema extensions; create schema storage;
create role anon; create role authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function extensions.gen_random_uuid() returns uuid language sql as $$ select gen_random_uuid() $$;
create table auth.users(id uuid primary key);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
grant usage on schema public,auth,storage to anon,authenticated;
grant select,insert,update,delete on storage.objects to authenticated;`);
for (const t of schema) {
 const cols = t.columns.map(c => {
  const type = c.data_type === 'USER-DEFINED' ? 'text' : c.data_type === 'ARRAY' ? 'text[]' : c.data_type;
  return `"${c.name}" ${type}${c.options.includes('identity') ? ' generated always as identity' : c.default_value ? ' default '+c.default_value : ''}${c.options.includes('nullable') ? '' : ' not null'}${c.options.includes('unique') ? ' unique' : ''}`;
 });
 await db.exec(`create table ${t.name}(${cols.join(',')}${t.primary_keys.length ? ',primary key('+t.primary_keys.join(',')+')' : ''});`);
}
await db.exec('alter table finance_documents enable row level security; grant select,insert,update,delete on finance_documents to authenticated,anon;');
await db.exec(`create function public.current_membership_id() returns uuid language sql stable security definer set search_path=public as $$ select id from memberships where user_id=auth.uid() and status='active' limit 1 $$;`);
await db.exec(await read('scripts/finance-pilot-auth-fixture.sql'));
const coa = JSON.parse(await read('scripts/finance-pilot-coa-fixture.json'));
for (const a of coa) await db.query('insert into finance_coa(code,name,account_class,cash_flow_category,control_position,default_flow) values($1,$2,$3,$4,$5,$6)',[a.code,a.name,a.account_class,a.cash_flow_category,a.control_position,'Non-Kas']);
for (const [i,key] of ['coo','ceo','cto','business_development_staff','project_lead','growth_marketing_staff','finance_staff','viewer'].entries()) {
 const id=uid(i+1); await db.query('insert into auth.users(id) values($1)',[id]);
 await db.query('insert into positions(id,key,name) values($1,$2,$2)',[id,key]);
 await db.query("insert into memberships(id,user_id,email,position_id,engagement_type,status) values($1,$1,$2,$1,'employee','active')",[id,`${key}@test.invalid`]);
}
for (const [i,key] of ['finance_manager','executive','system_admin'].entries()) await db.query('insert into roles(id,key,name) values($1,$2,$2)',[uid(50+i),key]);
await db.exec("insert into finance_sequences(document_type,prefix,period_key,last_number) values('invoice','INV','202610',0),('receipt','RCPT','202610',0),('quotation','QUO','202610',0),('transaction','TX','202610',0)");
await db.query('insert into member_roles(membership_id,role_id) values($1,$2),($3,$2)',[uid(7),uid(52),uid(2)]);
const migrations=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(n=>/finance_pilot_(accounting_core|workflows|reports|scoped_access)\.sql$/.test(n)).sort();
for (const name of migrations) { try { await db.exec(await read('supabase/migrations/'+name)); checks.push(`migration syntax: ${name}`); } catch(e) { console.error(`MIGRATION FAILED ${name}:`,e.message); throw e; } }
// Emulate real client roles and JWT subject; don't test as table owner.
const as = async n => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n ? uid(n) : '']); await db.exec('set role '+(n ? 'authenticated' : 'anon')); };
const rpc = async (sql,args=[]) => (await db.query(sql,args)).rows[0];
const denied = async (label,fn) => { await assert.rejects(fn); checks.push(label); };
const owner = async fn => { await db.exec('reset role'); return fn(); };
const request = async (kind,payload) => (await rpc('select finance_pilot_save_request($1,$2,$3) as id',[crypto.randomUUID(),kind,payload])).id;
const submit = id => rpc('select finance_pilot_submit($1) as state',[id]);
const approveApply = async id => { await as(2); await rpc("select finance_pilot_review($1,'approve','UAT isolated approval')",[id]); await as(1); await rpc('select finance_pilot_execute($1)',[id]); };
const evidence = `${uid(1)}/test.pdf`;
await owner(()=>db.query("insert into storage.objects(bucket_id,name) values('finance-pilot-evidence',$1)",[evidence]));
await as(1);
assert.equal((await rpc('select finance_pilot_access() as data')).data.manage,true); checks.push('COO operational access');
await as(2); assert.equal((await rpc('select finance_pilot_access() as data')).data.approve,true);
await denied('CEO cannot input',()=>request('journal',{}));
await denied('CEO cannot reconcile',()=>rpc('select finance_pilot_reconcile($1,$2,$3,$4)',[crypto.randomUUID(),'2026-10-07',0,evidence]));
for (const [n,label] of [[3,'CTO'],[4,'BD'],[5,'Project Lead'],[6,'GM/team'],[7,'System Admin'],[8,'viewer'],[null,'anonymous']]) {
 await as(n); await denied(`${label} cannot read sensitive snapshot`,()=>rpc('select finance_pilot_snapshot()'));
 await denied(`${label} cannot post`,()=>rpc('select finance_next_post_journal($1,$2,$3)', ['2026-10-01','test',[]]));
}
await as(1);
await denied('Unknown policy blocks transaction',async()=>{ const id=await request('journal',{date:'2026-10-01',description:'x',lines:[],evidence_path:evidence}); await submit(id); });
// Test-only accounts: deliberately not seeded by the production migration.
await owner(async()=>{for(const [code,cl] of [['FP-CASH','Aset'],['FP-AP','Kewajiban'],['FP-ADV','Kewajiban'],['FP-TAX','Kewajiban'],['FP-RE','Ekuitas'],['FP-DIST','Kewajiban']]) await db.query("insert into finance_coa(code,name,account_class,cash_flow_category,default_flow) values($1,$1,$2,'Operasional','Non-Kas')",[code,cl]);});
const policy={approval_threshold:1000000,fiscal_start:1,accounts:{cash:'FP-CASH',receivable:'2000',payable:'FP-AP',advance:'FP-ADV',tax_payable:'FP-TAX',retained_earnings:'FP-RE',distribution_payable:'FP-DIST',fixed_asset:'7000',related_receivable:'2001'},reason:'Test policy only'};
const pid=await request('policy',policy); assert.equal((await submit(pid)).state,'submitted');
await denied('COO cannot self approve policy',()=>rpc("select finance_pilot_review($1,'approve','self')",[pid]));
await approveApply(pid); checks.push('CEO approves; COO applies policy');
const line=(coa,d,c,extra={})=>({coa_code:coa,debit:d,credit:c,...extra});
const invPayload={date:'2026-10-01',due_date:'2026-10-05',client:'Isolated Client',project_id:null,service_line_key:'event_management',item_description:'Completed milestone',quantity:'1',unit_price:'1000000',discount:'0',tax:'0',management_fee:'0',other_fees:'0',installment_scheme:'50-50',percentages:[50,50],milestone_evidence:'Signed milestone test',evidence_path:evidence};
const invKey=crypto.randomUUID(); const iid=(await rpc('select finance_pilot_save_request($1,$2,$3) as id',[invKey,'invoice',invPayload])).id;
assert.equal((await rpc('select finance_pilot_save_request($1,$2,$3) as id',[invKey,'invoice',invPayload])).id,iid);
assert.equal((await submit(iid)).state,'submitted'); await denied('Invoice exactly Rp1,000,000 cannot execute before CEO approval',()=>rpc('select finance_pilot_execute($1)',[iid])); await approveApply(iid); await submit(iid); const invId=(await rpc('select result_id from finance_next_requests where id=$1',[iid])).result_id;
assert.equal((await rpc('select count(*)::int as n from finance_documents where id=$1',[invId])).n,1);
checks.push('Invoice draft persists, posting and request replay create one document/journal');
const rpayload={date:'2026-10-02',invoice_id:invId,amount:'400000',deposit_coa_code:'FP-CASH',reference:'UAT-PAYMENT-1',evidence_path:evidence};
const rid=await request('receipt',rpayload); await submit(rid); await submit(rid);
assert.equal(Number((await rpc('select balance from finance_documents where id=$1',[invId])).balance),600000);
await denied('Natural payment reference duplicate rejected',async()=>{const id=await request('receipt',rpayload);await submit(id)});
await denied('Overpayment rejected',async()=>{const id=await request('receipt',{...rpayload,reference:'OVER',amount:'700000'});await submit(id)});
checks.push('Receipt refresh/status/AR balance and idempotent replay');
await denied('Changed payload with same submitted key rejected',()=>rpc('select finance_pilot_save_request($1,$2,$3)',[invKey,'invoice',{...invPayload,unit_price:'5'}]));
await denied('Unbalanced journal rejected',async()=>{const id=await request('journal',{date:'2026-10-02',business_event:'manual',description:'bad',reference:'BAD-BALANCE',evidence_path:evidence,lines:[line('FP-CASH',10,0),line('1000',0,9,{service_line_key:'event_management'})]});await submit(id)});
await denied('Missing evidence rejected',async()=>{const id=await request('invoice',{...invPayload,evidence_path:'missing'});await submit(id)});
const snap=(await rpc("select finance_pilot_snapshot('MTD','2026-10-07') as data")).data;
assert.equal(Number(snap.totals.revenue),1000000); assert.equal(Number(snap.totals.collected),400000); assert.equal(Number(snap.totals.outstanding),600000); assert.equal(Number(snap.cash.book_cash),400000); assert.equal(Number(snap.quality.ledger_difference),0);
assert.equal(Number(snap.reports.income[0].value),Number(snap.totals.revenue));
assert.equal(snap.reports.trial.reduce((a,r)=>a+Number(r.value),0),0);
checks.push('Reconciliation: revenue 1,000,000; cash 400,000; AR 600,000; trial balance 0');
const oct1=(await rpc("select finance_pilot_snapshot('Custom','2026-10-07','2026-10-01','2026-10-01') as data")).data;
assert.equal(Number(oct1.totals.revenue),1000000);assert.equal(Number(oct1.totals.collected),0);assert.equal(Number(oct1.totals.outstanding),1000000);
const strip=(await rpc("select finance_pilot_snapshot('MTD','2026-10-07',null,null,'stripmate') as data")).data;
assert.equal(Number(strip.totals.revenue),0); checks.push('Period + service filters and historical as-of AR');
await denied('Posted journal client update denied',()=>db.exec("update finance_next_journal_entries set description='changed'"));
await denied('Posted journal immutable even through owner writer',()=>owner(()=>db.exec("update finance_next_journal_entries set description='changed'")));
await as(1);
await denied('Closed-period posting rejected',async()=>{await rpc("select finance_next_request_period_change('2026-10-01','close','UAT close')");await as(2);await rpc("select finance_next_review_period_change('2026-10-01','approve','UAT approved')");await as(1);const id=await request('invoice',{...invPayload,date:'2026-10-03'});await submit(id);});
await rpc("select finance_next_request_period_change('2026-10-01','reopen','UAT reopen')");await as(2);await rpc("select finance_next_review_period_change('2026-10-01','reject','keep closed')");await as(1);
assert.equal((await rpc("select status from finance_next_periods where period_month='2026-10-01'")).status,'closed'); checks.push('Rejected reopen keeps period closed');
await rpc("select finance_next_request_period_change('2026-10-01','reopen','UAT reopen')");await as(2);await rpc("select finance_next_review_period_change('2026-10-01','approve','UAT approved')");await as(1);
await denied('Bank mismatch rejected',()=>rpc('select finance_pilot_reconcile($1,$2,$3,$4)',[crypto.randomUUID(),'2026-10-07',5,evidence]));
await rpc('select finance_pilot_reconcile($1,$2,$3,$4)',[crypto.randomUUID(),'2026-10-07',400000,evidence]);
const fid=await request('funds',{as_of:'2026-10-07',operating_target:'100000',reason:'UAT reserve',buckets:[{key:'project',label:'Project',amount:0},{key:'operating',label:'Operating',amount:100000},{key:'emergency',label:'Emergency',amount:50000}]});await submit(fid);await approveApply(fid);
const cash=(await rpc("select finance_pilot_snapshot('MTD','2026-10-07') as data")).data.cash;
assert.equal(cash.reconciled,true);assert.equal(Number(cash.free_cash),250000);checks.push('Reconciled free cash 400,000 - reserves 150,000 = 250,000');
const alloc=Array.from({length:12},(_,i)=>({month:i+1,service_line_key:'event_management',amount:100000}));
const tid=await request('target',{fiscal_year:2026,annual_target:1200000,allocations:alloc,forecast:1300000,reason:'UAT target'});await submit(tid);await approveApply(tid);
const target=(await rpc("select finance_pilot_snapshot('YTD','2026-10-07') as data")).data.target;
assert.equal(Number(target.latest.payload.annual_target),1200000);assert.equal(target.monthly.reduce((a,r)=>a+Number(r.target),0),1200000); checks.push('Annual target versions and monthly allocations reconcile');
// Template journal posting, versioned budgets, asset inventory and reversal.
const base={date:'2026-10-03',description:'UAT expense',reference:'UAT-OPEX',evidence_path:evidence,business_event:'operating_expense',amount:'100000',expense_account:'3000',settlement_account:'FP-CASH',project_id:null,client:'Test Vendor',due_date:'2026-10-20'};
const jid=await request('journal',base);await submit(jid);
const j=(await rpc('select result_id from finance_next_requests where id=$1',[jid])).result_id;
const afterExpense=(await rpc("select finance_pilot_snapshot('MTD','2026-10-07') as data")).data;
assert.equal(Number(afterExpense.totals.opex),100000);assert.equal(Number(afterExpense.cash.book_cash),300000);assert.equal(afterExpense.cash.reconciled,false);checks.push('OPEX template persists and invalidates stale reconciliation fingerprint');
const revId=await request('reversal',{date:'2026-10-07',journal_id:j,evidence_path:evidence,reason:'UAT reversal'});await submit(revId);await approveApply(revId);
const afterReverse=(await rpc("select finance_pilot_snapshot('MTD','2026-10-07') as data")).data;
assert.equal(Number(afterReverse.totals.opex),0);assert.equal(Number(afterReverse.cash.book_cash),400000);checks.push('CEO-approved reversal cancels expense without editing source');
await denied('Second reversal rejected atomically',async()=>{const id=await request('reversal',{date:'2026-10-07',journal_id:j,evidence_path:evidence,reason:'second'});await submit(id);await approveApply(id);});
const assetId=await request('journal',{...base,reference:'UAT-ASSET',business_event:'asset_purchase',amount:'50000',asset_name:'Test Laptop',asset_class:'Equipment',custodian:'Test Custodian',useful_life_months:'36'});await submit(assetId);
assert.equal(Number((await owner(()=>rpc("select count(*)::int as n from finance_assets where pilot_journal_id is not null"))).n),1);checks.push('Asset journal links existing inventory register');await as(1);
await denied('NaN target rejected',async()=>{const id=await request('target',{fiscal_year:2026,annual_target:'NaN',allocations:alloc,reason:'bad'});await submit(id);});
await denied('Null fiscal policy rejected',async()=>{const id=await request('policy',{...policy,fiscal_start:null});await submit(id);});
await denied('Account remap after posted ledger rejected',async()=>{const id=await request('policy',{...policy,accounts:{...policy.accounts,cash:'7000',fixed_asset:'FP-CASH'}});await submit(id);});
// Financial source documents can be reversed with traceability, not rewritten.
const receiptDoc=(await rpc('select result_id from finance_next_requests where id=$1',[rid])).result_id;
const receiptJournal=(await rpc('select pilot_journal_id from finance_documents where id=$1',[receiptDoc])).pilot_journal_id;
const rr=await request('reversal',{date:'2026-10-07',journal_id:receiptJournal,evidence_path:evidence,reason:'UAT receipt correction'});await submit(rr);await approveApply(rr);
const reversedReceipt=(await rpc("select finance_pilot_snapshot('MTD','2026-10-07') as data")).data;
assert.equal(Number(reversedReceipt.totals.outstanding),1000000);assert.equal(Number(reversedReceipt.totals.collected),0);checks.push('Receipt reversal restores AR and nets collections on the ledger');
const invoiceJournal=(await rpc('select pilot_journal_id from finance_documents where id=$1',[invId])).pilot_journal_id;
const ri=await request('reversal',{date:'2026-10-07',journal_id:invoiceJournal,evidence_path:evidence,reason:'UAT invoice correction'});await submit(ri);await approveApply(ri);
const reversedInvoice=(await rpc("select finance_pilot_snapshot('MTD','2026-10-07') as data")).data;
assert.equal(Number(reversedInvoice.totals.revenue),0);assert.equal(Number(reversedInvoice.totals.outstanding),0);checks.push('Invoice reversal cancels AR/revenue; original identifiers and amounts retained');
// Own-claim isolation and real position key (BD) scoped view.
await owner(()=>db.query("insert into storage.objects(bucket_id,name) values('finance-pilot-evidence',$1),('finance-pilot-evidence',$2)",[`${uid(6)}/claim.pdf`,`${uid(5)}/claim.pdf`]));
await as(6);
const ck=crypto.randomUUID();const claim=(await rpc('select finance_pilot_submit_scoped($1,$2,$3,$4,$5,$6) as id',[ck,'claim',null,10,'Own test claim',`${uid(6)}/claim.pdf`])).id;
assert.equal((await rpc('select finance_pilot_submit_scoped($1,$2,$3,$4,$5,$6) as id',[ck,'claim',null,10,'Own test claim',`${uid(6)}/claim.pdf`])).id,claim);
assert.equal((await rpc('select finance_pilot_scoped_workspace() as data')).data.requests.length,1);
await as(5);assert.equal((await rpc('select finance_pilot_scoped_workspace() as data')).data.requests.length,0);
await denied('Team cannot submit peer-owned evidence',()=>rpc('select finance_pilot_submit_scoped($1,$2,$3,$4,$5,$6)',[crypto.randomUUID(),'claim',null,10,'Peer',`${uid(6)}/claim.pdf`]));
checks.push('GM/team own claims persist/replay; Project Lead cannot see or use peer claims/evidence');
await as(2);await denied('CEO cannot submit own routine claim',()=>rpc('select finance_pilot_submit_scoped($1,$2,$3,$4,$5,$6)',[crypto.randomUUID(),'claim',null,10,'CEO claim',evidence]));
await as(1);await rpc("select finance_pilot_review_scoped($1,'Accepted for journal preparation',true)",[claim]);
await denied('Claim cannot directly post without journal',()=>rpc('select finance_pilot_execute($1)',[claim]));

// Split cost lines must still require the documented over-budget approval.
await owner(()=>db.query("insert into projects(id,source_id,project_code,name,project_type,created_by_membership_id,updated_by_membership_id) values($1,$2,'ISOLATED-PROJECT','Isolated budget project','delivery',$3,$3)",[uid(90),uid(91),uid(1)]));
await as(1);
const bp=await request('budget',{project_id:uid(90),service_line_key:'event_management',contract_value:'1000',budgeted_hpp:'100',committed_cost:'0',reason:'Isolated budget'});await submit(bp);await approveApply(bp);
const directAccount=coa.find(a=>a.account_class==='Beban Langsung Proyek').code;
const splitCost=await request('journal',{business_event:'manual',date:'2026-10-07',description:'Split overrun',reference:'SPLIT-OVERRUN',evidence_path:evidence,lines:[line(directAccount,60,0,{project_id:uid(90),service_line_key:'event_management'}),line(directAccount,60,0,{project_id:uid(90),service_line_key:'event_management'}),line('FP-CASH',0,120)]});
assert.equal((await rpc('select finance_pilot_journal_preview($1) as data',[{business_event:'manual',lines:[line(directAccount,60,0,{project_id:uid(90),service_line_key:'event_management'}),line(directAccount,60,0,{project_id:uid(90),service_line_key:'event_management'}),line('FP-CASH',0,120)]}])).data.length,3);
await owner(async()=>assert.equal((await rpc("select finance_pilot_private.over_budget(payload->'lines') as exceeded from finance_next_requests where id=$1",[splitCost])).exceeded,true));
await as(1);
assert.equal((await submit(splitCost)).state,'submitted');
await denied('Split project costs cannot execute without CEO approval',()=>rpc('select finance_pilot_execute($1)',[splitCost]));
await approveApply(splitCost);checks.push('Aggregate project overrun approved by CEO then applied by COO');

// User-approved threshold: inclusive at Rp1,000,000, with explicit boundary tests.
await as(1);
for (const amount of ['1000000','1000000.01']) {
 const thresholdId=await request('journal',{...base,date:'2026-10-07',reference:'THRESHOLD-'+amount,amount});
 assert.equal((await submit(thresholdId)).state,'submitted');
 await denied('Routine amount '+amount+' requires CEO approval',()=>rpc('select finance_pilot_execute($1)',[thresholdId]));
 await as(2);await rpc("select finance_pilot_review($1,'reject','Boundary test only')",[thresholdId]);await as(1);
}
const below=await request('journal',{...base,date:'2026-10-07',reference:'THRESHOLD-BELOW',amount:'999999.99'});
assert.equal((await submit(below)).state,'posted');checks.push('Routine Rp999,999.99 posts below inclusive threshold');
const belowJournal=(await rpc('select result_id from finance_next_requests where id=$1',[below])).result_id;
const belowReverse=await request('reversal',{date:'2026-10-07',journal_id:belowJournal,evidence_path:evidence,reason:'Remove isolated boundary fixture through reversal'});await submit(belowReverse);await approveApply(belowReverse);
// Vendor bills/payments use the existing requests + ledger; no separate AP balance.
const beforeAP=(await rpc("select finance_pilot_snapshot('MTD','2026-10-07') as data")).data;
const vendorBill=await request('journal',{...base,business_event:'vendor_bill',amount:'600000',reference:'UAT-VENDOR-BILL',date:'2026-10-01',due_date:'2026-10-02'});await submit(vendorBill);
const vbSnap=(await rpc("select finance_pilot_snapshot('MTD','2026-10-07') as data")).data;
assert.equal(Number(vbSnap.cash.payables),600000);assert.equal(Number(vbSnap.cash.book_cash),Number(beforeAP.cash.book_cash));
assert.equal(Number(vbSnap.totals.opex)-Number(beforeAP.totals.opex),600000);
assert.equal(vbSnap.reports.aging.find(r=>r.request_id===vendorBill).aging_bucket,'1–30');
const vp={...base,business_event:'vendor_payment',vendor_bill_id:vendorBill,amount:'250000',reference:'UAT-VENDOR-PAY',date:'2026-10-03',due_date:'2026-10-02'};
const vk=crypto.randomUUID();const vpId=(await rpc('select finance_pilot_save_request($1,$2,$3) as id',[vk,'journal',vp])).id;
assert.equal((await submit(vpId)).state,'posted');await submit(vpId);
assert.equal((await rpc('select finance_pilot_save_request($1,$2,$3) as id',[vk,'journal',vp])).id,vpId);
const paidAP=(await rpc("select finance_pilot_snapshot('MTD','2026-10-07') as data")).data;
assert.equal(Number(paidAP.cash.payables),350000);assert.equal(Number(paidAP.vendor_bills.find(b=>b.id===vendorBill).balance),350000);
assert.equal(Number(paidAP.cash.book_cash),Number(beforeAP.cash.book_cash)-250000);assert.equal(Number(paidAP.totals.opex),Number(vbSnap.totals.opex));
assert.equal(Number(paidAP.quality.unallocated_ap),0);assert.equal(Number(paidAP.quality.ledger_difference),0);
checks.push('Vendor bill 600,000 + payment 250,000 => AP 350,000; cash reduces once; expense not duplicated');
await denied('Vendor overpayment rejected',async()=>{const id=await request('journal',{...vp,amount:'350001',reference:'AP-OVER'});await submit(id);});
await denied('Vendor/project substitution rejected',()=>request('journal',{...vp,client:'Different Vendor',reference:'AP-OTHER'}));
await denied('Vendor payment natural reference duplicate rolls back',async()=>{const id=await request('journal',{...vp,date:'2026-10-04',amount:'10'});await submit(id);});
const APasof=(await rpc("select finance_pilot_snapshot('Custom','2026-10-07','2026-10-01','2026-10-02') as data")).data;
assert.equal(Number(APasof.cash.payables),600000);assert.equal(Number(APasof.vendor_bills.find(b=>b.id===vendorBill).balance),600000);checks.push('AP historical as-of excludes later vendor payment');
const vendorBillJournal=(await rpc('select result_id from finance_next_requests where id=$1',[vendorBill])).result_id;
await denied('Bill reversal blocked until vendor payment reversed',async()=>{const id=await request('reversal',{date:'2026-10-07',journal_id:vendorBillJournal,evidence_path:evidence,reason:'Test blocked bill reversal'});await submit(id);await approveApply(id);});
const vpJournal=(await rpc('select result_id from finance_next_requests where id=$1',[vpId])).result_id;
const vpr=await request('reversal',{date:'2026-10-07',journal_id:vpJournal,evidence_path:evidence,reason:'Vendor payment correction'});await submit(vpr);await approveApply(vpr);
assert.equal(Number((await rpc("select finance_pilot_snapshot('MTD','2026-10-07') as data")).data.cash.payables),600000);
// A fully settled payable still accepts an identical retry key without posting twice.
const fullPayload={...vp,amount:'600000',reference:'UAT-VENDOR-FULL',date:'2026-10-07'};
const fullKey=crypto.randomUUID();const fullId=(await rpc('select finance_pilot_save_request($1,$2,$3) as id',[fullKey,'journal',fullPayload])).id;
await submit(fullId);assert.equal(Number((await rpc("select finance_pilot_snapshot('MTD','2026-10-07') as data")).data.cash.payables),0);
assert.equal((await rpc('select finance_pilot_save_request($1,$2,$3) as id',[fullKey,'journal',fullPayload])).id,fullId);
await submit(fullId);await denied('Changed fully paid retry rejected',()=>rpc('select finance_pilot_save_request($1,$2,$3)',[fullKey,'journal',{...fullPayload,amount:'1'}]));
const fullJournal=(await rpc('select result_id from finance_next_requests where id=$1',[fullId])).result_id;
const fullReversal=await request('reversal',{date:'2026-10-07',journal_id:fullJournal,evidence_path:evidence,reason:'Reverse isolated full settlement'});await submit(fullReversal);await approveApply(fullReversal);
checks.push('Fully settled vendor payment replay returns original request and never duplicates ledger');
const vbr=await request('reversal',{date:'2026-10-07',journal_id:vendorBillJournal,evidence_path:evidence,reason:'Vendor bill correction'});await submit(vbr);await approveApply(vbr);
assert.equal(Number((await rpc("select finance_pilot_snapshot('MTD','2026-10-07') as data")).data.cash.payables),0);checks.push('Vendor payment/bill reversals restore cash/AP then cancel liability without source edits');

// Financial project closure cannot abandon ledger-backed vendor obligations.
await as(1);
const projectBill=await request('journal',{...base,business_event:'vendor_bill',amount:'100',reference:'UAT-PROJECT-BILL',date:'2026-10-07',due_date:'2026-10-08',project_id:uid(90)});await submit(projectBill);
await denied('Project closure blocked with outstanding vendor AP',async()=>{const id=await request('project_closure',{project_id:uid(90),handover_evidence:'Isolated signed handover',reason:'UAT closure'});await submit(id);});
const projectBillJournal=(await rpc('select result_id from finance_next_requests where id=$1',[projectBill])).result_id;
const projectBillReverse=await request('reversal',{date:'2026-10-07',journal_id:projectBillJournal,evidence_path:evidence,reason:'Reverse isolated project bill'});await submit(projectBillReverse);await approveApply(projectBillReverse);
const closedProject=await request('project_closure',{project_id:uid(90),handover_evidence:'Isolated signed handover',reason:'UAT settled closure'});assert.equal((await submit(closedProject)).state,'posted');checks.push('COO financially closes project only after AP obligations resolved');

// Legacy document guard applies only to pilot records.
await owner(async()=>{
 await db.query("insert into finance_documents(document_type,document_number,document_date,client,status,created_by_membership_id,updated_by_membership_id) values('invoice','LEGACY-TEST','2026-09-01','Legacy','Unpaid',$1,$1)",[uid(1)]);
 await db.exec("update finance_documents set client='Legacy Updated' where document_number='LEGACY-TEST'");
 await db.exec("delete from finance_documents where document_number='LEGACY-TEST'");
});
await denied('Legacy RPC cannot rewrite pilot posted invoice',()=>owner(()=>db.query('update finance_documents set total=5 where id=$1',[invId])));
checks.push('Legacy non-pilot document update/delete still works');
if(process.env.FINANCE_PILOT_SERVE==='1'){const {serveFixture}=await import('./finance-pilot-test-api.mjs'); await serveFixture(db);}else await db.close();
console.log(JSON.stringify({status:'passed',isolated:true,checks},null,2));
