-- Ruang Kawan: configurable Business Development pipelines linked to My Activity.

insert into public.permissions (key, name, description) values
  ('pipeline.view', 'Lihat Pipeline BD', 'Melihat pipeline Business Development dari sumber yang dapat diakses.'),
  ('pipeline.manage_self', 'Kelola Pipeline BD sendiri', 'Membuat dan memperbarui lead yang menjadi tanggung jawab sendiri.'),
  ('pipeline.manage_team', 'Kelola Pipeline BD tim', 'Membuat dan memperbarui lead milik anggota tim.'),
  ('pipeline.configure', 'Konfigurasi Pipeline BD', 'Mengatur sumber, stage, dropdown, dan workflow Pipeline BD.')
on conflict (key) do update set name = excluded.name, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  r.key = 'system_admin'
  or (r.key = 'executive' and p.key in ('pipeline.view','pipeline.manage_self','pipeline.manage_team','pipeline.configure'))
  or (r.key in ('people_hr_manager','project_lead') and p.key in ('pipeline.view','pipeline.manage_self','pipeline.manage_team'))
  or (r.key in ('staff','freelancer') and p.key in ('pipeline.view','pipeline.manage_self'))
on conflict do nothing;

update public.work_sources
set name = 'B2B Services',
    description = 'Pipeline EO/Event Experience, Website/Landing Page, dan Sistem Digital.',
    module_type = 'pipeline',
    color = '#315c7d',
    field_schema = '[]'::jsonb,
    module_config = jsonb_build_object(
      'pipeline_kind','institution','lead_prefix','B2B',
      'business_units',jsonb_build_array('EO/Event Experience','Website/Landing Page','Sistem Digital'),
      'stages',jsonb_build_array('Target','Researched','Outreach','Follow Up','Replied','Qualified','Meeting Scheduled','Meeting Done','Proposal Draft','Proposal Sent','Negotiation','Won','Lost','Nurture'),
      'closed_stages',jsonb_build_array('Won','Lost'),
      'priorities',jsonb_build_array('High','Medium','Low'),
      'qualification_statuses',jsonb_build_array('Yes','No','Pending'),
      'account_types','[]'::jsonb,
      'interest_levels','[]'::jsonb,
      'payment_statuses','[]'::jsonb,
      'activity_types',jsonb_build_array('Follow Up','Maintenance Community','Community Event','Partnership/Collaboration','Meeting Preparation','Proposal/Deck Draft','Other'),
      'kpi_options',jsonb_build_array('Outreach Client EO','Outreach Client Website/Landing Page & Sistem Digital','Follow Up','Qualified Meeting')
    ),
    allowed_position_keys = array['business_development_staff','ceo','coo'],
    sort_order = 30
where key = 'pipeline_bd';

insert into public.work_sources (
  key,name,description,color,icon,source_kind,module_type,module_config,
  allowed_position_keys,sort_order
) values
  (
    'pipeline_coreva','COREVA','Pipeline organisasi calon pengguna COREVA.','#7b61a8','pipeline','system','pipeline',
    jsonb_build_object(
      'pipeline_kind','institution','lead_prefix','COR','business_units',jsonb_build_array('Coreva'),
      'stages',jsonb_build_array('Target','Researched','Outreach','Follow Up','Replied','Qualified','Meeting Scheduled','Meeting Done','Proposal Draft','Proposal Sent','Negotiation','Won','Lost','Nurture'),
      'closed_stages',jsonb_build_array('Won','Lost'),
      'priorities',jsonb_build_array('High','Medium','Low'),
      'qualification_statuses',jsonb_build_array('Yes','No','Pending'),
      'account_types',jsonb_build_array('BEM','Himpunan','UKM','Komunitas','OSIS','Yayasan','Organisasi Profesi','Lainnya'),
      'interest_levels','[]'::jsonb,'payment_statuses','[]'::jsonb,
      'activity_types',jsonb_build_array('Follow Up','Maintenance Community','Community Event','Partnership/Collaboration','Meeting Preparation','Proposal/Deck Draft','Other'),
      'kpi_options',jsonb_build_array('Outreach Client Coreva','Follow Up','Qualified Meeting')
    ),
    array['business_development_staff','ceo','coo'],31
  ),
  (
    'pipeline_stripmate','Stripmate','Pipeline calon peserta trip dan komunitas Stripmate.','#2f7d68','pipeline','system','pipeline',
    jsonb_build_object(
      'pipeline_kind','traveler','lead_prefix','STM','business_units',jsonb_build_array('Stripmate'),
      'stages',jsonb_build_array('Lead Baru','Dihubungi','Tertarik','Tanya Detail','Menunggu Pembayaran','Paid/Booked','Tidak Jadi','Nurture'),
      'closed_stages',jsonb_build_array('Paid/Booked','Tidak Jadi'),
      'priorities',jsonb_build_array('High','Medium','Low'),
      'qualification_statuses','[]'::jsonb,'account_types','[]'::jsonb,
      'interest_levels',jsonb_build_array('Hot','Warm','Cold'),
      'payment_statuses',jsonb_build_array('Belum Bayar','Menunggu Verifikasi','Lunas','Refund'),
      'activity_types',jsonb_build_array('Follow Up','Maintenance Community','Community Event','Partnership/Collaboration','Meeting Preparation','Proposal/Deck Draft','Other'),
      'kpi_options',jsonb_build_array('Member Baru (StripMate)','Outreach Calon Peserta (StripMate)','Follow Up','Maintenance Community Organization Hub & Stripmate','Event Collaboration Stripmate')
    ),
    array['business_development_staff','ceo','coo'],32
  )
on conflict (key) do update set
  name=excluded.name,description=excluded.description,color=excluded.color,icon=excluded.icon,
  source_kind=excluded.source_kind,module_type=excluded.module_type,module_config=excluded.module_config,
  allowed_position_keys=excluded.allowed_position_keys,sort_order=excluded.sort_order;

insert into public.work_sources (
  key,name,description,color,icon,source_kind,module_type,module_config,field_schema,
  allowed_position_keys,sort_order
) values
  (
    'pipeline_client','Client','Pipeline historis client, instansi, sekolah, kampus, pemerintah, dan swasta.','#b56d3d','pipeline','system','pipeline',
    jsonb_build_object(
      'pipeline_kind','institution','lead_prefix','CLI','business_units',jsonb_build_array('Client'),
      'stages',jsonb_build_array('Cold Lead','Contacted','In Discussion','Proposal Sent','Negotiation','Closed Won','Closed Lost','Reschedule'),
      'closed_stages',jsonb_build_array('Closed Won','Closed Lost'),
      'priorities',jsonb_build_array('Medium'),'qualification_statuses','[]'::jsonb,
      'account_types',jsonb_build_array('SD','SMP','SMA','Universitas','Organisasi / UKM','Direktorat','Unit','Fakultas','Departemen','Boarding School','Magister','Doktor','Instansi Pemerintah','Swasta'),
      'interest_levels','[]'::jsonb,'payment_statuses','[]'::jsonb,
      'activity_types',jsonb_build_array('Follow Up','Partnership/Collaboration','Meeting Preparation','Proposal/Deck Draft','Other'),
      'kpi_options',jsonb_build_array('Outreach Client EO','Outreach Client Website/Landing Page & Sistem Digital','Follow Up','Qualified Meeting')
    ),
    jsonb_build_array(
      jsonb_build_object('key','cooperation_context','label','Konteks Kerjasama','type','textarea'),
      jsonb_build_object('key','city','label','City','type','select','options',jsonb_build_array('Bogor','Jakarta','Depok','Tangerang','Bekasi','Subang','Banten')),
      jsonb_build_object('key','profile_url','label','Profile Link','type','url'),
      jsonb_build_object('key','contact_email','label','Contact Email','type','text'),
      jsonb_build_object('key','channel','label','Channels','type','select','options',jsonb_build_array('WA','IG','Linkedin','Email')),
      jsonb_build_object('key','contact_type','label','Contact Type','type','select','options',jsonb_build_array('Admin','Personal')),
      jsonb_build_object('key','initial_chat','label','Initial Chat','type','checkbox'),
      jsonb_build_object('key','meeting','label','Meeting','type','checkbox'),
      jsonb_build_object('key','visit','label','Visit','type','checkbox'),
      jsonb_build_object('key','deal','label','Deal','type','checkbox'),
      jsonb_build_object('key','feedback','label','Feedback','type','textarea'),
      jsonb_build_object('key','cooperation_document','label','Dokumen Kerjasama','type','url')
    ),
    array['business_development_staff','ceo','coo'],33
  ),
  (
    'pipeline_organisasi','Organisasi','Pipeline historis organisasi, komunitas, dan organisasi pelajar/mahasiswa.','#bd9a38','pipeline','system','pipeline',
    jsonb_build_object(
      'pipeline_kind','institution','lead_prefix','ORG','business_units',jsonb_build_array('Organization Hub'),
      'stages',jsonb_build_array('Database','Initial Chat','Meeting','Visit','Deal'),
      'closed_stages',jsonb_build_array('Deal'),
      'priorities',jsonb_build_array('Medium'),'qualification_statuses','[]'::jsonb,
      'account_types',jsonb_build_array('BEM/Senat','DPM','MPM','UKM','Komunitas','IRMA','LDK','OSIS','MPK','PRAMUKA','PASKIBRA','PMR','Pecinta Alam','LSM','Perusahaan','Ormek','Himpunan'),
      'interest_levels','[]'::jsonb,'payment_statuses','[]'::jsonb,
      'activity_types',jsonb_build_array('Follow Up','Maintenance Community','Community Event','Partnership/Collaboration','Meeting Preparation','Other'),
      'kpi_options',jsonb_build_array('Maintenance Community Organization Hub & Stripmate','Create Event Community Organization Hub','Follow Up','Qualified Meeting')
    ),
    jsonb_build_array(
      jsonb_build_object('key','city','label','City','type','text'),
      jsonb_build_object('key','profile_url','label','Profile Link','type','url'),
      jsonb_build_object('key','personal_email','label','Email','type','text'),
      jsonb_build_object('key','organization_email','label','Email Organisasi','type','text'),
      jsonb_build_object('key','channel','label','Channels','type','select','options',jsonb_build_array('WA','IG','Linkedin','Email')),
      jsonb_build_object('key','contact_type','label','PIC Type','type','select','options',jsonb_build_array('Admin','Personal')),
      jsonb_build_object('key','initial_chat','label','Initial Chat','type','checkbox'),
      jsonb_build_object('key','meeting','label','Meeting','type','checkbox'),
      jsonb_build_object('key','visit','label','Visit','type','checkbox'),
      jsonb_build_object('key','deal','label','Deal','type','checkbox'),
      jsonb_build_object('key','feedback','label','Feedback','type','textarea'),
      jsonb_build_object('key','proof_of_contact','label','Proof of Contact','type','url')
    ),
    array['business_development_staff','ceo','coo'],34
  )
on conflict (key) do update set
  name=excluded.name,description=excluded.description,color=excluded.color,icon=excluded.icon,
  source_kind=excluded.source_kind,module_type=excluded.module_type,module_config=excluded.module_config,
  field_schema=excluded.field_schema,allowed_position_keys=excluded.allowed_position_keys,sort_order=excluded.sort_order;

create table public.pipeline_leads (
  id uuid primary key default extensions.gen_random_uuid(),
  activity_id uuid not null unique references public.activities(id) on delete cascade,
  source_id uuid not null references public.work_sources(id),
  lead_code text not null,
  date_added date not null default current_date,
  business_unit text,
  account_name text not null check (char_length(trim(account_name)) between 1 and 180),
  account_type text,
  contact_name text,
  contact_role text,
  contact_details text,
  lead_source text,
  priority text not null default 'Medium',
  stage text not null,
  outreach_date date,
  follow_up_count integer not null default 0 check (follow_up_count >= 0),
  last_contact_date date,
  meeting_date date,
  qualification_status text,
  proposal_date date,
  deal_value numeric(18,2) check (deal_value is null or deal_value >= 0),
  probability numeric(5,4) check (probability is null or probability between 0 and 1),
  activity_type text not null default 'Follow Up',
  next_action text not null,
  due_date date not null,
  document_url text,
  notes text,
  trip_program text,
  interest_level text,
  next_follow_up date,
  seats integer check (seats is null or seats >= 0),
  price_per_person numeric(18,2) check (price_per_person is null or price_per_person >= 0),
  payment_status text,
  payment_date date,
  community_join_date date,
  payment_proof_url text,
  extra_data jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_data)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id,lead_code)
);

create index pipeline_leads_source_stage_idx on public.pipeline_leads(source_id,stage);
create index pipeline_leads_due_idx on public.pipeline_leads(due_date);
create index pipeline_leads_owner_activity_idx on public.pipeline_leads(activity_id);
create index pipeline_leads_account_search_idx on public.pipeline_leads using gin(to_tsvector('simple',account_name));

create or replace function public.list_pipeline_members()
returns jsonb language sql stable security definer set search_path=public as $$
  select case when public.current_user_has_permission('pipeline.view') then
    coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'position',p.name) order by coalesce(m.full_name,m.email::text)),'[]'::jsonb)
  else '[]'::jsonb end
  from public.memberships m left join public.positions p on p.id=m.position_id
  where m.status='active';
$$;

create or replace function public.list_pipeline_leads()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(
    to_jsonb(pl)||jsonb_build_object(
      'weighted_value',round(coalesce(pl.deal_value,0)*coalesce(pl.probability,0),2),
      'potential_revenue',round(coalesce(pl.seats,0)*coalesce(pl.price_per_person,0),2),
      'owner_membership_id',a.owner_membership_id,'assigned_by_membership_id',a.assigned_by_membership_id,
      'workflow_status',a.status,'progress',a.progress,'linked_kpi',a.linked_kpi,
      'owner_name',coalesce(owner_m.full_name,owner_m.email::text),
      'source_name',ws.name,'source_color',ws.color,'source_config',ws.module_config
    ) order by pl.due_date,pl.created_at desc
  ),'[]'::jsonb)
  from public.pipeline_leads pl
  join public.activities a on a.id=pl.activity_id
  join public.work_sources ws on ws.id=pl.source_id
  join public.memberships owner_m on owner_m.id=a.owner_membership_id
  where public.can_access_activity(a.id) and public.can_access_work_source(pl.source_id);
$$;

create or replace function public.save_pipeline_lead(pipeline_lead_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  actor_id uuid:=public.current_membership_id(); owner_id uuid; source_uuid uuid;
  saved_activity_id uuid; saved_lead_id uuid; existing public.pipeline_leads%rowtype;
  existing_owner_id uuid; source_config jsonb; target_stage text; target_priority text;
  target_account text; target_next_action text; target_due_date date; target_date_added date;
  target_probability numeric; target_workflow text; target_progress integer; target_activity_type text;
begin
  if actor_id is null or not public.current_user_has_permission('pipeline.view') then raise exception 'Akses Pipeline BD diperlukan.' using errcode='42501'; end if;
  owner_id:=coalesce(nullif(payload->>'owner_membership_id','')::uuid,actor_id);
  source_uuid:=nullif(payload->>'source_id','')::uuid;
  target_account:=trim(coalesce(payload->>'account_name',''));
  target_next_action:=trim(coalesce(payload->>'next_action',''));
  target_due_date:=nullif(payload->>'due_date','')::date;
  target_date_added:=coalesce(nullif(payload->>'date_added','')::date,current_date);
  target_stage:=trim(coalesce(payload->>'stage',''));
  target_priority:=coalesce(nullif(payload->>'priority',''),'Medium');
  target_activity_type:=coalesce(nullif(payload->>'activity_type',''),'Follow Up');
  target_probability:=nullif(payload->>'probability','')::numeric;
  if target_probability is not null and target_probability>1 then target_probability:=target_probability/100; end if;
  if target_account='' or target_next_action='' or target_due_date is null then raise exception 'Nama lead, next action, dan due date wajib diisi.'; end if;
  if not exists(select 1 from public.memberships m where m.id=owner_id and m.status='active') then raise exception 'Owner Pipeline BD tidak valid.'; end if;
  select ws.module_config into source_config from public.work_sources ws where ws.id=source_uuid and ws.module_type='pipeline' and public.can_access_work_source(ws.id);
  if source_config is null then raise exception 'Sumber Pipeline BD tidak tersedia.' using errcode='42501'; end if;
  if target_stage='' or not coalesce(source_config->'stages','[]'::jsonb) ? target_stage then raise exception 'Stage tidak tersedia pada pipeline ini.'; end if;
  if jsonb_array_length(coalesce(source_config->'priorities','[]'::jsonb))>0 and not (source_config->'priorities') ? target_priority then raise exception 'Priority tidak tersedia pada pipeline ini.'; end if;
  if jsonb_array_length(coalesce(source_config->'activity_types','[]'::jsonb))>0 and not (source_config->'activity_types') ? target_activity_type then raise exception 'Jenis aktivitas tidak tersedia pada pipeline ini.'; end if;
  if target_probability is not null and target_probability not between 0 and 1 then raise exception 'Probability harus berada di antara 0 dan 100 persen.'; end if;
  if owner_id=actor_id then
    if not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
  elsif not public.current_user_has_permission('pipeline.manage_team') and not public.current_user_has_permission('activity.assign_team') then
    raise exception 'Izin kelola Pipeline BD tim diperlukan.' using errcode='42501';
  end if;
  target_workflow:=case when coalesce(source_config->'closed_stages','[]'::jsonb) ? target_stage then 'done' else 'in_progress' end;
  target_progress:=case when target_workflow='done' then 100 else least(95,greatest(5,coalesce(round(target_probability*100)::integer,25))) end;

  if pipeline_lead_id is null then
    insert into public.activities(owner_membership_id,assigned_by_membership_id,source_id,title,activity_date,activity_type,linked_kpi,status,progress,priority,detail,output,next_action,evidence_url,created_by,updated_by)
    values(owner_id,actor_id,source_uuid,target_next_action||' · '||target_account,target_due_date,target_activity_type,nullif(trim(payload->>'linked_kpi'),''),target_workflow,target_progress,case lower(target_priority) when 'high' then 'high' when 'low' then 'low' else 'medium' end,nullif(trim(payload->>'notes'),''),target_stage,target_next_action,nullif(trim(payload->>'document_url'),''),auth.uid(),auth.uid()) returning id into saved_activity_id;
    insert into public.pipeline_leads(activity_id,source_id,lead_code,date_added,business_unit,account_name,account_type,contact_name,contact_role,contact_details,lead_source,priority,stage,outreach_date,follow_up_count,last_contact_date,meeting_date,qualification_status,proposal_date,deal_value,probability,activity_type,next_action,due_date,document_url,notes,trip_program,interest_level,next_follow_up,seats,price_per_person,payment_status,payment_date,community_join_date,payment_proof_url,extra_data)
    values(saved_activity_id,source_uuid,coalesce(nullif(trim(payload->>'lead_code'),''),upper(coalesce(source_config->>'lead_prefix','LEAD'))||'-'||upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,6))),target_date_added,nullif(trim(payload->>'business_unit'),''),target_account,nullif(trim(payload->>'account_type'),''),nullif(trim(payload->>'contact_name'),''),nullif(trim(payload->>'contact_role'),''),nullif(trim(payload->>'contact_details'),''),nullif(trim(payload->>'lead_source'),''),target_priority,target_stage,nullif(payload->>'outreach_date','')::date,coalesce(nullif(payload->>'follow_up_count','')::integer,0),nullif(payload->>'last_contact_date','')::date,nullif(payload->>'meeting_date','')::date,nullif(trim(payload->>'qualification_status'),''),nullif(payload->>'proposal_date','')::date,nullif(payload->>'deal_value','')::numeric,target_probability,target_activity_type,target_next_action,target_due_date,nullif(trim(payload->>'document_url'),''),nullif(trim(payload->>'notes'),''),nullif(trim(payload->>'trip_program'),''),nullif(trim(payload->>'interest_level'),''),nullif(payload->>'next_follow_up','')::date,nullif(payload->>'seats','')::integer,nullif(payload->>'price_per_person','')::numeric,nullif(trim(payload->>'payment_status'),''),nullif(payload->>'payment_date','')::date,nullif(payload->>'community_join_date','')::date,nullif(trim(payload->>'payment_proof_url'),''),coalesce(payload->'extra_data','{}'::jsonb)) returning id into saved_lead_id;
    update public.activities set source_record_id=saved_lead_id::text,custom_data=jsonb_build_object('pipeline_lead_id',saved_lead_id,'lead_code',(select lead_code from public.pipeline_leads where id=saved_lead_id)) where id=saved_activity_id;
    if owner_id<>actor_id then insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url) values(owner_id,actor_id,'assignment','Lead Pipeline BD baru',target_account,'activity',saved_activity_id::text,'/ruang-kawan/pipeline/'); end if;
    insert into public.activity_history(activity_id,actor_membership_id,event_type,after_data) values(saved_activity_id,actor_id,'pipeline_lead_created',payload);
  else
    select * into existing from public.pipeline_leads where id=pipeline_lead_id;
    if existing.id is null or not public.can_access_activity(existing.activity_id) then raise exception 'Lead tidak dapat diakses.' using errcode='42501'; end if;
    select a.owner_membership_id into existing_owner_id from public.activities a where a.id=existing.activity_id;
    if (existing_owner_id<>actor_id or owner_id<>actor_id) and not public.current_user_has_permission('pipeline.manage_team') and not public.current_user_has_permission('activity.assign_team') then raise exception 'Izin kelola Pipeline BD tim diperlukan.' using errcode='42501'; end if;
    saved_activity_id:=existing.activity_id;saved_lead_id:=existing.id;
    update public.activities set owner_membership_id=owner_id,source_id=source_uuid,title=target_next_action||' · '||target_account,activity_date=target_due_date,activity_type=target_activity_type,linked_kpi=nullif(trim(payload->>'linked_kpi'),''),status=target_workflow,progress=target_progress,priority=case lower(target_priority) when 'high' then 'high' when 'low' then 'low' else 'medium' end,detail=nullif(trim(payload->>'notes'),''),output=target_stage,next_action=target_next_action,evidence_url=nullif(trim(payload->>'document_url'),''),updated_by=auth.uid(),updated_at=now() where id=saved_activity_id;
    update public.pipeline_leads set source_id=source_uuid,lead_code=coalesce(nullif(trim(payload->>'lead_code'),''),lead_code),date_added=target_date_added,business_unit=nullif(trim(payload->>'business_unit'),''),account_name=target_account,account_type=nullif(trim(payload->>'account_type'),''),contact_name=nullif(trim(payload->>'contact_name'),''),contact_role=nullif(trim(payload->>'contact_role'),''),contact_details=nullif(trim(payload->>'contact_details'),''),lead_source=nullif(trim(payload->>'lead_source'),''),priority=target_priority,stage=target_stage,outreach_date=nullif(payload->>'outreach_date','')::date,follow_up_count=coalesce(nullif(payload->>'follow_up_count','')::integer,0),last_contact_date=nullif(payload->>'last_contact_date','')::date,meeting_date=nullif(payload->>'meeting_date','')::date,qualification_status=nullif(trim(payload->>'qualification_status'),''),proposal_date=nullif(payload->>'proposal_date','')::date,deal_value=nullif(payload->>'deal_value','')::numeric,probability=target_probability,activity_type=target_activity_type,next_action=target_next_action,due_date=target_due_date,document_url=nullif(trim(payload->>'document_url'),''),notes=nullif(trim(payload->>'notes'),''),trip_program=nullif(trim(payload->>'trip_program'),''),interest_level=nullif(trim(payload->>'interest_level'),''),next_follow_up=nullif(payload->>'next_follow_up','')::date,seats=nullif(payload->>'seats','')::integer,price_per_person=nullif(payload->>'price_per_person','')::numeric,payment_status=nullif(trim(payload->>'payment_status'),''),payment_date=nullif(payload->>'payment_date','')::date,community_join_date=nullif(payload->>'community_join_date','')::date,payment_proof_url=nullif(trim(payload->>'payment_proof_url'),''),extra_data=coalesce(payload->'extra_data','{}'::jsonb),updated_at=now() where id=pipeline_lead_id;
    insert into public.activity_history(activity_id,actor_membership_id,event_type,after_data) values(saved_activity_id,actor_id,'pipeline_lead_updated',payload);
  end if;
  return saved_lead_id;
end; $$;

create or replace function public.quick_update_pipeline_lead(target_pipeline_lead_id uuid,target_stage text,target_next_action text,target_due_date date)
returns void language plpgsql security definer set search_path=public as $$
declare lead public.pipeline_leads%rowtype; owner_id uuid; actor_id uuid:=public.current_membership_id(); config jsonb; workflow text;
begin
  select * into lead from public.pipeline_leads where id=target_pipeline_lead_id;
  if lead.id is null or not public.can_access_activity(lead.activity_id) then raise exception 'Lead tidak dapat diakses.' using errcode='42501'; end if;
  select a.owner_membership_id into owner_id from public.activities a where a.id=lead.activity_id;
  if (owner_id=actor_id and not public.current_user_has_permission('pipeline.manage_self')) or (owner_id<>actor_id and not public.current_user_has_permission('pipeline.manage_team')) then raise exception 'Izin update Pipeline BD diperlukan.' using errcode='42501'; end if;
  select module_config into config from public.work_sources where id=lead.source_id;
  if not coalesce(config->'stages','[]'::jsonb) ? target_stage then raise exception 'Stage tidak tersedia.'; end if;
  if trim(coalesce(target_next_action,''))='' or target_due_date is null then raise exception 'Next action dan due date wajib diisi.'; end if;
  workflow:=case when coalesce(config->'closed_stages','[]'::jsonb) ? target_stage then 'done' else 'in_progress' end;
  update public.pipeline_leads set stage=target_stage,next_action=trim(target_next_action),due_date=target_due_date,updated_at=now() where id=lead.id;
  update public.activities set title=trim(target_next_action)||' · '||lead.account_name,activity_date=target_due_date,status=workflow,progress=case when workflow='done' then 100 else progress end,output=target_stage,next_action=trim(target_next_action),updated_by=auth.uid(),updated_at=now() where id=lead.activity_id;
  insert into public.activity_history(activity_id,actor_membership_id,event_type,after_data) values(lead.activity_id,actor_id,'pipeline_quick_updated',jsonb_build_object('stage',target_stage,'next_action',target_next_action,'due_date',target_due_date));
end; $$;

create or replace function public.delete_pipeline_lead(target_pipeline_lead_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare lead public.pipeline_leads%rowtype; owner_id uuid; actor_id uuid:=public.current_membership_id();
begin
  select * into lead from public.pipeline_leads where id=target_pipeline_lead_id;
  select a.owner_membership_id into owner_id from public.activities a where a.id=lead.activity_id;
  if lead.id is null or not public.can_access_activity(lead.activity_id) or (owner_id=actor_id and not public.current_user_has_permission('pipeline.manage_self')) or (owner_id<>actor_id and not public.current_user_has_permission('pipeline.manage_team')) then raise exception 'Lead tidak dapat dihapus.' using errcode='42501'; end if;
  delete from public.activities where id=lead.activity_id;
end; $$;

alter table public.pipeline_leads enable row level security;
revoke all on public.pipeline_leads from anon,authenticated;

revoke all on function public.list_pipeline_members(),public.list_pipeline_leads(),public.save_pipeline_lead(uuid,jsonb),public.quick_update_pipeline_lead(uuid,text,text,date),public.delete_pipeline_lead(uuid) from public,anon;
grant execute on function public.list_pipeline_members(),public.list_pipeline_leads(),public.save_pipeline_lead(uuid,jsonb),public.quick_update_pipeline_lead(uuid,text,text,date),public.delete_pipeline_lead(uuid) to authenticated;
