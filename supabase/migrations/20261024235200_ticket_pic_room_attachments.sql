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

