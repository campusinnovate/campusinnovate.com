-- Pipeline Operating System: one sales funnel, measurable qualification,
-- automatic activity/contact metrics, and commercial-to-project handover.

insert into public.permissions(key,name,description) values
  ('tickets.view','Lihat Commercial & Handover Ticket','Melihat ticket komersial dan handover yang berkaitan dengan layanan.'),
  ('tickets.manage','Kelola Commercial & Handover Ticket','Memperbarui dan menerima ticket komersial atau handover.'),
  ('pipeline.analytics','Lihat analitik Pipeline BD','Melihat analitik nilai penawaran, deal, conversion, dan win/loss.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key='system_admin'
   or (r.key='executive' and p.key in ('tickets.view','tickets.manage','pipeline.analytics'))
   or (r.key in ('staff','project_lead') and p.key in ('tickets.view','pipeline.analytics'))
on conflict do nothing;

alter table public.pipeline_leads
  add column if not exists proposal_value numeric(18,2) check(proposal_value is null or proposal_value>=0),
  add column if not exists won_value numeric(18,2) check(won_value is null or won_value>=0),
  add column if not exists expected_close_date date,
  add column if not exists won_at timestamptz,
  add column if not exists lost_at timestamptz,
  add column if not exists win_loss_reason text,
  add column if not exists whatsapp_contact text,
  add column if not exists email_contact text,
  add column if not exists linkedin_contact text,
  add column if not exists qual_icp_fit boolean not null default false,
  add column if not exists qual_need boolean not null default false,
  add column if not exists qual_decision_maker boolean not null default false,
  add column if not exists qual_budget boolean not null default false,
  add column if not exists qual_timing boolean not null default false,
  add column if not exists qual_buying_process boolean not null default false,
  add column if not exists qual_service_needed boolean not null default false,
  add column if not exists qualification_outcome text not null default 'pending'
    check(qualification_outcome in ('pending','qualified','disqualified')),
  add column if not exists qualification_reason text;

update public.pipeline_leads
set proposal_value=coalesce(proposal_value,deal_value),
    whatsapp_contact=coalesce(whatsapp_contact,contact_details),
    won_value=case when stage in ('Won','Closed Won','Deal','Paid/Booked') then coalesce(won_value,deal_value) else won_value end,
    won_at=case when stage in ('Won','Closed Won','Deal','Paid/Booked') then coalesce(won_at,updated_at) else won_at end,
    lost_at=case when stage in ('Lost','Closed Lost','Tidak Jadi') then coalesce(lost_at,updated_at) else lost_at end;

create index if not exists pipeline_leads_expected_close_idx on public.pipeline_leads(expected_close_date);
create index if not exists pipeline_leads_won_at_idx on public.pipeline_leads(won_at) where won_at is not null;

create table public.pipeline_contact_events(
  id uuid primary key default extensions.gen_random_uuid(),
  pipeline_lead_id uuid not null references public.pipeline_leads(id) on delete cascade,
  channel text not null check(channel in ('whatsapp','email','linkedin','call','meeting','other')),
  direction text not null default 'outbound' check(direction in ('inbound','outbound')),
  outcome text,
  notes text,
  occurred_at timestamptz not null default now(),
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now()
);
create index pipeline_contact_events_lead_time_idx on public.pipeline_contact_events(pipeline_lead_id,occurred_at desc);

insert into public.pipeline_contact_events(pipeline_lead_id,channel,direction,outcome,occurred_at,created_by_membership_id)
select pl.id,'other','outbound','Riwayat kontak sebelum activity log',pl.last_contact_date::timestamptz,a.owner_membership_id
from public.pipeline_leads pl join public.activities a on a.id=pl.activity_id
where pl.last_contact_date is not null and not exists(select 1 from public.pipeline_contact_events e where e.pipeline_lead_id=pl.id);

create table public.service_tickets(
  id uuid primary key default extensions.gen_random_uuid(),
  ticket_code text not null unique,
  ticket_type text not null check(ticket_type in ('commercial','handover')),
  pipeline_lead_id uuid not null references public.pipeline_leads(id) on delete cascade,
  source_id uuid not null references public.work_sources(id),
  title text not null,
  status text not null default 'open' check(status in ('open','in_progress','accepted','completed','cancelled')),
  assignee_membership_id uuid references public.memberships(id),
  deadline date not null,
  project_id uuid references public.projects(id) on delete set null,
  context jsonb not null default '{}'::jsonb check(jsonb_typeof(context)='object'),
  created_by_membership_id uuid not null references public.memberships(id),
  accepted_by_membership_id uuid references public.memberships(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pipeline_lead_id,ticket_type)
);
create sequence if not exists public.service_ticket_code_seq start 1;
create index service_tickets_status_deadline_idx on public.service_tickets(status,deadline);

create table public.service_ticket_participants(
  ticket_id uuid not null references public.service_tickets(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  participant_role text not null check(participant_role in ('owner','assignee','watcher','approver')),
  added_at timestamptz not null default now(),
  primary key(ticket_id,membership_id,participant_role)
);

create table public.pipeline_saved_views(
  id uuid primary key default extensions.gen_random_uuid(),
  owner_membership_id uuid not null references public.memberships(id) on delete cascade,
  name text not null check(char_length(trim(name)) between 1 and 80),
  filters jsonb not null default '{}'::jsonb check(jsonb_typeof(filters)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_membership_id,name)
);

alter table public.pipeline_contact_events enable row level security;
alter table public.service_tickets enable row level security;
alter table public.service_ticket_participants enable row level security;
alter table public.pipeline_saved_views enable row level security;
revoke all on public.pipeline_contact_events,public.service_tickets,public.service_ticket_participants,public.pipeline_saved_views from anon,authenticated;

create or replace function public.pipeline_prepare_lead()
returns trigger language plpgsql set search_path=public as $$
declare q jsonb; score integer;
begin
  new.proposal_value:=coalesce(nullif(new.extra_data->>'proposal_value','')::numeric,new.proposal_value,new.deal_value);
  new.won_value:=coalesce(nullif(new.extra_data->>'won_value','')::numeric,new.won_value);
  new.expected_close_date:=coalesce(nullif(new.extra_data->>'expected_close_date','')::date,new.expected_close_date);
  new.win_loss_reason:=coalesce(nullif(trim(new.extra_data->>'win_loss_reason'),''),new.win_loss_reason);
  new.whatsapp_contact:=coalesce(nullif(trim(new.extra_data->>'whatsapp_contact'),''),new.whatsapp_contact,new.contact_details);
  new.email_contact:=coalesce(nullif(trim(new.extra_data->>'email_contact'),''),new.email_contact);
  new.linkedin_contact:=coalesce(nullif(trim(new.extra_data->>'linkedin_contact'),''),new.linkedin_contact);
  q:=coalesce(new.extra_data->'qualification','{}'::jsonb);
  new.qual_icp_fit:=coalesce((q->>'icp_fit')::boolean,new.qual_icp_fit,false);
  new.qual_need:=coalesce((q->>'need')::boolean,new.qual_need,false);
  new.qual_decision_maker:=coalesce((q->>'decision_maker')::boolean,new.qual_decision_maker,false);
  new.qual_budget:=coalesce((q->>'budget')::boolean,new.qual_budget,false);
  new.qual_timing:=coalesce((q->>'timing')::boolean,new.qual_timing,false);
  new.qual_buying_process:=coalesce((q->>'buying_process')::boolean,new.qual_buying_process,false);
  new.qual_service_needed:=coalesce((q->>'service_needed')::boolean,new.qual_service_needed,false);
  new.qualification_reason:=coalesce(nullif(trim(q->>'reason'),''),new.qualification_reason);
  score:=new.qual_icp_fit::integer+new.qual_need::integer+new.qual_decision_maker::integer+new.qual_budget::integer+new.qual_timing::integer+new.qual_buying_process::integer+new.qual_service_needed::integer;
  if lower(coalesce(q->>'outcome',''))='disqualified' then
    new.qualification_outcome:='disqualified';
  elsif score>=6 and new.qual_icp_fit and new.qual_need and new.qual_service_needed then
    new.qualification_outcome:='qualified';
  else
    new.qualification_outcome:='pending';
  end if;
  new.qualification_status:=case new.qualification_outcome when 'qualified' then 'Yes' when 'disqualified' then 'No' else 'Pending' end;
  if new.stage in ('Won','Closed Won','Deal','Paid/Booked') then
    new.won_value:=coalesce(new.won_value,new.proposal_value,new.deal_value,0);
    new.won_at:=coalesce(new.won_at,now());
  end if;
  if new.stage in ('Lost','Closed Lost','Tidak Jadi') then new.lost_at:=coalesce(new.lost_at,now()); end if;
  return new;
end; $$;

drop trigger if exists pipeline_prepare_lead_trigger on public.pipeline_leads;
create trigger pipeline_prepare_lead_trigger before insert or update on public.pipeline_leads
for each row execute function public.pipeline_prepare_lead();

create or replace function public.sync_pipeline_tickets()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid; assignee_id uuid; executive_id uuid; watcher_id uuid; ticket_id uuid; source_name text;
begin
  select a.owner_membership_id,ws.name into owner_id,source_name
  from public.activities a join public.work_sources ws on ws.id=new.source_id where a.id=new.activity_id;
  if new.qualification_outcome='qualified' then
    select m.id into assignee_id from public.memberships m join public.positions p on p.id=m.position_id
    where m.status='active' and p.key='business_development_staff' order by m.created_at limit 1;
    assignee_id:=coalesce(assignee_id,owner_id);
    insert into public.service_tickets(ticket_code,ticket_type,pipeline_lead_id,source_id,title,assignee_membership_id,deadline,context,created_by_membership_id)
    values('COM-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.service_ticket_code_seq')::text,6,'0'),'commercial',new.id,new.source_id,'Commercial · '||new.account_name,assignee_id,current_date+interval '3 days',jsonb_build_object('service',source_name,'proposal_value',new.proposal_value,'qualification_reason',new.qualification_reason),owner_id)
    on conflict(pipeline_lead_id,ticket_type) do update set context=excluded.context,updated_at=now()
    returning id into ticket_id;
    insert into public.service_ticket_participants(ticket_id,membership_id,participant_role) values(ticket_id,owner_id,'owner') on conflict do nothing;
    select m.id into executive_id from public.memberships m join public.positions p on p.id=m.position_id where m.status='active' and p.key='ceo' order by m.created_at limit 1;
    if executive_id is not null then insert into public.service_ticket_participants values(ticket_id,executive_id,'approver',now()) on conflict do nothing; end if;
    select m.id into watcher_id from public.memberships m join public.positions p on p.id=m.position_id
    where m.status='active' and p.key=case when lower(source_name) ~ '(digital|coreva)' then 'cto' else 'coo' end order by m.created_at limit 1;
    if watcher_id is not null then insert into public.service_ticket_participants values(ticket_id,watcher_id,'watcher',now()) on conflict do nothing; end if;
  end if;
  if new.stage in ('Won','Closed Won','Deal','Paid/Booked') then
    select m.id into assignee_id from public.memberships m join public.positions p on p.id=m.position_id
    where m.status='active' and p.key=case when lower(source_name) ~ '(digital|coreva)' then 'cto' else 'coo' end order by m.created_at limit 1;
    insert into public.service_tickets(ticket_code,ticket_type,pipeline_lead_id,source_id,title,assignee_membership_id,deadline,context,created_by_membership_id)
    values('HOV-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.service_ticket_code_seq')::text,6,'0'),'handover',new.id,new.source_id,'Handover · '||new.account_name,assignee_id,current_date+interval '2 days',jsonb_build_object('service',source_name,'won_value',new.won_value,'document_url',new.document_url,'notes',new.notes),owner_id)
    on conflict(pipeline_lead_id,ticket_type) do update set context=excluded.context,updated_at=now()
    returning id into ticket_id;
    insert into public.service_ticket_participants(ticket_id,membership_id,participant_role) values(ticket_id,owner_id,'owner') on conflict do nothing;
    if assignee_id is not null then insert into public.service_ticket_participants values(ticket_id,assignee_id,'assignee',now()) on conflict do nothing; end if;
  end if;
  return new;
end; $$;

drop trigger if exists pipeline_ticket_sync_trigger on public.pipeline_leads;
create trigger pipeline_ticket_sync_trigger after insert or update of qualification_outcome,stage,proposal_value,won_value on public.pipeline_leads
for each row execute function public.sync_pipeline_tickets();

create or replace function public.refresh_pipeline_contact_metrics()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.pipeline_leads set
    follow_up_count=(select count(*) from public.pipeline_contact_events where pipeline_lead_id=new.pipeline_lead_id and direction='outbound'),
    last_contact_date=(select max(occurred_at)::date from public.pipeline_contact_events where pipeline_lead_id=new.pipeline_lead_id),
    updated_at=now()
  where id=new.pipeline_lead_id;
  return new;
end; $$;
create trigger pipeline_contact_metrics_trigger after insert or update on public.pipeline_contact_events
for each row execute function public.refresh_pipeline_contact_metrics();

create or replace function public.list_pipeline_leads()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(pl)||jsonb_build_object(
    'weighted_value',round(coalesce(pl.proposal_value,0)*coalesce(pl.probability,0),2),
    'potential_revenue',round(coalesce(pl.seats,0)*coalesce(pl.price_per_person,0),2),
    'owner_membership_id',a.owner_membership_id,'assigned_by_membership_id',a.assigned_by_membership_id,
    'workflow_status',a.status,'progress',a.progress,'linked_kpi',a.linked_kpi,
    'owner_name',coalesce(m.full_name,m.email::text),'source_name',ws.name,'source_color',ws.color,'source_config',ws.module_config,
    'commercial_ticket_id',(select id from public.service_tickets t where t.pipeline_lead_id=pl.id and t.ticket_type='commercial'),
    'handover_ticket_id',(select id from public.service_tickets t where t.pipeline_lead_id=pl.id and t.ticket_type='handover')
  ) order by pl.due_date,pl.created_at desc),'[]'::jsonb)
  from public.pipeline_leads pl join public.activities a on a.id=pl.activity_id
  join public.work_sources ws on ws.id=pl.source_id join public.memberships m on m.id=a.owner_membership_id
  where public.current_user_has_permission('pipeline.view') and public.can_access_work_source(pl.source_id);
$$;

create or replace function public.log_pipeline_contact(target_pipeline_lead_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); event_id uuid; lead public.pipeline_leads%rowtype;
begin
  select * into lead from public.pipeline_leads where id=target_pipeline_lead_id;
  if actor_id is null or lead.id is null or not public.can_access_activity(lead.activity_id) then raise exception 'Lead tidak dapat diakses.' using errcode='42501'; end if;
  insert into public.pipeline_contact_events(pipeline_lead_id,channel,direction,outcome,notes,occurred_at,created_by_membership_id)
  values(lead.id,coalesce(nullif(payload->>'channel',''),'other'),coalesce(nullif(payload->>'direction',''),'outbound'),nullif(trim(payload->>'outcome'),''),nullif(trim(payload->>'notes'),''),coalesce(nullif(payload->>'occurred_at','')::timestamptz,now()),actor_id)
  returning id into event_id;
  return event_id;
end; $$;

create or replace function public.pipeline_ticket_workspace()
returns jsonb language sql stable security definer set search_path=public as $$
  select case when public.current_user_has_permission('tickets.view') or public.current_user_has_permission('pipeline.view') then
    coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('account_name',pl.account_name,'lead_code',pl.lead_code,'stage',pl.stage,'source_name',ws.name,'source_color',ws.color,'assignee_name',coalesce(am.full_name,am.email::text),'owner_name',coalesce(om.full_name,om.email::text),'can_accept',t.ticket_type='handover' and t.status in ('open','in_progress') and (t.assignee_membership_id=public.current_membership_id() or public.current_user_has_permission('projects.create'))) order by case t.status when 'open' then 0 when 'in_progress' then 1 else 2 end,t.deadline),'[]'::jsonb)
    else '[]'::jsonb end
  from public.service_tickets t join public.pipeline_leads pl on pl.id=t.pipeline_lead_id
  join public.activities a on a.id=pl.activity_id join public.memberships om on om.id=a.owner_membership_id
  join public.work_sources ws on ws.id=t.source_id left join public.memberships am on am.id=t.assignee_membership_id
  where public.can_access_work_source(t.source_id);
$$;

create or replace function public.accept_handover_ticket(target_ticket_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); t public.service_tickets%rowtype; pl public.pipeline_leads%rowtype; project_source uuid; project_uuid uuid; owner_id uuid; project_type text;
begin
  select * into t from public.service_tickets where id=target_ticket_id for update;
  if t.id is null or t.ticket_type<>'handover' then raise exception 'Handover ticket tidak ditemukan.'; end if;
  if t.project_id is not null then return t.project_id; end if;
  if actor_id is null or (t.assignee_membership_id<>actor_id and not public.current_user_has_permission('projects.create')) then raise exception 'Handover hanya dapat diterima COO/CTO yang ditugaskan.' using errcode='42501'; end if;
  select * into pl from public.pipeline_leads where id=t.pipeline_lead_id;
  select a.owner_membership_id into owner_id from public.activities a where a.id=pl.activity_id;
  select id into project_source from public.work_sources where key='project_management';
  select case when lower(ws.name) like '%event%' then 'Event' when lower(ws.name) ~ '(digital|coreva)' then 'Digital System' when lower(ws.name) like '%training%' then 'Training' else 'Other' end into project_type from public.work_sources ws where ws.id=t.source_id;
  insert into public.projects(source_id,project_code,name,client_name,project_type,origin_label,origin_record_id,phase,status,priority,start_date,target_end_date,objective,budget_amount,extra_data,created_by_membership_id,updated_by_membership_id)
  values(project_source,'CI-PRJ-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.project_code_seq')::text,6,'0'),pl.account_name||' · '||(select name from public.work_sources where id=pl.source_id),pl.account_name,project_type,'Pipeline BD',pl.id::text,'Handover','Active',case lower(pl.priority) when 'high' then 'high' when 'low' then 'low' else 'medium' end,current_date,pl.expected_close_date,pl.notes,coalesce(pl.won_value,0),jsonb_build_object('pipeline_lead_id',pl.id,'handover_ticket_id',t.id),actor_id,actor_id)
  returning id into project_uuid;
  insert into public.project_members(project_id,membership_id,project_role,can_manage_members,added_by_membership_id) values(project_uuid,actor_id,'project_lead',true,actor_id);
  if owner_id<>actor_id then insert into public.project_members(project_id,membership_id,project_role,can_manage_members,added_by_membership_id) values(project_uuid,owner_id,'project_sponsor',false,actor_id) on conflict do nothing; end if;
  insert into public.project_records(project_id,record_type,title,status,owner_membership_id,due_date,content,created_by_membership_id)
  values(project_uuid,'handover','Handover dari Business Development','open',actor_id,t.deadline,t.context,actor_id);
  update public.service_tickets set status='accepted',project_id=project_uuid,accepted_by_membership_id=actor_id,accepted_at=now(),updated_at=now() where id=t.id;
  return project_uuid;
end; $$;

create or replace function public.list_pipeline_saved_views()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(v) order by v.name),'[]'::jsonb) from public.pipeline_saved_views v where v.owner_membership_id=public.current_membership_id();
$$;
create or replace function public.save_pipeline_view(target_id uuid,target_name text,target_filters jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); saved_id uuid;
begin
  if actor_id is null then raise exception 'Sesi tidak valid.' using errcode='42501'; end if;
  if target_id is null then insert into public.pipeline_saved_views(owner_membership_id,name,filters) values(actor_id,trim(target_name),coalesce(target_filters,'{}')) returning id into saved_id;
  else update public.pipeline_saved_views set name=trim(target_name),filters=coalesce(target_filters,'{}'),updated_at=now() where id=target_id and owner_membership_id=actor_id returning id into saved_id; end if;
  if saved_id is null then raise exception 'View tidak dapat disimpan.' using errcode='42501'; end if;
  return saved_id;
end; $$;

create or replace function public.bulk_update_pipeline_leads(target_ids uuid[],payload jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=public.current_membership_id(); lead_id uuid; updated_count integer:=0; lead public.pipeline_leads%rowtype; next_stage text;
begin
  if actor_id is null or cardinality(target_ids)>200 then raise exception 'Bulk action maksimal 200 lead.'; end if;
  foreach lead_id in array target_ids loop
    select * into lead from public.pipeline_leads where id=lead_id;
    if lead.id is null or not public.can_access_activity(lead.activity_id) then continue; end if;
    next_stage:=coalesce(nullif(payload->>'stage',''),lead.stage);
    perform public.quick_update_pipeline_lead(lead.id,next_stage,coalesce(nullif(payload->>'next_action',''),lead.next_action),coalesce(nullif(payload->>'due_date','')::date,lead.due_date));
    updated_count:=updated_count+1;
  end loop;
  return updated_count;
end; $$;

-- Remove only unpromoted Prospect Inbox duplicates that are still untouched Targets.
insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,before_data,reason)
select null,'pipeline_duplicate_removed','pipeline_lead',pl.id::text,to_jsonb(pl),'Nama sudah tersedia di Prospect Inbox; lead dikembalikan ke pre-pipeline review.'
from public.pipeline_leads pl where pl.stage='Target'
and exists(select 1 from public.prospects p where regexp_replace(lower(trim(p.account_name)),'[^a-z0-9]+','','g')=regexp_replace(lower(trim(pl.account_name)),'[^a-z0-9]+','','g'))
and not exists(select 1 from public.prospects p where p.promoted_lead_id=pl.id);

delete from public.activities a using public.pipeline_leads pl
where pl.activity_id=a.id and pl.stage='Target'
and exists(select 1 from public.prospects p where regexp_replace(lower(trim(p.account_name)),'[^a-z0-9]+','','g')=regexp_replace(lower(trim(pl.account_name)),'[^a-z0-9]+','','g'))
and not exists(select 1 from public.prospects p where p.promoted_lead_id=pl.id);

-- Normalize final service names and remove delivery phases from the sales funnel.
update public.pipeline_leads set stage='Won' where source_id in (select id from public.work_sources where key in ('ds','pipeline_coreva')) and stage in ('Development','Testing / UAT','Handover','Onboarding','Active');
update public.work_sources set name='Digital Transformation',description='Pipeline penjualan layanan transformasi dan sistem digital.',module_config=module_config||jsonb_build_object('stages',jsonb_build_array('Target','Researched','Outreach','Replied','Qualified','Meeting','Proposal','Negotiation','Decision','Won','Lost','Nurture'),'closed_stages',jsonb_build_array('Won','Lost')) where key='ds';
update public.work_sources set name='COREVA ERP Organisasi',module_config=module_config||jsonb_build_object('stages',jsonb_build_array('Target','Researched','Outreach','Replied','Qualified','Meeting','Proposal','Negotiation','Decision','Won','Lost','Nurture'),'closed_stages',jsonb_build_array('Won','Lost')) where key='pipeline_coreva';
update public.work_sources set name='Stripmate Trip & Community' where key='pipeline_stripmate';
update public.work_sources set module_config=module_config||jsonb_build_object('stages',jsonb_build_array('Target','Researched','Outreach','Replied','Qualified','Meeting','Proposal','Negotiation','Decision','Won','Lost','Nurture'),'closed_stages',jsonb_build_array('Won','Lost')) where key='pipeline_bd';

insert into public.work_sources(key,name,description,color,icon,source_kind,module_type,module_config,allowed_position_keys,sort_order) values
('pipeline_training','Training & Development','Pipeline penjualan training dan pengembangan kapasitas.','#b66a3c','pipeline','system','pipeline',jsonb_build_object('pipeline_kind','institution','lead_prefix','TRN','business_units',jsonb_build_array('Training & Development'),'stages',jsonb_build_array('Target','Researched','Outreach','Replied','Qualified','Meeting','Proposal','Negotiation','Decision','Won','Lost','Nurture'),'closed_stages',jsonb_build_array('Won','Lost'),'priorities',jsonb_build_array('High','Medium','Low'),'activity_types',jsonb_build_array('Research','Outreach','Follow Up','Meeting Preparation','Proposal/Deck Draft','Negotiation','Waiting Reply','Other'),'kpi_options',jsonb_build_array('Outreach','Follow Up','Qualified Meeting')),array['business_development_staff','ceo','coo'],35),
('pipeline_program','Program Development','Pipeline penjualan program dan kolaborasi pengembangan.','#92703f','pipeline','system','pipeline',jsonb_build_object('pipeline_kind','institution','lead_prefix','PRG','business_units',jsonb_build_array('Program Development'),'stages',jsonb_build_array('Target','Researched','Outreach','Replied','Qualified','Meeting','Proposal','Negotiation','Decision','Won','Lost','Nurture'),'closed_stages',jsonb_build_array('Won','Lost'),'priorities',jsonb_build_array('High','Medium','Low'),'activity_types',jsonb_build_array('Research','Outreach','Follow Up','Meeting Preparation','Proposal/Deck Draft','Negotiation','Waiting Reply','Other'),'kpi_options',jsonb_build_array('Outreach','Follow Up','Qualified Meeting')),array['business_development_staff','ceo','coo'],36)
on conflict(key) do update set name=excluded.name,description=excluded.description,module_config=excluded.module_config,allowed_position_keys=excluded.allowed_position_keys;

-- Backfill tickets after the supporting tables and trigger exist.
update public.pipeline_leads set qualification_outcome=qualification_outcome,stage=stage;

revoke all on function public.list_pipeline_leads(),public.log_pipeline_contact(uuid,jsonb),public.pipeline_ticket_workspace(),public.accept_handover_ticket(uuid),public.list_pipeline_saved_views(),public.save_pipeline_view(uuid,text,jsonb),public.bulk_update_pipeline_leads(uuid[],jsonb) from public,anon;
grant execute on function public.list_pipeline_leads(),public.log_pipeline_contact(uuid,jsonb),public.pipeline_ticket_workspace(),public.accept_handover_ticket(uuid),public.list_pipeline_saved_views(),public.save_pipeline_view(uuid,text,jsonb),public.bulk_update_pipeline_leads(uuid[],jsonb) to authenticated;
