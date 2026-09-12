-- WhatsApp CRM capture and explicit handoff into the existing Pipeline/My Activity workflow.
create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^[1-9][0-9]{6,14}$'),
  name text not null check (char_length(name) between 1 and 180),
  organization text not null default '' check (char_length(organization) <= 180),
  email text not null default '' check (char_length(email) <= 254),
  role text not null default '' check (char_length(role) <= 120),
  notes text not null default '' check (char_length(notes) <= 5000),
  name_locked boolean not null default false,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by_membership_id uuid references public.memberships(id) on delete set null
);
alter table public.crm_contacts enable row level security;
revoke all on public.crm_contacts from public, anon, authenticated;
grant all on public.crm_contacts to service_role;
-- Contacts are read/written through the inbox RPCs; pipeline visibility stays source/owner scoped.
alter table public.whatsapp_conversations
  add column contact_id uuid references public.crm_contacts(id),
  add column pipeline_lead_id uuid references public.pipeline_leads(id) on delete set null;
create index whatsapp_conversations_contact_idx on public.whatsapp_conversations(contact_id);
create index whatsapp_conversations_pipeline_idx on public.whatsapp_conversations(pipeline_lead_id) where pipeline_lead_id is not null;

insert into public.crm_contacts(phone, name, created_at, last_contact_at)
select distinct on (c.phone) c.phone, coalesce(nullif(left(trim(c.profile_name),180),''),c.phone),
  min(c.created_at) over (partition by c.phone), max(c.last_incoming_at) over (partition by c.phone)
from public.whatsapp_conversations c order by c.phone, c.last_message_at desc, c.id;
update public.whatsapp_conversations c set contact_id=k.id from public.crm_contacts k where k.phone=c.phone;
alter table public.whatsapp_conversations alter column contact_id set not null;
-- Preserve Phase 1 reads without exposing a restricted lead ID through the shared inbox table.
revoke select on public.whatsapp_conversations from authenticated;
grant select(id,phone,profile_name,whatsapp_number_id,last_message_at,last_incoming_at,created_at,contact_id)
  on public.whatsapp_conversations to authenticated;

create function public.whatsapp_capture_contact() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.crm_contacts(phone,name) values(new.phone,coalesce(nullif(left(trim(new.profile_name),180),''),new.phone))
  on conflict(phone) do update set
    name=case when not crm_contacts.name_locked and nullif(trim(new.profile_name),'') is not null then excluded.name else crm_contacts.name end,
    updated_at=case when not crm_contacts.name_locked and nullif(trim(new.profile_name),'') is not null and crm_contacts.name<>excluded.name then clock_timestamp() else crm_contacts.updated_at end
  returning id into new.contact_id;
  return new;
end $$;
create trigger whatsapp_capture_contact before insert or update of phone,profile_name
  on public.whatsapp_conversations for each row execute function public.whatsapp_capture_contact();

create function public.whatsapp_normalize_contact_phone(value text) returns text
language plpgsql immutable strict set search_path=public,pg_temp as $$
declare normalized text:=regexp_replace(value,'[[:space:]()+.\-]','','g');
begin
  if left(normalized,1)='0' then normalized:='62'||substr(normalized,2); end if;
  return case when normalized ~ '^[1-9][0-9]{6,14}$' then normalized else null end;
end $$;

create function public.whatsapp_can_manage_lead(target_lead_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select public.current_membership_id() is not null and public.current_user_has_permission('pipeline.view') and exists(
    select 1 from public.pipeline_leads p join public.activities a on a.id=p.activity_id
    where p.id=target_lead_id and public.can_access_activity(a.id) and public.can_access_work_source(p.source_id)
      and ((a.owner_membership_id=public.current_membership_id() and public.current_user_has_permission('pipeline.manage_self'))
        or (a.owner_membership_id<>public.current_membership_id() and public.current_user_has_permission('pipeline.manage_team')))
  );
$$;

create function public.whatsapp_crm_context(target_conversation_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare conversation public.whatsapp_conversations%rowtype; contact public.crm_contacts%rowtype;
  linked jsonb; matches jsonb; can_manage boolean;
begin
  if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.view') then
    raise exception 'Akses inbox diperlukan.' using errcode='42501';
  end if;
  select * into conversation from public.whatsapp_conversations where id=target_conversation_id;
  if conversation.id is null then raise exception 'Percakapan tidak ditemukan.'; end if;
  select * into contact from public.crm_contacts where id=conversation.contact_id;
  select to_jsonb(p)||jsonb_build_object('owner_membership_id',a.owner_membership_id,
    'owner_name',coalesce(m.full_name,m.email::text),'source_name',s.name,'source_color',s.color,
    'source_config',s.module_config,'workflow_status',a.status,'progress',a.progress,'linked_kpi',a.linked_kpi)
  into linked from public.pipeline_leads p
  join public.activities a on a.id=p.activity_id join public.work_sources s on s.id=p.source_id
  join public.memberships m on m.id=a.owner_membership_id
  where p.id=conversation.pipeline_lead_id and public.can_access_activity(a.id) and public.can_access_work_source(p.source_id);
  -- A complete phone token must match. Never concatenate an email, extension or another phone.
  select coalesce(jsonb_agg(candidate.row_data order by candidate.updated_at desc),'[]'::jsonb) into matches from (
    select p.updated_at, to_jsonb(p)||jsonb_build_object('owner_membership_id',a.owner_membership_id,
      'owner_name',coalesce(m.full_name,m.email::text),'source_name',s.name,'source_config',s.module_config) row_data
    from public.pipeline_leads p join public.activities a on a.id=p.activity_id
    join public.work_sources s on s.id=p.source_id join public.memberships m on m.id=a.owner_membership_id
    where public.can_access_activity(a.id) and public.can_access_work_source(p.source_id)
      and (public.whatsapp_normalize_contact_phone(p.extra_data->>'whatsapp_phone')=contact.phone
        or exists(select 1 from regexp_split_to_table(coalesce(p.contact_details,''),'[,;|·\n]') token
          where public.whatsapp_normalize_contact_phone(token)=contact.phone))
    order by p.updated_at desc limit 20
  ) candidate;
  can_manage:=public.current_user_has_permission('pipeline.manage_self') or public.current_user_has_permission('pipeline.manage_team');
  return jsonb_build_object('contact',to_jsonb(contact)-'name_locked','linked_lead',linked,
    'has_linked_lead',conversation.pipeline_lead_id is not null,'matching_leads',matches,
    'can_manage_contact',can_manage,'can_manage_linked_lead',coalesce(public.whatsapp_can_manage_lead(conversation.pipeline_lead_id),false));
end $$;

create function public.save_whatsapp_crm_contact(target_conversation_id uuid,payload jsonb,expected_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare contact public.crm_contacts%rowtype; merged jsonb;
begin
  if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.view')
    or not (public.current_user_has_permission('pipeline.manage_self') or public.current_user_has_permission('pipeline.manage_team')) then
    raise exception 'Izin kelola CRM diperlukan.' using errcode='42501';
  end if;
  if jsonb_typeof(payload) is distinct from 'object' or exists(
    select 1 from jsonb_each(payload) f where f.key not in ('name','organization','email','role','notes') or jsonb_typeof(f.value)<>'string'
  ) then raise exception 'Data kontak tidak valid.'; end if;
  select k.* into contact from public.crm_contacts k join public.whatsapp_conversations c on c.contact_id=k.id
    where c.id=target_conversation_id for update of k;
  if contact.id is null then raise exception 'Kontak tidak ditemukan.'; end if;
  if expected_updated_at is null or contact.updated_at<>expected_updated_at then
    raise exception 'Kontak telah diperbarui. Muat ulang sebelum menyimpan.' using errcode='40001';
  end if;
  merged:=to_jsonb(contact)||payload;
  if char_length(trim(merged->>'name')) not between 1 and 180
    or char_length(trim(merged->>'organization'))>180 or char_length(trim(merged->>'role'))>120
    or char_length(trim(merged->>'notes'))>5000 or char_length(trim(merged->>'email'))>254
    or (trim(merged->>'email')<>'' and trim(merged->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'Nama, email, atau panjang data kontak tidak valid.';
  end if;
  update public.crm_contacts set name=trim(merged->>'name'),organization=trim(merged->>'organization'),
    email=trim(merged->>'email'),role=trim(merged->>'role'),notes=trim(merged->>'notes'),
    name_locked=name_locked or payload ? 'name',updated_at=clock_timestamp(),updated_by_membership_id=public.current_membership_id()
  where id=contact.id;
  return contact.id;
end $$;

-- Only real incoming messages and accepted outbound messages count as contact.
create function public.whatsapp_sync_pipeline_contact() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare conversation public.whatsapp_conversations%rowtype; contact_date date;
begin
  if not (new.direction='incoming' or (new.direction='outgoing' and new.whatsapp_message_id is not null
      and new.delivery_status in ('sent','delivered','read'))) then return new; end if;
  select * into conversation from public.whatsapp_conversations where id=new.conversation_id;
  update public.crm_contacts set last_contact_at=greatest(last_contact_at,new.sent_at)
    where id=conversation.contact_id and (last_contact_at is null or last_contact_at<new.sent_at);
  contact_date:=(new.sent_at at time zone 'Asia/Jakarta')::date;
  update public.pipeline_leads set last_contact_date=contact_date,updated_at=clock_timestamp()
    where id=conversation.pipeline_lead_id and (last_contact_date is null or last_contact_date<contact_date);
  return new;
end $$;
create trigger whatsapp_sync_pipeline_contact after insert or update of whatsapp_message_id,delivery_status
  on public.whatsapp_messages for each row execute function public.whatsapp_sync_pipeline_contact();

update public.crm_contacts k set last_contact_at=greatest(k.last_contact_at,latest.latest_at)
from (select c.contact_id,max(m.sent_at) latest_at from public.whatsapp_conversations c
  join public.whatsapp_messages m on m.conversation_id=c.id
  where m.direction='incoming' or (m.direction='outgoing' and m.whatsapp_message_id is not null and m.delivery_status in ('sent','delivered','read'))
  group by c.contact_id) latest where latest.contact_id=k.id;

create function public.link_whatsapp_pipeline_lead(target_conversation_id uuid,target_lead_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare conversation public.whatsapp_conversations%rowtype; latest_date date; activity uuid;
begin
  if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.view')
    or not (public.current_user_has_permission('pipeline.manage_self') or public.current_user_has_permission('pipeline.manage_team')) then
    raise exception 'Izin kelola Pipeline diperlukan.' using errcode='42501';
  end if;
  select * into conversation from public.whatsapp_conversations where id=target_conversation_id for update;
  if conversation.id is null then raise exception 'Percakapan tidak ditemukan.'; end if;
  if (conversation.pipeline_lead_id is not null and not public.whatsapp_can_manage_lead(conversation.pipeline_lead_id))
    or (target_lead_id is not null and not public.whatsapp_can_manage_lead(target_lead_id)) then
    raise exception 'Lead tidak dapat dikelola.' using errcode='42501';
  end if;
  if conversation.pipeline_lead_id is not distinct from target_lead_id then return target_lead_id; end if;
  if conversation.pipeline_lead_id is not null then
    select activity_id into activity from public.pipeline_leads where id=conversation.pipeline_lead_id;
    insert into public.activity_history(activity_id,actor_membership_id,event_type,after_data)
      values(activity,public.current_membership_id(),'whatsapp_conversation_unlinked',jsonb_build_object('conversation_id',conversation.id,'contact_id',conversation.contact_id));
  end if;
  update public.whatsapp_conversations set pipeline_lead_id=target_lead_id where id=conversation.id;
  if target_lead_id is not null then
    select (max(m.sent_at) at time zone 'Asia/Jakarta')::date into latest_date from public.whatsapp_messages m
      where m.conversation_id=conversation.id and (m.direction='incoming' or (m.direction='outgoing'
        and m.whatsapp_message_id is not null and m.delivery_status in ('sent','delivered','read')));
    update public.pipeline_leads set last_contact_date=greatest(last_contact_date,latest_date),updated_at=clock_timestamp()
      where id=target_lead_id returning activity_id into activity;
    insert into public.activity_history(activity_id,actor_membership_id,event_type,after_data)
      values(activity,public.current_membership_id(),'whatsapp_conversation_linked',jsonb_build_object('conversation_id',conversation.id,'contact_id',conversation.contact_id,'phone',conversation.phone));
  end if;
  return target_lead_id;
end $$;

create function public.create_whatsapp_pipeline_lead(target_conversation_id uuid,payload jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare conversation public.whatsapp_conversations%rowtype; contact public.crm_contacts%rowtype;
  config jsonb; defaults jsonb; lead_payload jsonb; lead_id uuid; owner_id uuid;
begin
  if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.view')
    or not (public.current_user_has_permission('pipeline.manage_self') or public.current_user_has_permission('pipeline.manage_team')) then
    raise exception 'Izin kelola Pipeline diperlukan.' using errcode='42501';
  end if;
  if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Data lead tidak valid.'; end if;
  -- Serializes staff double clicks and competing handoffs; the linked lead is the idempotency result.
  select * into conversation from public.whatsapp_conversations where id=target_conversation_id for update;
  if conversation.id is null then raise exception 'Percakapan tidak ditemukan.'; end if;
  if conversation.pipeline_lead_id is not null then
    if not public.whatsapp_can_manage_lead(conversation.pipeline_lead_id) then
      raise exception 'Lead terhubung tidak dapat dikelola.' using errcode='42501';
    end if;
    return conversation.pipeline_lead_id;
  end if;
  select * into contact from public.crm_contacts where id=conversation.contact_id;
  select s.module_config into config from public.work_sources s where s.id=nullif(payload->>'source_id','')::uuid
    and s.module_type='pipeline' and public.can_access_work_source(s.id);
  if config is null then raise exception 'Pipeline tujuan tidak tersedia.' using errcode='42501'; end if;
  owner_id:=coalesce(nullif(payload->>'owner_membership_id','')::uuid,public.current_membership_id());
  if owner_id<>public.current_membership_id() and not public.current_user_has_permission('pipeline.manage_team') then
    raise exception 'Izin kelola Pipeline tim diperlukan.' using errcode='42501';
  end if;
  defaults:=jsonb_build_object('owner_membership_id',owner_id,'account_name',coalesce(nullif(contact.organization,''),contact.name),
    'contact_name',contact.name,'contact_role',contact.role,'notes',contact.notes,
    'business_unit',config->'business_units'->>0,
    'stage',case when coalesce(config->'stages','[]'::jsonb) ? 'Replied' then 'Replied' else config->'stages'->>0 end,
    'priority',case when coalesce(config->'priorities','[]'::jsonb) ? 'Medium' then 'Medium' else coalesce(config->'priorities'->>0,'Medium') end,
    'activity_type',case when coalesce(config->'activity_types','[]'::jsonb) ? 'Follow Up' then 'Follow Up' else coalesce(config->'activity_types'->>0,'Follow Up') end,
    'next_action','Tindak lanjuti percakapan WhatsApp','due_date',current_date+1);
  lead_payload:=defaults||payload||jsonb_build_object('lead_source','WhatsApp',
    'contact_details',concat_ws(' · ','+'||contact.phone,nullif(contact.email,'')),
    'extra_data',coalesce(payload->'extra_data','{}'::jsonb)||jsonb_build_object('crm_contact_id',contact.id,
      'whatsapp_conversation_id',conversation.id,'whatsapp_phone',contact.phone));
  lead_id:=public.save_pipeline_lead(null,lead_payload);
  perform public.link_whatsapp_pipeline_lead(conversation.id,lead_id);
  return lead_id;
end $$;

create function public.whatsapp_pipeline_conversations()
returns table(id uuid,pipeline_lead_id uuid,last_message_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select c.id,c.pipeline_lead_id,c.last_message_at from public.whatsapp_conversations c
  join public.pipeline_leads p on p.id=c.pipeline_lead_id
  where public.current_membership_id() is not null and public.current_user_has_permission('pipeline.view')
    and public.can_access_activity(p.activity_id) and public.can_access_work_source(p.source_id)
  order by c.last_message_at desc,c.id;
$$;

revoke all on function public.whatsapp_capture_contact(),public.whatsapp_normalize_contact_phone(text),
  public.whatsapp_can_manage_lead(uuid),public.whatsapp_sync_pipeline_contact() from public,anon,authenticated;
revoke all on function public.whatsapp_crm_context(uuid),public.save_whatsapp_crm_contact(uuid,jsonb,timestamptz),
  public.link_whatsapp_pipeline_lead(uuid,uuid),public.create_whatsapp_pipeline_lead(uuid,jsonb),public.whatsapp_pipeline_conversations() from public,anon;
grant execute on function public.whatsapp_crm_context(uuid),public.save_whatsapp_crm_contact(uuid,jsonb,timestamptz),
  public.link_whatsapp_pipeline_lead(uuid,uuid),public.create_whatsapp_pipeline_lead(uuid,jsonb),public.whatsapp_pipeline_conversations() to authenticated;
