-- Ruang Kawan: first-class Content Plan linked to Activity, Assignment, and Review.

insert into public.permissions (key, name, description) values
  ('content_plan.view', 'Lihat Content Plan', 'Melihat content plan dari sumber yang dapat diakses.'),
  ('content_plan.manage_self', 'Kelola Content Plan sendiri', 'Membuat dan memperbarui content plan milik sendiri.'),
  ('content_plan.manage_team', 'Kelola Content Plan tim', 'Membuat dan memperbarui content plan milik anggota tim.'),
  ('content_plan.configure', 'Konfigurasi Content Plan', 'Mengatur brand, akses, dan pilihan dropdown Content Plan.')
on conflict (key) do update set name = excluded.name, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  r.key = 'system_admin'
  or (r.key = 'executive' and p.key in ('content_plan.view','content_plan.manage_self','content_plan.manage_team','content_plan.configure'))
  or (r.key in ('people_hr_manager','project_lead') and p.key in ('content_plan.view','content_plan.manage_self','content_plan.manage_team'))
  or (r.key in ('staff','freelancer','finance_manager') and p.key in ('content_plan.view','content_plan.manage_self'))
on conflict do nothing;

alter table public.work_sources
  add column if not exists module_type text not null default 'activity'
    check (module_type in ('activity','content_plan','pipeline')),
  add column if not exists module_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(module_config) = 'object');

update public.work_sources
set name = 'Campus Innovate',
    module_type = 'content_plan',
    module_config = jsonb_build_object(
      'platforms', jsonb_build_array('Instagram Campus Innovate','TikTok Campus Innovate','Instagram Fauzan','TikTok Fauzan'),
      'content_formats', jsonb_build_array('Reels','Carousel','Story','Single post','Meme','POV','Vlog','TikTok','Aftermovie','Poster','Infografis','BTS','Testimoni','Screen Recording','Demo Product','Motion Graphic','Before vs After'),
      'content_pillars', jsonb_build_array('Event Management','Capacity Building','Educational Event','MICE/Corporate Event','Event Experience','Event Planning & Management','Event Tips & Insight','Behind the Scenes','Event Equipment & Production','Client Success Story','Event Branding','Community & Partnership','Organizational System','Information System','Digital Transformation','Productivity & Workflow','Project Management','Program Management','Technology for Education','Product Demo & Tutorial','Digital Case Study','Automation & AI','Website & Dashboard'),
      'content_strategies', jsonb_build_array('Trending Content','Newsjacking','Educational','Entertaining','Emotional','Interactive','Soft Selling','Hard Selling','User Generated Content','Collaboration','Series Content','Product Demo','Pain Point Marketing','Case Study','Tips & Tricks','Comparison','Myth vs Fact'),
      'funnels', jsonb_build_array('Awareness','Engagement','Consideration','Conversion','Retention','Advocacy'),
      'publish_times', jsonb_build_array('06:00','10:00','12:00','16:00','18:00','19:00','20:00')
    ),
    field_schema = '[]'::jsonb
where key = 'content_plan';

insert into public.work_sources (
  key,name,description,color,icon,source_kind,module_type,module_config,
  allowed_position_keys,sort_order
) values (
  'content_plan_stripmate','Stripmate','Rencana, produksi, dan publikasi konten Stripmate.','#2f7d68','content','system','content_plan',
  jsonb_build_object(
    'platforms',jsonb_build_array('Instagram CI','TikTok CI','Instagram Fauzan','TikTok Fauzan','TikTok Stripmate','Instagram Stripmate','TikTok + Instagram'),
    'content_formats',jsonb_build_array('Aftermovie','BTS','Carousel','Cinematic','Infografis','Meme','Poster','POV','Reels','Story','Testimoni','TikTok','Vlog'),
    'content_pillars',jsonb_build_array('Adventure & Destination','Brand Story','Collaboration','Community & Friendship','Equipment & Gear','Lifestyle & Healing','Open Trip & Event','Outdoor Education','UGC'),
    'content_strategies',jsonb_build_array('Collaboration','Educational','Emotional','Entertaining','Hard Selling','Interactive','Newsjacking','Series Content','Soft Selling','Storytelling','Trending Content','User Generated Content (UGC)'),
    'funnels',jsonb_build_array('Engagement','Conversion','Advocacy','Consideration','Retention','Awareness (Reach)'),
    'publish_times',jsonb_build_array('10:00','13:00','15:00','19:00','20:00')
  ),
  array['social_media_staff','growth_marketing_staff','ceo','coo'],25
)
on conflict (key) do update set
  name=excluded.name,description=excluded.description,color=excluded.color,icon=excluded.icon,
  source_kind=excluded.source_kind,module_type=excluded.module_type,module_config=excluded.module_config,
  allowed_position_keys=excluded.allowed_position_keys,sort_order=excluded.sort_order;

create table public.content_items (
  id uuid primary key default extensions.gen_random_uuid(),
  activity_id uuid not null unique references public.activities(id) on delete cascade,
  source_id uuid not null references public.work_sources(id),
  title text not null check (char_length(trim(title)) between 1 and 180),
  publish_date date,
  deadline date not null,
  publish_time time,
  platforms text[] not null default '{}'::text[],
  reference_url text,
  content_pillar text,
  content_strategy text,
  content_format text,
  funnel text,
  brief_url text,
  brief_text text,
  caption text,
  production_url text,
  thumbnail_url text,
  concept_status text not null default 'research'
    check (concept_status in ('research','finalizing','done')),
  production_status text not null default 'not_started'
    check (production_status in ('not_started','in_progress','revision','done')),
  publication_status text not null default 'not_scheduled'
    check (publication_status in ('not_scheduled','scheduled','published','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (publish_date is null or deadline <= publish_date)
);

create index content_items_source_publish_idx on public.content_items(source_id,publish_date desc nulls last);
create index content_items_deadline_idx on public.content_items(deadline);
create index content_items_status_idx on public.content_items(production_status,publication_status);

create or replace function public.list_my_work_sources()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ws.id,'key',ws.key,'name',ws.name,'description',ws.description,
    'color',ws.color,'icon',ws.icon,'source_kind',ws.source_kind,
    'module_type',ws.module_type,'module_config',ws.module_config,
    'field_schema',ws.field_schema,'allowed_role_keys',ws.allowed_role_keys,
    'allowed_position_keys',ws.allowed_position_keys,'sort_order',ws.sort_order
  ) order by ws.sort_order,ws.name),'[]'::jsonb)
  from public.work_sources ws where public.can_access_work_source(ws.id);
$$;

create or replace function public.admin_save_work_source(
  source_id uuid, source_key text, source_name text, source_description text,
  source_color text, source_icon text, source_field_schema jsonb,
  source_allowed_role_keys text[], source_allowed_position_keys text[],
  source_is_active boolean, source_sort_order integer,
  source_module_type text, source_module_config jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare saved_id uuid;
begin
  if not public.current_user_has_permission('work_sources.manage') then raise exception 'Akses pengelola sumber kerja diperlukan.' using errcode='42501'; end if;
  if trim(source_name)='' then raise exception 'Nama sumber kerja wajib diisi.'; end if;
  if source_key !~ '^[a-z0-9_]+$' then raise exception 'Kode sumber hanya boleh berisi huruf kecil, angka, dan garis bawah.'; end if;
  if source_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Format warna tidak valid.'; end if;
  if source_module_type not in ('activity','content_plan','pipeline') then raise exception 'Tipe modul tidak valid.'; end if;
  if jsonb_typeof(coalesce(source_field_schema,'[]'::jsonb))<>'array' then raise exception 'Format field tambahan tidak valid.'; end if;
  if jsonb_typeof(coalesce(source_module_config,'{}'::jsonb))<>'object' then raise exception 'Konfigurasi modul tidak valid.'; end if;
  insert into public.work_sources(id,key,name,description,color,icon,source_kind,field_schema,allowed_role_keys,allowed_position_keys,is_active,sort_order,module_type,module_config,created_by)
  values(coalesce(source_id,extensions.gen_random_uuid()),source_key,trim(source_name),nullif(trim(source_description),''),source_color,coalesce(nullif(trim(source_icon),''),'activity'),'custom',coalesce(source_field_schema,'[]'::jsonb),coalesce(source_allowed_role_keys,'{}'::text[]),coalesce(source_allowed_position_keys,'{}'::text[]),source_is_active,source_sort_order,source_module_type,coalesce(source_module_config,'{}'::jsonb),auth.uid())
  on conflict(id) do update set name=excluded.name,description=excluded.description,color=excluded.color,icon=excluded.icon,
    field_schema=excluded.field_schema,allowed_role_keys=excluded.allowed_role_keys,allowed_position_keys=excluded.allowed_position_keys,
    is_active=excluded.is_active,sort_order=excluded.sort_order,module_type=excluded.module_type,module_config=excluded.module_config,updated_at=now()
  returning id into saved_id;
  return saved_id;
end; $$;

create or replace function public.list_content_items()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(
    to_jsonb(ci)||jsonb_build_object(
      'owner_membership_id',a.owner_membership_id,'reviewer_membership_id',a.reviewer_membership_id,
      'assigned_by_membership_id',a.assigned_by_membership_id,'workflow_status',a.status,
      'progress',a.progress,'priority',a.priority,'linked_kpi',a.linked_kpi,
      'review_status',a.review_status,'review_note',a.review_note,
      'owner_name',coalesce(owner_m.full_name,owner_m.email::text),
      'reviewer_name',coalesce(reviewer_m.full_name,reviewer_m.email::text),
      'source_name',ws.name,'source_color',ws.color
    ) order by coalesce(ci.publish_date,ci.deadline) desc,ci.created_at desc
  ),'[]'::jsonb)
  from public.content_items ci
  join public.activities a on a.id=ci.activity_id
  join public.work_sources ws on ws.id=ci.source_id
  join public.memberships owner_m on owner_m.id=a.owner_membership_id
  left join public.memberships reviewer_m on reviewer_m.id=a.reviewer_membership_id
  where public.can_access_activity(a.id) and public.can_access_work_source(ci.source_id);
$$;

create or replace function public.list_content_plan_members()
returns jsonb language sql stable security definer set search_path=public as $$
  select case when public.current_user_has_permission('content_plan.view') then
    coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'position',p.name) order by coalesce(m.full_name,m.email::text)),'[]'::jsonb)
  else '[]'::jsonb end
  from public.memberships m left join public.positions p on p.id=m.position_id
  where m.status='active';
$$;

create or replace function public.save_content_item(content_item_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  actor_id uuid:=public.current_membership_id(); owner_id uuid; reviewer_id uuid; source_uuid uuid;
  saved_activity_id uuid; saved_content_id uuid; existing public.content_items%rowtype;
  existing_owner_id uuid;
  target_title text; target_deadline date; target_publish_date date; target_publish_time time;
  target_workflow_status text; target_progress integer; target_priority text;
begin
  if actor_id is null or not public.current_user_has_permission('content_plan.view') then raise exception 'Akses Content Plan diperlukan.' using errcode='42501'; end if;
  owner_id:=coalesce(nullif(payload->>'owner_membership_id','')::uuid,actor_id);
  reviewer_id:=nullif(payload->>'reviewer_membership_id','')::uuid;
  source_uuid:=nullif(payload->>'source_id','')::uuid;
  target_title:=trim(coalesce(payload->>'title',''));
  target_deadline:=nullif(payload->>'deadline','')::date;
  target_publish_date:=nullif(payload->>'publish_date','')::date;
  target_publish_time:=nullif(payload->>'publish_time','')::time;
  target_workflow_status:=coalesce(nullif(payload->>'workflow_status',''),'not_started');
  target_progress:=coalesce(nullif(payload->>'progress','')::integer,0);
  target_priority:=coalesce(nullif(payload->>'priority',''),'medium');
  if target_title='' or target_deadline is null then raise exception 'Judul dan deadline wajib diisi.'; end if;
  if target_publish_date is not null and target_deadline>target_publish_date then raise exception 'Deadline tidak boleh melewati tanggal publish.'; end if;
  if target_workflow_status not in ('not_started','in_progress','done','blocked') or target_priority not in ('low','medium','high','urgent') or target_progress not between 0 and 100 then raise exception 'Status, prioritas, atau progress tidak valid.'; end if;
  if not exists(select 1 from public.memberships m where m.id=owner_id and m.status='active') then raise exception 'PIC Content Plan tidak valid.'; end if;
  if reviewer_id is not null and not exists(select 1 from public.memberships m where m.id=reviewer_id and m.status='active') then raise exception 'Reviewer Content Plan tidak valid.'; end if;
  if not exists(select 1 from public.work_sources ws where ws.id=source_uuid and ws.module_type='content_plan' and public.can_access_work_source(ws.id)) then raise exception 'Sumber Content Plan tidak tersedia.' using errcode='42501'; end if;
  if owner_id=actor_id then
    if not public.current_user_has_permission('content_plan.manage_self') then raise exception 'Izin kelola Content Plan diperlukan.' using errcode='42501'; end if;
  elsif not public.current_user_has_permission('content_plan.manage_team') and not public.current_user_has_permission('activity.assign_team') then
    raise exception 'Izin kelola Content Plan tim diperlukan.' using errcode='42501';
  end if;

  if content_item_id is null then
    insert into public.activities(owner_membership_id,assigned_by_membership_id,reviewer_membership_id,source_id,title,activity_date,activity_type,linked_kpi,status,progress,priority,detail,output,next_action,evidence_url,created_by,updated_by)
    values(owner_id,actor_id,reviewer_id,source_uuid,target_title,coalesce(target_publish_date,target_deadline),'content_plan',nullif(trim(payload->>'linked_kpi'),''),target_workflow_status,case when target_workflow_status='done' then 100 else target_progress end,target_priority,nullif(trim(payload->>'brief_text'),''),nullif(trim(payload->>'content_format'),''),'Siapkan konten sebelum deadline.',nullif(trim(payload->>'production_url'),''),auth.uid(),auth.uid()) returning id into saved_activity_id;
    insert into public.content_items(activity_id,source_id,title,publish_date,deadline,publish_time,platforms,reference_url,content_pillar,content_strategy,content_format,funnel,brief_url,brief_text,caption,production_url,thumbnail_url,concept_status,production_status,publication_status)
    values(saved_activity_id,source_uuid,target_title,target_publish_date,target_deadline,target_publish_time,
      coalesce(array(select jsonb_array_elements_text(coalesce(payload->'platforms','[]'::jsonb))),'{}'::text[]),
      nullif(trim(payload->>'reference_url'),''),nullif(trim(payload->>'content_pillar'),''),nullif(trim(payload->>'content_strategy'),''),nullif(trim(payload->>'content_format'),''),nullif(trim(payload->>'funnel'),''),nullif(trim(payload->>'brief_url'),''),nullif(trim(payload->>'brief_text'),''),nullif(trim(payload->>'caption'),''),nullif(trim(payload->>'production_url'),''),nullif(trim(payload->>'thumbnail_url'),''),coalesce(nullif(payload->>'concept_status',''),'research'),coalesce(nullif(payload->>'production_status',''),'not_started'),coalesce(nullif(payload->>'publication_status',''),'not_scheduled')) returning id into saved_content_id;
    update public.activities set source_record_id=saved_content_id::text,custom_data=jsonb_build_object('content_item_id',saved_content_id) where id=saved_activity_id;
    if owner_id<>actor_id then insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url) values(owner_id,actor_id,'assignment','Content Plan baru',target_title,'activity',saved_activity_id::text,'/ruang-kawan/content-plan/'); end if;
    insert into public.activity_history(activity_id,actor_membership_id,event_type,after_data) values(saved_activity_id,actor_id,'content_created',payload);
  else
    select * into existing from public.content_items where id=content_item_id;
    if existing.id is null or not public.can_access_activity(existing.activity_id) then raise exception 'Konten tidak dapat diakses.' using errcode='42501'; end if;
    select a.owner_membership_id into existing_owner_id from public.activities a where a.id=existing.activity_id;
    if (existing_owner_id<>actor_id or owner_id<>actor_id) and not public.current_user_has_permission('content_plan.manage_team') and not public.current_user_has_permission('activity.assign_team') then raise exception 'Izin kelola Content Plan tim diperlukan.' using errcode='42501'; end if;
    saved_activity_id:=existing.activity_id; saved_content_id:=existing.id;
    update public.activities set owner_membership_id=owner_id,reviewer_membership_id=reviewer_id,source_id=source_uuid,title=target_title,activity_date=coalesce(target_publish_date,target_deadline),linked_kpi=nullif(trim(payload->>'linked_kpi'),''),status=target_workflow_status,progress=case when target_workflow_status='done' then 100 else target_progress end,priority=target_priority,detail=nullif(trim(payload->>'brief_text'),''),output=nullif(trim(payload->>'content_format'),''),evidence_url=nullif(trim(payload->>'production_url'),''),updated_by=auth.uid(),updated_at=now() where id=saved_activity_id;
    update public.content_items set source_id=source_uuid,title=target_title,publish_date=target_publish_date,deadline=target_deadline,publish_time=target_publish_time,platforms=coalesce(array(select jsonb_array_elements_text(coalesce(payload->'platforms','[]'::jsonb))),'{}'::text[]),reference_url=nullif(trim(payload->>'reference_url'),''),content_pillar=nullif(trim(payload->>'content_pillar'),''),content_strategy=nullif(trim(payload->>'content_strategy'),''),content_format=nullif(trim(payload->>'content_format'),''),funnel=nullif(trim(payload->>'funnel'),''),brief_url=nullif(trim(payload->>'brief_url'),''),brief_text=nullif(trim(payload->>'brief_text'),''),caption=nullif(trim(payload->>'caption'),''),production_url=nullif(trim(payload->>'production_url'),''),thumbnail_url=nullif(trim(payload->>'thumbnail_url'),''),concept_status=coalesce(nullif(payload->>'concept_status',''),'research'),production_status=coalesce(nullif(payload->>'production_status',''),'not_started'),publication_status=coalesce(nullif(payload->>'publication_status',''),'not_scheduled'),updated_at=now() where id=content_item_id;
    insert into public.activity_history(activity_id,actor_membership_id,event_type,after_data) values(saved_activity_id,actor_id,'content_updated',payload);
  end if;
  return saved_content_id;
end; $$;

create or replace function public.delete_content_item(target_content_item_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare item public.content_items%rowtype; owner_id uuid; actor_id uuid:=public.current_membership_id();
begin
  select ci.* into item from public.content_items ci where ci.id=target_content_item_id;
  select a.owner_membership_id into owner_id from public.activities a where a.id=item.activity_id;
  if item.id is null or not public.can_access_activity(item.activity_id) or (owner_id=actor_id and not public.current_user_has_permission('content_plan.manage_self')) or (owner_id<>actor_id and not public.current_user_has_permission('content_plan.manage_team')) then raise exception 'Konten tidak dapat dihapus.' using errcode='42501'; end if;
  delete from public.activities where id=item.activity_id;
end; $$;

alter table public.content_items enable row level security;
revoke all on public.content_items from anon,authenticated;

revoke all on function public.list_content_items(),public.list_content_plan_members(),public.save_content_item(uuid,jsonb),public.delete_content_item(uuid) from public,anon;
grant execute on function public.list_content_items(),public.list_content_plan_members(),public.save_content_item(uuid,jsonb),public.delete_content_item(uuid) to authenticated;
revoke all on function public.admin_save_work_source(uuid,text,text,text,text,text,jsonb,text[],text[],boolean,integer,text,jsonb) from public,anon;
grant execute on function public.admin_save_work_source(uuid,text,text,text,text,text,jsonb,text[],text[],boolean,integer,text,jsonb) to authenticated;
