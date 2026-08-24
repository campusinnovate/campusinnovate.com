-- Ruang Kawan: project workspace with per-project roles and My Activity tasks.

insert into public.permissions (key,name,description) values
  ('projects.create','Buat project','Membuat project dan menetapkan Project Lead.'),
  ('projects.manage_assigned','Kelola project yang ditugaskan','Mengelola project ketika menjadi Sponsor atau Project Lead.'),
  ('projects.approve','Setujui gate project','Menyetujui brief, budget, perubahan material, dan closing project.'),
  ('projects.configure','Konfigurasi Project Management','Mengatur sumber dan pilihan Project Management.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on
  r.key='system_admin'
  or (r.key='executive' and p.key in ('projects.view','projects.create','projects.manage_assigned','projects.approve','projects.configure'))
  or (r.key='project_lead' and p.key in ('projects.view','projects.manage_assigned'))
  or (r.key in ('staff','freelancer','finance_manager','people_hr_manager') and p.key='projects.view')
on conflict do nothing;

alter table public.work_sources drop constraint if exists work_sources_module_type_check;
alter table public.work_sources add constraint work_sources_module_type_check
  check(module_type in ('activity','content_plan','pipeline','project'));

insert into public.work_sources(
  key,name,description,color,icon,source_kind,module_type,module_config,sort_order
) values (
  'project_management','Project Management','Project client, internal program, partnership, training, dan event.','#684a85','briefcase','system','project',
  jsonb_build_object(
    'project_types',jsonb_build_array('Event','Training','Digital System','Website','Internal Program','Partnership','Community','Other'),
    'phases',jsonb_build_array('Commercial','Handover','Setup','Brief & Approval','Planning','Readiness','Execution','Deliverables','Finance Closing','Final Report','Closing','Lessons Learned','Archive'),
    'statuses',jsonb_build_array('Draft','Active','At Risk','On Hold','Completed','Archived')
  ),40
) on conflict(key) do update set module_type='project',module_config=excluded.module_config,name=excluded.name,description=excluded.description;

create table public.projects(
  id uuid primary key default extensions.gen_random_uuid(),
  source_id uuid not null references public.work_sources(id),
  project_code text not null unique,
  name text not null check(char_length(trim(name)) between 2 and 180),
  client_name text,
  project_type text not null,
  origin_label text,
  origin_record_id text,
  phase text not null default 'Setup',
  status text not null default 'Draft',
  priority text not null default 'medium' check(priority in ('low','medium','high','urgent')),
  start_date date,
  target_end_date date,
  actual_end_date date,
  objective text,
  success_kpi text,
  scope_in text,
  scope_out text,
  deliverables text,
  budget_amount numeric(18,2) not null default 0 check(budget_amount>=0),
  brief_status text not null default 'draft' check(brief_status in ('draft','waiting_approval','approved','revision_requested')),
  budget_status text not null default 'draft' check(budget_status in ('draft','waiting_approval','locked','revision_requested')),
  closing_status text not null default 'open' check(closing_status in ('open','waiting_approval','approved')),
  extra_data jsonb not null default '{}'::jsonb check(jsonb_typeof(extra_data)='object'),
  created_by_membership_id uuid not null references public.memberships(id),
  updated_by_membership_id uuid not null references public.memberships(id),
  deleted_at timestamptz,
  deleted_by_membership_id uuid references public.memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(target_end_date is null or start_date is null or target_end_date>=start_date)
);

create table public.project_members(
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  membership_id uuid not null references public.memberships(id),
  project_role text not null check(project_role in ('project_sponsor','project_lead','finance_project','pic','member','viewer')),
  can_manage_members boolean not null default false,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  added_by_membership_id uuid not null references public.memberships(id)
);
create unique index project_members_active_unique on public.project_members(project_id,membership_id) where removed_at is null;

create table public.project_tasks(
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  activity_id uuid unique references public.activities(id) on delete set null,
  parent_task_id uuid references public.project_tasks(id) on delete set null,
  task_kind text not null default 'task' check(task_kind in ('milestone','task','readiness','deliverable','action_item')),
  phase text not null,
  title text not null check(char_length(trim(title)) between 1 and 180),
  description text,
  due_date date not null,
  owner_membership_id uuid not null references public.memberships(id),
  reviewer_membership_id uuid references public.memberships(id),
  status text not null default 'not_started' check(status in ('not_started','in_progress','done','blocked')),
  progress smallint not null default 0 check(progress between 0 and 100),
  priority text not null default 'medium' check(priority in ('low','medium','high','urgent')),
  evidence_url text,
  blocker_risk text,
  sort_order integer not null default 100,
  deleted_at timestamptz,
  deleted_by_membership_id uuid references public.memberships(id),
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_records(
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  record_type text not null check(record_type in ('handover','risk','issue','decision','change_request','meeting','client_feedback','final_report','lesson_learned','document')),
  title text not null,
  status text not null default 'open',
  owner_membership_id uuid references public.memberships(id),
  due_date date,
  content jsonb not null default '{}'::jsonb check(jsonb_typeof(content)='object'),
  deleted_at timestamptz,
  deleted_by_membership_id uuid references public.memberships(id),
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_approvals(
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  approval_type text not null check(approval_type in ('brief','budget','change_request','closing')),
  related_record_id uuid references public.project_records(id) on delete set null,
  requested_by_membership_id uuid not null references public.memberships(id),
  approver_membership_id uuid not null references public.memberships(id),
  status text not null default 'waiting_approval' check(status in ('waiting_approval','approved','revision_requested','cancelled')),
  note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.project_code_seq start 1;

create index projects_status_phase_idx on public.projects(status,phase) where deleted_at is null;
create index project_members_project_idx on public.project_members(project_id) where removed_at is null;
create index project_tasks_project_due_idx on public.project_tasks(project_id,due_date) where deleted_at is null;
create index project_records_project_type_idx on public.project_records(project_id,record_type) where deleted_at is null;

create or replace function public.can_access_project(target_project_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_has_permission('access.manage')
    or public.current_user_has_permission('projects.approve')
    or exists(
      select 1 from public.project_members pm
      where pm.project_id=target_project_id and pm.membership_id=public.current_membership_id() and pm.removed_at is null
    );
$$;

create or replace function public.can_manage_project(target_project_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_has_permission('access.manage') or exists(
    select 1 from public.project_members pm
    where pm.project_id=target_project_id and pm.membership_id=public.current_membership_id()
      and pm.removed_at is null and pm.project_role in ('project_sponsor','project_lead')
  );
$$;

create or replace function public.list_project_candidates()
returns jsonb language sql stable security definer set search_path=public as $$
  select case when public.current_user_has_permission('projects.view') then coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'name',coalesce(m.full_name,m.email::text),'email',m.email::text,'position',p.name
  ) order by coalesce(m.full_name,m.email::text)),'[]'::jsonb) else '[]'::jsonb end
  from public.memberships m left join public.positions p on p.id=m.position_id where m.status='active';
$$;

create or replace function public.list_projects()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'source_id',p.source_id,'project_code',p.project_code,'name',p.name,'client_name',p.client_name,
    'project_type',p.project_type,'origin_label',p.origin_label,'phase',p.phase,'status',p.status,'priority',p.priority,
    'start_date',p.start_date,'target_end_date',p.target_end_date,'objective',p.objective,'success_kpi',p.success_kpi,
    'scope_in',p.scope_in,'scope_out',p.scope_out,'deliverables',p.deliverables,'budget_amount',p.budget_amount,
    'brief_status',p.brief_status,'budget_status',p.budget_status,'closing_status',p.closing_status,'extra_data',p.extra_data,
    'source_name',ws.name,'source_color',ws.color,
    'project_lead_id',(select pm.membership_id from public.project_members pm where pm.project_id=p.id and pm.project_role='project_lead' and pm.removed_at is null order by pm.joined_at limit 1),
    'project_lead_name',(select coalesce(m.full_name,m.email::text) from public.project_members pm join public.memberships m on m.id=pm.membership_id where pm.project_id=p.id and pm.project_role='project_lead' and pm.removed_at is null order by pm.joined_at limit 1),
    'sponsor_id',(select pm.membership_id from public.project_members pm where pm.project_id=p.id and pm.project_role='project_sponsor' and pm.removed_at is null order by pm.joined_at limit 1),
    'sponsor_name',(select coalesce(m.full_name,m.email::text) from public.project_members pm join public.memberships m on m.id=pm.membership_id where pm.project_id=p.id and pm.project_role='project_sponsor' and pm.removed_at is null order by pm.joined_at limit 1),
    'member_count',(select count(*) from public.project_members pm where pm.project_id=p.id and pm.removed_at is null),
    'task_count',(select count(*) from public.project_tasks pt where pt.project_id=p.id and pt.deleted_at is null),
    'completed_task_count',(select count(*) from public.project_tasks pt where pt.project_id=p.id and pt.deleted_at is null and pt.status='done'),
    'updated_at',p.updated_at
  ) order by case p.status when 'At Risk' then 0 when 'Active' then 1 when 'Draft' then 2 else 3 end,p.updated_at desc),'[]'::jsonb)
  from public.projects p join public.work_sources ws on ws.id=p.source_id
  where p.deleted_at is null and public.current_user_has_permission('projects.view') and public.can_access_project(p.id);
$$;

create or replace function public.list_project_tasks(target_project_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select case when public.can_access_project(target_project_id) then coalesce(jsonb_agg(jsonb_build_object(
    'id',pt.id,'project_id',pt.project_id,'activity_id',pt.activity_id,'task_kind',pt.task_kind,'phase',pt.phase,
    'title',pt.title,'description',pt.description,'due_date',pt.due_date,'owner_membership_id',pt.owner_membership_id,
    'reviewer_membership_id',pt.reviewer_membership_id,'status',pt.status,'progress',pt.progress,'priority',pt.priority,
    'evidence_url',pt.evidence_url,'blocker_risk',pt.blocker_risk,'owner_name',coalesce(om.full_name,om.email::text),
    'reviewer_name',coalesce(rm.full_name,rm.email::text),'review_status',a.review_status
  ) order by pt.due_date,pt.sort_order,pt.created_at),'[]'::jsonb) else '[]'::jsonb end
  from public.project_tasks pt join public.memberships om on om.id=pt.owner_membership_id
  left join public.memberships rm on rm.id=pt.reviewer_membership_id left join public.activities a on a.id=pt.activity_id
  where pt.project_id=target_project_id and pt.deleted_at is null;
$$;

create or replace function public.list_project_members(target_project_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select case when public.can_access_project(target_project_id) then coalesce(jsonb_agg(jsonb_build_object(
    'id',pm.id,'membership_id',pm.membership_id,'project_role',pm.project_role,'name',coalesce(m.full_name,m.email::text),'position',pos.name
  ) order by case pm.project_role when 'project_sponsor' then 0 when 'project_lead' then 1 else 2 end,coalesce(m.full_name,m.email::text)),'[]'::jsonb) else '[]'::jsonb end
  from public.project_members pm join public.memberships m on m.id=pm.membership_id left join public.positions pos on pos.id=m.position_id
  where pm.project_id=target_project_id and pm.removed_at is null;
$$;

create or replace function public.list_project_records(target_project_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select case when public.can_access_project(target_project_id) then coalesce(jsonb_agg(jsonb_build_object(
    'id',pr.id,'project_id',pr.project_id,'record_type',pr.record_type,'title',pr.title,'status',pr.status,
    'owner_membership_id',pr.owner_membership_id,'owner_name',coalesce(m.full_name,m.email::text),
    'due_date',pr.due_date,'content',pr.content,'created_at',pr.created_at,'updated_at',pr.updated_at
  ) order by pr.updated_at desc),'[]'::jsonb) else '[]'::jsonb end
  from public.project_records pr left join public.memberships m on m.id=pr.owner_membership_id
  where pr.project_id=target_project_id and pr.deleted_at is null;
$$;

create or replace function public.save_project_record(project_record_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); saved_id uuid; project_uuid uuid; current_record public.project_records%rowtype;
  type_value text; title_value text;
begin
  project_uuid:=nullif(payload->>'project_id','')::uuid; type_value:=coalesce(nullif(payload->>'record_type',''),'document'); title_value:=trim(coalesce(payload->>'title',''));
  if not public.can_manage_project(project_uuid) then raise exception 'Hanya Sponsor atau Project Lead yang dapat mengelola control log.' using errcode='42501'; end if;
  if type_value not in ('handover','risk','issue','decision','change_request','meeting','client_feedback','final_report','lesson_learned','document') then raise exception 'Jenis record tidak valid.'; end if;
  if title_value='' then raise exception 'Judul record wajib diisi.'; end if;
  if project_record_id is null then
    insert into public.project_records(project_id,record_type,title,status,owner_membership_id,due_date,content,created_by_membership_id)
    values(project_uuid,type_value,title_value,coalesce(nullif(payload->>'status',''),'open'),nullif(payload->>'owner_membership_id','')::uuid,nullif(payload->>'due_date','')::date,coalesce(payload->'content','{}'::jsonb),actor_id) returning id into saved_id;
  else
    select * into current_record from public.project_records where id=project_record_id and deleted_at is null;
    if current_record.id is null or current_record.project_id<>project_uuid then raise exception 'Record tidak ditemukan.'; end if;
    update public.project_records set record_type=type_value,title=title_value,status=coalesce(nullif(payload->>'status',''),'open'),owner_membership_id=nullif(payload->>'owner_membership_id','')::uuid,due_date=nullif(payload->>'due_date','')::date,content=coalesce(payload->'content','{}'::jsonb),updated_at=now() where id=project_record_id returning id into saved_id;
  end if;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),case when project_record_id is null then 'project.record.create' else 'project.record.update' end,'project_record',saved_id::text,payload);
  return saved_id;
end; $$;

create or replace function public.delete_project_record(target_project_record_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare target public.project_records%rowtype; actor_id uuid:=public.current_membership_id();
begin
  select * into target from public.project_records where id=target_project_record_id and deleted_at is null;
  if target.id is null or not public.can_manage_project(target.project_id) then raise exception 'Record tidak dapat dihapus.' using errcode='42501'; end if;
  update public.project_records set deleted_at=now(),deleted_by_membership_id=actor_id,updated_at=now() where id=target.id;
end; $$;

create or replace function public.save_project(project_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); saved_id uuid; lead_id uuid; sponsor_id uuid; source_uuid uuid;
  code_value text; name_value text; current_project public.projects%rowtype;
begin
  if actor_id is null or not public.current_user_has_permission('projects.view') then raise exception 'Akses Project Management diperlukan.' using errcode='42501'; end if;
  lead_id:=nullif(payload->>'project_lead_id','')::uuid; sponsor_id:=nullif(payload->>'sponsor_id','')::uuid;
  source_uuid:=nullif(payload->>'source_id','')::uuid; name_value:=trim(coalesce(payload->>'name',''));
  if lead_id is null then raise exception 'Project Lead wajib ditentukan.'; end if;
  if name_value='' then raise exception 'Nama project wajib diisi.'; end if;
  if not exists(select 1 from public.work_sources ws where ws.id=source_uuid and ws.module_type='project' and public.can_access_work_source(ws.id)) then raise exception 'Sumber project tidak tersedia.' using errcode='42501'; end if;
  if project_id is null then
    if not (public.current_user_has_permission('projects.create') or public.current_user_has_permission('projects.manage')) then raise exception 'Izin membuat project diperlukan.' using errcode='42501'; end if;
    code_value:=coalesce(nullif(trim(payload->>'project_code'),''),'CI-PRJ-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.project_code_seq')::text,6,'0'));
    insert into public.projects(source_id,project_code,name,client_name,project_type,origin_label,origin_record_id,phase,status,priority,start_date,target_end_date,objective,success_kpi,scope_in,scope_out,deliverables,budget_amount,brief_status,budget_status,closing_status,extra_data,created_by_membership_id,updated_by_membership_id)
    values(source_uuid,code_value,name_value,nullif(trim(payload->>'client_name'),''),coalesce(nullif(trim(payload->>'project_type'),''),'Other'),nullif(trim(payload->>'origin_label'),''),nullif(trim(payload->>'origin_record_id'),''),coalesce(nullif(trim(payload->>'phase'),''),'Setup'),coalesce(nullif(payload->>'status',''),'Draft'),coalesce(nullif(payload->>'priority',''),'medium'),nullif(payload->>'start_date','')::date,nullif(payload->>'target_end_date','')::date,nullif(trim(payload->>'objective'),''),nullif(trim(payload->>'success_kpi'),''),nullif(trim(payload->>'scope_in'),''),nullif(trim(payload->>'scope_out'),''),nullif(trim(payload->>'deliverables'),''),coalesce(nullif(payload->>'budget_amount','')::numeric,0),'draft','draft','open',coalesce(payload->'extra_data','{}'::jsonb),actor_id,actor_id) returning id into saved_id;
    insert into public.project_members(project_id,membership_id,project_role,can_manage_members,added_by_membership_id) values(saved_id,lead_id,'project_lead',true,actor_id);
    if sponsor_id is not null and sponsor_id<>lead_id then insert into public.project_members(project_id,membership_id,project_role,can_manage_members,added_by_membership_id) values(saved_id,sponsor_id,'project_sponsor',true,actor_id); end if;
  else
    select * into current_project from public.projects where id=project_id and deleted_at is null;
    if current_project.id is null or not public.can_manage_project(project_id) then raise exception 'Project tidak dapat diubah.' using errcode='42501'; end if;
    if ((payload->>'brief_status'='approved') or (payload->>'budget_status'='locked') or (payload->>'closing_status'='approved')) and not public.current_user_has_permission('projects.approve') then
      raise exception 'Approval gate hanya dapat diputuskan oleh approver project.' using errcode='42501';
    end if;
    saved_id:=project_id;
    update public.projects set source_id=source_uuid,name=name_value,client_name=nullif(trim(payload->>'client_name'),''),project_type=coalesce(nullif(trim(payload->>'project_type'),''),project_type),origin_label=nullif(trim(payload->>'origin_label'),''),origin_record_id=nullif(trim(payload->>'origin_record_id'),''),phase=coalesce(nullif(trim(payload->>'phase'),''),phase),status=coalesce(nullif(payload->>'status',''),status),priority=coalesce(nullif(payload->>'priority',''),priority),start_date=nullif(payload->>'start_date','')::date,target_end_date=nullif(payload->>'target_end_date','')::date,objective=nullif(trim(payload->>'objective'),''),success_kpi=nullif(trim(payload->>'success_kpi'),''),scope_in=nullif(trim(payload->>'scope_in'),''),scope_out=nullif(trim(payload->>'scope_out'),''),deliverables=nullif(trim(payload->>'deliverables'),''),budget_amount=coalesce(nullif(payload->>'budget_amount','')::numeric,0),brief_status=coalesce(nullif(payload->>'brief_status',''),brief_status),budget_status=coalesce(nullif(payload->>'budget_status',''),budget_status),closing_status=coalesce(nullif(payload->>'closing_status',''),closing_status),extra_data=coalesce(payload->'extra_data',extra_data),updated_by_membership_id=actor_id,updated_at=now() where id=project_id;
    update public.project_members pm set removed_at=now() where pm.project_id=saved_id and pm.project_role in ('project_lead','project_sponsor') and pm.removed_at is null;
    insert into public.project_members(project_id,membership_id,project_role,can_manage_members,added_by_membership_id) values(saved_id,lead_id,'project_lead',true,actor_id);
    if sponsor_id is not null and sponsor_id<>lead_id then insert into public.project_members(project_id,membership_id,project_role,can_manage_members,added_by_membership_id) values(saved_id,sponsor_id,'project_sponsor',true,actor_id); end if;
  end if;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),case when project_id is null then 'project.create' else 'project.update' end,'project',saved_id::text,payload);
  return saved_id;
end; $$;

create or replace function public.save_project_task(project_task_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); saved_id uuid; saved_activity_id uuid; project_uuid uuid; source_uuid uuid;
  owner_id uuid; reviewer_id uuid; existing public.project_tasks%rowtype; title_value text; due_value date; status_value text; progress_value integer;
begin
  project_uuid:=nullif(payload->>'project_id','')::uuid; owner_id:=nullif(payload->>'owner_membership_id','')::uuid; reviewer_id:=nullif(payload->>'reviewer_membership_id','')::uuid;
  title_value:=trim(coalesce(payload->>'title','')); due_value:=nullif(payload->>'due_date','')::date;
  status_value:=coalesce(nullif(payload->>'status',''),'not_started'); progress_value:=case when status_value='done' then 100 else coalesce(nullif(payload->>'progress','')::integer,0) end;
  if title_value='' or due_value is null or owner_id is null then raise exception 'Judul, PIC, dan deadline wajib diisi.'; end if;
  if project_task_id is null then
    if not public.can_manage_project(project_uuid) then raise exception 'Hanya Sponsor atau Project Lead yang dapat membuat pekerjaan.' using errcode='42501'; end if;
    select source_id into source_uuid from public.projects where id=project_uuid and deleted_at is null;
    insert into public.activities(owner_membership_id,assigned_by_membership_id,reviewer_membership_id,source_id,title,activity_date,activity_type,status,progress,priority,detail,blocker_risk,evidence_url,source_record_id,created_by,updated_by)
    values(owner_id,actor_id,reviewer_id,source_uuid,title_value,due_value,coalesce(nullif(payload->>'task_kind',''),'task'),status_value,progress_value,coalesce(nullif(payload->>'priority',''),'medium'),nullif(trim(payload->>'description'),''),nullif(trim(payload->>'blocker_risk'),''),nullif(trim(payload->>'evidence_url'),''),project_uuid::text,auth.uid(),auth.uid()) returning id into saved_activity_id;
    insert into public.project_tasks(project_id,activity_id,task_kind,phase,title,description,due_date,owner_membership_id,reviewer_membership_id,status,progress,priority,evidence_url,blocker_risk,created_by_membership_id)
    values(project_uuid,saved_activity_id,coalesce(nullif(payload->>'task_kind',''),'task'),coalesce(nullif(trim(payload->>'phase'),''),'Planning'),title_value,nullif(trim(payload->>'description'),''),due_value,owner_id,reviewer_id,status_value,progress_value,coalesce(nullif(payload->>'priority',''),'medium'),nullif(trim(payload->>'evidence_url'),''),nullif(trim(payload->>'blocker_risk'),''),actor_id) returning id into saved_id;
    update public.activities set source_record_id=saved_id::text where id=saved_activity_id;
  else
    select * into existing from public.project_tasks where id=project_task_id and deleted_at is null;
    if existing.id is null or not (public.can_manage_project(existing.project_id) or existing.owner_membership_id=actor_id) then raise exception 'Pekerjaan tidak dapat diubah.' using errcode='42501'; end if;
    if existing.owner_membership_id=actor_id and not public.can_manage_project(existing.project_id) and owner_id<>actor_id then raise exception 'PIC tidak dapat memindahkan pekerjaan.' using errcode='42501'; end if;
    saved_id:=existing.id; saved_activity_id:=existing.activity_id;
    update public.project_tasks set task_kind=coalesce(nullif(payload->>'task_kind',''),task_kind),phase=coalesce(nullif(trim(payload->>'phase'),''),phase),title=title_value,description=nullif(trim(payload->>'description'),''),due_date=due_value,owner_membership_id=owner_id,reviewer_membership_id=reviewer_id,status=status_value,progress=progress_value,priority=coalesce(nullif(payload->>'priority',''),'medium'),evidence_url=nullif(trim(payload->>'evidence_url'),''),blocker_risk=nullif(trim(payload->>'blocker_risk'),''),updated_at=now() where id=saved_id;
    update public.activities set owner_membership_id=owner_id,reviewer_membership_id=reviewer_id,title=title_value,activity_date=due_value,activity_type=coalesce(nullif(payload->>'task_kind',''),'task'),status=status_value,progress=progress_value,priority=coalesce(nullif(payload->>'priority',''),'medium'),detail=nullif(trim(payload->>'description'),''),blocker_risk=nullif(trim(payload->>'blocker_risk'),''),evidence_url=nullif(trim(payload->>'evidence_url'),''),updated_by=auth.uid(),updated_at=now() where id=saved_activity_id;
  end if;
  return saved_id;
end; $$;

create or replace function public.save_project_member(target_project_id uuid,target_membership_id uuid,target_role text)
returns void language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id();
begin
  if not public.can_manage_project(target_project_id) then raise exception 'Anggota project tidak dapat diubah.' using errcode='42501'; end if;
  if target_role not in ('finance_project','pic','member','viewer') then raise exception 'Role project tidak valid.'; end if;
  update public.project_members set removed_at=now() where project_id=target_project_id and membership_id=target_membership_id and removed_at is null;
  insert into public.project_members(project_id,membership_id,project_role,added_by_membership_id) values(target_project_id,target_membership_id,target_role,actor_id);
end; $$;

create or replace function public.remove_project_member(target_project_member_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare target public.project_members%rowtype;
begin
  select * into target from public.project_members where id=target_project_member_id and removed_at is null;
  if target.id is null or target.project_role in ('project_sponsor','project_lead') or not public.can_manage_project(target.project_id) then raise exception 'Anggota project tidak dapat dihapus.' using errcode='42501'; end if;
  update public.project_members set removed_at=now() where id=target.id;
end; $$;

create or replace function public.delete_project_task(target_project_task_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare target public.project_tasks%rowtype; actor_id uuid:=public.current_membership_id();
begin
  select * into target from public.project_tasks where id=target_project_task_id and deleted_at is null;
  if target.id is null or not public.can_manage_project(target.project_id) then raise exception 'Pekerjaan tidak dapat dihapus.' using errcode='42501'; end if;
  update public.project_tasks set deleted_at=now(),deleted_by_membership_id=actor_id,updated_at=now() where id=target.id;
  delete from public.activities where id=target.activity_id;
end; $$;

create or replace function public.delete_project(target_project_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id();
begin
  if not public.current_user_has_permission('access.manage') then raise exception 'Hanya Admin yang dapat menghapus project.' using errcode='42501'; end if;
  update public.projects set deleted_at=now(),deleted_by_membership_id=actor_id,updated_at=now() where id=target_project_id and deleted_at is null;
  delete from public.activities where id in(select activity_id from public.project_tasks where project_id=target_project_id and deleted_at is null);
  update public.project_tasks set deleted_at=now(),deleted_by_membership_id=actor_id where project_id=target_project_id and deleted_at is null;
end; $$;

create or replace function public.admin_save_work_source(
  source_id uuid,source_key text,source_name text,source_description text,source_color text,source_icon text,source_field_schema jsonb,
  source_allowed_role_keys text[],source_allowed_position_keys text[],source_is_active boolean,source_sort_order integer,source_module_type text,source_module_config jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare saved_id uuid;
begin
  if not public.current_user_has_permission('work_sources.manage') then raise exception 'Akses pengelola sumber kerja diperlukan.' using errcode='42501'; end if;
  if trim(source_name)='' or source_key !~ '^[a-z0-9_]+$' or source_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Data sumber kerja tidak valid.'; end if;
  if source_module_type not in ('activity','content_plan','pipeline','project') then raise exception 'Tipe modul tidak valid.'; end if;
  insert into public.work_sources(id,key,name,description,color,icon,source_kind,field_schema,allowed_role_keys,allowed_position_keys,is_active,sort_order,module_type,module_config,created_by)
  values(coalesce(source_id,extensions.gen_random_uuid()),source_key,trim(source_name),nullif(trim(source_description),''),source_color,coalesce(nullif(trim(source_icon),''),'activity'),'custom',coalesce(source_field_schema,'[]'::jsonb),coalesce(source_allowed_role_keys,'{}'::text[]),coalesce(source_allowed_position_keys,'{}'::text[]),source_is_active,source_sort_order,source_module_type,coalesce(source_module_config,'{}'::jsonb),auth.uid())
  on conflict(id) do update set name=excluded.name,description=excluded.description,color=excluded.color,icon=excluded.icon,field_schema=excluded.field_schema,allowed_role_keys=excluded.allowed_role_keys,allowed_position_keys=excluded.allowed_position_keys,is_active=excluded.is_active,sort_order=excluded.sort_order,module_type=excluded.module_type,module_config=excluded.module_config,updated_at=now() returning id into saved_id;
  return saved_id;
end; $$;

create or replace function public.list_my_activity_feed()
returns jsonb language sql stable security definer set search_path=public as $$
  with me as(select public.current_membership_id() membership_id),feed as(
    select a.*,ws.key source_key,ws.name source_name,ws.color source_color,ws.icon source_icon,ws.source_kind,ws.field_schema,ws.module_type,
      coalesce(owner_m.full_name,owner_m.email::text) owner_name,coalesce(assigner_m.full_name,assigner_m.email::text) assigned_by_name,coalesce(reviewer_m.full_name,reviewer_m.email::text) reviewer_name,
      case when ws.module_type='content_plan' then 'content_plan' when ws.module_type='pipeline' then 'pipeline' when ws.module_type='project' then 'project' when a.assigned_by_membership_id is not null then 'assignment' else 'manual' end feed_kind,
      case when a.owner_membership_id=me.membership_id then 'mine' when a.reviewer_membership_id=me.membership_id then 'review' else 'assigned_by_me' end relationship,
      case when ws.module_type='content_plan' then '/ruang-kawan/content-plan/' when ws.module_type='pipeline' then '/ruang-kawan/pipeline/' when ws.module_type='project' then '/ruang-kawan/projects/' when a.assigned_by_membership_id is not null then '/ruang-kawan/assignments/' else null end module_route
    from public.activities a join me on me.membership_id is not null join public.work_sources ws on ws.id=a.source_id join public.memberships owner_m on owner_m.id=a.owner_membership_id left join public.memberships assigner_m on assigner_m.id=a.assigned_by_membership_id left join public.memberships reviewer_m on reviewer_m.id=a.reviewer_membership_id
    where public.current_user_has_permission('activity.view_self') and(a.owner_membership_id=me.membership_id or a.assigned_by_membership_id=me.membership_id or a.reviewer_membership_id=me.membership_id)
  ) select coalesce(jsonb_agg(to_jsonb(feed)-'source_key'-'source_name'-'source_color'-'source_icon'-'source_kind'-'field_schema'-'module_type'||jsonb_build_object('work_sources',jsonb_build_object('id',feed.source_id,'key',feed.source_key,'name',feed.source_name,'color',feed.source_color,'icon',feed.source_icon,'source_kind',feed.source_kind,'field_schema',feed.field_schema,'module_type',feed.module_type)) order by feed.activity_date desc,feed.created_at desc),'[]'::jsonb) from feed;
$$;

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_records enable row level security;
alter table public.project_approvals enable row level security;

create policy project_view on public.projects for select to authenticated using(public.can_access_project(id));
create policy project_members_view on public.project_members for select to authenticated using(public.can_access_project(project_id));
create policy project_tasks_view on public.project_tasks for select to authenticated using(public.can_access_project(project_id));
create policy project_records_view on public.project_records for select to authenticated using(public.can_access_project(project_id));
create policy project_approvals_view on public.project_approvals for select to authenticated using(public.can_access_project(project_id));

grant select on public.projects,public.project_members,public.project_tasks,public.project_records,public.project_approvals to authenticated;
revoke all on function public.can_access_project(uuid),public.can_manage_project(uuid),public.list_project_candidates(),public.list_projects(),public.list_project_tasks(uuid),public.list_project_members(uuid),public.list_project_records(uuid),public.save_project(uuid,jsonb),public.save_project_task(uuid,jsonb),public.save_project_record(uuid,jsonb),public.save_project_member(uuid,uuid,text),public.remove_project_member(uuid),public.delete_project_task(uuid),public.delete_project_record(uuid),public.delete_project(uuid) from public,anon;
grant execute on function public.can_access_project(uuid),public.can_manage_project(uuid),public.list_project_candidates(),public.list_projects(),public.list_project_tasks(uuid),public.list_project_members(uuid),public.list_project_records(uuid),public.save_project(uuid,jsonb),public.save_project_task(uuid,jsonb),public.save_project_record(uuid,jsonb),public.save_project_member(uuid,uuid,text),public.remove_project_member(uuid),public.delete_project_task(uuid),public.delete_project_record(uuid),public.delete_project(uuid) to authenticated;