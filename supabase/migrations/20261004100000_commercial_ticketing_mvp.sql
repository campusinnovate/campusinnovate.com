-- Commercial ticketing MVP integrated with existing Pipeline and Kawan Chat.
-- Pipeline remains the source of truth for lead/account data; tickets add workflow only.

insert into public.permissions(key,name,description) values
 ('ticketing.view','Lihat Commercial Ticket','Melihat ticket yang terkait dengan lead yang dapat diakses.'),
 ('ticketing.manage','Kelola Commercial Ticket','Mengelola detail, anggota, dan checklist commercial ticket.'),
 ('ticketing.contribute','Berkontribusi pada Commercial Ticket','Memperbarui checklist pada ticket yang ditugaskan.'),
 ('ticketing.transition','Pindahkan fase Commercial Ticket','Mengajukan dan melakukan perpindahan fase commercial ticket.'),
 ('ticketing.configure','Konfigurasi Ticketing','Mengelola template layanan dan aturan ticketing.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.key='system_admin' and p.key like 'ticketing.%')
   or (r.key='executive' and p.key in ('ticketing.view','ticketing.manage','ticketing.transition','ticketing.configure'))
   or (r.key='business_development_staff' and p.key in ('ticketing.view','ticketing.manage','ticketing.transition'))
   or (r.key in ('staff','project_lead') and p.key in ('ticketing.view','ticketing.contribute'))
on conflict do nothing;

insert into public.position_permissions(position_id,permission_id)
select pos.id,p.id from public.positions pos cross join public.permissions p
where (pos.key='business_development_staff' and p.key in ('ticketing.view','ticketing.manage','ticketing.transition'))
   or (pos.key='ceo' and p.key in ('ticketing.view','ticketing.manage','ticketing.transition','ticketing.configure'))
   or (pos.key in('coo','cto') and p.key in ('ticketing.view','projects.view','projects.create'))
on conflict do nothing;

-- COO and CTO are the designated acceptance roles in the ticketing handover flow.
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in('coo','cto') and p.key in('projects.view','projects.create','ticketing.view')
on conflict do nothing;

create table public.commercial_tickets(
 id uuid primary key default extensions.gen_random_uuid(),
 ticket_code text not null unique,
 pipeline_lead_id uuid not null unique references public.pipeline_leads(id) on delete cascade,
 phase text not null default 'commercial' check(phase in ('commercial','proposal_deal','handover','delivery','report_close')),
 ticket_status text not null default 'open' check(ticket_status in ('open','in_progress','waiting_client','blocked','handover','closed_won','closed_lost')),
 service_main text not null default 'Strategy',
 phase_owner_membership_id uuid not null references public.memberships(id),
 phase_deadline date not null,
 next_action text not null,
 next_action_due date not null,
 blocker text,
 conversation_id uuid unique references public.chat_conversations(id) on delete set null,
 project_id uuid unique references public.projects(id) on delete set null,
 created_by_membership_id uuid not null references public.memberships(id),
 updated_by_membership_id uuid not null references public.memberships(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index commercial_tickets_phase_idx on public.commercial_tickets(phase,phase_deadline);
create index commercial_tickets_owner_idx on public.commercial_tickets(phase_owner_membership_id,phase_deadline);

create table public.commercial_ticket_members(
 ticket_id uuid not null references public.commercial_tickets(id) on delete cascade,
 membership_id uuid not null references public.memberships(id),
 member_role text not null check(member_role in ('assignee','watcher','approver')),
 created_by_membership_id uuid not null references public.memberships(id),
 created_at timestamptz not null default now(),
 primary key(ticket_id,membership_id,member_role)
);

create table public.commercial_ticket_checklist(
 id uuid primary key default extensions.gen_random_uuid(),
 ticket_id uuid not null references public.commercial_tickets(id) on delete cascade,
 phase text not null check(phase in ('commercial','proposal_deal','handover','delivery','report_close')),
 label text not null,
 required boolean not null default true,
 completed_at timestamptz,
 completed_by_membership_id uuid references public.memberships(id),
 evidence text,
 sort_order integer not null default 100,
 unique(ticket_id,phase,label)
);

create table public.commercial_ticket_events(
 id bigint generated always as identity primary key,
 ticket_id uuid not null references public.commercial_tickets(id) on delete cascade,
 actor_membership_id uuid not null references public.memberships(id),
 action text not null,
 before_data jsonb,
 after_data jsonb,
 reason text,
 created_at timestamptz not null default now()
);
create index commercial_ticket_events_ticket_idx on public.commercial_ticket_events(ticket_id,created_at desc);

create or replace function public.commercial_ticket_service(value text)
returns text language sql immutable as $$
 select case lower(coalesce(value,''))
  when 'event' then 'Event Management'
  when 'eo/event experience' then 'Event Management'
  when 'event management' then 'Event Management'
  when 'event management / event operation' then 'Event Management'
  when 'sistem digital' then 'Digital System'
  when 'digital system' then 'Digital System'
  when 'website/landing page' then 'Digital System'
  when 'program' then 'Program Development'
  when 'program development' then 'Program Development'
  when 'capacity building' then 'Training & Capacity Building'
  when 'training & capacity building' then 'Training & Capacity Building'
  when 'creative' then 'Creative Production'
  when 'creative production' then 'Creative Production'
  when 'strategy' then 'Strategy'
  else 'Strategy' end;
$$;

create or replace function public.create_commercial_ticket_for_qualified_lead()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid; ticket_id uuid; ticket_no text; svc text; src_name text;
begin
 if new.stage <> 'Qualified' or exists(select 1 from public.commercial_tickets where pipeline_lead_id=new.id) then return new; end if;
 select a.owner_membership_id, ws.name into owner_id,src_name
 from public.activities a join public.work_sources ws on ws.id=a.source_id where a.id=new.activity_id;
 if owner_id is null then return new; end if;
 svc:=public.commercial_ticket_service(coalesce(new.business_unit,src_name));
 ticket_no:='CT-'||to_char(now() at time zone 'Asia/Jakarta','YYMMDD')||'-'||upper(substr(replace(new.id::text,'-',''),1,6));
 insert into public.commercial_tickets(ticket_code,pipeline_lead_id,phase,ticket_status,service_main,phase_owner_membership_id,phase_deadline,next_action,next_action_due,created_by_membership_id,updated_by_membership_id)
 values(ticket_no,new.id,'commercial','open',svc,owner_id,new.due_date,new.next_action,new.due_date,owner_id,owner_id)
 on conflict(pipeline_lead_id) do nothing returning id into ticket_id;
 if ticket_id is not null then
  insert into public.commercial_ticket_checklist(ticket_id,phase,label,sort_order) values
   (ticket_id,'commercial','Account, PIC, dan sumber lead tercatat',10),
   (ticket_id,'commercial','Discovery outcome dan kebutuhan/decision process dicatat',20),
   (ticket_id,'commercial','Next action dan deadline tersedia',30),
   (ticket_id,'proposal_deal','Scope, effort, timeline, risiko, dan pricing tercatat',10),
   (ticket_id,'proposal_deal','Proposal final dan approval yang diperlukan tercatat',20),
   (ticket_id,'proposal_deal','Hasil negosiasi atau komitmen client terdokumentasi',30),
   (ticket_id,'handover','Brief, scope/exclusions, terms, timeline, dan dependency siap',10),
   (ticket_id,'handover','Risiko, dokumen, dan konteks client disiapkan',20),
   (ticket_id,'handover','Service lead menerima handover',30),
   (ticket_id,'delivery','Readiness dan delivery milestone selesai',10),
   (ticket_id,'delivery','Output dan evidence delivery ditautkan',20),
   (ticket_id,'delivery','Perubahan scope disetujui dan dicatat',30),
   (ticket_id,'report_close','Final report tersedia',10),
   (ticket_id,'report_close','Client feedback tercatat',20),
   (ticket_id,'report_close','Invoice/settlement status tercatat',30),
   (ticket_id,'report_close','Lessons learned tercatat',40);
  insert into public.commercial_ticket_events(ticket_id,actor_membership_id,action,after_data)
  values(ticket_id,owner_id,'ticket_created_from_qualified',jsonb_build_object('pipeline_lead_id',new.id,'ticket_code',ticket_no,'service_main',svc));
 end if;
 return new;
end $$;
create trigger pipeline_qualified_creates_ticket after insert or update of stage on public.pipeline_leads
for each row execute function public.create_commercial_ticket_for_qualified_lead();
-- Backfill current Qualified leads using their existing owner, source and due date.
update public.pipeline_leads set stage=stage where stage='Qualified';

create or replace function public.ticketing_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); rows jsonb;
begin
 if not public.current_user_has_permission('ticketing.view') then raise exception 'Akses ticketing tidak tersedia.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',t.id,'ticket_code',t.ticket_code,'pipeline_lead_id',t.pipeline_lead_id,'phase',t.phase,'ticket_status',t.ticket_status,
  'service_main',t.service_main,'phase_owner_membership_id',t.phase_owner_membership_id,'phase_deadline',t.phase_deadline,
  'next_action',t.next_action,'next_action_due',t.next_action_due,'blocker',t.blocker,'conversation_id',t.conversation_id,'project_id',t.project_id,'project_conversation_id',t.project_conversation_id,
  'account_name',pl.account_name,'lead_code',pl.lead_code,'stage',pl.stage,'lead_source',pl.lead_source,'deal_value',pl.deal_value,
  'owner_name',coalesce(m.full_name,m.email::text),
  'can_accept_handover',t.phase='handover' and public.current_user_has_permission('projects.create') and exists(select 1 from public.memberships me join public.positions pos on pos.id=me.position_id where me.id=actor and (pos.key=case when t.service_main='Event Management' then 'coo' when t.service_main='Digital System' then 'cto' else pos.key end)),
  'can_contribute',public.current_user_has_permission('ticketing.manage') or (public.current_user_has_permission('ticketing.contribute') and (t.phase_owner_membership_id=actor or exists(select 1 from public.commercial_ticket_members own where own.ticket_id=t.id and own.membership_id=actor and own.member_role in('assignee','approver')))),
  'checklist',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'phase',c.phase,'label',c.label,'required',c.required,'done',c.completed_at is not null,'evidence',c.evidence) order by c.sort_order),'[]'::jsonb) from public.commercial_ticket_checklist c where c.ticket_id=t.id),
  'members',(select coalesce(jsonb_agg(jsonb_build_object('membership_id',tm.membership_id,'name',coalesce(mm.full_name,mm.email::text),'member_role',tm.member_role)),'[]'::jsonb) from public.commercial_ticket_members tm join public.memberships mm on mm.id=tm.membership_id where tm.ticket_id=t.id),
  'conversation_name',(select name from public.chat_conversations where id=t.conversation_id),
  'project_code',(select project_code from public.projects where id=t.project_id)
 ) order by t.phase_deadline,t.created_at desc),'[]'::jsonb) into rows
 from public.commercial_tickets t join public.pipeline_leads pl on pl.id=t.pipeline_lead_id
 join public.activities a on a.id=pl.activity_id join public.memberships m on m.id=t.phase_owner_membership_id
 where public.can_access_activity(a.id) or t.phase_owner_membership_id=actor
   or (t.phase='handover' and public.current_user_has_permission('projects.create') and (t.service_main not in('Event Management','Digital System') or exists(select 1 from public.memberships hm join public.positions hp on hp.id=hm.position_id where hm.id=actor and hp.key=case when t.service_main='Event Management' then 'coo' else 'cto' end)))
   or exists(select 1 from public.commercial_ticket_members x where x.ticket_id=t.id and x.membership_id=actor);
 return jsonb_build_object('tickets',rows,'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'position',p.name) order by coalesce(m.full_name,m.email::text)),'[]'::jsonb) from public.memberships m left join public.positions p on p.id=m.position_id where m.status='active'),'can_manage',public.current_user_has_permission('ticketing.manage'),'can_contribute',public.current_user_has_permission('ticketing.contribute'),'can_transition',public.current_user_has_permission('ticketing.transition'));
end $$;

create or replace function public.update_commercial_ticket(target_ticket_id uuid,payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); t public.commercial_tickets%rowtype; before_json jsonb; reason_text text:=nullif(trim(payload->>'change_reason'),'');
begin
 if not public.current_user_has_permission('ticketing.manage') then raise exception 'Izin mengelola ticket diperlukan.' using errcode='42501'; end if;
 select * into t from public.commercial_tickets where id=target_ticket_id for update;
 if not found then raise exception 'Ticket tidak ditemukan.'; end if;
 if not exists(select 1 from public.pipeline_leads pl join public.activities a on a.id=pl.activity_id where pl.id=t.pipeline_lead_id and public.can_access_activity(a.id)) and t.phase_owner_membership_id<>actor then raise exception 'Ticket tidak dapat diakses.' using errcode='42501'; end if;
 before_json:=to_jsonb(t);
 if (nullif(payload->>'phase_deadline','')::date is distinct from t.phase_deadline or nullif(payload->>'next_action_due','')::date is distinct from t.next_action_due) and length(coalesce(reason_text,''))<5 then raise exception 'Perubahan deadline wajib disertai alasan minimal 5 karakter.'; end if;
 update public.commercial_tickets set service_main=coalesce(nullif(trim(payload->>'service_main'),''),service_main),
  phase_owner_membership_id=coalesce(nullif(payload->>'phase_owner_membership_id','')::uuid,phase_owner_membership_id),
  phase_deadline=coalesce(nullif(payload->>'phase_deadline','')::date,phase_deadline),
  next_action=coalesce(nullif(trim(payload->>'next_action'),''),next_action),
  next_action_due=coalesce(nullif(payload->>'next_action_due','')::date,next_action_due),
  ticket_status=coalesce(nullif(payload->>'ticket_status',''),ticket_status),
  blocker=nullif(trim(payload->>'blocker'),''),updated_by_membership_id=actor,updated_at=now()
 where id=target_ticket_id;
 insert into public.commercial_ticket_events(ticket_id,actor_membership_id,action,before_data,after_data,reason)
 select target_ticket_id,actor,'ticket_updated',before_json,to_jsonb(t),reason_text from public.commercial_tickets t where t.id=target_ticket_id;
end $$;

create or replace function public.set_commercial_ticket_checklist(target_checklist_id uuid,is_done boolean,evidence_text text default null)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); t_id uuid; before_row jsonb; after_row jsonb;
begin
 select c.ticket_id,to_jsonb(c) into t_id,before_row from public.commercial_ticket_checklist c where id=target_checklist_id;
 if t_id is null then raise exception 'Checklist tidak ditemukan.'; end if;
 if not public.current_user_has_permission('ticketing.manage') and not (public.current_user_has_permission('ticketing.contribute') and exists(select 1 from public.commercial_tickets t where t.id=t_id and (t.phase_owner_membership_id=actor or exists(select 1 from public.commercial_ticket_members m where m.ticket_id=t.id and m.membership_id=actor and m.member_role in('assignee','approver'))))) then raise exception 'Checklist ticket ini tidak dapat diubah oleh akun Anda.' using errcode='42501'; end if;
 update public.commercial_ticket_checklist set completed_at=case when is_done then now() else null end,completed_by_membership_id=case when is_done then actor else null end,evidence=nullif(trim(evidence_text), '') where id=target_checklist_id returning to_jsonb(commercial_ticket_checklist) into after_row;
 insert into public.commercial_ticket_events(ticket_id,actor_membership_id,action,before_data,after_data) values(t_id,actor,'checklist_updated',before_row,after_row);
end $$;

create or replace function public.transition_commercial_ticket(target_ticket_id uuid,target_phase text,transition_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); t public.commercial_tickets%rowtype; next_phase text; missing text;
begin
 if not public.current_user_has_permission('ticketing.transition') then raise exception 'Hanya BD/CEO yang dapat memindahkan fase.' using errcode='42501'; end if;
 if target_phase not in('proposal_deal','handover','delivery','report_close') then raise exception 'Fase tujuan tidak valid.'; end if;
 select * into t from public.commercial_tickets where id=target_ticket_id for update;
 next_phase:=case t.phase when 'commercial' then 'proposal_deal' when 'proposal_deal' then 'handover' when 'handover' then 'delivery' when 'delivery' then 'report_close' else null end;
 if target_phase is distinct from next_phase then raise exception 'Fase harus dipindahkan berurutan.'; end if;
 select string_agg(label,', ' order by sort_order) into missing from public.commercial_ticket_checklist where ticket_id=t.id and phase=t.phase and required and completed_at is null;
 if missing is not null and length(trim(coalesce(transition_reason,'')))<5 then raise exception 'Gate belum lengkap: %. Lengkapi checklist atau berikan alasan override minimal 5 karakter.',missing; end if;
 update public.commercial_tickets set phase=target_phase,phase_deadline=next_action_due,updated_by_membership_id=actor,updated_at=now() where id=t.id;
 insert into public.commercial_ticket_events(ticket_id,actor_membership_id,action,before_data,after_data,reason)
 values(t.id,actor,case when missing is null then 'phase_transition' else 'phase_override' end,to_jsonb(t),jsonb_build_object('phase',target_phase,'phase_deadline',t.next_action_due),nullif(trim(transition_reason),''));
end $$;

create or replace function public.add_commercial_ticket_members(target_ticket_id uuid,member_ids uuid[],target_role text)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); t public.commercial_tickets%rowtype; cid uuid;
begin
 if not public.current_user_has_permission('ticketing.manage') then raise exception 'Izin mengelola ticket diperlukan.' using errcode='42501'; end if;
 if target_role not in('assignee','watcher','approver') then raise exception 'Tipe anggota tidak valid.'; end if;
 select * into t from public.commercial_tickets where id=target_ticket_id for update;
 if not found then raise exception 'Ticket tidak ditemukan.'; end if;
 insert into public.commercial_ticket_members(ticket_id,membership_id,member_role,created_by_membership_id)
 select t.id,x,target_role,actor from unnest(coalesce(member_ids,'{}'::uuid[])) x where x<>t.phase_owner_membership_id on conflict do nothing;
 if t.conversation_id is null and exists(select 1 from public.commercial_ticket_members where ticket_id=t.id and member_role in('assignee','watcher') and membership_id<>t.phase_owner_membership_id) then
  insert into public.chat_conversations(name,kind,created_by_membership_id) values(t.ticket_code||' · '||(select account_name from public.pipeline_leads where id=t.pipeline_lead_id),'group',actor) returning id into cid;
  insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level) values(cid,t.phase_owner_membership_id,'owner','all');
  insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level)
   select cid,membership_id,'member','mentions' from public.commercial_ticket_members where ticket_id=t.id and member_role in('assignee','watcher') on conflict do nothing;
  update public.commercial_tickets set conversation_id=cid where id=t.id;
  insert into public.chat_relations(conversation_id,relation_type,relation_id,title,url,metadata,created_by_membership_id)
   values(cid,'pipeline',t.pipeline_lead_id,t.ticket_code,'/ruang-kawan/ticketing/',jsonb_build_object('ticket_id',t.id,'phase',t.phase,'account_name',(select account_name from public.pipeline_leads where id=t.pipeline_lead_id)),actor);
 elsif t.conversation_id is not null then
  insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level)
   select t.conversation_id,x,'member','mentions' from unnest(coalesce(member_ids,'{}'::uuid[])) x on conflict do nothing;
 end if;
 insert into public.commercial_ticket_events(ticket_id,actor_membership_id,action,after_data) values(t.id,actor,'members_added',jsonb_build_object('member_ids',member_ids,'role',target_role));
end $$;

alter table public.commercial_tickets enable row level security;
alter table public.commercial_ticket_members enable row level security;
alter table public.commercial_ticket_checklist enable row level security;
alter table public.commercial_ticket_events enable row level security;
revoke all on public.commercial_tickets,public.commercial_ticket_members,public.commercial_ticket_checklist,public.commercial_ticket_events from anon,authenticated;
revoke all on function public.ticketing_workspace(),public.update_commercial_ticket(uuid,jsonb),public.set_commercial_ticket_checklist(uuid,boolean,text),public.transition_commercial_ticket(uuid,text,text),public.add_commercial_ticket_members(uuid,uuid[],text) from public,anon;
grant execute on function public.ticketing_workspace(),public.update_commercial_ticket(uuid,jsonb),public.set_commercial_ticket_checklist(uuid,boolean,text),public.transition_commercial_ticket(uuid,text,text),public.add_commercial_ticket_members(uuid,uuid[],text) to authenticated;

-- Handover acceptance activates the existing Project Management record and Kawan Chat space.
alter table public.commercial_tickets add column project_conversation_id uuid unique references public.chat_conversations(id) on delete set null;

create or replace function public.accept_commercial_handover(target_ticket_id uuid,target_project_lead_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); t public.commercial_tickets%rowtype; lead public.pipeline_leads%rowtype;
 position_key text; project_uuid uuid; project_chat uuid; source_uuid uuid; svc_type text;
begin
 select * into t from public.commercial_tickets where id=target_ticket_id for update;
 if not found or t.phase<>'handover' then raise exception 'Ticket belum berada pada fase handover.'; end if;
 if t.project_id is not null then return t.project_id; end if;
 if not public.current_user_has_permission('projects.create') then raise exception 'Akses service lead diperlukan untuk menerima handover.' using errcode='42501'; end if;
 select pos.key into position_key from public.memberships m left join public.positions pos on pos.id=m.position_id where m.id=actor;
 if t.service_main='Event Management' and position_key<>'coo' and not public.current_user_has_permission('access.manage') then raise exception 'Handover Event harus diterima COO.' using errcode='42501'; end if;
 if t.service_main='Digital System' and position_key<>'cto' and not public.current_user_has_permission('access.manage') then raise exception 'Handover Digital System harus diterima CTO.' using errcode='42501'; end if;
 if not exists(select 1 from public.memberships where id=target_project_lead_id and status='active') then raise exception 'Project Lead harus merupakan staf aktif.'; end if;
 if exists(select 1 from public.commercial_ticket_checklist where ticket_id=t.id and phase='handover' and required and completed_at is null and label<>'Service lead menerima handover') then raise exception 'Checklist handover masih memiliki item wajib yang belum lengkap.'; end if;
 select * into lead from public.pipeline_leads where id=t.pipeline_lead_id;
 select id into source_uuid from public.work_sources where key='project_management' and is_active;
 if source_uuid is null then raise exception 'Sumber Project Management tidak tersedia.'; end if;
 svc_type:=case when t.service_main='Training & Capacity Building' then 'Training' when t.service_main='Event Management' then 'Event' when t.service_main='Digital System' then 'Digital System' when t.service_main='Program Development' then 'Internal Program' else 'Other' end;
 project_uuid:=public.save_project(null,jsonb_build_object('source_id',source_uuid,'name',lead.account_name,'client_name',lead.account_name,'project_type',svc_type,'origin_label','Commercial Ticket','origin_record_id',t.id::text,'phase','Setup','status','Active','priority',lower(lead.priority),'start_date',current_date,'target_end_date',lead.due_date,'objective',lead.notes,'scope_in',lead.business_unit,'project_lead_id',target_project_lead_id,'sponsor_id',t.phase_owner_membership_id,'extra_data',jsonb_build_object('commercial_ticket_id',t.id,'pipeline_lead_id',lead.id,'pipeline_lead_code',lead.lead_code)));
 insert into public.chat_conversations(name,kind,project_id,created_by_membership_id) values('Project · '||lead.account_name,'project',project_uuid,actor) returning id into project_chat;
 insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level) values(project_chat,target_project_lead_id,'owner','all') on conflict do nothing;
 insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level) values(project_chat,t.phase_owner_membership_id,'manager','all') on conflict do nothing;
 insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level)
  select project_chat,tm.membership_id,'member','mentions' from public.commercial_ticket_members tm where tm.ticket_id=t.id and tm.member_role in('assignee','watcher') on conflict do nothing;
 insert into public.chat_relations(conversation_id,relation_type,relation_id,title,url,metadata,created_by_membership_id) select project_chat,'project',project_uuid,p.project_code,'/ruang-kawan/projects/',jsonb_build_object('commercial_ticket_id',t.id),actor from public.projects p where p.id=project_uuid;
 update public.commercial_ticket_checklist set completed_at=now(),completed_by_membership_id=actor where ticket_id=t.id and phase='handover' and label='Service lead menerima handover';
 update public.commercial_tickets set project_id=project_uuid,project_conversation_id=project_chat,phase='delivery',phase_owner_membership_id=target_project_lead_id,ticket_status='in_progress',updated_by_membership_id=actor,updated_at=now() where id=t.id;
 insert into public.commercial_ticket_events(ticket_id,actor_membership_id,action,before_data,after_data) values(t.id,actor,'handover_accepted',to_jsonb(t),jsonb_build_object('project_id',project_uuid,'project_conversation_id',project_chat,'project_lead_id',target_project_lead_id));
 return project_uuid;
end $$;

revoke all on function public.accept_commercial_handover(uuid,uuid) from public,anon;
grant execute on function public.accept_commercial_handover(uuid,uuid) to authenticated;
