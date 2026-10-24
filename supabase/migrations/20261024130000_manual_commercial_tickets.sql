-- Ticket records are issued manually from Marketing. Pipeline stages stay in Pipeline.
-- Existing legacy/phase-gate records are preserved; only their auto-create triggers are removed.
drop trigger if exists pipeline_qualified_creates_ticket on public.pipeline_leads;
drop trigger if exists pipeline_ticket_sync_trigger on public.pipeline_leads;

create sequence if not exists public.commercial_ticket_record_seq;

create table if not exists public.commercial_ticket_records(
 id uuid primary key default extensions.gen_random_uuid(),
 ticket_code text not null unique,
 pipeline_lead_id uuid references public.pipeline_leads(id) on delete set null,
 client_name text not null,
 service_name text not null,
 requirements text not null,
 target_proposal_date date not null,
 project_plan text not null,
 rru_status text not null check(rru_status in('first_time','repeat_order')),
 created_by_membership_id uuid not null references public.memberships(id),
 chat_message_id uuid references public.chat_messages(id) on delete set null,
 created_at timestamptz not null default now()
);

create table if not exists public.commercial_ticket_record_pics(
 ticket_id uuid not null references public.commercial_ticket_records(id) on delete cascade,
 membership_id uuid not null references public.memberships(id),
 pic_role text not null check(pic_role in('account_manager','operations','sales','marketing','hr','other')),
 created_at timestamptz not null default now(),
 primary key(ticket_id,membership_id,pic_role)
);

create table if not exists public.commercial_ticket_chat_config(
 singleton boolean primary key default true check(singleton),
 conversation_id uuid not null unique references public.chat_conversations(id)
);
insert into public.commercial_ticket_chat_config(singleton,conversation_id)
values(true,'745414b9-3bd2-40ea-931b-c89fd50cf0ae'::uuid)
on conflict(singleton) do update set conversation_id=excluded.conversation_id;

alter table public.commercial_ticket_records enable row level security;
alter table public.commercial_ticket_record_pics enable row level security;
alter table public.commercial_ticket_chat_config enable row level security;
revoke all on public.commercial_ticket_records,public.commercial_ticket_record_pics,public.commercial_ticket_chat_config from anon,authenticated;
revoke all on sequence public.commercial_ticket_record_seq from anon,authenticated;

create or replace function public.ticketing_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); result jsonb;
begin
 if not public.current_user_has_permission('ticketing.view') then raise exception 'Akses ticket tidak tersedia.' using errcode='42501'; end if;
 select jsonb_build_object(
  'tickets',coalesce((select jsonb_agg(jsonb_build_object(
   'id',t.id,'ticket_code',t.ticket_code,'pipeline_lead_id',t.pipeline_lead_id,'client_name',t.client_name,'service_name',t.service_name,
   'requirements',t.requirements,'target_proposal_date',t.target_proposal_date,'project_plan',t.project_plan,'rru_status',t.rru_status,
   'created_by_membership_id',t.created_by_membership_id,'creator_name',coalesce(cm.full_name,cm.email::text),'chat_message_id',t.chat_message_id,'created_at',t.created_at,
   'lead_code',pl.lead_code,'pipeline_stage',pl.stage,
   'proposal_value',case when coalesce(pl.extra_data->>'proposal_value','') ~ '^[0-9]+(\\.[0-9]+)?$' then (pl.extra_data->>'proposal_value')::numeric else null end,
   'won_value',case when coalesce(pl.extra_data->>'won_value','') ~ '^[0-9]+(\\.[0-9]+)?$' then (pl.extra_data->>'won_value')::numeric else null end,
   'is_won',coalesce(pl.stage in('Won','Closed Won','Deal','Paid/Booked'),false),
   'pics',(select coalesce(jsonb_agg(jsonb_build_object('membership_id',tp.membership_id,'name',coalesce(pm.full_name,pm.email::text),'role',tp.pic_role) order by tp.pic_role,coalesce(pm.full_name,pm.email::text)),'[]'::jsonb) from public.commercial_ticket_record_pics tp join public.memberships pm on pm.id=tp.membership_id where tp.ticket_id=t.id)
  ) order by t.created_at desc) from public.commercial_ticket_records t join public.memberships cm on cm.id=t.created_by_membership_id left join public.pipeline_leads pl on pl.id=t.pipeline_lead_id),'[]'::jsonb),
  'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'position',p.name) order by coalesce(m.full_name,m.email::text)),'[]'::jsonb) from public.memberships m left join public.positions p on p.id=m.position_id where m.status='active'),
  'pipeline_options',(select coalesce(jsonb_agg(jsonb_build_object('id',pl.id,'lead_code',pl.lead_code,'client_name',pl.account_name,'stage',pl.stage,'proposal_value',case when coalesce(pl.extra_data->>'proposal_value','') ~ '^[0-9]+(\\.[0-9]+)?$' then (pl.extra_data->>'proposal_value')::numeric else null end,'won_value',case when coalesce(pl.extra_data->>'won_value','') ~ '^[0-9]+(\\.[0-9]+)?$' then (pl.extra_data->>'won_value')::numeric else null end) order by pl.date_added desc),'[]'::jsonb) from public.pipeline_leads pl join public.activities a on a.id=pl.activity_id where public.can_access_activity(a.id)),
  'conversation_id',(select conversation_id from public.commercial_ticket_chat_config where singleton),
  'can_create',public.current_user_has_permission('ticketing.manage')
 ) into result;
 return result;
end $$;

create or replace function public.create_commercial_ticket_record(payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 actor uuid:=public.current_membership_id(); room uuid; ticket_uuid uuid; message_uuid uuid;
 ticket_code_value text; client_value text:=nullif(trim(payload->>'client_name'),'');
 service_value text:=nullif(trim(payload->>'service_name'),'');
 requirements_value text:=nullif(trim(payload->>'requirements'),'');
 plan_value text:=nullif(trim(payload->>'project_plan'),'');
 target_date date:=nullif(payload->>'target_proposal_date','')::date;
 rru_value text:=coalesce(nullif(payload->>'rru_status',''),'first_time');
 lead_uuid uuid:=nullif(payload->>'pipeline_lead_id','')::uuid;
 creator_name text; pic jsonb; pic_id uuid; pic_role_value text; pic_name text;
 mentions uuid[]:='{}'; body text;
begin
 if not public.current_user_has_permission('ticketing.manage') then raise exception 'Hanya BD atau CEO yang dapat menerbitkan ticket.' using errcode='42501'; end if;
 if client_value is null or service_value is null or requirements_value is null or plan_value is null or target_date is null then raise exception 'Client, service, kebutuhan, target proposal, dan rencana project wajib diisi.'; end if;
 if rru_value not in('first_time','repeat_order') then raise exception 'Status RRU tidak valid.'; end if;
 if lead_uuid is not null and not exists(select 1 from public.pipeline_leads pl join public.activities a on a.id=pl.activity_id where pl.id=lead_uuid and public.can_access_activity(a.id)) then raise exception 'Lead Pipeline tidak dapat diakses.' using errcode='42501'; end if;
 ticket_code_value:='CI-TKT-'||to_char(now() at time zone 'Asia/Jakarta','YYYY')||'-'||lpad(nextval('public.commercial_ticket_record_seq')::text,6,'0');
 insert into public.commercial_ticket_records(ticket_code,pipeline_lead_id,client_name,service_name,requirements,target_proposal_date,project_plan,rru_status,created_by_membership_id)
 values(ticket_code_value,lead_uuid,client_value,service_value,requirements_value,target_date,plan_value,rru_value,actor) returning id into ticket_uuid;
 select conversation_id into room from public.commercial_ticket_chat_config where singleton;
 if room is null then raise exception 'Grup Commercial & Handover belum disiapkan.'; end if;
 select coalesce(full_name,email::text) into creator_name from public.memberships where id=actor;
 body:='🎫 TIKET BARU'||E'\n'||'Ticket ID: '||ticket_code_value||E'\n'||'Client: '||client_value||E'\n'||'Service: '||service_value||E'\n'||E'\n'||'Deskripsi & kebutuhan detail:'||E'\n'||requirements_value||E'\n'||E'\n'||'Target proposal: '||to_char(target_date,'DD/MM/YYYY')||E'\n'||'Rencana project:'||E'\n'||plan_value||E'\n'||'Status RRU: '||case rru_value when 'repeat_order' then 'Repeat Order' else 'First Time Client' end||E'\n'||'Ticket Creator: '||creator_name||E'\n'||'PIC:';
 for pic in select value from jsonb_array_elements(coalesce(payload->'pics','[]'::jsonb)) loop
  pic_id:=nullif(pic->>'membership_id','')::uuid; pic_role_value:=coalesce(nullif(pic->>'role',''),'other');
  if pic_id is null or pic_role_value not in('account_manager','operations','sales','marketing','hr','other') then raise exception 'PIC ticket tidak valid.'; end if;
  select coalesce(full_name,email::text) into pic_name from public.memberships where id=pic_id and status='active';
  if pic_name is null then raise exception 'PIC harus merupakan anggota aktif.'; end if;
  insert into public.commercial_ticket_record_pics(ticket_id,membership_id,pic_role) values(ticket_uuid,pic_id,pic_role_value) on conflict do nothing;
  insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at)
  values(room,pic_id,'member','mentions',now()) on conflict(conversation_id,membership_id) do update set left_at=null,joined_at=now();
  body:=body||E'\n'||case pic_role_value when 'account_manager' then 'AM' when 'operations' then 'Ops' when 'sales' then 'Sales' when 'marketing' then 'Marketing' when 'hr' then 'HR PIC' else 'PIC' end||': @'||pic_name;
  mentions:=array_append(mentions,pic_id);
 end loop;
 if jsonb_array_length(coalesce(payload->'pics','[]'::jsonb))=0 then body:=body||E'\n'||'Belum ditentukan'; end if;
 message_uuid:=public.send_chat_message(room,body,null,'{}'::uuid[],mentions);
 update public.commercial_ticket_records set chat_message_id=message_uuid where id=ticket_uuid;
 insert into public.chat_relations(conversation_id,message_id,relation_type,relation_id,title,url,metadata,created_by_membership_id)
 values(room,message_uuid,'pipeline',coalesce(lead_uuid,ticket_uuid),ticket_code_value,'/ruang-kawan/tickets/?ticket='||ticket_uuid,jsonb_build_object('ticket_id',ticket_uuid,'ticket_code',ticket_code_value),actor);
 return jsonb_build_object('ticket_id',ticket_uuid,'ticket_code',ticket_code_value,'conversation_id',room,'message_id',message_uuid);
end $$;

revoke all on function public.ticketing_workspace(),public.create_commercial_ticket_record(jsonb) from public,anon;
grant execute on function public.ticketing_workspace(),public.create_commercial_ticket_record(jsonb) to authenticated;
