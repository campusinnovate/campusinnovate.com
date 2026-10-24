create or replace function public.create_commercial_ticket_record_legacy(payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 actor uuid:=public.current_membership_id();
 room uuid; discussion uuid; ticket_uuid uuid; message_uuid uuid; discussion_message_uuid uuid;
 ticket_code_value text;
 client_value text:=nullif(trim(payload->>'client_name'),'');
 client_type_value text:=coalesce(nullif(payload->>'client_type',''),'new_client');
 service_value text:=nullif(trim(payload->>'service_name'),'');
 requirements_value text:=nullif(trim(payload->>'requirements'),'');
 plan_value text:=nullif(trim(payload->>'project_plan'),'');
 target_date date:=nullif(payload->>'target_proposal_date','')::date;
 rru_value text:=coalesce(nullif(payload->>'rru_status',''),'ready');
 lead_uuid uuid:=nullif(payload->>'pipeline_lead_id','')::uuid;
 creator_name text; pic jsonb; pic_id uuid; pic_role_value text; pic_name text;
 mentions uuid[]:='{}'; formatted_pics text:=''; body text; discussion_body text;
begin
 if not public.current_user_has_permission('ticketing.manage') then
  raise exception 'Hanya BD atau CEO yang dapat menerbitkan ticket.' using errcode='42501';
 end if;
 if client_value is null or service_value is null or requirements_value is null or plan_value is null or target_date is null then
  raise exception 'Client, service, kebutuhan, target proposal, dan rencana project wajib diisi.';
 end if;
 if client_type_value not in ('new_client','repeat_order') then raise exception 'Tipe client tidak valid.'; end if;
 if rru_value not in ('ready','response','unreachable') then raise exception 'Status RRU tidak valid.'; end if;
 if lead_uuid is not null and not exists(select 1 from public.pipeline_leads pl join public.activities a on a.id=pl.activity_id where pl.id=lead_uuid and public.can_access_activity(a.id)) then
  raise exception 'Lead Pipeline tidak dapat diakses.' using errcode='42501';
 end if;
 if jsonb_typeof(payload->'pics') is distinct from 'array' then
  raise exception 'Daftar PIC ticket tidak valid.';
 end if;
 if jsonb_array_length(payload->'pics')=0 then
  raise exception 'Tambahkan minimal satu PIC sebelum menerbitkan ticket.';
 end if;

 ticket_code_value:='CI-TKT-'||to_char(now() at time zone 'Asia/Jakarta','YYYY')||'-'||lpad(nextval('public.commercial_ticket_record_seq')::text,6,'0');
 select coalesce(full_name,email::text) into creator_name from public.memberships where id=actor;

 insert into public.commercial_ticket_records(ticket_code,pipeline_lead_id,client_name,client_type,service_name,requirements,target_proposal_date,project_plan,rru_status,created_by_membership_id)
 values(ticket_code_value,lead_uuid,client_value,client_type_value,service_value,requirements_value,target_date,plan_value,rru_value,actor)
 returning id into ticket_uuid;

 select conversation_id into room from public.commercial_ticket_chat_config where singleton;
 if room is null then raise exception 'Grup Commercial & Handover belum disiapkan.'; end if;

 insert into public.chat_conversations(name,kind,created_by_membership_id)
 values('Ticket · '||ticket_code_value||' · '||left(client_value,72),'private',actor)
 returning id into discussion;

 insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at)
 values(discussion,actor,'owner','all',now());
 for pic in select value from jsonb_array_elements(payload->'pics') loop
  pic_id:=nullif(pic->>'membership_id','')::uuid;
  pic_role_value:=coalesce(nullif(pic->>'role',''),'other');
  if pic_id is null or pic_role_value not in ('account_manager','operations','sales','marketing','social_media_specialist','coo','cto','hr','other','business_development','project_leader','content_marketing') then
   raise exception 'PIC ticket tidak valid.';
  end if;
  select coalesce(full_name,email::text) into pic_name from public.memberships where id=pic_id and status='active';
  if pic_name is null then raise exception 'PIC harus merupakan anggota aktif.'; end if;

  insert into public.commercial_ticket_record_pics(ticket_id,membership_id,pic_role)
  values(ticket_uuid,pic_id,pic_role_value) on conflict do nothing;

  if pic_id<>actor then
   insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at)
   values(discussion,pic_id,'member','all',now()) on conflict(conversation_id,membership_id) do update set left_at=null,joined_at=now(),notification_level='all';
  end if;

  insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at)
  values(room,pic_id,'member','mentions',now()) on conflict(conversation_id,membership_id) do update set left_at=null,joined_at=now();

  if formatted_pics<>'' then formatted_pics:=formatted_pics||E'\n'; end if;
  formatted_pics:=formatted_pics||'• '||case pic_role_value
    when 'account_manager' then 'AM' when 'operations' then 'Ops' when 'sales' then 'Sales'
    when 'marketing' then 'Marketing' when 'social_media_specialist' then 'Sosmed Specialist' when 'business_development' then 'Business Development' when 'project_leader' then 'Project Leader' when 'content_marketing' then 'Content Marketing'
    when 'coo' then 'COO' when 'cto' then 'CTO' when 'hr' then 'HR PIC' else 'PIC' end||': @'||pic_name;
  if not pic_id=any(mentions) then mentions:=array_append(mentions,pic_id); end if;
 end loop;

 update public.commercial_ticket_records set discussion_conversation_id=discussion where id=ticket_uuid;

 body:='🎫 TICKET BARU  ·  '||ticket_code_value||E'\n'||
  '━━━━━━━━━━━━━━━━━━━━'||E'\n'||
  '🏢 CLIENT'||E'\n'||client_value||E'\n'||
  '🤝 HUBUNGAN CLIENT'||E'\n'||case client_type_value when 'repeat_order' then 'Repeat Order' else 'Client Baru' end||E'\n'||
  '🧩 LAYANAN'||E'\n'||service_value||E'\n'||
  '📋 KEBUTUHAN'||E'\n'||requirements_value||E'\n'||
  '📆 TARGET PROPOSAL'||E'\n'||to_char(target_date,'DD/MM/YYYY')||E'\n'||
  '🗺️ RENCANA PROJECT'||E'\n'||plan_value||E'\n'||
  '📡 STATUS RRU'||E'\n'||case rru_value when 'ready' then 'Ready · Siap ditindaklanjuti' when 'response' then 'Response · Prospek sudah merespons' else 'Unreachable · Belum dapat dijangkau' end||E'\n'||
  '👤 DITERBITKAN OLEH'||E'\n'||creator_name||E'\n'||
  '🧭 PROGRES'||E'\n'||'Commercial → Proposal & Deal → Handover → Delivery → Report & Close'||E'\n'||
  'Update singkat bisa di thread pengumuman ini.'||E'\n'||
  '🛠️ DISKUSI TEKNIS & HANDOVER'||E'\n'||'https://campusinnovate.com/ruang-kawan/chat/?conversation='||discussion::text||E'\n'||
  '👥 PIC'||E'\n'||formatted_pics;

 discussion_body:=regexp_replace(body,E'🛠️ DISKUSI TEKNIS & HANDOVER\n[^\n]+\n?','','g');
 discussion_body:=replace(replace(discussion_body,'Update singkat bisa di thread pengumuman ini.','Percakapan teknis dan handover berlangsung di ruang ini.'),'Balas pada thread pengumuman ini untuk memulai chat teknis bersama PIC.','Percakapan teknis dan handover berlangsung di ruang ini.');

 message_uuid:=public.send_chat_message(room,body,null,'{}'::uuid[],mentions);
 discussion_message_uuid:=public.send_chat_message(discussion,discussion_body,null,'{}'::uuid[],mentions);
 update public.commercial_ticket_records set chat_message_id=message_uuid,discussion_message_id=discussion_message_uuid where id=ticket_uuid;

 insert into public.chat_relations(conversation_id,message_id,relation_type,relation_id,title,url,metadata,created_by_membership_id)
 values(room,message_uuid,'pipeline',coalesce(lead_uuid,ticket_uuid),ticket_code_value,'/ruang-kawan/tickets/?ticket='||ticket_uuid,
  jsonb_build_object('ticket_id',ticket_uuid,'ticket_code',ticket_code_value,'discussion_conversation_id',discussion),actor);

 return jsonb_build_object('ticket_id',ticket_uuid,'ticket_code',ticket_code_value,'conversation_id',room,'message_id',message_uuid,'discussion_conversation_id',discussion,'discussion_message_id',discussion_message_uuid);
end $$;

