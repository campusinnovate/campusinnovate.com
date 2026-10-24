-- Expand ticket PIC roles, show the full commercial ticket card in its PIC room,
-- mirror ticket files/links into that room, and reserve the next numbers requested.
alter table public.commercial_ticket_records
  add column if not exists discussion_message_id uuid references public.chat_messages(id) on delete set null;

alter table public.commercial_ticket_record_pics
  drop constraint if exists commercial_ticket_record_pics_pic_role_check;
alter table public.commercial_ticket_record_pics
  add constraint commercial_ticket_record_pics_pic_role_check
  check (pic_role in ('account_manager','operations','sales','marketing','social_media_specialist','coo','cto','hr','other','business_development','project_leader','content_marketing'));

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
  previous_discussion_body text;
  docs_position integer;
  docs_suffix text;
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
    if pic_id is null or pic_role_value not in ('account_manager','operations','sales','marketing','social_media_specialist','coo','cto','hr','other','business_development','project_leader','content_marketing') then
      raise exception 'PIC ticket tidak valid.';
    end if;
    select coalesce(full_name,email::text) into pic_name from public.memberships where id=pic_id and status='active';
    if pic_name is null then raise exception 'PIC harus anggota aktif.'; end if;
    insert into public.commercial_ticket_record_pics(ticket_id,membership_id,pic_role) values(ticket.id,pic_id,pic_role_value);
    if formatted_pics<>'' then formatted_pics:=formatted_pics||E'\n'; end if;
    formatted_pics:=formatted_pics||'• '||case pic_role_value when 'account_manager' then 'AM' when 'operations' then 'Ops' when 'sales' then 'Sales' when 'marketing' then 'Marketing' when 'social_media_specialist' then 'Sosmed Specialist' when 'business_development' then 'Business Development' when 'project_leader' then 'Project Leader' when 'content_marketing' then 'Content Marketing' when 'coo' then 'COO' when 'cto' then 'CTO' when 'hr' then 'HR PIC' else 'PIC' end||': @'||pic_name;
    if ticket.discussion_conversation_id is not null then
      insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at)
      values(ticket.discussion_conversation_id,pic_id,'member','all',now())
      on conflict(conversation_id,membership_id) do update set left_at=null,notification_level='all';
    end if;
  end loop;

  new_body := '🎫 TICKET BARU  ·  '||ticket.ticket_code||E'\n'||'━━━━━━━━━━━━━━━━━━━━'||E'\n'||
    '🏢 CLIENT'||E'\n'||client_value||E'\n'||
    '🤝 HUBUNGAN CLIENT'||E'\n'||case client_type_value when 'repeat_order' then 'Repeat Order' else 'Client Baru' end||E'\n'||
    '🧩 LAYANAN'||E'\n'||service_value||E'\n'||
    '📋 KEBUTUHAN'||E'\n'||requirements_value||E'\n'||
    '📆 TARGET PROPOSAL'||E'\n'||to_char(target_date,'DD/MM/YYYY')||E'\n'||
    '🗺️ RENCANA PROJECT'||E'\n'||plan_value||E'\n'||
    '📡 STATUS RRU'||E'\n'||case rru_value when 'ready' then 'Ready · Siap ditindaklanjuti' when 'response' then 'Response · Prospek sudah merespons' else 'Unreachable · Belum dapat dijangkau' end||E'\n'||
    '👤 DITERBITKAN OLEH'||E'\n'||coalesce((select full_name from public.memberships where id=ticket.created_by_membership_id),'BD')||E'\n'||
    '🧭 PROGRES'||E'\n'||'Commercial → Proposal & Deal → Handover → Delivery → Report & Close'||E'\n'||
    'Balas pada thread pengumuman ini untuk memulai chat teknis bersama PIC.'||E'\n'||
    '👥 PIC'||E'\n'||formatted_pics;
  update public.chat_messages set body=new_body,edited_at=now(),updated_at=now() where id=ticket.chat_message_id;
  if ticket.discussion_message_id is not null then
    select body into previous_discussion_body from public.chat_messages where id=ticket.discussion_message_id;
    docs_position := coalesce(nullif(strpos(previous_discussion_body,'📎 DOKUMEN PENDUKUNG'),0),0);
    if docs_position>0 then docs_suffix := E'\n\\n'||substring(previous_discussion_body from docs_position); end if;
    update public.chat_messages
      set body=replace(new_body,'Balas pada thread pengumuman ini untuk memulai chat teknis bersama PIC.','Percakapan teknis dan handover berlangsung di ruang ini.')||coalesce(docs_suffix,''),
          edited_at=now(),updated_at=now()
      where id=ticket.discussion_message_id;
  end if;
end;
$$;

create or replace function public.attach_commercial_ticket_documents(
  target_ticket_id uuid,
  target_attachment_ids uuid[],
  target_document_links jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_membership_id();
  ticket public.commercial_ticket_records%rowtype;
  announcement public.chat_messages%rowtype;
  link_lines text;
  attached_count integer := 0;
  project_message public.chat_messages%rowtype;
  doc_link jsonb;
  doc_url text;
  doc_title text;
begin
  if not public.current_user_has_permission('ticketing.manage') then
    raise exception 'Hanya BD atau CEO yang dapat melampirkan dokumen ticket.' using errcode='42501';
  end if;
  select * into ticket from public.commercial_ticket_records
    where id=target_ticket_id and deleted_at is null for update;
  if ticket.id is null or ticket.chat_message_id is null then
    raise exception 'Pengumuman ticket tidak ditemukan.';
  end if;
  select * into announcement from public.chat_messages where id=ticket.chat_message_id for update;
  if announcement.id is null or not public.is_chat_member(announcement.conversation_id,actor) then
    raise exception 'Percakapan Commercial tidak dapat diakses.' using errcode='42501';
  end if;
  if ticket.discussion_message_id is not null then
    select * into project_message from public.chat_messages where id=ticket.discussion_message_id for update;
  end if;

  if coalesce(cardinality(target_attachment_ids),0)>0 then
    select count(*) into attached_count from public.chat_attachments
      where id=any(target_attachment_ids)
        and conversation_id=announcement.conversation_id
        and uploader_membership_id=actor
        and message_id is null;
    if attached_count<>cardinality(target_attachment_ids) then
      raise exception 'Ada file yang tidak valid atau sudah dilampirkan.';
    end if;
    update public.chat_attachments set message_id=announcement.id
      where id=any(target_attachment_ids)
        and conversation_id=announcement.conversation_id
        and uploader_membership_id=actor
        and message_id is null;

    if project_message.id is not null then
      insert into public.chat_attachments(conversation_id,message_id,uploader_membership_id,document_id,drive_file_id,file_name,file_url,mime_type,size_bytes)
      select ticket.discussion_conversation_id,project_message.id,a.uploader_membership_id,a.document_id,a.drive_file_id,a.file_name,a.file_url,a.mime_type,a.size_bytes
      from public.chat_attachments a
      where a.id=any(target_attachment_ids) and a.message_id=announcement.id
        and not exists(select 1 from public.chat_attachments existing where existing.message_id=project_message.id and existing.file_url=a.file_url and existing.file_name=a.file_name);
    end if;
  end if;

  if target_document_links is not null and jsonb_typeof(target_document_links) is distinct from 'array' then
    raise exception 'Format link dokumen tidak valid.';
  end if;
  select string_agg(
    coalesce(nullif(trim(value->>'label'),''),trim(value->>'url'))||': '||trim(value->>'url'),
    E'\n'
  ) into link_lines
  from jsonb_array_elements(coalesce(target_document_links,'[]'::jsonb)) value
  where coalesce(trim(value->>'url'),'') ~* '^https?://';

  if exists(
    select 1 from jsonb_array_elements(coalesce(target_document_links,'[]'::jsonb)) value
    where coalesce(trim(value->>'url'),'') !~* '^https?://'
  ) then
    raise exception 'Link dokumen harus menggunakan http atau https.';
  end if;

  if link_lines is not null then
    update public.chat_messages
      set body=concat_ws(E'\n\n',nullif(body,''),'📎 DOKUMEN PENDUKUNG'||E'\n'||link_lines),
          updated_at=now()
      where id=announcement.id;

    if project_message.id is not null then
      update public.chat_messages
        set body=concat_ws(E'\n\\n',nullif(body,''),'📎 DOKUMEN PENDUKUNG'||E'\n'||link_lines),
            updated_at=now()
        where id=project_message.id;
    end if;
    for doc_link in select value from jsonb_array_elements(coalesce(target_document_links,'[]'::jsonb)) loop
      doc_url := trim(doc_link->>'url');
      if doc_url ~* '^https?://' and project_message.id is not null then
        doc_title := coalesce(nullif(trim(doc_link->>'label'),''),doc_url);
        if not exists(select 1 from public.chat_relations rel where rel.conversation_id=ticket.discussion_conversation_id and rel.message_id=project_message.id and rel.url=doc_url) then
          insert into public.chat_relations(conversation_id,message_id,relation_type,relation_id,title,url,metadata,created_by_membership_id)
          values(ticket.discussion_conversation_id,project_message.id,'document',ticket.id,doc_title,doc_url,jsonb_build_object('ticket_id',ticket.id,'ticket_code',ticket.ticket_code),actor);
        end if;
      end if;
    end loop;
  end if;
end;
$$;

-- Backfill the ticket announcement message id for existing PIC rooms.
update public.commercial_ticket_records t
set discussion_message_id = (
  select m.id
  from public.chat_messages m
  where m.conversation_id=t.discussion_conversation_id
    and m.parent_message_id is null
    and m.sender_membership_id=t.created_by_membership_id
    and (m.body like '🛠️ RUANG DISKUSI TIKET%' or m.body like '🎫 TICKET BARU%')
  order by m.created_at asc
  limit 1
)
where t.discussion_message_id is null
  and t.discussion_conversation_id is not null
  and t.deleted_at is null;

-- Align the PIC room's opening message to the same structured card as Commercial.
update public.chat_messages dm
set body=replace(cm.body,
  'Balas pada thread pengumuman ini untuk memulai chat teknis bersama PIC.',
  'Percakapan teknis dan handover berlangsung di ruang ini.'),
  updated_at=now()
from public.commercial_ticket_records t
join public.chat_messages cm on cm.id=t.chat_message_id
where dm.id=t.discussion_message_id and t.deleted_at is null;

-- Copy existing uploaded files to the matching PIC room so the file archive can find them there.
insert into public.chat_attachments(conversation_id,message_id,uploader_membership_id,document_id,drive_file_id,file_name,file_url,mime_type,size_bytes)
select t.discussion_conversation_id,t.discussion_message_id,a.uploader_membership_id,a.document_id,a.drive_file_id,a.file_name,a.file_url,a.mime_type,a.size_bytes
from public.commercial_ticket_records t
join public.chat_attachments a on a.message_id=t.chat_message_id
where t.deleted_at is null and t.discussion_message_id is not null
  and not exists(
    select 1 from public.chat_attachments existing
    where existing.message_id=t.discussion_message_id and existing.file_url=a.file_url and existing.file_name=a.file_name
  );

-- Ticket codes are renumbered by client name so internal IDs and links remain unchanged.
do $$
declare feriul uuid; finku uuid; old_fer text; old_finku text;
begin
  select id,ticket_code into feriul,old_fer
  from public.commercial_ticket_records
  where deleted_at is null and client_name='Feriulhadiiii (@feriulhadi_)';
  select id,ticket_code into finku,old_finku
  from public.commercial_ticket_records
  where deleted_at is null and client_name='Finku';
  if feriul is null or finku is null then raise exception 'Ticket Feriulhadi atau Finku tidak ditemukan; nomor tidak diubah.'; end if;
  if (select count(*) from public.commercial_ticket_records where deleted_at is null and client_name='Feriulhadiiii (@feriulhadi_)')<>1
     or (select count(*) from public.commercial_ticket_records where deleted_at is null and client_name='Finku')<>1 then
    raise exception 'Nama client tidak unik; nomor tiket tidak diubah.';
  end if;
  if exists(select 1 from public.commercial_ticket_records where ticket_code in ('CI-TKT-2026-000020','CI-TKT-2026-000021') and id not in (feriul,finku)) then
    raise exception 'Nomor 000020 atau 000021 sudah dipakai tiket lain.';
  end if;
  update public.commercial_ticket_records set ticket_code='CI-TKT-2026-000020' where id=feriul;
  update public.commercial_ticket_records set ticket_code='CI-TKT-2026-000021' where id=finku;

  update public.chat_conversations set name=replace(name,old_fer,'CI-TKT-2026-000020') where id=(select discussion_conversation_id from public.commercial_ticket_records where id=feriul);
  update public.chat_conversations set name=replace(name,old_finku,'CI-TKT-2026-000021') where id=(select discussion_conversation_id from public.commercial_ticket_records where id=finku);

  update public.chat_messages set body=replace(body,old_fer,'CI-TKT-2026-000020') where body like '%'||old_fer||'%';
  update public.chat_messages set body=replace(body,old_finku,'CI-TKT-2026-000021') where body like '%'||old_finku||'%';

  update public.chat_relations set title='CI-TKT-2026-000020',metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{ticket_code}','"CI-TKT-2026-000020"'::jsonb,true)
    where relation_id=feriul;
  update public.chat_relations set title='CI-TKT-2026-000021',metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{ticket_code}','"CI-TKT-2026-000021"'::jsonb,true)
    where relation_id=finku;
end $$;

-- Preserve the requested sequence: Finku is 21, so the next issued ticket is 22.
select setval('public.commercial_ticket_record_seq', greatest(21, (select coalesce(max(case when ticket_code ~ '-[0-9]{6}
 then substring(ticket_code from '([0-9]{6})
)::bigint end),0) from public.commercial_ticket_records)), true);
