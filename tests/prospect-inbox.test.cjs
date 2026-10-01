const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const member='00000000-0000-4000-8000-000000000001';
const pipelineLead='00000000-0000-4000-8000-000000000099';
const migration=()=>fs.readFileSync('supabase/migrations/20261001170742_prospect_inbox.sql','utf8');
const row={
 no:'1',lead_code:'DS-TEST01',status:'POTENTIAL LEAD — High',company_institution:'PT Contoh Indonesia',pic:'Budi Utama',
 position:'Head of Digital',pipeline_category:'Workflow & Administration Systems',description:'Deskripsi lengkap',
 context_findings:'Temuan riset',potential_problem_opportunity:'Peluang workflow',recommended_solution:'Digital Transformation',
 budget:'Perlu discovery',authority:'High',need:'High',timeline:'Q4',confidence:'High',evidence_sources:'https://example.test/evidence',
 suggested_outreach_angle:'Masuk dari workflow',next_action:'Hubungi via LinkedIn',linkedin_saved_lead:'/sales/lead/example',
 research_date:'2026-09-18',position_status:'VERIFIED — current',verified_current_position:'Head of Digital',
 verified_current_organization:'PT Contoh Indonesia',position_verification_source:'https://example.test/team',
 company_website_social_media:'Website: https://example.test',review_manual_bd_ceo:'Layak dihubungi',
 review_manual_cto_digital_system:'Perlu technical discovery',
};

test('Prospect Inbox preserves research rows, links duplicates, audits review, and converts the same record',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated; create schema extensions;
   create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;
   create table memberships(id uuid primary key,full_name text,email text,position_id uuid,status text default 'active');
   insert into memberships(id,full_name) values('${member}','BD Test');
   create table pipeline_leads(id uuid primary key);insert into pipeline_leads values('${pipelineLead}');
   create table work_sources(id uuid primary key default gen_random_uuid(),key text,name text,color text,module_config jsonb default '{}',module_type text,is_active boolean default true,sort_order integer default 1);
   create table prospect_signals(id uuid primary key default gen_random_uuid(),prospect_id uuid,source text,signal_type text,content text,url text,detected_at timestamptz default now(),signal_score integer);
   create table prospect_outreach_drafts(id uuid primary key default gen_random_uuid(),prospect_id uuid,recommended_channel text,drafts jsonb);
   create function current_membership_id() returns uuid language sql as $$select '${member}'::uuid$$;
   create function current_user_has_permission(permission text) returns boolean language sql as $$select coalesce(current_setting('test.access',true),'none')='manage' or (permission='pipeline.view' and current_setting('test.access',true)='view')$$;
   create function can_access_work_source(uuid) returns boolean language sql as $$select true$$;
   create function list_pipeline_members() returns jsonb language sql as $$select '[]'::jsonb$$;
   grant usage on schema public to authenticated,anon;
  `);
  const original=fs.readFileSync('supabase/migrations/20260904113000_ruang_kawan_prospect_harvester.sql','utf8');
  await db.exec(original.match(/create table if not exists public\.prospects \([\s\S]*?\n\);/)[0]);
  await db.exec(`
   alter table prospects add column review_notes text not null default '';
   create table prospect_review_events(
    id uuid primary key default gen_random_uuid(),prospect_id uuid not null references prospects(id) on delete cascade,
    actor_membership_id uuid references memberships(id),event_type text not null check(event_type in ('details_updated','status_changed')),
    changed_fields text[] not null,previous_status text,new_status text,created_at timestamptz not null default now()
   );
   create function promote_prospect_to_pipeline(target_prospect_id uuid,target_source_id uuid,target_owner_id uuid default null)
   returns uuid language plpgsql as $$begin update prospects set promoted_lead_id='${pipelineLead}',status='promoted' where id=target_prospect_id;return '${pipelineLead}'::uuid;end$$;
  `);
  await db.exec(migration());
  await db.exec("set test.access='manage';set role authenticated");
  const batch=(await db.query('select create_prospect_import_batch($1) id',[{source_type:'google_sheets',source_title:'BD Worksheet New',source_file_id:'sheet-1',source_sheet_name:'LEAD RESEARCH',total_rows:460}])).rows[0].id;
  const first=(await db.query('select import_prospect_research_row($1,$2,$3) result',[batch,5,row])).rows[0].result;
  assert.equal(first.result,'created');assert.equal(first.duplicate_of_prospect_id,null);
  const second=(await db.query('select import_prospect_research_row($1,$2,$3) result',[batch,6,{...row,no:'2'}])).rows[0].result;
  assert.equal(second.result,'created');assert.equal(second.duplicate_of_prospect_id,first.prospect_id);
  await db.query('select complete_prospect_import_batch($1)',[batch]);
  await db.exec('reset role');
  const records=(await db.query('select * from prospect_research_records order by source_row_number')).rows;
  assert.equal(records.length,2);assert.deepEqual(records[0].raw_snapshot,row);assert.equal(records[0].review_manual_bd_ceo,'Layak dihubungi');
  assert.equal((await db.query('select inbox_status,duplicate_of_prospect_id from prospects where id=$1',[second.prospect_id])).rows[0].inbox_status,'duplicate');
  await db.exec('set role authenticated');
  const workspace=(await db.query('select prospect_inbox_workspace() data')).rows[0].data;
  assert.equal(workspace.stats.total,2);assert.equal(workspace.stats.duplicates,1);assert.equal(workspace.imports[0].processed_rows,2);
  const detail=(await db.query('select prospect_inbox_detail($1) data',[first.prospect_id])).rows[0].data;
  await db.query('select save_prospect_inbox_review($1,$2,$3)',[first.prospect_id,detail.updated_at,{inbox_status:'needs_review',review_notes:'Approved',review_manual_bd_ceo:'Prioritas outreach',review_manual_cto_digital_system:'Scope workshop dulu',account_name:'PT Contoh Indonesia',phone:'08123456789'}]);
  await db.exec('reset role');
  const reviewed=(await db.query('select inbox_status,review_notes,phone from prospects where id=$1',[first.prospect_id])).rows[0];
  assert.equal(reviewed.inbox_status,'needs_review');assert.equal(reviewed.phone,'628123456789');
  assert.ok((await db.query('select * from prospect_review_events where prospect_id=$1',[first.prospect_id])).rows.some(event=>event.event_type==='inbox_status_changed'));
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select promote_inbox_prospect_to_pipeline($1,$2,$3)',[second.prospect_id,member,member]),/Duplicate atau Junk/);
  await db.query('select promote_inbox_prospect_to_pipeline($1,$2,$3)',[first.prospect_id,member,member]);
  await db.exec('reset role');
  assert.equal((await db.query('select inbox_status from prospects where id=$1',[first.prospect_id])).rows[0].inbox_status,'converted');
  await db.exec("set role authenticated;set test.access='view'");
  assert.equal((await db.query('select prospect_inbox_workspace() data')).rows[0].data.stats.total,2);
  await assert.rejects(db.query('select save_prospect_inbox_review($1,$2,$3)',[second.prospect_id,new Date().toISOString(),{inbox_status:'junk'}]),/Izin/);
  await assert.rejects(db.query('select * from prospect_research_records'),/permission denied/);
  await db.exec('reset role;set role anon');
  await assert.rejects(db.query('select prospect_inbox_workspace()'),/permission denied/);
 }finally{await db.close()}
});
