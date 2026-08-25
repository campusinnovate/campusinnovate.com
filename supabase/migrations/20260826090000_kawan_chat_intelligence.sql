-- Kawan Chat, contextual AI audit, work relations, and meeting registry.
-- This migration is intentionally not applied automatically.

insert into public.permissions(key,name,description) values
  ('chat.view','Gunakan Kawan Chat','Membaca percakapan yang diikuti.'),
  ('chat.create','Buat percakapan','Membuat direct message, grup, dan space.'),
  ('chat.manage','Kelola Kawan Chat','Mengelola anggota, pin, arsip, dan moderasi space.'),
  ('ai.use','Gunakan Kawan AI','Meminta analisis kontekstual sesuai izin pengguna.'),
  ('meeting.create','Buat meeting','Membuat meeting Google Calendar/Meet dari Ruang Kawan.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in('system_admin','executive','finance_manager','people_hr_manager','project_lead','staff','freelancer')
and p.key in('chat.view','chat.create','ai.use','meeting.create')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in('system_admin','executive') and p.key='chat.manage'
on conflict do nothing;

create table public.chat_conversations(
  id uuid primary key default extensions.gen_random_uuid(),
  name text,
  kind text not null check(kind in('direct','group','team','project','private')),
  avatar_url text,
  project_id uuid references public.projects(id) on delete set null,
  retention_days integer check(retention_days is null or retention_days between 30 and 3650),
  created_by_membership_id uuid not null references public.memberships(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(kind='direct' or nullif(trim(name),'') is not null)
);

create table public.chat_conversation_members(
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  member_role text not null default 'member' check(member_role in('owner','manager','member')),
  notification_level text not null default 'mentions' check(notification_level in('all','mentions','none')),
  starred_at timestamptz,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key(conversation_id,membership_id)
);

create table public.chat_messages(
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_membership_id uuid not null references public.memberships(id),
  parent_message_id uuid references public.chat_messages(id) on delete set null,
  body text not null default '' check(length(trim(body)) <= 12000),
  edited_at timestamptz,
  deleted_at timestamptz,
  pinned_at timestamptz,
  pinned_by_membership_id uuid references public.memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_reactions(
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  emoji text not null check(length(emoji) between 1 and 24),
  created_at timestamptz not null default now(),
  primary key(message_id,membership_id,emoji)
);

create table public.chat_attachments(
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  message_id uuid references public.chat_messages(id) on delete cascade,
  uploader_membership_id uuid not null references public.memberships(id),
  document_id uuid references public.documents(id) on delete set null,
  drive_file_id text,
  file_name text not null,
  file_url text not null,
  mime_type text,
  size_bytes bigint check(size_bytes is null or size_bytes>=0),
  created_at timestamptz not null default now()
);

create table public.chat_message_mentions(
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(message_id,membership_id)
);

create table public.chat_relations(
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  message_id uuid references public.chat_messages(id) on delete set null,
  relation_type text not null check(relation_type in('project','assignment','document','meeting','decision','content','pipeline')),
  relation_id uuid,
  title text not null,
  url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now()
);

create table public.chat_meetings(
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  source_message_id uuid references public.chat_messages(id) on delete set null,
  title text not null,
  agenda text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Asia/Jakarta',
  attendee_membership_ids uuid[] not null default '{}',
  google_event_id text,
  google_calendar_id text,
  meet_url text,
  html_link text,
  status text not null default 'scheduled' check(status in('scheduled','cancelled','completed')),
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at>starts_at)
);

create table public.kawan_ai_runs(
  id uuid primary key default extensions.gen_random_uuid(),
  membership_id uuid not null references public.memberships(id),
  context_route text not null,
  context_entity_type text,
  context_entity_id text,
  intent text,
  model text,
  proposed_actions jsonb not null default '[]'::jsonb,
  confirmed_action_ids text[] not null default '{}',
  status text not null default 'completed' check(status in('completed','failed','partially_confirmed','confirmed')),
  created_at timestamptz not null default now()
);

create index chat_members_membership_idx on public.chat_conversation_members(membership_id,conversation_id) where left_at is null;
create index chat_messages_conversation_idx on public.chat_messages(conversation_id,created_at desc) where deleted_at is null;
create index chat_messages_parent_idx on public.chat_messages(parent_message_id,created_at) where parent_message_id is not null;
create index chat_mentions_membership_idx on public.chat_message_mentions(membership_id,created_at desc);
create index chat_relations_conversation_idx on public.chat_relations(conversation_id,created_at desc);
create index chat_meetings_conversation_idx on public.chat_meetings(conversation_id,starts_at desc);
create index kawan_ai_runs_member_idx on public.kawan_ai_runs(membership_id,created_at desc);

create or replace function public.is_chat_member(target_conversation_id uuid,target_membership_id uuid default public.current_membership_id())
returns boolean language sql stable security definer set search_path=public as $$
 select target_membership_id is not null and exists(select 1 from public.chat_conversation_members cm join public.chat_conversations c on c.id=cm.conversation_id where cm.conversation_id=target_conversation_id and cm.membership_id=target_membership_id and cm.left_at is null and c.deleted_at is null);
$$;

create or replace function public.can_manage_chat(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.current_user_has_permission('chat.manage') or exists(select 1 from public.chat_conversation_members where conversation_id=target_conversation_id and membership_id=public.current_membership_id() and left_at is null and member_role in('owner','manager'));
$$;

create or replace function public.chat_workspace()
returns jsonb language sql stable security definer set search_path=public as $$
with me as(select public.current_membership_id() id), accessible as(
 select c.*,cm.starred_at,cm.last_read_at,
  case when c.kind='direct' then coalesce((select coalesce(m.full_name,m.email::text) from public.chat_conversation_members peer join public.memberships m on m.id=peer.membership_id where peer.conversation_id=c.id and peer.membership_id<>me.id and peer.left_at is null limit 1),c.name,'Pesan langsung') else c.name end display_name,
  case when c.kind='direct' then (select p.avatar_url from public.chat_conversation_members peer join public.memberships m on m.id=peer.membership_id left join public.profiles p on p.user_id=m.user_id where peer.conversation_id=c.id and peer.membership_id<>me.id and peer.left_at is null limit 1) else c.avatar_url end display_avatar
 from public.chat_conversations c join public.chat_conversation_members cm on cm.conversation_id=c.id cross join me
 where cm.membership_id=me.id and cm.left_at is null and c.deleted_at is null
), rows as(
 select a.id,a.display_name name,a.kind,a.display_avatar avatar_url,a.starred_at is not null starred,
  (select count(*) from public.chat_conversation_members x where x.conversation_id=a.id and x.left_at is null) member_count,
  lm.body last_message,lm.created_at last_message_at,
  (select count(*) from public.chat_messages um where um.conversation_id=a.id and um.deleted_at is null and um.sender_membership_id<>(select id from me) and um.created_at>coalesce(a.last_read_at,'epoch'::timestamptz)) unread_count,
  (select count(*) from public.chat_message_mentions mn join public.chat_messages mm on mm.id=mn.message_id where mm.conversation_id=a.id and mn.membership_id=(select id from me) and mm.deleted_at is null and mm.created_at>coalesce(a.last_read_at,'epoch'::timestamptz)) mention_count
 from accessible a left join lateral(select body,created_at from public.chat_messages where conversation_id=a.id and deleted_at is null order by created_at desc limit 1) lm on true
)
select jsonb_build_object(
 'conversations',coalesce((select jsonb_agg(to_jsonb(rows) order by starred desc,last_message_at desc nulls last) from rows),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'email',m.email,'avatar_url',p.avatar_url,'position_name',pos.name) order by coalesce(m.full_name,m.email::text)) from public.memberships m left join public.profiles p on p.user_id=m.user_id left join public.positions pos on pos.id=m.position_id where m.status='active'),'[]'::jsonb),
 'me',(select jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'email',m.email,'avatar_url',p.avatar_url) from public.memberships m left join public.profiles p on p.user_id=m.user_id where m.id=(select id from me)),
 'unread_total',coalesce((select sum(unread_count) from rows),0),
 'mentions_total',coalesce((select sum(mention_count) from rows),0)
);
$$;

create or replace function public.chat_conversation(target_conversation_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb; me uuid:=public.current_membership_id();
begin
 if not public.is_chat_member(target_conversation_id,me) then raise exception 'Percakapan tidak dapat diakses.' using errcode='42501'; end if;
 select jsonb_build_object(
  'conversation',jsonb_build_object('id',c.id,'name',case when c.kind='direct' then coalesce((select coalesce(peer.full_name,peer.email::text) from public.chat_conversation_members pcm join public.memberships peer on peer.id=pcm.membership_id where pcm.conversation_id=c.id and pcm.membership_id<>me and pcm.left_at is null limit 1),c.name,'Pesan langsung') else c.name end,'kind',c.kind,'avatar_url',case when c.kind='direct' then (select peer_profile.avatar_url from public.chat_conversation_members pcm join public.memberships peer on peer.id=pcm.membership_id left join public.profiles peer_profile on peer_profile.user_id=peer.user_id where pcm.conversation_id=c.id and pcm.membership_id<>me and pcm.left_at is null limit 1) else c.avatar_url end,'member_count',(select count(*) from public.chat_conversation_members where conversation_id=c.id and left_at is null)),
  'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'email',m.email,'avatar_url',p.avatar_url,'position_name',pos.name,'last_read_at',cm.last_read_at,'online',false) order by coalesce(m.full_name,m.email::text)) from public.chat_conversation_members cm join public.memberships m on m.id=cm.membership_id left join public.profiles p on p.user_id=m.user_id left join public.positions pos on pos.id=m.position_id where cm.conversation_id=c.id and cm.left_at is null),'[]'::jsonb),
  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',msg.id,'body',msg.body,'created_at',msg.created_at,'edited_at',msg.edited_at,'deleted_at',msg.deleted_at,'parent_id',msg.parent_message_id,'pinned',msg.pinned_at is not null,'sender',jsonb_build_object('id',sender.id,'name',coalesce(sender.full_name,sender.email::text),'avatar_url',sp.avatar_url),'reply_count',(select count(*) from public.chat_messages r where r.parent_message_id=msg.id and r.deleted_at is null),'read_count',(select count(*) from public.chat_conversation_members reader where reader.conversation_id=msg.conversation_id and reader.membership_id<>msg.sender_membership_id and reader.left_at is null and reader.last_read_at>=msg.created_at),'mentions',coalesce((select jsonb_agg(mn.membership_id) from public.chat_message_mentions mn where mn.message_id=msg.id),'[]'::jsonb),'reactions',coalesce((select jsonb_agg(jsonb_build_object('emoji',rx.emoji,'count',rx.total,'reacted_by_me',rx.mine)) from(select emoji,count(*) total,bool_or(membership_id=me) mine from public.chat_reactions where message_id=msg.id group by emoji)rx),'[]'::jsonb),'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.file_name,'url',a.file_url,'mime_type',a.mime_type,'size_label',case when a.size_bytes is null then null when a.size_bytes<1048576 then round(a.size_bytes/1024.0)||' KB' else round(a.size_bytes/1048576.0,1)||' MB' end)) from public.chat_attachments a where a.message_id=msg.id),'[]'::jsonb)) order by msg.created_at) from public.chat_messages msg join public.memberships sender on sender.id=msg.sender_membership_id left join public.profiles sp on sp.user_id=sender.user_id where msg.conversation_id=c.id and msg.parent_message_id is null),'[]'::jsonb),
  'related',coalesce((select jsonb_agg(jsonb_build_object('id',rel.id,'type',rel.relation_type,'title',rel.title,'subtitle',rel.metadata->>'subtitle','url',rel.url) order by rel.created_at desc) from public.chat_relations rel where rel.conversation_id=c.id),'[]'::jsonb)
 ) into result from public.chat_conversations c where c.id=target_conversation_id and c.deleted_at is null;
 return result;
end;$$;

create or replace function public.create_chat_conversation(conversation_name text,conversation_kind text,member_ids uuid[])
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_membership_id(); saved uuid; member uuid;
begin
 if me is null or not public.current_user_has_permission('chat.create') then raise exception 'Izin membuat percakapan diperlukan.' using errcode='42501'; end if;
 if conversation_kind not in('direct','group','team','project','private') then raise exception 'Jenis percakapan tidak valid.'; end if;
 if conversation_kind='direct' and cardinality(member_ids)<>1 then raise exception 'Pesan langsung membutuhkan satu anggota.'; end if;
 if conversation_kind<>'direct' and nullif(trim(conversation_name),'') is null then raise exception 'Nama ruang wajib diisi.'; end if;
 insert into public.chat_conversations(name,kind,created_by_membership_id) values(case when conversation_kind='direct' then null else trim(conversation_name) end,conversation_kind,me) returning id into saved;
 insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at) values(saved,me,'owner','all',now());
 foreach member in array member_ids loop
  if member<>me and exists(select 1 from public.memberships where id=member and status='active') then insert into public.chat_conversation_members(conversation_id,membership_id,notification_level) values(saved,member,case when conversation_kind='direct' then 'all' else 'mentions' end) on conflict do nothing; end if;
 end loop;
 insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),'chat.conversation.create','chat_conversation',saved::text,jsonb_build_object('kind',conversation_kind,'member_count',cardinality(member_ids)+1));
 return saved;
end;$$;

create or replace function public.send_chat_message(target_conversation_id uuid,message_body text,reply_to_message_id uuid default null,attachment_ids uuid[] default '{}',mention_membership_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_membership_id(); saved uuid; recipient uuid;
begin
 if not public.is_chat_member(target_conversation_id,me) then raise exception 'Percakapan tidak dapat diakses.' using errcode='42501'; end if;
 if reply_to_message_id is not null and not exists(select 1 from public.chat_messages where id=reply_to_message_id and conversation_id=target_conversation_id) then raise exception 'Thread tidak valid.'; end if;
 if nullif(trim(message_body),'') is null and cardinality(coalesce(attachment_ids,'{}'))=0 then raise exception 'Pesan atau lampiran wajib diisi.'; end if;
 insert into public.chat_messages(conversation_id,sender_membership_id,parent_message_id,body) values(target_conversation_id,me,reply_to_message_id,coalesce(trim(message_body),'')) returning id into saved;
 update public.chat_attachments set message_id=saved where id=any(coalesce(attachment_ids,'{}')) and conversation_id=target_conversation_id and uploader_membership_id=me and message_id is null;
 insert into public.chat_message_mentions(message_id,membership_id)
 select saved,cm.membership_id from public.chat_conversation_members cm where cm.conversation_id=target_conversation_id and cm.left_at is null and cm.membership_id=any(coalesce(mention_membership_ids,'{}')) and cm.membership_id<>me on conflict do nothing;
 for recipient in select cm.membership_id from public.chat_conversation_members cm where cm.conversation_id=target_conversation_id and cm.left_at is null and cm.membership_id<>me and (cm.notification_level='all' or cm.membership_id=any(coalesce(mention_membership_ids,'{}'))) loop
  insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key)
  values(recipient,me,case when recipient=any(coalesce(mention_membership_ids,'{}')) then 'chat.mention' else 'chat.message' end,case when recipient=any(coalesce(mention_membership_ids,'{}')) then 'Kamu disebut di Kawan Chat' else 'Pesan baru di Kawan Chat' end,left(coalesce(nullif(trim(message_body),''),'Mengirim lampiran'),240),'chat_conversation',target_conversation_id::text,'/ruang-kawan/chat/?conversation='||target_conversation_id,'normal','chat-message:'||saved::text||':'||recipient::text)
  on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do nothing;
 end loop;
 update public.chat_conversations set updated_at=now() where id=target_conversation_id;
 update public.chat_conversation_members set last_read_at=now() where conversation_id=target_conversation_id and membership_id=me;
 return saved;
end;$$;

create or replace function public.chat_thread(target_message_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid:=public.current_membership_id(); conversation uuid; result jsonb;
begin
 select conversation_id into conversation from public.chat_messages where id=target_message_id;
 if not public.is_chat_member(conversation,me) then raise exception 'Thread tidak dapat diakses.' using errcode='42501'; end if;
 select jsonb_build_object(
  'parent',jsonb_build_object('id',p.id,'body',p.body,'created_at',p.created_at,'edited_at',p.edited_at,'deleted_at',p.deleted_at,'sender',jsonb_build_object('id',pm.id,'name',coalesce(pm.full_name,pm.email::text),'avatar_url',pp.avatar_url),'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.file_name,'url',a.file_url,'mime_type',a.mime_type)) from public.chat_attachments a where a.message_id=p.id),'[]'::jsonb)),
  'replies',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'body',r.body,'created_at',r.created_at,'edited_at',r.edited_at,'deleted_at',r.deleted_at,'parent_id',r.parent_message_id,'sender',jsonb_build_object('id',rm.id,'name',coalesce(rm.full_name,rm.email::text),'avatar_url',rp.avatar_url),'read_count',(select count(*) from public.chat_conversation_members reader where reader.conversation_id=r.conversation_id and reader.membership_id<>r.sender_membership_id and reader.left_at is null and reader.last_read_at>=r.created_at),'reactions',coalesce((select jsonb_agg(jsonb_build_object('emoji',rx.emoji,'count',rx.total,'reacted_by_me',rx.mine)) from(select emoji,count(*) total,bool_or(membership_id=me) mine from public.chat_reactions where message_id=r.id group by emoji)rx),'[]'::jsonb),'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.file_name,'url',a.file_url,'mime_type',a.mime_type)) from public.chat_attachments a where a.message_id=r.id),'[]'::jsonb)) order by r.created_at) from public.chat_messages r join public.memberships rm on rm.id=r.sender_membership_id left join public.profiles rp on rp.user_id=rm.user_id where r.parent_message_id=p.id),'[]'::jsonb)
 ) into result from public.chat_messages p join public.memberships pm on pm.id=p.sender_membership_id left join public.profiles pp on pp.user_id=pm.user_id where p.id=target_message_id and p.parent_message_id is null;
 return result;
end;$$;

create or replace function public.search_chat_messages(search_query text,target_conversation_id uuid default null,mentions_only boolean default false)
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(row_data order by created_at desc),'[]'::jsonb) from(
  select jsonb_build_object('id',msg.id,'conversation_id',msg.conversation_id,'conversation_name',coalesce(c.name,'Pesan langsung'),'body',msg.body,'created_at',msg.created_at,'sender_name',coalesce(m.full_name,m.email::text),'parent_id',msg.parent_message_id) row_data,msg.created_at
  from public.chat_messages msg join public.chat_conversations c on c.id=msg.conversation_id join public.memberships m on m.id=msg.sender_membership_id
  where msg.deleted_at is null and public.is_chat_member(msg.conversation_id) and (target_conversation_id is null or msg.conversation_id=target_conversation_id)
   and (not mentions_only or exists(select 1 from public.chat_message_mentions mn where mn.message_id=msg.id and mn.membership_id=public.current_membership_id()))
   and (nullif(trim(search_query),'') is null or msg.body ilike '%'||replace(replace(trim(search_query),'%','\%'),'_','\_')||'%' escape '\')
  order by msg.created_at desc limit 50
 ) found;
$$;

create or replace function public.register_chat_attachment(target_conversation_id uuid,file_payload jsonb,register_document boolean default true)
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_membership_id(); saved uuid; doc uuid; doc_code text;
begin
 if not public.is_chat_member(target_conversation_id,me) then raise exception 'Percakapan tidak dapat diakses.' using errcode='42501'; end if;
 if nullif(trim(file_payload->>'file_name'),'') is null or nullif(trim(file_payload->>'file_url'),'') is null then raise exception 'Metadata file tidak lengkap.'; end if;
 if coalesce(nullif(file_payload->>'size_bytes','')::bigint,0)>26214400 then raise exception 'Ukuran lampiran maksimum 25 MB.'; end if;
 if register_document and public.current_user_has_permission('documents.create') then
  doc_code:='DOC-CHAT-'||to_char(now(),'YYYYMM')||'-'||upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,8));
  insert into public.documents(document_id,title,document_type,category,description,owner_membership_id,source_module,linked_record_id,linked_record_name,status,classification,tags,created_by_membership_id,updated_by_membership_id)
  values(doc_code,file_payload->>'file_name','Chat Attachment','Kawan Chat','Lampiran percakapan Kawan Chat.',me,'chat',target_conversation_id::text,'Kawan Chat','draft','internal',array['kawan-chat'],me,me) returning id into doc;
  insert into public.document_versions(document_id,version_number,file_name,drive_file_url,file_type,file_size,source_kind,revision_summary,created_by_membership_id)
  values(doc,1,file_payload->>'file_name',file_payload->>'file_url',nullif(file_payload->>'mime_type',''),nullif(file_payload->>'size_bytes','')::bigint,'uploaded','Uploaded from Kawan Chat',me);
 end if;
 insert into public.chat_attachments(conversation_id,uploader_membership_id,document_id,drive_file_id,file_name,file_url,mime_type,size_bytes)
 values(target_conversation_id,me,doc,nullif(file_payload->>'drive_file_id',''),file_payload->>'file_name',file_payload->>'file_url',nullif(file_payload->>'mime_type',''),nullif(file_payload->>'size_bytes','')::bigint) returning id into saved;
 if doc is not null then
  insert into public.chat_relations(conversation_id,relation_type,relation_id,title,url,metadata,created_by_membership_id)
  values(target_conversation_id,'document',doc,file_payload->>'file_name','/ruang-kawan/documents/',jsonb_build_object('drive_url',file_payload->>'file_url','attachment_id',saved),me);
 end if;
 return saved;
end;$$;

create or replace function public.mark_chat_conversation_read(target_conversation_id uuid)
returns void language plpgsql security definer set search_path=public as $$ begin
 if not public.is_chat_member(target_conversation_id) then raise exception 'Percakapan tidak dapat diakses.' using errcode='42501'; end if;
 update public.chat_conversation_members set last_read_at=now() where conversation_id=target_conversation_id and membership_id=public.current_membership_id();
end;$$;

create or replace function public.toggle_chat_reaction(target_message_id uuid,reaction_emoji text)
returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_membership_id(); conversation uuid;
begin
 select conversation_id into conversation from public.chat_messages where id=target_message_id;
 if not public.is_chat_member(conversation,me) then raise exception 'Pesan tidak dapat diakses.' using errcode='42501'; end if;
 if exists(select 1 from public.chat_reactions where message_id=target_message_id and membership_id=me and emoji=reaction_emoji) then delete from public.chat_reactions where message_id=target_message_id and membership_id=me and emoji=reaction_emoji;
 else insert into public.chat_reactions(message_id,membership_id,emoji) values(target_message_id,me,reaction_emoji); end if;
end;$$;

create or replace function public.update_chat_message(target_message_id uuid,message_body text)
returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_membership_id(); target public.chat_messages%rowtype;
begin select * into target from public.chat_messages where id=target_message_id;
 if target.sender_membership_id<>me or target.deleted_at is not null then raise exception 'Pesan tidak dapat diedit.' using errcode='42501'; end if;
 update public.chat_messages set body=trim(message_body),edited_at=now(),updated_at=now() where id=target_message_id;
end;$$;

create or replace function public.delete_chat_message(target_message_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_membership_id(); target public.chat_messages%rowtype;
begin select * into target from public.chat_messages where id=target_message_id;
 if target.sender_membership_id<>me and not public.can_manage_chat(target.conversation_id) then raise exception 'Pesan tidak dapat dihapus.' using errcode='42501'; end if;
 update public.chat_messages set deleted_at=now(),updated_at=now() where id=target_message_id;
 insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,before_data) values(auth.uid(),'chat.message.soft_delete','chat_message',target_message_id::text,to_jsonb(target)-'body');
end;$$;

create or replace function public.toggle_chat_pin(target_message_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_membership_id(); conversation uuid;
begin select conversation_id into conversation from public.chat_messages where id=target_message_id;
 if not public.can_manage_chat(conversation) then raise exception 'Izin pin pesan diperlukan.' using errcode='42501'; end if;
 update public.chat_messages set pinned_at=case when pinned_at is null then now() else null end,pinned_by_membership_id=case when pinned_at is null then me else null end where id=target_message_id;
end;$$;

create or replace function public.toggle_chat_star(target_conversation_id uuid)
returns void language plpgsql security definer set search_path=public as $$ begin
 if not public.is_chat_member(target_conversation_id) then raise exception 'Percakapan tidak dapat diakses.' using errcode='42501'; end if;
 update public.chat_conversation_members set starred_at=case when starred_at is null then now() else null end where conversation_id=target_conversation_id and membership_id=public.current_membership_id();
end;$$;

create or replace function public.save_chat_relation(target_conversation_id uuid,target_message_id uuid,relation_kind text,relation_uuid uuid,relation_title text,relation_url text default null,relation_metadata jsonb default '{}')
returns uuid language plpgsql security definer set search_path=public as $$
declare saved uuid; me uuid:=public.current_membership_id();
begin
 if not public.is_chat_member(target_conversation_id,me) then raise exception 'Percakapan tidak dapat diakses.' using errcode='42501'; end if;
 if relation_kind not in('project','assignment','document','meeting','decision','content','pipeline') then raise exception 'Relasi tidak valid.'; end if;
 insert into public.chat_relations(conversation_id,message_id,relation_type,relation_id,title,url,metadata,created_by_membership_id) values(target_conversation_id,target_message_id,relation_kind,relation_uuid,trim(relation_title),relation_url,coalesce(relation_metadata,'{}'),me) returning id into saved;
 return saved;
end;$$;

create or replace function public.create_assignment_from_chat(target_message_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_membership_id(); msg public.chat_messages%rowtype; saved uuid; source uuid; owner uuid:=coalesce((payload->>'owner_membership_id')::uuid,me); reviewer uuid:=nullif(payload->>'reviewer_membership_id','')::uuid;
begin
 select * into msg from public.chat_messages where id=target_message_id and deleted_at is null;
 if not public.is_chat_member(msg.conversation_id,me) then raise exception 'Pesan tidak dapat diakses.' using errcode='42501'; end if;
 if owner<>me and not public.current_user_has_permission('activity.assign_team') then raise exception 'Izin assignment diperlukan.' using errcode='42501'; end if;
 select id into source from public.work_sources where key='assignment' and is_active=true limit 1;
 if source is null then select id into source from public.work_sources where key='manual_activity' and is_active=true limit 1; end if;
 if source is null then raise exception 'Sumber Assignment belum tersedia.'; end if;
 insert into public.activities(owner_membership_id,assigned_by_membership_id,reviewer_membership_id,source_id,title,activity_date,priority,detail,output,next_action,created_by,updated_by)
 values(owner,me,reviewer,source,coalesce(nullif(trim(payload->>'title'),''),left(msg.body,140)),coalesce((payload->>'due_date')::date,current_date),coalesce(nullif(payload->>'priority',''),'medium'),coalesce(nullif(trim(payload->>'detail'),''),msg.body),nullif(trim(payload->>'output'),''),nullif(trim(payload->>'next_action'),''),auth.uid(),auth.uid()) returning id into saved;
 insert into public.chat_relations(conversation_id,message_id,relation_type,relation_id,title,url,metadata,created_by_membership_id) values(msg.conversation_id,msg.id,'assignment',saved,coalesce(nullif(trim(payload->>'title'),''),left(msg.body,140)),'/ruang-kawan/activity/',jsonb_build_object('owner_membership_id',owner),me);
 if owner<>me then insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url) values(owner,me,'assignment','Assignment dari Kawan Chat',coalesce(nullif(trim(payload->>'title'),''),left(msg.body,140)),'activity',saved::text,'/ruang-kawan/activity/'); end if;
 insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),'chat.assignment.create','activity',saved::text,jsonb_build_object('message_id',msg.id,'conversation_id',msg.conversation_id));
 return saved;
end;$$;

create or replace function public.register_chat_meeting(target_conversation_id uuid,target_message_id uuid,meeting_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_membership_id(); saved uuid;
begin
 if not public.is_chat_member(target_conversation_id,me) or not public.current_user_has_permission('meeting.create') then raise exception 'Izin meeting diperlukan.' using errcode='42501'; end if;
 insert into public.chat_meetings(conversation_id,source_message_id,title,agenda,starts_at,ends_at,timezone,attendee_membership_ids,google_event_id,google_calendar_id,meet_url,html_link,created_by_membership_id)
 values(target_conversation_id,target_message_id,trim(meeting_payload->>'title'),nullif(trim(meeting_payload->>'agenda'),''),(meeting_payload->>'starts_at')::timestamptz,(meeting_payload->>'ends_at')::timestamptz,coalesce(nullif(meeting_payload->>'timezone',''),'Asia/Jakarta'),coalesce(array(select jsonb_array_elements_text(coalesce(meeting_payload->'attendee_membership_ids','[]'))::uuid),'{}'),meeting_payload->>'google_event_id',meeting_payload->>'google_calendar_id',meeting_payload->>'meet_url',meeting_payload->>'html_link',me) returning id into saved;
 insert into public.chat_relations(conversation_id,message_id,relation_type,relation_id,title,url,metadata,created_by_membership_id) values(target_conversation_id,target_message_id,'meeting',saved,meeting_payload->>'title',coalesce(meeting_payload->>'meet_url',meeting_payload->>'html_link'),jsonb_build_object('subtitle',(meeting_payload->>'starts_at')||' · '||(meeting_payload->>'ends_at')),me);
 return saved;
end;$$;

create or replace function public.kawan_ai_context(context_route text,context_entity_type text default null,context_entity_id text default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid:=public.current_membership_id(); access jsonb; module_context jsonb:='{}';
begin
 if me is null or not public.current_user_has_permission('ai.use') then raise exception 'Kawan AI tidak tersedia.' using errcode='42501'; end if;
 select jsonb_build_object('membership_id',m.id,'name',coalesce(m.full_name,m.email::text),'permissions',coalesce((select jsonb_agg(p.key) from public.permissions p where public.current_user_has_permission(p.key)),'[]'::jsonb)) into access from public.memberships m where m.id=me;
 if context_route like '/ruang-kawan/chat%' and context_entity_id is not null and public.is_chat_member(context_entity_id::uuid,me) then
  select jsonb_build_object('conversation_id',c.id,'conversation_name',coalesce(c.name,'Pesan langsung'),'recent_messages',coalesce((select jsonb_agg(jsonb_build_object('sender',coalesce(m.full_name,m.email::text),'body',x.body,'created_at',x.created_at) order by x.created_at) from(select * from public.chat_messages where conversation_id=c.id and deleted_at is null order by created_at desc limit 40)x join public.memberships m on m.id=x.sender_membership_id),'[]'::jsonb)) into module_context from public.chat_conversations c where c.id=context_entity_id::uuid;
 elsif context_route like '/ruang-kawan/projects%' and context_entity_id is not null and public.current_user_has_permission('projects.view') then
  select jsonb_build_object('project',to_jsonb(p)) into module_context from public.projects p where p.id=context_entity_id::uuid and p.deleted_at is null;
 elsif context_route like '/ruang-kawan/activity%' then
  select jsonb_build_object('my_open_activities',coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'date',a.activity_date,'status',a.status,'priority',a.priority) order by a.activity_date) filter(where a.id is not null),'[]'::jsonb)) into module_context from public.activities a where a.owner_membership_id=me and a.status<>'done';
 end if;
 return jsonb_build_object('actor',access,'route',context_route,'entity_type',context_entity_type,'entity_id',context_entity_id,'module_context',module_context);
end;$$;

create or replace function public.register_kawan_ai_run(context_route text,context_entity_type text,context_entity_id text,intent text,model_name text,actions jsonb)
returns uuid language plpgsql security definer set search_path=public as $$ declare saved uuid; begin
 if not public.current_user_has_permission('ai.use') then raise exception 'Kawan AI tidak tersedia.' using errcode='42501'; end if;
 insert into public.kawan_ai_runs(membership_id,context_route,context_entity_type,context_entity_id,intent,model,proposed_actions) values(public.current_membership_id(),context_route,context_entity_type,context_entity_id,intent,model_name,coalesce(actions,'[]')) returning id into saved; return saved;
end;$$;

create or replace function public.confirm_kawan_ai_action(target_run_id uuid,action_id text)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.kawan_ai_runs set
  confirmed_action_ids=case when action_id=any(confirmed_action_ids) then confirmed_action_ids else array_append(confirmed_action_ids,action_id) end,
  status='confirmed'
 where id=target_run_id and membership_id=public.current_membership_id();
 if not found then raise exception 'Run Kawan AI tidak dapat dikonfirmasi.' using errcode='42501'; end if;
end;$$;

alter table public.chat_conversations enable row level security;
alter table public.chat_conversation_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reactions enable row level security;
alter table public.chat_attachments enable row level security;
alter table public.chat_message_mentions enable row level security;
alter table public.chat_relations enable row level security;
alter table public.chat_meetings enable row level security;
alter table public.kawan_ai_runs enable row level security;

create policy "Chat conversations member read" on public.chat_conversations for select to authenticated using(public.is_chat_member(id));
create policy "Chat members member read" on public.chat_conversation_members for select to authenticated using(public.is_chat_member(conversation_id));
create policy "Chat messages member read" on public.chat_messages for select to authenticated using(public.is_chat_member(conversation_id));
create policy "Chat reactions member read" on public.chat_reactions for select to authenticated using(public.is_chat_member((select conversation_id from public.chat_messages where id=message_id)));
create policy "Chat attachments member read" on public.chat_attachments for select to authenticated using(public.is_chat_member(conversation_id));
create policy "Chat mentions member read" on public.chat_message_mentions for select to authenticated using(public.is_chat_member((select conversation_id from public.chat_messages where id=message_id)));
create policy "Chat relations member read" on public.chat_relations for select to authenticated using(public.is_chat_member(conversation_id));
create policy "Chat meetings member read" on public.chat_meetings for select to authenticated using(public.is_chat_member(conversation_id));
create policy "AI runs owner read" on public.kawan_ai_runs for select to authenticated using(membership_id=public.current_membership_id());

revoke all on public.chat_conversations,public.chat_conversation_members,public.chat_messages,public.chat_reactions,public.chat_attachments,public.chat_message_mentions,public.chat_relations,public.chat_meetings,public.kawan_ai_runs from anon,authenticated;
grant select on public.chat_conversations,public.chat_conversation_members,public.chat_messages,public.chat_reactions,public.chat_attachments,public.chat_message_mentions,public.chat_relations,public.chat_meetings,public.kawan_ai_runs to authenticated;
revoke all on function public.is_chat_member(uuid,uuid),public.can_manage_chat(uuid),public.chat_workspace(),public.chat_conversation(uuid),public.create_chat_conversation(text,text,uuid[]),public.send_chat_message(uuid,text,uuid,uuid[],uuid[]),public.chat_thread(uuid),public.search_chat_messages(text,uuid,boolean),public.register_chat_attachment(uuid,jsonb,boolean),public.mark_chat_conversation_read(uuid),public.toggle_chat_reaction(uuid,text),public.update_chat_message(uuid,text),public.delete_chat_message(uuid),public.toggle_chat_pin(uuid),public.toggle_chat_star(uuid),public.save_chat_relation(uuid,uuid,text,uuid,text,text,jsonb),public.create_assignment_from_chat(uuid,jsonb),public.register_chat_meeting(uuid,uuid,jsonb),public.kawan_ai_context(text,text,text),public.register_kawan_ai_run(text,text,text,text,text,jsonb),public.confirm_kawan_ai_action(uuid,text) from anon,public;
grant execute on function public.is_chat_member(uuid,uuid),public.can_manage_chat(uuid),public.chat_workspace(),public.chat_conversation(uuid),public.create_chat_conversation(text,text,uuid[]),public.send_chat_message(uuid,text,uuid,uuid[],uuid[]),public.chat_thread(uuid),public.search_chat_messages(text,uuid,boolean),public.register_chat_attachment(uuid,jsonb,boolean),public.mark_chat_conversation_read(uuid),public.toggle_chat_reaction(uuid,text),public.update_chat_message(uuid,text),public.delete_chat_message(uuid),public.toggle_chat_pin(uuid),public.toggle_chat_star(uuid),public.save_chat_relation(uuid,uuid,text,uuid,text,text,jsonb),public.create_assignment_from_chat(uuid,jsonb),public.register_chat_meeting(uuid,uuid,jsonb),public.kawan_ai_context(text,text,text),public.register_kawan_ai_run(text,text,text,text,text,jsonb),public.confirm_kawan_ai_action(uuid,text) to authenticated;

do $$ begin alter publication supabase_realtime add table public.chat_messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_reactions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_conversation_members; exception when duplicate_object then null; end $$;
