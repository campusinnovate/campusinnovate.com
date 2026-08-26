-- Ruang Kawan production handover: chat collaboration, RSVP/Gmail audit, and PWA push.
-- Requires 20260826090000_kawan_chat_intelligence.sql and does not touch Finance.

create table if not exists public.chat_thread_reads(
 parent_message_id uuid not null references public.chat_messages(id) on delete cascade,
 membership_id uuid not null references public.memberships(id) on delete cascade,
 last_read_at timestamptz not null default now(),
 primary key(parent_message_id,membership_id)
);

create table if not exists public.chat_meeting_responses(
 meeting_id uuid not null references public.chat_meetings(id) on delete cascade,
 membership_id uuid not null references public.memberships(id) on delete cascade,
 response text not null check(response in('yes','no','maybe')),
 attendance_note text,
 seat_note text,
 responded_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(meeting_id,membership_id)
);

create table if not exists public.chat_email_deliveries(
 id uuid primary key default extensions.gen_random_uuid(),
 message_id uuid not null references public.chat_messages(id) on delete cascade,
 requested_by_membership_id uuid not null references public.memberships(id),
 recipient_membership_id uuid not null references public.memberships(id),
 recipient_email text not null,
 idempotency_key text not null unique,
 status text not null default 'pending' check(status in('pending','sent','failed')),
 provider_message_id text,
 error_message text,
 created_at timestamptz not null default now(),
 sent_at timestamptz
);

create table if not exists public.push_subscriptions(
 id uuid primary key default extensions.gen_random_uuid(),
 membership_id uuid not null references public.memberships(id) on delete cascade,
 endpoint text not null,
 p256dh text not null,
 auth text not null,
 user_agent text,
 device_label text,
 is_active boolean not null default true,
 last_success_at timestamptz,
 last_failure_at timestamptz,
 failure_count integer not null default 0,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(membership_id,endpoint)
);

create table if not exists public.push_delivery_queue(
 id uuid primary key default extensions.gen_random_uuid(),
 notification_id uuid not null references public.notifications(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 status text not null default 'pending' check(status in('pending','processing','sent','failed','expired')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 locked_at timestamptz,
 error_message text,
 created_at timestamptz not null default now(),
 delivered_at timestamptz,
 unique(notification_id,subscription_id)
);

create index if not exists push_delivery_pending_idx on public.push_delivery_queue(next_attempt_at,created_at) where status in('pending','failed');
create index if not exists chat_email_delivery_status_idx on public.chat_email_deliveries(status,created_at);

create or replace function public.add_chat_members(target_conversation_id uuid,member_ids uuid[])
returns integer language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();member uuid;added integer:=0;kind_value text;
begin
 if not public.can_manage_chat(target_conversation_id) then raise exception 'Hanya owner/manager yang dapat menambah anggota.' using errcode='42501';end if;
 select kind into kind_value from public.chat_conversations where id=target_conversation_id and deleted_at is null;
 if kind_value is null or kind_value='direct' then raise exception 'Anggota direct message tidak dapat diubah.';end if;
 foreach member in array coalesce(member_ids,'{}') loop
  if member<>actor and exists(select 1 from public.memberships where id=member and status='active') then
   insert into public.chat_conversation_members(conversation_id,membership_id,member_role,notification_level,last_read_at,left_at)
   values(target_conversation_id,member,'member','mentions',now(),null)
   on conflict(conversation_id,membership_id) do update set left_at=null,joined_at=now();
   added:=added+1;
  end if;
 end loop;
 insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),'chat.members.add','chat_conversation',target_conversation_id::text,jsonb_build_object('member_ids',member_ids,'added',added));
 return added;
end;$$;

create or replace function public.remove_chat_member(target_conversation_id uuid,target_membership_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();target_role text;
begin
 if actor<>target_membership_id and not public.can_manage_chat(target_conversation_id) then raise exception 'Izin mengeluarkan anggota diperlukan.' using errcode='42501';end if;
 select member_role into target_role from public.chat_conversation_members where conversation_id=target_conversation_id and membership_id=target_membership_id and left_at is null;
 if target_role='owner' and actor<>target_membership_id then raise exception 'Owner tidak dapat dikeluarkan.';end if;
 update public.chat_conversation_members set left_at=now() where conversation_id=target_conversation_id and membership_id=target_membership_id and left_at is null;
end;$$;

create or replace function public.send_chat_message(target_conversation_id uuid,message_body text,reply_to_message_id uuid default null,attachment_ids uuid[] default '{}',mention_membership_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_membership_id();saved uuid;recipient uuid;effective_mentions uuid[]:=coalesce(mention_membership_ids,'{}');mention_all boolean:=lower(coalesce(message_body,'')) ~ '(^|[[:space:]])@all([[:space:][:punct:]]|$)';
begin
 if not public.is_chat_member(target_conversation_id,me) then raise exception 'Percakapan tidak dapat diakses.' using errcode='42501';end if;
 if reply_to_message_id is not null and not exists(select 1 from public.chat_messages where id=reply_to_message_id and conversation_id=target_conversation_id and parent_message_id is null) then raise exception 'Thread tidak valid.';end if;
 if nullif(trim(message_body),'') is null and cardinality(coalesce(attachment_ids,'{}'))=0 then raise exception 'Pesan atau lampiran wajib diisi.';end if;
 if mention_all then select coalesce(array_agg(membership_id),'{}') into effective_mentions from public.chat_conversation_members where conversation_id=target_conversation_id and left_at is null and membership_id<>me;end if;
 insert into public.chat_messages(conversation_id,sender_membership_id,parent_message_id,body) values(target_conversation_id,me,reply_to_message_id,coalesce(trim(message_body),'')) returning id into saved;
 update public.chat_attachments set message_id=saved where id=any(coalesce(attachment_ids,'{}')) and conversation_id=target_conversation_id and uploader_membership_id=me and message_id is null;
 insert into public.chat_message_mentions(message_id,membership_id)
 select saved,cm.membership_id from public.chat_conversation_members cm where cm.conversation_id=target_conversation_id and cm.left_at is null and cm.membership_id=any(effective_mentions) and cm.membership_id<>me on conflict do nothing;
 for recipient in select cm.membership_id from public.chat_conversation_members cm where cm.conversation_id=target_conversation_id and cm.left_at is null and cm.membership_id<>me and (cm.notification_level='all' or cm.membership_id=any(effective_mentions)) loop
  insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key)
  values(recipient,me,case when recipient=any(effective_mentions) then case when mention_all then 'chat.mention_all' else 'chat.mention' end when reply_to_message_id is not null then 'chat.thread' else 'chat.message' end,case when recipient=any(effective_mentions) then case when mention_all then 'Semua anggota disebut di Kawan Chat' else 'Kamu disebut di Kawan Chat' end when reply_to_message_id is not null then 'Balasan baru di thread' else 'Pesan baru di Kawan Chat' end,left(coalesce(nullif(trim(message_body),''),'Mengirim lampiran'),240),'chat_conversation',target_conversation_id::text,'/ruang-kawan/chat/?conversation='||target_conversation_id,'normal','chat-message:'||saved::text||':'||recipient::text)
  on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do nothing;
 end loop;
 update public.chat_conversations set updated_at=now() where id=target_conversation_id;
 update public.chat_conversation_members set last_read_at=now() where conversation_id=target_conversation_id and membership_id=me;
 if reply_to_message_id is not null then insert into public.chat_thread_reads(parent_message_id,membership_id,last_read_at) values(reply_to_message_id,me,now()) on conflict(parent_message_id,membership_id) do update set last_read_at=excluded.last_read_at;end if;
 return saved;
end;$$;

create or replace function public.chat_thread_unread_counts(target_conversation_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select case when public.is_chat_member(target_conversation_id) then coalesce(jsonb_object_agg(parent_id,unread),'{}'::jsonb) else '{}'::jsonb end
 from(
  select p.id::text parent_id,count(r.id) filter(where r.sender_membership_id<>public.current_membership_id() and r.created_at>coalesce(tr.last_read_at,'epoch'::timestamptz)) unread
  from public.chat_messages p left join public.chat_messages r on r.parent_message_id=p.id and r.deleted_at is null
  left join public.chat_thread_reads tr on tr.parent_message_id=p.id and tr.membership_id=public.current_membership_id()
  where p.conversation_id=target_conversation_id and p.parent_message_id is null and p.deleted_at is null group by p.id,tr.last_read_at
 )q where unread>0;
$$;

create or replace function public.mark_chat_thread_read(target_message_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare conversation uuid;
begin
 select conversation_id into conversation from public.chat_messages where id=target_message_id and parent_message_id is null;
 if not public.is_chat_member(conversation) then raise exception 'Thread tidak dapat diakses.' using errcode='42501';end if;
 insert into public.chat_thread_reads(parent_message_id,membership_id,last_read_at) values(target_message_id,public.current_membership_id(),now()) on conflict(parent_message_id,membership_id) do update set last_read_at=excluded.last_read_at;
end;$$;

create or replace function public.chat_meeting_workspace(target_conversation_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();result jsonb;
begin
 if not public.is_chat_member(target_conversation_id,actor) then raise exception 'Meeting tidak dapat diakses.' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('my_response',(select to_jsonb(r) from public.chat_meeting_responses r where r.meeting_id=m.id and r.membership_id=actor),'responses',coalesce((select jsonb_agg(jsonb_build_object('membership_id',r.membership_id,'name',coalesce(mem.full_name,mem.email::text),'response',r.response,'attendance_note',r.attendance_note,'seat_note',r.seat_note,'responded_at',r.responded_at) order by coalesce(mem.full_name,mem.email::text)) from public.chat_meeting_responses r join public.memberships mem on mem.id=r.membership_id where r.meeting_id=m.id),'[]'::jsonb)) order by m.starts_at desc),'[]'::jsonb) into result from public.chat_meetings m where m.conversation_id=target_conversation_id;
 return result;
end;$$;

create or replace function public.respond_chat_meeting(target_meeting_id uuid,response_value text,attendance_note_value text default null,seat_note_value text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();meeting public.chat_meetings%rowtype;actor_email text;creator uuid;
begin
 select * into meeting from public.chat_meetings where id=target_meeting_id;
 if meeting.id is null or not public.is_chat_member(meeting.conversation_id,actor) or not(actor=any(meeting.attendee_membership_ids) or actor=meeting.created_by_membership_id) then raise exception 'RSVP meeting tidak tersedia.' using errcode='42501';end if;
 if response_value not in('yes','no','maybe') then raise exception 'Respons RSVP tidak valid.';end if;
 insert into public.chat_meeting_responses(meeting_id,membership_id,response,attendance_note,seat_note) values(meeting.id,actor,response_value,nullif(trim(attendance_note_value),''),nullif(trim(seat_note_value),'')) on conflict(meeting_id,membership_id) do update set response=excluded.response,attendance_note=excluded.attendance_note,seat_note=excluded.seat_note,responded_at=now(),updated_at=now();
 creator:=meeting.created_by_membership_id;
 if creator<>actor then insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key) values(creator,actor,'meeting.rsvp','RSVP meeting diperbarui',response_value||' · '||meeting.title,'chat_meeting',meeting.id::text,'/ruang-kawan/chat/?conversation='||meeting.conversation_id,'normal','meeting-rsvp:'||meeting.id::text||':'||actor::text) on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do update set message=excluded.message,read_at=null,dismissed_at=null,created_at=now();end if;
 select email::text into actor_email from public.memberships where id=actor;
 return jsonb_build_object('meeting_id',meeting.id,'conversation_id',meeting.conversation_id,'google_event_id',meeting.google_event_id,'google_calendar_id',meeting.google_calendar_id,'email',actor_email,'response',response_value);
end;$$;

create or replace function public.save_push_subscription(subscription jsonb,device_name text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();saved uuid;endpoint_value text:=subscription->>'endpoint';
begin
 if actor is null or not public.current_user_has_permission('notifications.view_self') then raise exception 'Akses notifikasi diperlukan.' using errcode='42501';end if;
 if nullif(endpoint_value,'') is null or nullif(subscription#>>'{keys,p256dh}','') is null or nullif(subscription#>>'{keys,auth}','') is null then raise exception 'Push subscription tidak lengkap.';end if;
 insert into public.push_subscriptions(membership_id,endpoint,p256dh,auth,user_agent,device_label,is_active,updated_at)
 values(actor,endpoint_value,subscription#>>'{keys,p256dh}',subscription#>>'{keys,auth}',left(coalesce(subscription->>'userAgent',''),500),left(nullif(trim(device_name),''),120),true,now())
 on conflict(membership_id,endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,device_label=excluded.device_label,is_active=true,expires_at=null,updated_at=now() returning id into saved;
 return saved;
end;$$;

create or replace function public.remove_push_subscription(endpoint_value text)
returns void language sql security definer set search_path=public as $$
 update public.push_subscriptions set is_active=false,updated_at=now() where membership_id=public.current_membership_id() and endpoint=endpoint_value;
$$;

create or replace function public.queue_push_notification()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.push_delivery_queue(notification_id,subscription_id)
 select new.id,s.id from public.push_subscriptions s where s.membership_id=new.recipient_membership_id and s.is_active and (s.expires_at is null or s.expires_at>now()) on conflict do nothing;
 return new;
end;$$;

drop trigger if exists notification_push_queue on public.notifications;
create trigger notification_push_queue after insert on public.notifications for each row execute function public.queue_push_notification();

alter table public.chat_thread_reads enable row level security;
alter table public.chat_meeting_responses enable row level security;
alter table public.chat_email_deliveries enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_delivery_queue enable row level security;

drop policy if exists "Chat thread reads own" on public.chat_thread_reads;
create policy "Chat thread reads own" on public.chat_thread_reads for select to authenticated using(membership_id=public.current_membership_id());
drop policy if exists "Meeting responses member read" on public.chat_meeting_responses;
create policy "Meeting responses member read" on public.chat_meeting_responses for select to authenticated using(public.is_chat_member((select conversation_id from public.chat_meetings where id=meeting_id)));
drop policy if exists "Email deliveries requester read" on public.chat_email_deliveries;
create policy "Email deliveries requester read" on public.chat_email_deliveries for select to authenticated using(requested_by_membership_id=public.current_membership_id());
drop policy if exists "Push subscriptions own read" on public.push_subscriptions;
create policy "Push subscriptions own read" on public.push_subscriptions for select to authenticated using(membership_id=public.current_membership_id());

revoke all on public.chat_thread_reads,public.chat_meeting_responses,public.chat_email_deliveries,public.push_subscriptions,public.push_delivery_queue from anon,authenticated;
grant select on public.chat_thread_reads,public.chat_meeting_responses,public.chat_email_deliveries,public.push_subscriptions to authenticated;
revoke all on function public.add_chat_members(uuid,uuid[]),public.remove_chat_member(uuid,uuid),public.chat_thread_unread_counts(uuid),public.mark_chat_thread_read(uuid),public.chat_meeting_workspace(uuid),public.respond_chat_meeting(uuid,text,text,text),public.save_push_subscription(jsonb,text),public.remove_push_subscription(text) from anon,public;
grant execute on function public.add_chat_members(uuid,uuid[]),public.remove_chat_member(uuid,uuid),public.chat_thread_unread_counts(uuid),public.mark_chat_thread_read(uuid),public.chat_meeting_workspace(uuid),public.respond_chat_meeting(uuid,text,text,text),public.save_push_subscription(jsonb,text),public.remove_push_subscription(text) to authenticated;

do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null;end $$;
