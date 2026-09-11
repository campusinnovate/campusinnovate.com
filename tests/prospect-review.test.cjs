const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const member='00000000-0000-4000-8000-000000000001';
const prospect='00000000-0000-4000-8000-000000000002';
const lead='00000000-0000-4000-8000-000000000003';
test('Prospect manual review extends the existing table with validation, audit and concurrency checks',async t=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create schema extensions;
   create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;
   create table memberships(id uuid primary key); insert into memberships values('${member}');
   create table pipeline_leads(id uuid primary key); insert into pipeline_leads values('${lead}');
   create function current_membership_id() returns uuid language sql as $$select '${member}'::uuid$$;
   create function current_user_has_permission(permission text) returns boolean language sql as $$select coalesce(current_setting('test.access',true),'none')='manage' or (permission='pipeline.view' and current_setting('test.access',true)='view')$$;
   grant usage on schema public to authenticated,anon;
  `);
  const original=fs.readFileSync('supabase/migrations/20260904113000_ruang_kawan_prospect_harvester.sql','utf8');
  await db.exec(original.match(/create table if not exists public\.prospects \([\s\S]*?\n\);/)[0]);
  await db.exec(fs.readFileSync('supabase/migrations/20260911140000_prospect_review_workflow.sql','utf8'));
  await db.exec(`insert into prospects(id,account_name,phone) values('${prospect}','PT ABC','08123456789');set test.access='manage';`);
  async function row(){await db.exec('reset role');const result=(await db.query('select *,updated_at::text as version from prospects where id=$1',[prospect])).rows[0];await db.exec('set role authenticated');return result;}
  async function update(payload,version){return db.query('select update_prospect_details($1,$2,$3)',[prospect,version??(await row()).version,payload]);}
  await t.test('edits normalize phone, clear optional fields and keep scores and source intact',async()=>{
   await update({account_name:' PT ABC Baru ',phone:'+62 812-3456-789',contact_name:'Budi',email:'budi@example.com',review_notes:'Hubungi PIC terkait gathering.'});
   const saved=await row();assert.equal(saved.account_name,'PT ABC Baru');assert.equal(saved.phone,'628123456789');assert.equal(saved.fit_score,0);assert.equal(saved.primary_source,'Manual');
   await update({email:''});assert.equal((await row()).email,null);
   const events=await db.query('select * from prospect_review_events');assert.equal(events.rows.length,2);assert.equal(events.rows[0].actor_membership_id,member);
   assert.ok(events.rows.some(e=>e.changed_fields.includes('phone')));
  });
  await t.test('rejects invalid input and forbidden fields without partial persistence',async()=>{
   for(const payload of [{account_name:''},{email:'invalid'},{phone:'123'},{website:'javascript:alert(1)'},{website:'https://user:secret@example.com'},{fit_score:'40'},{review_notes:'a'.repeat(5001)},{contact_name:42}]) await assert.rejects(update(payload));
   const before=await row();await assert.rejects(update({city:'Changed',email:'invalid'}));assert.equal((await row()).city,before.city);
   await update({website:'https://example.com/about?x=1'});
  });
  await t.test('stale detail/status saves are rejected and unchanged saves create no audit noise',async()=>{
   const stale=await row();await update({city:'Bogor'});
   await assert.rejects(update({city:'Jakarta'},stale.version),/telah berubah/);
   await assert.rejects(db.query('select review_prospect_status($1,$2,$3)',[prospect,stale.version,'archived']),/telah berubah/);
   const count=(await db.query('select count(*) n from prospect_review_events')).rows[0].n;
   await update({city:'Bogor'});assert.equal((await db.query('select count(*) n from prospect_review_events')).rows[0].n,count);
  });
  await t.test('review/archive/restore preserve prospect and capture status history',async()=>{
   for(const status of ['reviewed','archived','new']){
    const p=await row();await db.query('select review_prospect_status($1,$2,$3)',[prospect,p.version,status]);assert.equal((await row()).status,status);
   }
   const events=await db.query("select * from prospect_review_events where event_type='status_changed' order by created_at");assert.equal(events.rows.length,3);assert.equal(events.rows[2].previous_status,'archived');
   await assert.rejects(db.query('select set_prospect_status($1,$2)',[prospect,'promoted']),/tidak valid/);
  });
  await t.test('read-only users see history but cannot mutate; anonymous callers see neither',async()=>{
   await db.exec("set test.access='view'");assert.ok((await db.query('select * from prospect_review_events')).rows.length);
   await assert.rejects(update({city:'Forbidden'}),/Izin/);
   await assert.rejects(db.query('select set_prospect_status($1,$2)',[prospect,'archived']),/Izin/);
   await assert.rejects(db.query('delete from prospect_review_events'),/permission denied/);
   await db.exec("set test.access='none'");assert.equal((await db.query('select * from prospect_review_events')).rows.length,0);
   await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from prospect_review_events'),/permission denied/);
   await assert.rejects(update({city:'Forbidden'},'2026-01-01T00:00:00Z'),/permission denied/);
   await db.exec("reset role;set test.access='manage'");
  });
  await t.test('promoted prospects cannot be edited or restored outside Pipeline',async()=>{
   await db.query("update prospects set promoted_lead_id=$1,status='promoted' where id=$2",[lead,prospect]);
   await assert.rejects(update({city:'Forbidden'}),/dipromosikan/);
   await assert.rejects(db.query('select set_prospect_status($1,$2)',[prospect,'new']),/Pipeline/);
  });
 } finally {await db.close();}
});
