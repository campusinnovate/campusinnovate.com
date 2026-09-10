const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002', c='00000000-0000-4000-8000-000000000003';
const doc='00000000-0000-4000-8000-000000000010';
const assignment='00000000-0000-4000-8000-000000000020', resultId='00000000-0000-4000-8000-000000000030', period='00000000-0000-4000-8000-000000000040';
async function fixture() {
 const db = new PGlite();
 await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage; create schema extensions;
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
 create function extensions.gen_random_uuid() returns uuid language sql as $$ select gen_random_uuid() $$;
 create table public.memberships(id uuid primary key,user_id uuid,status text,full_name text,email text);
 create function public.current_membership_id() returns uuid language sql stable security definer as $$ select id from public.memberships where user_id=auth.uid() and status='active' $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
 create table public.notifications(id uuid default gen_random_uuid(),recipient_membership_id uuid,actor_membership_id uuid,notification_type text,title text,message text,entity_type text,entity_id text,action_url text,priority text);
 create table public.kpi_periods(id uuid primary key,status text);
 create table public.kpi_assignments(id uuid primary key,membership_id uuid,period_id uuid,status text,reviewer_membership_id uuid,review_note text,updated_at timestamptz,final_score numeric);
 create table public.kpi_results(id uuid primary key,assignment_id uuid,name text,formula_type text,target_value numeric,actual_value numeric,raw_achievement numeric,score numeric,reviewer_score numeric,review_note text,reviewed_by_membership_id uuid,reviewed_at timestamptz,updated_at timestamptz);
 create table public.kpi_events(id serial,assignment_id uuid,result_id uuid,actor_membership_id uuid,action text,before_data jsonb,after_data jsonb,reason text);
 create function public.kpi_score_item(formula text,target numeric,actual numeric) returns numeric language sql as $$ select case when actual is null then null when target>0 then actual/target*100 end $$;
 create function public.recalculate_kpi_assignment(target_assignment_id uuid) returns void language sql as $$ update public.kpi_assignments set final_score=(select avg(score) from public.kpi_results where assignment_id=target_assignment_id) where id=target_assignment_id $$;
 insert into public.memberships values('${a}','${a}','active','Anggota A','a@example.test'),('${b}','${b}','active','Anggota B','b@example.test'),('${c}','${c}','active','Anggota C','c@example.test');
 insert into storage.objects(bucket_id,name) values('office-signatures','${a}/a.png'),('office-signatures','${b}/b.png'),('office-documents','${a}/source.pdf'),('office-documents','${a}/output.pdf');
 insert into public.kpi_periods values('${period}','open');
 insert into public.kpi_assignments values('${assignment}','${a}','${period}','reviewed','${b}',null,now(),100);
 insert into public.kpi_results values('${resultId}','${assignment}','Target test','higher_better',10,5,50,50,95,'Reviewed','${b}',now(),now());
 grant usage on schema public,auth,storage,extensions to authenticated,service_role;
 grant select,insert on storage.objects to authenticated;
 `);
 for (const file of ['20260908150000_digital_office.sql','20260908151000_kpi_self_corrections.sql','20260909120000_office_direct_signing.sql','20260910120000_office_signing_backend_access.sql']) await db.exec(fs.readFileSync(`supabase/migrations/${file}`,'utf8'));
 return db;
}
async function actor(db,id,role='authenticated') { await db.exec(`reset role; set test.actor='${id}'; set role ${role};`); }
async function signature(db,id,shared) { await actor(db,id); await db.query('select save_office_signature($1,$2)',[`${id}/${id===a?'a':'b'}.png`,shared]); }
const payload=()=>({id:doc,title:'Test dokumen',source_path:`${a}/source.pdf`,source_hash:'a'.repeat(64),page_count:2,signers:[a,b].map(membership_id=>({membership_id,page:1,x:.1,y:.3,width:.3,height:.1}))});

test('Digital Office enforces consent, private documents, immutable finalization and audit', async () => {
 const db=await fixture();
 try {
  await signature(db,a,false); await signature(db,b,false); await actor(db,a);
  await assert.rejects(db.query('select create_office_document($1)',[payload()]),/belum membagikan/);
  await signature(db,b,true); await actor(db,a);
  await assert.rejects(db.query('select save_office_signature($1,true)',[`${b}/b.png`]),/milikmu/);
  const invalid=payload();invalid.signers[0].x=.9;
  await assert.rejects(db.query('select create_office_document($1)',[invalid]),/Lokasi/);
  await db.query('select create_office_document($1)',[payload()]);
  await actor(db,c);
  assert.equal((await db.query('select * from office_documents')).rows.length,0);
  await assert.rejects(db.query('select respond_office_document($1,true)',[doc]),/tidak tersedia/);
  await actor(db,a);
  await assert.rejects(db.query('select complete_office_document($1,$2,$3)',[doc,`${a}/output.pdf`,'b'.repeat(64)]),/permission denied/);
  await actor(db,a,'service_role');
  await assert.rejects(db.query('select complete_office_document($1,$2,$3)',[doc,`${a}/output.pdf`,'b'.repeat(64)]),/harus menyetujui/);
  await actor(db,a);await db.query('select respond_office_document($1,true)',[doc]);
  await actor(db,b);await db.query('select respond_office_document($1,true)',[doc]);
  await assert.rejects(db.query('select respond_office_document($1,true)',[doc]),/sudah disimpan/);
  await actor(db,a,'service_role');await db.query('select complete_office_document($1,$2,$3)',[doc,`${a}/output.pdf`,'b'.repeat(64)]);
  await assert.rejects(db.query('select complete_office_document($1,$2,$3)',[doc,`${a}/output.pdf`,'b'.repeat(64)]),/tidak dapat difinalisasi/);
  await actor(db,b);
  const row=(await db.query('select * from office_documents')).rows[0];assert.equal(row.status,'completed');
  const verified=(await db.query('select verify_office_credential($1) result',[row.credential])).rows[0].result;assert.equal(verified.document.output_hash,'b'.repeat(64));assert.equal(verified.signers.length,2);
  assert.equal((await db.query('select * from office_events')).rows.length,4);
  await actor(db,c);await assert.rejects(db.query('select verify_office_credential($1)',[row.credential]),/peserta dokumen/);
  await actor(db,a);const cancelled=payload();cancelled.id='00000000-0000-4000-8000-000000000011';await db.query('select create_office_document($1)',[cancelled]);
  await actor(db,b);await assert.rejects(db.query('select cancel_office_document($1)',[cancelled.id]),/pembuat/);await db.query('select respond_office_document($1,false)',[cancelled.id]);
  await actor(db,a,'service_role');await assert.rejects(db.query('select complete_office_document($1,$2,$3)',[cancelled.id,`${a}/output.pdf`,'b'.repeat(64)]),/tidak dapat difinalisasi/);
 } finally { await db.close(); }
});

test('KPI corrections reject other owners and locked periods, recalculate and reset review', async()=>{
 const db=await fixture();
 try {
  await actor(db,b);await assert.rejects(db.query('select correct_my_kpi_item($1,20,$2)',[resultId,'Salah input']),/Hanya pemilik/);
  await actor(db,a);await assert.rejects(db.query('select correct_my_kpi_item($1,20,$2)',[resultId,'']),/alasan/);
  await assert.rejects(db.query('select correct_my_kpi_item($1,0,$2)',[resultId,'Salah input']),/lebih besar/);
  await db.query('select correct_my_kpi_item($1,20,$2)',[resultId,'Salah input']);
  await db.exec('reset role');
  const result=(await db.query('select * from kpi_results')).rows[0]; assert.equal(Number(result.score),25);assert.equal(result.reviewer_score,null);
  assert.equal((await db.query('select status from kpi_assignments')).rows[0].status,'revision_requested');
  assert.equal((await db.query('select * from kpi_events')).rows.length,1);
  await db.exec('update kpi_results set actual_value=null');await actor(db,a);await db.query('select correct_my_kpi_item($1,30,$2)',[resultId,'Target diperbaiki']);await db.exec('reset role');assert.equal((await db.query('select score from kpi_results')).rows[0].score,null);
  await db.exec("update kpi_periods set status='locked'");await actor(db,a);await assert.rejects(db.query('select correct_my_kpi_item($1,25,$2)',[resultId,'Salah input']),/terkunci/);
 }finally{await db.close();}
});

test('chat archive includes historical files/links, searches file names and denies outsiders',async()=>{
 const db=await fixture();
 try{
  await db.exec(`
  create table public.google_calendar_connections(id uuid primary key);
  create table public.chat_meetings(id uuid primary key);
  create table public.chat_messages(id uuid primary key default gen_random_uuid(),conversation_id uuid,sender_membership_id uuid,body text,created_at timestamptz,deleted_at timestamptz);
  create table public.chat_attachments(id uuid primary key default gen_random_uuid(),message_id uuid,file_name text,file_url text,mime_type text);
  create table public.chat_relations(id uuid primary key default gen_random_uuid(),conversation_id uuid,created_at timestamptz);
  create function public.is_chat_member(target uuid) returns boolean language sql stable security definer as $$ select current_membership_id() in ('${a}'::uuid,'${b}'::uuid) and target='${doc}'::uuid $$;
  insert into public.chat_messages(conversation_id,sender_membership_id,body,created_at) select '${doc}','${a}','https://example.test/'||i,now()-i*interval '1 minute' from generate_series(1,51)i;
  insert into public.chat_messages(id,conversation_id,sender_membership_id,body,created_at) values('${resultId}','${doc}','${b}','Dokumen tim',now());
  insert into public.chat_attachments(message_id,file_name,file_url,mime_type) values('${resultId}','laporan.pdf','https://example.test/laporan.pdf','application/pdf');
  insert into public.chat_messages(conversation_id,sender_membership_id,body,created_at,deleted_at) values('${doc}','${a}','https://example.test/deleted',now(),now());
  `);
  await db.exec(fs.readFileSync('supabase/migrations/20260908152000_chat_archive.sql','utf8'));
  await actor(db,a);const first=(await db.query('select chat_archive($1,0,$2) value',[doc,''])).rows[0].value;
  assert.equal(first.messages.length,50);assert.equal(first.messages[0].attachments[0].name,'laporan.pdf');assert.equal(first.messages.some(m=>m.body.includes('deleted')),false);
  assert.equal((await db.query('select chat_archive($1,50,$2) value',[doc,''])).rows[0].value.messages.length,2);
  assert.equal((await db.query('select chat_archive($1,0,$2) value',[doc,'laporan'])).rows[0].value.messages.length,1);
  await actor(db,c);await assert.rejects(db.query('select chat_archive($1)',[doc]),/tidak dapat diakses/);
 }finally{await db.close();}
});


test('direct signing preserves sharing, access control and truthful approval history', async () => {
 const db = await fixture();
 try {
  await signature(db,a,false); await signature(db,b,false); await actor(db,a);
  const direct = {...payload(), approval_mode:'direct'};
  await assert.rejects(db.query('select create_office_document($1)',[direct]),/belum membagikan/);
  await signature(db,b,true); await actor(db,a);
  await assert.rejects(db.query('select create_office_document($1)',[{...direct,approval_mode:'invalid'}]),/Mode/);
  await db.query('select create_office_document($1)',[direct]);
  const row=(await db.query('select * from office_documents')).rows[0];
  assert.equal(row.approval_mode,'direct');
  assert.ok((await db.query('select * from office_signers')).rows.every(s=>s.approved_at===null));
  assert.equal((await db.query('select * from office_events')).rows[0].action,'created_direct');
  await actor(db,b);
  await assert.rejects(db.query('select respond_office_document($1,true)',[doc]),/tanpa approval/);
  await actor(db,c); assert.equal((await db.query('select * from office_documents')).rows.length,0);
  await actor(db,a);
  await assert.rejects(db.query('select complete_office_document($1,$2,$3)',[doc,`${a}/output.pdf`,'b'.repeat(64)]),/permission denied/);
  await actor(db,a,'service_role');
  assert.equal((await db.query('select * from office_documents where id=$1',[doc])).rows.length,1);
  assert.equal((await db.query('select * from office_signers where document_id=$1',[doc])).rows.length,2);
  await db.query('select complete_office_document($1,$2,$3)',[doc,`${a}/output.pdf`,'b'.repeat(64)]);
  await actor(db,b);
  const verified=(await db.query('select verify_office_credential($1) result',[row.credential])).rows[0].result;
  assert.equal(verified.document.status,'completed');
  assert.equal(verified.document.approval_mode,'direct');
  assert.ok(verified.signers.every(s=>s.approved_at===null));
 } finally { await db.close(); }
});
