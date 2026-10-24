-- Ticket announcements stay in the Commercial & Handover room. Their private PIC room
-- is hidden until the first announcement-thread reply, then each reply is mirrored there.
alter table public.commercial_ticket_records
  add column if not exists deleted_at timestamptz;

alter function public.create_commercial_ticket_record(jsonb)
  rename to create_commercial_ticket_record_legacy;

create or replace function public.create_commercial_ticket_record(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  discussion uuid;
  message uuid;
begin
  result := public.create_commercial_ticket_record_legacy(payload);
  discussion := nullif(result->>'discussion_conversation_id','')::uuid;
  message := nullif(result->>'message_id','')::uuid;

  if discussion is not null then
    update public.chat_conversations set archived_at=now() where id=discussion;
  end if;
  if message is not null then
    update public.chat_messages
      set body = regexp_replace(
        replace(body, 'Update singkat bisa di thread pengumuman ini.',
          'Balas pada thread pengumuman ini untuk memulai chat teknis bersama PIC.'),
        E'🛠️ DISKUSI TEKNIS & HANDOVER\\n[^\\n]+\\n?', '', 'g'),
        updated_at=now()
      where id=message;
  end if;
  return result;
end;
$$;

create or replace function public.ensure_ticket_discussion_for_thread_reply(target_reply_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_membership_id();
  parent_id uuid;
  group_id uuid;
  room_id uuid;
  ticket public.commercial_ticket_records%rowtype;
  reply public.chat_messages%rowtype;
  mentions uuid[];
begin
  select * into reply from public.chat_messages where id=target_reply_id and deleted_at is null;
  if reply.id is null or reply.sender_membership_id<>me or reply.parent_message_id is null then
    raise exception 'Balasan tiket tidak valid.' using errcode='42501';
  end if;
  parent_id := reply.parent_message_id;
  select conversation_id into group_id from public.chat_messages where id=parent_id and parent_message_id is null;
  if not public.is_chat_member(group_id,me) then
    raise exception 'Percakapan tidak dapat diakses.' using errcode='42501';
  end if;

  select t.* into ticket
    from public.commercial_ticket_records t
    where t.chat_message_id=parent_id and t.deleted_at is null
    for update;
  if ticket.id is null then return null; end if;

  room_id := ticket.discussion_conversation_id;
  if room_id is null then
    insert into public.chat_conversations(name,kind,created_by_membership_id)
    values('Ticket · '||ticket.ticket_code||' · '||left(ticket.client_name,72),'private',ticket.created_by_membership_id)
    returning id into room_id;
    insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at)
    values(room_id,ticket.created_by_membership_id,'owner','all',now())
    on conflict(conversation_id,membership_id) do update set left_at=null;
    insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at)
    select room_id,p.membership_id,'member','all',now()
    from public.commercial_ticket_record_pics p where p.ticket_id=ticket.id
    on conflict(conversation_id,membership_id) do update set left_at=null,notification_level='all';
    update public.commercial_ticket_records set discussion_conversation_id=room_id where id=ticket.id;
  end if;

  update public.chat_conversations set archived_at=null,deleted_at=null,updated_at=now() where id=room_id;
  insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at)
  values(room_id,me,'member','all',now())
  on conflict(conversation_id,membership_id) do update set left_at=null,notification_level='all';

  select coalesce(array_agg(membership_id),'{}'::uuid[]) into mentions
    from public.chat_message_mentions where message_id=reply.id;
  perform public.send_chat_message(room_id,reply.body,null,'{}'::uuid[],mentions);
  return room_id;
end;
$$;

create or replace function public.update_commercial_ticket_record(target_ticket_id uuid,payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_membership_id();
  ticket public.commercial_ticket_records%rowtype;
  client_value text := nullif(trim(payload->>'client_name'),'');
  service_value text := nullif(trim(payload->>'service_name'),'');
  requirements_value text := nullif(trim(payload->>'requirements'),'');
  plan_value text := nullif(trim(payload->>'project_plan'),'');
  target_date date := nullif(payload->>'target_proposal_date','')::date;
  client_type_value text := coalesce(nullif(payload->>'client_type',''),'new_client');
  rru_value text := coalesce(nullif(payload->>'rru_status',''),'ready');
  lead_uuid uuid := nullif(payload->>'pipeline_lead_id','')::uuid;
  pic jsonb; pic_id uuid; pic_role_value text; pic_name text; formatted_pics text := '';
  new_body text;
begin
  if not public.current_user_has_permission('ticketing.manage') then
    raise exception 'Hanya BD atau CEO yang dapat mengedit ticket.' using errcode='42501';
  end if;
  select * into ticket from public.commercial_ticket_records where id=target_ticket_id and deleted_at is null for update;
  if ticket.id is null then raise exception 'Ticket tidak ditemukan.'; end if;
  if client_value is null or service_value is null or requirements_value is null or plan_value is null or target_date is null then
    raise exception 'Client, service, kebutuhan, target proposal, dan rencana project wajib diisi.';
  end if;
  if client_type_value not in ('new_client','repeat_order') or rru_value not in ('ready','response','unreachable') then
    raise exception 'Tipe client atau status RRU tidak valid.';
  end if;
  if jsonb_typeof(payload->'pics') is distinct from 'array' or jsonb_array_length(payload->'pics')=0 then
    raise exception 'Tambahkan minimal satu PIC.';
  end if;
  update public.commercial_ticket_records
  set client_name=client_value,client_type=client_type_value,service_name=service_value,
      requirements=requirements_value,target_proposal_date=target_date,project_plan=plan_value,
      rru_status=rru_value,pipeline_lead_id=lead_uuid
  where id=ticket.id;

  delete from public.commercial_ticket_record_pics where ticket_id=ticket.id;
  for pic in select value from jsonb_array_elements(payload->'pics') loop
    pic_id := nullif(pic->>'membership_id','')::uuid;
    pic_role_value := coalesce(nullif(pic->>'role',''),'other');
    if pic_id is null or pic_role_value not in ('account_manager','operations','sales','marketing','social_media_specialist','coo','cto','hr','other') then
      raise exception 'PIC ticket tidak valid.';
    end if;
    select coalesce(full_name,email::text) into pic_name from public.memberships where id=pic_id and status='active';
    if pic_name is null then raise exception 'PIC harus anggota aktif.'; end if;
    insert into public.commercial_ticket_record_pics(ticket_id,membership_id,pic_role) values(ticket.id,pic_id,pic_role_value);
    if formatted_pics<>'' then formatted_pics:=formatted_pics||E'\\n'; end if;
    formatted_pics:=formatted_pics||'• '||case pic_role_value when 'account_manager' then 'AM' when 'operations' then 'Ops' when 'sales' then 'Sales' when 'marketing' then 'Marketing' when 'social_media_specialist' then 'Sosmed Specialist' when 'coo' then 'COO' when 'cto' then 'CTO' when 'hr' then 'HR PIC' else 'PIC' end||': @'||pic_name;
    if ticket.discussion_conversation_id is not null then
      insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at)
      values(ticket.discussion_conversation_id,pic_id,'member','all',now())
      on conflict(conversation_id,membership_id) do update set left_at=null,notification_level='all';
    end if;
  end loop;

  new_body := '🎫 TICKET BARU  ·  '||ticket.ticket_code||E'\\n'||'━━━━━━━━━━━━━━━━━━━━'||E'\\n'||
    '🏢 CLIENT'||E'\\n'||client_value||E'\\n'||
    '🤝 HUBUNGAN CLIENT'||E'\\n'||case client_type_value when 'repeat_order' then 'Repeat Order' else 'Client Baru' end||E'\\n'||
    '🧩 LAYANAN'||E'\\n'||service_value||E'\\n'||
    '📋 KEBUTUHAN'||E'\\n'||requirements_value||E'\\n'||
    '📆 TARGET PROPOSAL'||E'\\n'||to_char(target_date,'DD/MM/YYYY')||E'\\n'||
    '🗺️ RENCANA PROJECT'||E'\\n'||plan_value||E'\\n'||
    '📡 STATUS RRU'||E'\\n'||case rru_value when 'ready' then 'Ready · Siap ditindaklanjuti' when 'response' then 'Response · Prospek sudah merespons' else 'Unreachable · Belum dapat dijangkau' end||E'\\n'||
    '👤 DITERBITKAN OLEH'||E'\\n'||coalesce((select full_name from public.memberships where id=ticket.created_by_membership_id),'BD')||E'\\n'||
    '🧭 PROGRES'||E'\\n'||'Commercial → Proposal & Deal → Handover → Delivery → Report & Close'||E'\\n'||
    'Balas pada thread pengumuman ini untuk memulai chat teknis bersama PIC.'||E'\\n'||
    '👥 PIC'||E'\\n'||formatted_pics;
  update public.chat_messages set body=new_body,edited_at=now(),updated_at=now() where id=ticket.chat_message_id;
end;
$$;

create or replace function public.delete_commercial_ticket_record(target_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket public.commercial_ticket_records%rowtype;
begin
  if not public.current_user_has_permission('ticketing.manage') then
    raise exception 'Hanya BD atau CEO yang dapat menghapus ticket.' using errcode='42501';
  end if;
  select * into ticket from public.commercial_ticket_records where id=target_ticket_id and deleted_at is null for update;
  if ticket.id is null then raise exception 'Ticket tidak ditemukan.'; end if;

  update public.commercial_ticket_records set deleted_at=now() where id=ticket.id;
  -- Keep the announcement and its handover history visible in chat, marked as withdrawn.
  update public.chat_messages
    set body=replace(body,'🎫 TICKET BARU  ·','🗄️ TICKET DIHAPUS  ·'),edited_at=now(),updated_at=now()
    where id=ticket.chat_message_id;
end;
$$;

revoke all on function public.ensure_ticket_discussion_for_thread_reply(uuid) from public,anon;
grant execute on function public.ensure_ticket_discussion_for_thread_reply(uuid) to authenticated;
revoke all on function public.update_commercial_ticket_record(uuid,jsonb) from public,anon;
grant execute on function public.update_commercial_ticket_record(uuid,jsonb) to authenticated;
revoke all on function public.delete_commercial_ticket_record(uuid) from public,anon;
grant execute on function public.delete_commercial_ticket_record(uuid) to authenticated;

create or replace function public.ticketing_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.current_user_has_permission('ticketing.view') then
    raise exception 'Akses ticket tidak tersedia.' using errcode='42501';
  end if;
  select jsonb_build_object(
    'tickets',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',t.id,'ticket_code',t.ticket_code,'pipeline_lead_id',t.pipeline_lead_id,
        'client_name',t.client_name,'client_type',t.client_type,'service_name',t.service_name,
        'requirements',t.requirements,'target_proposal_date',t.target_proposal_date,'project_plan',t.project_plan,
        'rru_status',t.rru_status,'created_by_membership_id',t.created_by_membership_id,
        'creator_name',coalesce(cm.full_name,cm.email::text),'chat_message_id',t.chat_message_id,
        'discussion_conversation_id',t.discussion_conversation_id,'created_at',t.created_at,
        'lead_code',pl.lead_code,'pipeline_stage',pl.stage,
        'proposal_value',coalesce(pl.proposal_value,case when coalesce(pl.extra_data->>'proposal_value','') ~ '^[0-9]+([.][0-9]+)?$' then (pl.extra_data->>'proposal_value')::numeric else null end),
        'won_value',coalesce(pl.won_value,pl.deal_value,case when coalesce(pl.extra_data->>'won_value','') ~ '^[0-9]+([.][0-9]+)?$' then (pl.extra_data->>'won_value')::numeric else null end),
        'is_won',coalesce(lower(trim(pl.stage)) in ('won','closed won','deal','paid/booked'),false),
        'pics',(select coalesce(jsonb_agg(jsonb_build_object('membership_id',tp.membership_id,'name',coalesce(pm.full_name,pm.email::text),'role',tp.pic_role) order by tp.pic_role,coalesce(pm.full_name,pm.email::text)),'[]'::jsonb)
          from public.commercial_ticket_record_pics tp join public.memberships pm on pm.id=tp.membership_id where tp.ticket_id=t.id)
      ) order by t.created_at desc) from public.commercial_ticket_records t
      join public.memberships cm on cm.id=t.created_by_membership_id
      left join public.pipeline_leads pl on pl.id=t.pipeline_lead_id where t.deleted_at is null
    ),'[]'::jsonb),
    'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'position',p.name) order by coalesce(m.full_name,m.email::text)),'[]'::jsonb) from public.memberships m left join public.positions p on p.id=m.position_id where m.status='active'),
    'pipeline_options',(select coalesce(jsonb_agg(jsonb_build_object('id',pl.id,'lead_code',pl.lead_code,'client_name',pl.account_name,'stage',pl.stage,'proposal_value',pl.proposal_value,'won_value',coalesce(pl.won_value,pl.deal_value)) order by pl.date_added desc),'[]'::jsonb) from public.pipeline_leads pl join public.activities a on a.id=pl.activity_id where public.can_access_activity(a.id)),
    'won_projects',(select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'lead_code',w.lead_code,'client_name',w.client_name,'service_name',w.service_name,'stage',w.stage,'won_date',w.won_date,'proposal_value',w.proposal_value,'won_value',w.won_value) order by w.won_date desc),'[]'::jsonb)
      from (
        select pl.id,pl.lead_code,pl.account_name client_name,coalesce(nullif(pl.business_unit,''),nullif(pl.extra_data->>'service_name',''),nullif(pl.extra_data->>'service','')) service_name,pl.stage,
          case when coalesce(pl.extra_data->>'won_date','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then (pl.extra_data->>'won_date')::date
          when pl.extra_data->>'won_year' ~ '^(19|20|21)[0-9]{2}$' and pl.extra_data->>'won_month' ~ '^(0?[1-9]|1[0-2])$' then make_date((pl.extra_data->>'won_year')::int,(pl.extra_data->>'won_month')::int,1)
          when pl.extra_data->>'won_year' ~ '^(19|20|21)[0-9]{2}$' then make_date((pl.extra_data->>'won_year')::int,1,1)
          when pl.extra_data->>'historical_year' ~ '^(19|20|21)[0-9]{2}$' and pl.extra_data->>'historical_month' ~ '^(0?[1-9]|1[0-2])$' then make_date((pl.extra_data->>'historical_year')::int,(pl.extra_data->>'historical_month')::int,1)
          when pl.extra_data->>'historical_year' ~ '^(19|20|21)[0-9]{2}$' then make_date((pl.extra_data->>'historical_year')::int,1,1)
          else coalesce(timezone('Asia/Jakarta',pl.won_at)::date,pl.date_added) end won_date,
          coalesce(pl.proposal_value,case when coalesce(pl.extra_data->>'proposal_value','') ~ '^[0-9]+([.][0-9]+)?$' then (pl.extra_data->>'proposal_value')::numeric else null end) proposal_value,
          coalesce(pl.won_value,pl.deal_value,case when coalesce(pl.extra_data->>'won_value','') ~ '^[0-9]+([.][0-9]+)?$' then (pl.extra_data->>'won_value')::numeric else null end) won_value
        from public.pipeline_leads pl where lower(trim(pl.stage)) in ('won','closed won','deal','paid/booked')
      ) w),
    'conversation_id',(select conversation_id from public.commercial_ticket_chat_config where singleton),
    'can_create',public.current_user_has_permission('ticketing.manage')
  ) into result;
  return result;
end; $$;

