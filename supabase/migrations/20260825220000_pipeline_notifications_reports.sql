-- Ruang Kawan: governed pipeline configuration, shared notifications, and actionable personal reports.

insert into public.permissions(key,name,description) values
 ('pipeline.propose_config','Ajukan perubahan pipeline','Mengajukan pipeline, stage, sumber lead, atau perubahan konfigurasi.'),
 ('pipeline.review_config','Review perubahan pipeline','Menyetujui atau menolak perubahan struktur pipeline.'),
 ('notifications.manage_self','Kelola notifikasi sendiri','Membaca dan menutup notifikasi pribadi.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on
 (r.key in ('system_admin','executive') and p.key in ('pipeline.propose_config','pipeline.review_config','notifications.manage_self'))
 or (r.key in ('project_lead','finance_manager','people_hr_manager','staff','freelancer') and p.key in ('pipeline.propose_config','notifications.manage_self'))
on conflict do nothing;

create table if not exists public.pipeline_change_requests(
 id uuid primary key default extensions.gen_random_uuid(),
 request_code text not null unique,
 target_source_id uuid references public.work_sources(id),
 request_type text not null check(request_type in ('create','update','deactivate')),
 title text not null,
 reason text not null,
 proposed_data jsonb not null check(jsonb_typeof(proposed_data)='object'),
 status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','cancelled')),
 requested_by_membership_id uuid not null references public.memberships(id),
 reviewed_by_membership_id uuid references public.memberships(id),
 review_note text,
 submitted_at timestamptz,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists pipeline_change_status_idx on public.pipeline_change_requests(status,created_at desc);
alter table public.pipeline_change_requests enable row level security;
revoke all on public.pipeline_change_requests from anon,authenticated;

create or replace function public.pipeline_configuration_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); can_review boolean:=public.current_user_has_permission('pipeline.review_config');
begin
 if actor is null or not public.current_user_has_permission('pipeline.propose_config') then raise exception 'Akses konfigurasi pipeline diperlukan.' using errcode='42501';end if;
 return jsonb_build_object(
  'can_review',can_review,
  'sources',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'key',w.key,'name',w.name,'description',w.description,'color',w.color,'field_schema',w.field_schema,'module_config',w.module_config,'allowed_role_keys',w.allowed_role_keys,'allowed_position_keys',w.allowed_position_keys,'is_active',w.is_active,'sort_order',w.sort_order) order by w.sort_order,w.name) from public.work_sources w where w.module_type='pipeline' and (can_review or public.can_access_work_source(w.id))),'[]'::jsonb),
  'requests',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'request_code',q.request_code,'target_source_id',q.target_source_id,'request_type',q.request_type,'title',q.title,'reason',q.reason,'proposed_data',q.proposed_data,'status',q.status,'requester_name',coalesce(m.full_name,m.email::text),'review_note',q.review_note,'created_at',q.created_at,'submitted_at',q.submitted_at,'reviewed_at',q.reviewed_at) order by q.created_at desc) from public.pipeline_change_requests q join public.memberships m on m.id=q.requested_by_membership_id where can_review or q.requested_by_membership_id=actor),'[]'::jsonb)
 );
end;$$;

create or replace function public.save_pipeline_change_request(target uuid,payload jsonb,submit_now boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();saved uuid;target_source uuid:=nullif(payload->>'target_source_id','')::uuid;kind text:=coalesce(nullif(payload->>'request_type',''),'create');next_status text:=case when submit_now then 'submitted' else 'draft' end;
begin
 if actor is null or not public.current_user_has_permission('pipeline.propose_config') then raise exception 'Izin pengajuan pipeline diperlukan.' using errcode='42501';end if;
 if kind not in ('create','update','deactivate') then raise exception 'Jenis perubahan pipeline tidak valid.';end if;
 if trim(coalesce(payload->>'title',''))='' or trim(coalesce(payload->>'reason',''))='' then raise exception 'Judul dan alasan perubahan wajib diisi.';end if;
 if kind<>'create' and not exists(select 1 from public.work_sources where id=target_source and module_type='pipeline') then raise exception 'Pipeline tujuan tidak ditemukan.';end if;
 if target is null then
  insert into public.pipeline_change_requests(request_code,target_source_id,request_type,title,reason,proposed_data,status,requested_by_membership_id,submitted_at)
  values('PCR-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,6)),target_source,kind,trim(payload->>'title'),trim(payload->>'reason'),coalesce(payload->'proposed_data','{}'::jsonb),next_status,actor,case when submit_now then now() end) returning id into saved;
 else
  update public.pipeline_change_requests set target_source_id=target_source,request_type=kind,title=trim(payload->>'title'),reason=trim(payload->>'reason'),proposed_data=coalesce(payload->'proposed_data',proposed_data),status=next_status,submitted_at=case when submit_now then now() else submitted_at end,updated_at=now()
  where id=target and requested_by_membership_id=actor and status='draft' returning id into saved;
 end if;
 if saved is null then raise exception 'Pengajuan pipeline tidak dapat diubah.' using errcode='42501';end if;
 if submit_now then
  insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key)
  select distinct mr.membership_id,actor,'pipeline.config.review','Perubahan pipeline perlu direview',trim(payload->>'title'),'pipeline_change',saved::text,'/ruang-kawan/pipeline/?panel=config','high','pipeline-review:'||saved::text
  from public.member_roles mr join public.roles r on r.id=mr.role_id where r.key in ('system_admin','executive') and mr.membership_id<>actor
  on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do nothing;
 end if;
 return saved;
end;$$;

create or replace function public.review_pipeline_change_request(target uuid,decision text,note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();q public.pipeline_change_requests%rowtype;d jsonb;saved_source uuid;source_key text;config jsonb;roles text[];positions text[];
begin
 if not public.current_user_has_permission('pipeline.review_config') then raise exception 'Izin review konfigurasi pipeline diperlukan.' using errcode='42501';end if;
 if decision not in ('approved','rejected') then raise exception 'Keputusan review tidak valid.';end if;
 select * into q from public.pipeline_change_requests where id=target and status='submitted' for update;
 if q.id is null then raise exception 'Pengajuan tidak lagi menunggu review.';end if;
 d:=q.proposed_data;
 if decision='approved' then
  if q.request_type='create' then
   source_key:=coalesce(nullif(d->>'key',''),'pipeline_'||lower(substr(replace(q.id::text,'-',''),1,8)));
   if source_key !~ '^[a-z0-9_]+$' then raise exception 'Kode pipeline tidak valid.';end if;
   config:=coalesce(d->'module_config','{}'::jsonb);
   if jsonb_array_length(coalesce(config->'stages','[]'::jsonb))=0 then raise exception 'Pipeline minimal memiliki satu stage.';end if;
   roles:=coalesce(array(select jsonb_array_elements_text(coalesce(d->'allowed_role_keys','[]'::jsonb))),'{}');
   positions:=coalesce(array(select jsonb_array_elements_text(coalesce(d->'allowed_position_keys','[]'::jsonb))),'{}');
   if cardinality(roles)=0 and cardinality(positions)=0 then positions:=array['business_development_staff','ceo','coo'];end if;
   insert into public.work_sources(key,name,description,color,icon,source_kind,module_type,module_config,field_schema,allowed_role_keys,allowed_position_keys,is_active,sort_order,created_by)
   values(source_key,trim(d->>'name'),nullif(d->>'description',''),coalesce(nullif(d->>'color',''),'#315c7d'),'pipeline','custom','pipeline',config,coalesce(d->'field_schema','[]'::jsonb),roles,positions,true,coalesce((d->>'sort_order')::integer,100),auth.uid()) returning id into saved_source;
  elsif q.request_type='deactivate' then
   update public.work_sources set is_active=false,updated_at=now() where id=q.target_source_id and module_type='pipeline';saved_source:=q.target_source_id;
  else
   config:=coalesce(d->'module_config',(select module_config from public.work_sources where id=q.target_source_id));
   if jsonb_array_length(coalesce(config->'stages','[]'::jsonb))=0 then raise exception 'Pipeline minimal memiliki satu stage.';end if;
   update public.work_sources set name=coalesce(nullif(trim(d->>'name'),''),name),description=coalesce(d->>'description',description),color=coalesce(nullif(d->>'color',''),color),module_config=config,field_schema=coalesce(d->'field_schema',field_schema),updated_at=now() where id=q.target_source_id and module_type='pipeline';saved_source:=q.target_source_id;
  end if;
 end if;
 update public.pipeline_change_requests set status=decision,reviewed_by_membership_id=actor,review_note=nullif(trim(note),''),reviewed_at=now(),updated_at=now(),proposed_data=proposed_data||jsonb_build_object('applied_source_id',saved_source) where id=q.id;
 insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key)
 values(q.requested_by_membership_id,actor,'pipeline.config.'||decision,case when decision='approved' then 'Perubahan pipeline disetujui' else 'Perubahan pipeline ditolak' end,q.title,'pipeline_change',q.id::text,'/ruang-kawan/pipeline/?panel=config',case when decision='approved' then 'normal' else 'high' end,'pipeline-decision:'||q.id::text)
 on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do nothing;
end;$$;

create or replace function public.notification_center_workspace()
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();today_jkt date:=(now() at time zone 'Asia/Jakarta')::date;
begin
 if actor is null or not public.current_user_has_permission('notifications.view_self') then raise exception 'Akses notifikasi diperlukan.' using errcode='42501';end if;
 insert into public.notifications(recipient_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key)
 select actor,'deadline.reminder',case when a.activity_date<today_jkt then 'Pekerjaan melewati deadline' else 'Deadline pekerjaan sudah dekat' end,a.title,'activity',a.id::text,case when ws.module_type='pipeline' then '/ruang-kawan/pipeline/' when ws.module_type='content_plan' then '/ruang-kawan/content-plan/' when ws.module_type='project' then '/ruang-kawan/projects/' else '/ruang-kawan/activity/' end,case when a.activity_date<today_jkt then 'urgent' else 'high' end,'activity-deadline:'||a.id::text||':'||today_jkt::text
 from public.activities a join public.work_sources ws on ws.id=a.source_id where a.owner_membership_id=actor and a.status not in ('done') and a.activity_date<=today_jkt+1
 on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do nothing;
 insert into public.notifications(recipient_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key)
 select actor,'proposal.followup','Follow-up proposal jatuh tempo',d.account_name||coalesce(' · '||d.next_action,''),'proposal',d.id::text,'/ruang-kawan/marketing/?tab=proposal','high','proposal-due:'||d.id::text||':'||today_jkt::text from public.proposal_deliverables d where (d.owner_membership_id=actor or d.reviewer_membership_id=actor) and d.deadline<=today_jkt+1 and lower(d.status) not in ('won','lost','archived','approved')
 on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do nothing;
 return jsonb_build_object(
  'unread',(select count(*) from public.notifications where recipient_membership_id=actor and read_at is null and dismissed_at is null),
  'urgent',(select count(*) from public.notifications where recipient_membership_id=actor and read_at is null and dismissed_at is null and priority='urgent'),
  'items',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from (select * from public.notifications where recipient_membership_id=actor and dismissed_at is null order by created_at desc limit 100)n),'[]'::jsonb)
 );
end;$$;

create or replace function public.notify_document_request_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();recipient uuid;event_key text;
begin
 recipient:=case when tg_op='INSERT' then new.assignee_membership_id when new.status is distinct from old.status then new.requester_membership_id end;
 if recipient is null or recipient=actor then return new;end if;
 event_key:=case when tg_op='INSERT' then 'document.request.assigned' else 'document.request.'||new.status end;
 insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key)
 values(recipient,actor,event_key,case when tg_op='INSERT' then 'Document request baru' else 'Status document request berubah' end,new.title,'document_request',new.id::text,'/ruang-kawan/documents/','normal',event_key||':'||new.id::text)
 on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do update set message=excluded.message,read_at=null,dismissed_at=null,created_at=now();return new;
end;$$;
drop trigger if exists notify_document_request_event on public.document_requests;
create trigger notify_document_request_event after insert or update of status on public.document_requests for each row execute function public.notify_document_request_event();

create or replace function public.notify_proposal_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();recipient uuid;event_key text;
begin
 if tg_op='INSERT' then recipient:=new.reviewer_membership_id;event_key:='proposal.review';
 elsif new.status is distinct from old.status then recipient:=case when actor=new.owner_membership_id then new.reviewer_membership_id else new.owner_membership_id end;event_key:='proposal.status.'||lower(regexp_replace(new.status,'[^a-zA-Z0-9]+','.','g'));end if;
 if recipient is null or recipient=actor then return new;end if;
 insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key)
 values(recipient,actor,event_key,case when tg_op='INSERT' then 'Proposal perlu direview' else 'Status proposal berubah' end,new.account_name||' · '||new.status,'proposal',new.id::text,'/ruang-kawan/marketing/?tab=proposal',case when lower(new.priority) in ('urgent','high') then 'high' else 'normal' end,event_key||':'||new.id::text)
 on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do update set message=excluded.message,read_at=null,dismissed_at=null,created_at=now();return new;
end;$$;
drop trigger if exists notify_proposal_event on public.proposal_deliverables;
create trigger notify_proposal_event after insert or update of status on public.proposal_deliverables for each row execute function public.notify_proposal_event();

create or replace function public.notify_kpi_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();recipient uuid;event_key text;
begin
 if new.status is not distinct from old.status then return new;end if;
 recipient:=case when new.status='submitted' then new.reviewer_membership_id else new.membership_id end;
 if recipient is null or recipient=actor then return new;end if;event_key:='kpi.'||new.status;
 insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key)
 values(recipient,actor,event_key,case when new.status='submitted' then 'KPI perlu direview' when new.status='locked' then 'KPI telah dikunci' else 'Status KPI berubah' end,'Buka KPI Management untuk melihat detail.','kpi_assignment',new.id::text,'/ruang-kawan/kpi/','high',event_key||':'||new.id::text)
 on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do update set read_at=null,dismissed_at=null,created_at=now();return new;
end;$$;
drop trigger if exists notify_kpi_event on public.kpi_assignments;
create trigger notify_kpi_event after update of status on public.kpi_assignments for each row execute function public.notify_kpi_event();

alter table public.report_action_items add column if not exists activity_id uuid references public.activities(id) on delete set null;
create index if not exists report_action_pic_status_idx on public.report_action_items(pic_membership_id,status,deadline);
alter table public.report_artifacts drop constraint if exists report_artifacts_artifact_type_check;
alter table public.report_artifacts add constraint report_artifacts_artifact_type_check check(artifact_type in ('document','presentation','pdf'));

create or replace function public.report_action_workspace(target uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();
begin
 if not exists(select 1 from public.report_drafts where id=target and owner_membership_id=actor) then raise exception 'Report tidak dapat diakses.' using errcode='42501';end if;
 return jsonb_build_object(
  'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text)) order by coalesce(m.full_name,m.email::text)) from public.memberships m where m.status='active'),'[]'::jsonb),
  'actions',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'report_id',a.report_id,'report_item_id',a.report_item_id,'pic_membership_id',a.pic_membership_id,'pic_name',coalesce(m.full_name,m.email::text),'title',a.title,'deadline',a.deadline,'priority',a.priority,'status',a.status,'source_module',a.source_module,'source_id',a.source_id,'activity_id',a.activity_id) order by a.deadline nulls last,a.created_at) from public.report_action_items a join public.memberships m on m.id=a.pic_membership_id where a.report_id=target),'[]'::jsonb)
 );
end;$$;

create or replace function public.save_report_action_item(target uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();saved uuid;pic uuid:=coalesce(nullif(payload->>'pic_membership_id','')::uuid,actor);activity uuid;source uuid;deadline_value date:=nullif(payload->>'deadline','')::date;priority_value text:=coalesce(nullif(payload->>'priority',''),'medium');status_value text:=coalesce(nullif(payload->>'status',''),'open');report_owner uuid;
begin
 select owner_membership_id into report_owner from public.report_drafts where id=(payload->>'report_id')::uuid;
 if actor is null or report_owner<>actor then raise exception 'Action item hanya dapat dibuat dari report sendiri.' using errcode='42501';end if;
 if pic<>actor and not public.current_user_has_permission('report.action.assign') then raise exception 'Izin assign action item diperlukan.' using errcode='42501';end if;
 if trim(coalesce(payload->>'title',''))='' or deadline_value is null then raise exception 'Judul dan deadline action item wajib diisi.';end if;
 select id into source from public.work_sources where key='manual_activity';
 if target is null then
  insert into public.activities(owner_membership_id,assigned_by_membership_id,source_id,title,activity_date,activity_type,status,progress,priority,detail,next_action,source_record_id,custom_data,created_by,updated_by)
  values(pic,actor,source,trim(payload->>'title'),deadline_value,'Report Action Item',case when status_value='done' then 'done' when status_value='blocked' then 'blocked' else 'not_started' end,case when status_value='done' then 100 else 0 end,priority_value,nullif(payload->>'source_module',''),'Selesaikan action item report',null,jsonb_build_object('report_id',payload->>'report_id'),auth.uid(),auth.uid()) returning id into activity;
  insert into public.report_action_items(report_id,report_item_id,pic_membership_id,title,deadline,priority,status,source_module,source_id,created_by_membership_id,activity_id)
  values((payload->>'report_id')::uuid,nullif(payload->>'report_item_id','')::uuid,pic,trim(payload->>'title'),deadline_value,priority_value,status_value,nullif(payload->>'source_module',''),nullif(payload->>'source_id',''),actor,activity) returning id into saved;
  update public.activities set source_record_id=saved::text,custom_data=custom_data||jsonb_build_object('report_action_id',saved) where id=activity;
 else
  select activity_id into activity from public.report_action_items where id=target and (created_by_membership_id=actor or pic_membership_id=actor);
  update public.report_action_items set pic_membership_id=pic,title=trim(payload->>'title'),deadline=deadline_value,priority=priority_value,status=status_value,updated_at=now() where id=target and (created_by_membership_id=actor or pic_membership_id=actor) returning id into saved;
  update public.activities set owner_membership_id=pic,title=trim(payload->>'title'),activity_date=deadline_value,priority=priority_value,status=case when status_value='done' then 'done' when status_value='blocked' then 'blocked' else 'in_progress' end,progress=case when status_value='done' then 100 else progress end,updated_at=now() where id=activity;
 end if;
 if saved is null then raise exception 'Action item tidak dapat disimpan.' using errcode='42501';end if;
 if pic<>actor then insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key) values(pic,actor,'report.action.assigned','Action item baru',payload->>'title','reports',saved::text,'/ruang-kawan/activity/',case when priority_value='urgent' then 'urgent' else 'normal' end,'report-action:'||saved::text) on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do update set message=excluded.message,read_at=null,dismissed_at=null,created_at=now();end if;
 return saved;
end;$$;

create or replace function public.snapshot_report(target uuid,idempotency text)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();d public.report_drafts%rowtype;saved uuid;payload jsonb;digest text;
begin
 select * into d from public.report_drafts where id=target and owner_membership_id=actor and status in ('draft','ready','snapshotted');if d.id is null then raise exception 'Report tidak dapat dibekukan.' using errcode='42501';end if;
 select jsonb_build_object('report',to_jsonb(d),'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.section,i.sort_order) from public.report_items i where i.report_id=target and i.active),'[]'::jsonb),'action_items',coalesce((select jsonb_agg(to_jsonb(a) order by a.deadline,a.created_at) from public.report_action_items a where a.report_id=target),'[]'::jsonb)) into payload;
 digest:=encode(extensions.digest(payload::text,'sha256'),'hex');
 insert into public.report_snapshots(report_id,draft_revision,owner_membership_id,report_type,period_start,period_end,score,payload_json,checksum,idempotency_key,created_by_membership_id) values(target,d.revision,actor,d.report_type,d.period_start,d.period_end,d.score_cache,payload,digest,idempotency,actor) on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key returning id into saved;
 insert into public.report_snapshot_kpis(snapshot_id,kpi_result_id,category,category_weight,target,actual,achievement,status,source_data) select saved,r.id,r.category_name,r.category_weight,r.target_value,r.actual_value,r.raw_achievement,case when coalesce(r.reviewer_score,r.score)>=100 then 'Exceeded' when coalesce(r.reviewer_score,r.score)>=80 then 'On Track' when coalesce(r.reviewer_score,r.score)>=70 then 'Needs Attention' else 'At Risk' end,to_jsonb(r) from public.kpi_assignments a join public.kpi_periods p on p.id=a.period_id join public.kpi_results r on r.assignment_id=a.id where a.membership_id=actor and p.start_date<=d.period_end and p.end_date>=d.period_start on conflict do nothing;
 update public.report_drafts set status='snapshotted',updated_at=now() where id=target;insert into public.report_usage_events(owner_membership_id,event_name,report_id,metadata) values(actor,'snapshot_created',target,jsonb_build_object('snapshot_id',saved));return saved;
end;$$;

create or replace function public.list_my_activity_feed()
returns jsonb language sql stable security definer set search_path=public as $$
 with me as(select public.current_membership_id() membership_id),feed as(
  select a.*,ws.key source_key,ws.name source_name,ws.color source_color,ws.icon source_icon,ws.source_kind,ws.field_schema,ws.module_type,
   coalesce(owner_m.full_name,owner_m.email::text) owner_name,coalesce(assigner_m.full_name,assigner_m.email::text) assigned_by_name,coalesce(reviewer_m.full_name,reviewer_m.email::text) reviewer_name,
   case when a.custom_data ? 'report_action_id' then 'report_action' when ws.module_type='content_plan' then 'content_plan' when ws.module_type='pipeline' then 'pipeline' when ws.module_type='project' then 'project' when a.assigned_by_membership_id is not null then 'assignment' else 'manual' end feed_kind,
   case when a.owner_membership_id=me.membership_id then 'mine' when a.reviewer_membership_id=me.membership_id then 'review' else 'assigned_by_me' end relationship,
   case when a.custom_data ? 'report_action_id' then '/ruang-kawan/reports/' when ws.module_type='content_plan' then '/ruang-kawan/content-plan/' when ws.module_type='pipeline' then '/ruang-kawan/pipeline/' when ws.module_type='project' then '/ruang-kawan/projects/' when a.assigned_by_membership_id is not null then '/ruang-kawan/assignments/' else null end module_route
  from public.activities a join me on me.membership_id is not null join public.work_sources ws on ws.id=a.source_id join public.memberships owner_m on owner_m.id=a.owner_membership_id left join public.memberships assigner_m on assigner_m.id=a.assigned_by_membership_id left join public.memberships reviewer_m on reviewer_m.id=a.reviewer_membership_id
  where public.current_user_has_permission('activity.view_self') and(a.owner_membership_id=me.membership_id or a.assigned_by_membership_id=me.membership_id or a.reviewer_membership_id=me.membership_id)
 ) select coalesce(jsonb_agg(to_jsonb(feed)-'source_key'-'source_name'-'source_color'-'source_icon'-'source_kind'-'field_schema'-'module_type'||jsonb_build_object('work_sources',jsonb_build_object('id',feed.source_id,'key',feed.source_key,'name',feed.source_name,'color',feed.source_color,'icon',feed.source_icon,'source_kind',feed.source_kind,'field_schema',feed.field_schema,'module_type',feed.module_type)) order by feed.activity_date desc,feed.created_at desc),'[]'::jsonb) from feed;
$$;

revoke all on function public.pipeline_configuration_workspace(),public.save_pipeline_change_request(uuid,jsonb,boolean),public.review_pipeline_change_request(uuid,text,text),public.notification_center_workspace(),public.report_action_workspace(uuid),public.save_report_action_item(uuid,jsonb),public.snapshot_report(uuid,text),public.list_my_activity_feed() from anon,public;
grant execute on function public.pipeline_configuration_workspace(),public.save_pipeline_change_request(uuid,jsonb,boolean),public.review_pipeline_change_request(uuid,text,text),public.notification_center_workspace(),public.report_action_workspace(uuid),public.save_report_action_item(uuid,jsonb),public.snapshot_report(uuid,text),public.list_my_activity_feed() to authenticated;
