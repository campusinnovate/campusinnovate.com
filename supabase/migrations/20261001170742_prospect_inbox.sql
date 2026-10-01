-- Prospect Inbox is the pre-pipeline review layer for LinkedIn/Sheet research.
-- Prospect Harvester remains a separate discovery surface; Pipeline remains the
-- operational source of truth after a prospect is converted.

alter table public.prospects
  add column inbox_status text not null default 'new'
    check (inbox_status in ('new','needs_review','potential','duplicate','junk','replace_pic','converted')),
  add column duplicate_of_prospect_id uuid references public.prospects(id) on delete set null;

create index prospects_inbox_status_updated_idx
  on public.prospects(inbox_status,updated_at desc);
create index prospects_duplicate_of_idx
  on public.prospects(duplicate_of_prospect_id)
  where duplicate_of_prospect_id is not null;

update public.prospects
set inbox_status=case status
  when 'promoted' then 'converted'
  when 'reviewed' then 'potential'
  when 'archived' then 'junk'
  else 'new'
end;

create table public.prospect_import_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  source_type text not null check(source_type in ('google_sheets','csv','linkedin','manual')),
  source_title text not null,
  source_file_id text,
  source_sheet_name text,
  total_rows integer not null default 0 check(total_rows>=0),
  processed_rows integer not null default 0 check(processed_rows>=0),
  failed_rows integer not null default 0 check(failed_rows>=0),
  status text not null default 'running' check(status in ('running','completed','completed_with_errors','failed')),
  summary jsonb not null default '{}'::jsonb check(jsonb_typeof(summary)='object'),
  imported_by_membership_id uuid references public.memberships(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.prospect_research_records (
  id uuid primary key default extensions.gen_random_uuid(),
  prospect_id uuid not null unique references public.prospects(id) on delete cascade,
  import_batch_id uuid references public.prospect_import_batches(id) on delete set null,
  source_file_id text not null,
  source_sheet_name text not null,
  source_row_number integer not null check(source_row_number>0),
  source_no text,
  lead_code text,
  source_status text,
  company_institution text,
  pic text,
  position text,
  pipeline_category text,
  description text,
  context_findings text,
  potential_problem_opportunity text,
  recommended_solution text,
  budget text,
  authority text,
  need text,
  timeline text,
  confidence text,
  evidence_sources text,
  suggested_outreach_angle text,
  next_action text,
  linkedin_saved_lead text,
  research_date text,
  position_status text,
  verified_current_position text,
  verified_current_organization text,
  position_verification_source text,
  company_website_social_media text,
  review_manual_bd_ceo text,
  review_manual_cto_digital_system text,
  raw_snapshot jsonb not null check(jsonb_typeof(raw_snapshot)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prospect_research_source_row_unique unique(source_file_id,source_sheet_name,source_row_number)
);

create table public.prospect_import_failures (
  id uuid primary key default extensions.gen_random_uuid(),
  import_batch_id uuid not null references public.prospect_import_batches(id) on delete cascade,
  source_row_number integer,
  error_message text not null,
  raw_snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(raw_snapshot)='object'),
  created_at timestamptz not null default now()
);

create index prospect_research_lead_code_idx on public.prospect_research_records(lead_code)
  where lead_code is not null;
create index prospect_research_pic_idx on public.prospect_research_records(pic)
  where pic is not null;
create index prospect_import_failures_batch_idx on public.prospect_import_failures(import_batch_id,source_row_number);

alter table public.prospect_import_batches enable row level security;
alter table public.prospect_research_records enable row level security;
alter table public.prospect_import_failures enable row level security;
revoke all on public.prospect_import_batches,public.prospect_research_records,public.prospect_import_failures from anon,authenticated;

alter table public.prospect_review_events
  drop constraint if exists prospect_review_events_event_type_check;
alter table public.prospect_review_events
  add constraint prospect_review_events_event_type_check
  check(event_type in ('details_updated','status_changed','inbox_status_changed','duplicate_linked','research_review_updated','converted'));

create or replace function public.prospect_inbox_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.current_user_has_permission('pipeline.view') then
    raise exception 'Akses Pipeline BD diperlukan.' using errcode='42501';
  end if;
  return jsonb_build_object(
    'prospects',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',p.id,'account_name',p.account_name,'account_type',p.account_type,'industry',p.industry,
          'city',p.city,'primary_source',p.primary_source,'contact_name',p.contact_name,'contact_role',p.contact_role,
          'recommended_service',p.recommended_service,'recommended_pipeline',p.recommended_pipeline,
          'fit_score',p.fit_score,'intent_score',p.intent_score,'accessibility_score',p.accessibility_score,
          'total_score',p.fit_score+p.intent_score+p.accessibility_score,'inbox_status',p.inbox_status,
          'duplicate_of_prospect_id',p.duplicate_of_prospect_id,'promoted_lead_id',p.promoted_lead_id,
          'updated_at',p.updated_at,'lead_code',r.lead_code,'source_status',r.source_status,
          'pipeline_category',r.pipeline_category,'confidence',r.confidence,'research_date',r.research_date,
          'position_status',r.position_status,'next_action',r.next_action
        ) order by
          case p.inbox_status when 'needs_review' then 0 when 'new' then 1 when 'replace_pic' then 2 when 'potential' then 3 when 'duplicate' then 4 when 'junk' then 5 else 6 end,
          p.updated_at desc
      )
      from public.prospects p
      left join public.prospect_research_records r on r.prospect_id=p.id
    ),'[]'::jsonb),
    'stats',jsonb_build_object(
      'total',(select count(*) from public.prospects),
      'needs_review',(select count(*) from public.prospects where inbox_status in ('new','needs_review','replace_pic')),
      'potential',(select count(*) from public.prospects where inbox_status='potential'),
      'duplicates',(select count(*) from public.prospects where inbox_status='duplicate'),
      'converted',(select count(*) from public.prospects where inbox_status='converted')
    ),
    'pipeline_sources',coalesce((
      select jsonb_agg(jsonb_build_object('id',ws.id,'key',ws.key,'name',ws.name,'color',ws.color,'module_config',ws.module_config) order by ws.sort_order)
      from public.work_sources ws where ws.module_type='pipeline' and ws.is_active and public.can_access_work_source(ws.id)
    ),'[]'::jsonb),
    'members',public.list_pipeline_members(),
    'imports',coalesce((
      select jsonb_agg(to_jsonb(b) order by b.created_at desc) from (
        select * from public.prospect_import_batches order by created_at desc limit 10
      ) b
    ),'[]'::jsonb)
  );
end; $$;

create or replace function public.prospect_inbox_detail(target_prospect_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.current_user_has_permission('pipeline.view') then
    raise exception 'Akses Pipeline BD diperlukan.' using errcode='42501';
  end if;
  select to_jsonb(p)||jsonb_build_object(
    'total_score',p.fit_score+p.intent_score+p.accessibility_score,
    'research',(select to_jsonb(r) from public.prospect_research_records r where r.prospect_id=p.id),
    'signals',coalesce((select jsonb_agg(to_jsonb(s) order by s.detected_at desc) from public.prospect_signals s where s.prospect_id=p.id),'[]'::jsonb),
    'outreach',(select to_jsonb(o) from public.prospect_outreach_drafts o where o.prospect_id=p.id),
    'review_events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select * from public.prospect_review_events where prospect_id=p.id order by created_at desc limit 30) e),'[]'::jsonb),
    'duplicate_of',(select jsonb_build_object('id',d.id,'account_name',d.account_name,'contact_name',d.contact_name,'promoted_lead_id',d.promoted_lead_id) from public.prospects d where d.id=p.duplicate_of_prospect_id)
  ) into result from public.prospects p where p.id=target_prospect_id;
  if result is null then raise exception 'Prospect tidak ditemukan.'; end if;
  return result;
end; $$;

create or replace function public.create_prospect_import_batch(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); saved_id uuid;
begin
  if actor_id is null or not public.current_user_has_permission('pipeline.manage_self') then
    raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501';
  end if;
  if coalesce(payload->>'source_type','') not in ('google_sheets','csv','linkedin','manual') then raise exception 'Tipe sumber impor tidak valid.'; end if;
  if trim(coalesce(payload->>'source_title',''))='' then raise exception 'Judul sumber impor wajib diisi.'; end if;
  insert into public.prospect_import_batches(source_type,source_title,source_file_id,source_sheet_name,total_rows,imported_by_membership_id)
  values(payload->>'source_type',trim(payload->>'source_title'),nullif(trim(payload->>'source_file_id'),''),nullif(trim(payload->>'source_sheet_name'),''),greatest(0,coalesce(nullif(payload->>'total_rows','')::integer,0)),actor_id)
  returning id into saved_id;
  return saved_id;
end; $$;

create or replace function public.import_prospect_research_row(target_batch_id uuid,source_row_number integer,payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  actor_id uuid:=public.current_membership_id(); batch public.prospect_import_batches%rowtype;
  existing_record public.prospect_research_records%rowtype; canonical_id uuid; prospect_uuid uuid;
  account_value text:=trim(coalesce(payload->>'company_institution',''));
  pic_value text:=nullif(trim(payload->>'pic'),''); code_value text:=nullif(trim(payload->>'lead_code'),'');
  mapped_status text; result_kind text:='created';
begin
  if actor_id is null or not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
  if source_row_number is null or source_row_number<1 then raise exception 'Nomor baris sumber tidak valid.'; end if;
  if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Data riset tidak valid.'; end if;
  if account_value='' then raise exception 'Company / Institution wajib diisi.'; end if;
  select * into batch from public.prospect_import_batches where id=target_batch_id for update;
  if batch.id is null or batch.status<>'running' then raise exception 'Batch impor tidak tersedia atau sudah selesai.'; end if;
  if batch.source_file_id is null or batch.source_sheet_name is null then raise exception 'File dan sheet sumber wajib tercatat.'; end if;

  select * into existing_record from public.prospect_research_records
  where source_file_id=batch.source_file_id and source_sheet_name=batch.source_sheet_name and prospect_research_records.source_row_number=import_prospect_research_row.source_row_number;
  if existing_record.id is not null then
    prospect_uuid:=existing_record.prospect_id; result_kind:='updated';
  else
    if code_value is not null then
      select r.prospect_id into canonical_id from public.prospect_research_records r where lower(r.lead_code)=lower(code_value) limit 1;
    end if;
    if canonical_id is null and pic_value is not null then
      select p.id into canonical_id from public.prospects p
      where lower(trim(p.account_name))=lower(account_value) and lower(trim(coalesce(p.contact_name,'')))=lower(pic_value) limit 1;
    end if;
    mapped_status:=case
      when canonical_id is not null then 'duplicate'
      when coalesce(payload->>'status','') ilike '%replace pic%'
        or coalesce(payload->>'position_status','') ilike '%unverified%' then 'replace_pic'
      when coalesce(payload->>'status','') ilike '%potential%' then 'potential'
      else 'needs_review'
    end;
    insert into public.prospects(
      account_name,account_type,industry,city,website,linkedin_url,primary_source,recommended_pipeline,recommended_service,
      contact_name,contact_role,ai_summary,inbox_status,duplicate_of_prospect_id,raw_data,created_by_membership_id
    ) values (
      account_value,nullif(trim(payload->>'account_type'),''),nullif(trim(payload->>'industry'),''),nullif(trim(payload->>'city'),''),
      nullif(trim(payload->>'website'),''),nullif(trim(payload->>'linkedin_url'),''),'LinkedIn Lead Research',
      nullif(trim(payload->>'pipeline_category'),''),nullif(trim(payload->>'recommended_service'),''),pic_value,
      nullif(trim(payload->>'position'),''),nullif(trim(payload->>'description'),''),mapped_status,canonical_id,
      jsonb_build_object('source_file_id',batch.source_file_id,'source_sheet_name',batch.source_sheet_name,'source_row_number',source_row_number),actor_id
    ) returning id into prospect_uuid;
  end if;

  insert into public.prospect_research_records(
    prospect_id,import_batch_id,source_file_id,source_sheet_name,source_row_number,source_no,lead_code,source_status,
    company_institution,pic,position,pipeline_category,description,context_findings,potential_problem_opportunity,
    recommended_solution,budget,authority,need,timeline,confidence,evidence_sources,suggested_outreach_angle,next_action,
    linkedin_saved_lead,research_date,position_status,verified_current_position,verified_current_organization,
    position_verification_source,company_website_social_media,review_manual_bd_ceo,review_manual_cto_digital_system,raw_snapshot
  ) values (
    prospect_uuid,target_batch_id,batch.source_file_id,batch.source_sheet_name,source_row_number,payload->>'no',code_value,payload->>'status',
    payload->>'company_institution',payload->>'pic',payload->>'position',payload->>'pipeline_category',payload->>'description',payload->>'context_findings',payload->>'potential_problem_opportunity',
    payload->>'recommended_solution',payload->>'budget',payload->>'authority',payload->>'need',payload->>'timeline',payload->>'confidence',payload->>'evidence_sources',payload->>'suggested_outreach_angle',payload->>'next_action',
    payload->>'linkedin_saved_lead',payload->>'research_date',payload->>'position_status',payload->>'verified_current_position',payload->>'verified_current_organization',
    payload->>'position_verification_source',payload->>'company_website_social_media',payload->>'review_manual_bd_ceo',payload->>'review_manual_cto_digital_system',payload
  ) on conflict on constraint prospect_research_source_row_unique do update set
    import_batch_id=excluded.import_batch_id,source_no=excluded.source_no,lead_code=excluded.lead_code,source_status=excluded.source_status,
    company_institution=excluded.company_institution,pic=excluded.pic,position=excluded.position,pipeline_category=excluded.pipeline_category,
    description=excluded.description,context_findings=excluded.context_findings,potential_problem_opportunity=excluded.potential_problem_opportunity,
    recommended_solution=excluded.recommended_solution,budget=excluded.budget,authority=excluded.authority,need=excluded.need,timeline=excluded.timeline,
    confidence=excluded.confidence,evidence_sources=excluded.evidence_sources,suggested_outreach_angle=excluded.suggested_outreach_angle,
    next_action=excluded.next_action,linkedin_saved_lead=excluded.linkedin_saved_lead,research_date=excluded.research_date,
    position_status=excluded.position_status,verified_current_position=excluded.verified_current_position,
    verified_current_organization=excluded.verified_current_organization,position_verification_source=excluded.position_verification_source,
    company_website_social_media=excluded.company_website_social_media,review_manual_bd_ceo=excluded.review_manual_bd_ceo,
    review_manual_cto_digital_system=excluded.review_manual_cto_digital_system,raw_snapshot=excluded.raw_snapshot,updated_at=now();
  update public.prospect_import_batches set processed_rows=processed_rows+1 where id=target_batch_id;
  return jsonb_build_object('prospect_id',prospect_uuid,'result',result_kind,'duplicate_of_prospect_id',canonical_id);
end; $$;

create or replace function public.record_prospect_import_failure(target_batch_id uuid,source_row_number integer,error_message text,raw_snapshot jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
  if trim(coalesce(error_message,''))='' then raise exception 'Pesan error wajib diisi.'; end if;
  insert into public.prospect_import_failures(import_batch_id,source_row_number,error_message,raw_snapshot)
  values(target_batch_id,source_row_number,trim(error_message),coalesce(raw_snapshot,'{}'::jsonb));
  update public.prospect_import_batches set failed_rows=failed_rows+1 where id=target_batch_id and status='running';
  if not found then raise exception 'Batch impor tidak tersedia atau sudah selesai.'; end if;
end; $$;

create or replace function public.complete_prospect_import_batch(target_batch_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
  update public.prospect_import_batches set
    status=case when failed_rows>0 then 'completed_with_errors' else 'completed' end,
    completed_at=now(),summary=jsonb_build_object('processed_rows',processed_rows,'failed_rows',failed_rows,'expected_rows',total_rows)
  where id=target_batch_id and status='running';
  if not found then raise exception 'Batch impor tidak tersedia atau sudah selesai.'; end if;
end; $$;

create or replace function public.save_prospect_inbox_review(target_prospect_id uuid,expected_updated_at timestamptz,payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  p public.prospects%rowtype; r public.prospect_research_records%rowtype; target_status text;
  duplicate_id uuid; actor_id uuid:=public.current_membership_id(); changed text[]:='{}'; phone_value text;
begin
  if actor_id is null or not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
  if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Data review tidak valid.'; end if;
  select * into p from public.prospects where id=target_prospect_id for update;
  if p.id is null then raise exception 'Prospect tidak ditemukan.'; end if;
  if p.updated_at is distinct from expected_updated_at then raise exception 'Prospect telah berubah. Muat ulang detail sebelum menyimpan.' using errcode='40001'; end if;
  if p.inbox_status='converted' or p.promoted_lead_id is not null then raise exception 'Prospect sudah masuk Pipeline BD.'; end if;
  target_status:=coalesce(nullif(payload->>'inbox_status',''),p.inbox_status);
  if target_status not in ('new','needs_review','potential','duplicate','junk','replace_pic') then raise exception 'Status Prospect Inbox tidak valid.'; end if;
  duplicate_id:=nullif(payload->>'duplicate_of_prospect_id','')::uuid;
  if target_status='duplicate' then
    if duplicate_id is null or duplicate_id=p.id or not exists(select 1 from public.prospects where id=duplicate_id) then raise exception 'Pilih prospect utama untuk status Duplicate.'; end if;
  else duplicate_id:=null; end if;
  if char_length(coalesce(payload->>'review_notes',''))>5000 or char_length(coalesce(payload->>'review_manual_bd_ceo',''))>5000 or char_length(coalesce(payload->>'review_manual_cto_digital_system',''))>5000 then raise exception 'Catatan review maksimal 5000 karakter.'; end if;
  if payload?'account_name' and char_length(trim(coalesce(payload->>'account_name',''))) not between 1 and 180 then raise exception 'Nama account wajib diisi (maksimal 180 karakter).'; end if;
  if payload?'email' and trim(coalesce(payload->>'email',''))<>'' and trim(payload->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Format email tidak valid.'; end if;
  if payload?'website' and trim(coalesce(payload->>'website',''))<>'' and (trim(payload->>'website') !~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$' or trim(payload->>'website') ~ '[<>]') then raise exception 'Website harus berupa URL http/https yang valid.'; end if;
  phone_value:=trim(coalesce(payload->>'phone',p.phone,''));
  if phone_value<>'' then
    phone_value:=regexp_replace(phone_value,'[[:space:]()+.\-]','','g');
    if left(phone_value,1)='0' then phone_value:='62'||substr(phone_value,2); end if;
    if phone_value !~ '^[1-9][0-9]{6,14}$' then raise exception 'Nomor telepon tidak valid. Gunakan kode negara.'; end if;
  end if;
  if target_status is distinct from p.inbox_status then changed:=array_append(changed,'inbox_status'); end if;
  if duplicate_id is distinct from p.duplicate_of_prospect_id then changed:=array_append(changed,'duplicate_of_prospect_id'); end if;
  if coalesce(payload->>'review_notes','') is distinct from p.review_notes then changed:=array_append(changed,'review_notes'); end if;
  if payload?'account_name' and trim(payload->>'account_name') is distinct from p.account_name then changed:=array_append(changed,'account_name'); end if;
  if payload?'contact_name' and nullif(trim(payload->>'contact_name'),'') is distinct from p.contact_name then changed:=array_append(changed,'contact_name'); end if;
  if payload?'contact_role' and nullif(trim(payload->>'contact_role'),'') is distinct from p.contact_role then changed:=array_append(changed,'contact_role'); end if;
  if payload?'recommended_service' and nullif(trim(payload->>'recommended_service'),'') is distinct from p.recommended_service then changed:=array_append(changed,'recommended_service'); end if;
  update public.prospects set
    inbox_status=target_status,duplicate_of_prospect_id=duplicate_id,
    account_name=case when payload?'account_name' then trim(payload->>'account_name') else account_name end,
    account_type=case when payload?'account_type' then nullif(trim(payload->>'account_type'),'') else account_type end,
    industry=case when payload?'industry' then nullif(trim(payload->>'industry'),'') else industry end,
    city=case when payload?'city' then nullif(trim(payload->>'city'),'') else city end,
    website=case when payload?'website' then nullif(trim(payload->>'website'),'') else website end,
    phone=case when payload?'phone' then nullif(phone_value,'') else phone end,
    email=case when payload?'email' then nullif(trim(payload->>'email'),'') else email end,
    contact_name=case when payload?'contact_name' then nullif(trim(payload->>'contact_name'),'') else contact_name end,
    contact_role=case when payload?'contact_role' then nullif(trim(payload->>'contact_role'),'') else contact_role end,
    recommended_service=case when payload?'recommended_service' then nullif(trim(payload->>'recommended_service'),'') else recommended_service end,
    recommended_pipeline=case when payload?'recommended_pipeline' then nullif(trim(payload->>'recommended_pipeline'),'') else recommended_pipeline end,
    recommended_business_unit=case when payload?'recommended_business_unit' then nullif(trim(payload->>'recommended_business_unit'),'') else recommended_business_unit end,
    review_notes=coalesce(payload->>'review_notes',review_notes),updated_at=clock_timestamp()
  where id=p.id;
  select * into r from public.prospect_research_records where prospect_id=p.id for update;
  if r.id is not null then
    if coalesce(payload->>'review_manual_bd_ceo','') is distinct from coalesce(r.review_manual_bd_ceo,'') then changed:=array_append(changed,'review_manual_bd_ceo'); end if;
    if coalesce(payload->>'review_manual_cto_digital_system','') is distinct from coalesce(r.review_manual_cto_digital_system,'') then changed:=array_append(changed,'review_manual_cto_digital_system'); end if;
    update public.prospect_research_records set
      review_manual_bd_ceo=coalesce(payload->>'review_manual_bd_ceo',review_manual_bd_ceo),
      review_manual_cto_digital_system=coalesce(payload->>'review_manual_cto_digital_system',review_manual_cto_digital_system),updated_at=now()
    where id=r.id;
  end if;
  if cardinality(changed)>0 then
    insert into public.prospect_review_events(prospect_id,actor_membership_id,event_type,changed_fields,previous_status,new_status)
    values(p.id,actor_id,case when target_status is distinct from p.inbox_status then 'inbox_status_changed' else 'research_review_updated' end,changed,p.inbox_status,target_status);
  end if;
end; $$;

create or replace function public.promote_inbox_prospect_to_pipeline(target_prospect_id uuid,target_source_id uuid,target_owner_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare p public.prospects%rowtype;
begin
  if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.manage_self') then
    raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501';
  end if;
  select * into p from public.prospects where id=target_prospect_id for update;
  if p.id is null then raise exception 'Prospect tidak ditemukan.'; end if;
  if p.inbox_status in ('duplicate','junk') then raise exception 'Prospect Duplicate atau Junk tidak dapat masuk Pipeline BD.'; end if;
  return public.promote_prospect_to_pipeline(target_prospect_id,target_source_id,target_owner_id);
end; $$;

create or replace function public.sync_prospect_inbox_conversion()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.promoted_lead_id is not null and (old.promoted_lead_id is null or old.inbox_status<>'converted') then
    new.inbox_status:='converted';
    insert into public.prospect_review_events(prospect_id,actor_membership_id,event_type,changed_fields,previous_status,new_status)
    values(new.id,public.current_membership_id(),'converted',array['inbox_status','promoted_lead_id'],old.inbox_status,'converted');
  end if;
  return new;
end; $$;

create trigger sync_prospect_inbox_conversion_before_update
before update of promoted_lead_id on public.prospects
for each row execute function public.sync_prospect_inbox_conversion();

revoke all on function public.prospect_inbox_workspace(),public.prospect_inbox_detail(uuid),
  public.create_prospect_import_batch(jsonb),public.import_prospect_research_row(uuid,integer,jsonb),
  public.record_prospect_import_failure(uuid,integer,text,jsonb),public.complete_prospect_import_batch(uuid),
  public.save_prospect_inbox_review(uuid,timestamptz,jsonb),public.promote_inbox_prospect_to_pipeline(uuid,uuid,uuid),
  public.sync_prospect_inbox_conversion() from public,anon;
grant execute on function public.prospect_inbox_workspace(),public.prospect_inbox_detail(uuid),
  public.create_prospect_import_batch(jsonb),public.import_prospect_research_row(uuid,integer,jsonb),
  public.record_prospect_import_failure(uuid,integer,text,jsonb),public.complete_prospect_import_batch(uuid),
  public.save_prospect_inbox_review(uuid,timestamptz,jsonb),public.promote_inbox_prospect_to_pipeline(uuid,uuid,uuid) to authenticated;
