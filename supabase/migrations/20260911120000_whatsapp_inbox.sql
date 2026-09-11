-- Phase 1: shared inbox, using existing Pipeline permissions and staff identity.
create table public.whatsapp_conversations (
 id uuid primary key default gen_random_uuid(),
 phone text not null check (phone ~ '^[1-9][0-9]{6,14}$'),
 profile_name text not null default '',
 whatsapp_number_id text not null,
 last_message_at timestamptz not null default now(),
 last_incoming_at timestamptz,
 created_at timestamptz not null default now(),
 unique(whatsapp_number_id, phone)
);
create table public.whatsapp_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
 whatsapp_message_id text unique,
 direction text not null check(direction in ('incoming','outgoing')),
 message_type text not null,
 content text not null,
 delivery_status text not null check(delivery_status in ('received','sending','sent','delivered','read','failed','unknown')),
 sender_membership_id uuid references public.memberships(id) on delete set null,
 request_id uuid unique,
 error_code text,
 sent_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index whatsapp_messages_conversation_time on public.whatsapp_messages(conversation_id,created_at);
create index whatsapp_conversations_recent on public.whatsapp_conversations(last_message_at desc);
create table public.whatsapp_reads (
 conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
 membership_id uuid not null references public.memberships(id) on delete cascade,
 read_at timestamptz not null,
 primary key(conversation_id,membership_id)
);
-- Persist receipts even if they arrive before the send response has been stored.
create table public.whatsapp_receipts (
 wamid text primary key,
 status text not null check(status in ('sent','delivered','read','failed')),
 error_code text,
 occurred_at timestamptz not null
);
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_reads enable row level security;
alter table public.whatsapp_receipts enable row level security;
revoke all on public.whatsapp_conversations, public.whatsapp_messages, public.whatsapp_reads, public.whatsapp_receipts from anon, authenticated;
grant select on public.whatsapp_conversations, public.whatsapp_messages, public.whatsapp_reads to authenticated;
grant all on public.whatsapp_conversations, public.whatsapp_messages, public.whatsapp_reads, public.whatsapp_receipts to service_role;
create policy inbox_view on public.whatsapp_conversations for select to authenticated using(public.current_user_has_permission('pipeline.view'));
create policy inbox_messages_view on public.whatsapp_messages for select to authenticated using(public.current_user_has_permission('pipeline.view'));
create policy inbox_reads_view on public.whatsapp_reads for select to authenticated using(membership_id=public.current_membership_id() and public.current_user_has_permission('pipeline.view'));

create function public.whatsapp_receive(number_id text, phone_number text, display_name text, wamid text, kind text, body text, message_time timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare cid uuid; inserted_id uuid;
begin
 insert into whatsapp_conversations(phone,profile_name,whatsapp_number_id,last_message_at)
 values(phone_number,display_name,number_id,message_time)
 on conflict(whatsapp_number_id,phone) do update set profile_name=case when excluded.profile_name<>'' then excluded.profile_name else whatsapp_conversations.profile_name end
 returning id into cid;
 insert into whatsapp_messages(conversation_id,whatsapp_message_id,direction,message_type,content,delivery_status,sent_at)
 values(cid,wamid,'incoming',kind,body,'received',message_time)
 on conflict(whatsapp_message_id) do nothing returning id into inserted_id;
 if inserted_id is not null then
 update whatsapp_conversations set last_message_at=greatest(last_message_at,message_time),last_incoming_at=greatest(last_incoming_at,message_time) where id=cid;
 end if;
end $$;
create function public.whatsapp_status(wamid text, new_status text, status_time timestamptz, code text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 insert into whatsapp_receipts values(wamid,new_status,code,status_time)
 on conflict on constraint whatsapp_receipts_pkey do update set status=excluded.status,error_code=excluded.error_code,occurred_at=excluded.occurred_at
 where (case excluded.status when 'read' then 4 when 'delivered' then 3 when 'failed' then 2 else 1 end) >
 (case whatsapp_receipts.status when 'read' then 4 when 'delivered' then 3 when 'failed' then 2 else 1 end);
 update whatsapp_messages m set delivery_status=r.status,error_code=r.error_code from whatsapp_receipts r
 where m.whatsapp_message_id=r.wamid and r.wamid=whatsapp_status.wamid and m.direction='outgoing';
end $$;
create function public.whatsapp_apply_receipt() returns trigger language plpgsql set search_path=public as $$
begin
 select status,error_code into new.delivery_status,new.error_code from whatsapp_receipts where wamid=new.whatsapp_message_id;
 if not found then new.delivery_status=coalesce(old.delivery_status,'sent'); if new.delivery_status in ('sending','unknown') then new.delivery_status='sent'; end if; end if;
 return new;
end $$;
create trigger whatsapp_outgoing_receipt before update of whatsapp_message_id on public.whatsapp_messages for each row when(new.direction='outgoing' and new.whatsapp_message_id is not null) execute function public.whatsapp_apply_receipt();
create function public.whatsapp_mark_read(cid uuid, through_time timestamptz) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.current_user_has_permission('pipeline.view') then raise exception 'Akses inbox ditolak' using errcode='42501'; end if;
 insert into whatsapp_reads values(cid,public.current_membership_id(),least(through_time,now()))
 on conflict(conversation_id,membership_id) do update set read_at=greatest(whatsapp_reads.read_at,excluded.read_at);
end $$;
create function public.whatsapp_inbox() returns table(id uuid,phone text,profile_name text,last_message_at timestamptz,last_incoming_at timestamptz,preview text,unread_count bigint)
language sql stable security invoker set search_path=public as $$
 select c.id,c.phone,c.profile_name,c.last_message_at,c.last_incoming_at,
 (select m.content from whatsapp_messages m where m.conversation_id=c.id order by m.sent_at desc,m.created_at desc limit 1),
 (select count(*) from whatsapp_messages m where m.conversation_id=c.id and m.direction='incoming' and m.created_at>coalesce(r.read_at,'epoch'))
 from whatsapp_conversations c left join whatsapp_reads r on r.conversation_id=c.id and r.membership_id=public.current_membership_id()
 order by c.last_message_at desc limit 200
$$;
create function public.whatsapp_unread_total() returns bigint language sql stable security invoker set search_path=public as $$
 select count(*) from whatsapp_messages m left join whatsapp_reads r on r.conversation_id=m.conversation_id and r.membership_id=public.current_membership_id()
 where m.direction='incoming' and m.created_at>coalesce(r.read_at,'epoch')
$$;
revoke all on function public.whatsapp_receive(text,text,text,text,text,text,timestamptz), public.whatsapp_status(text,text,timestamptz,text), public.whatsapp_apply_receipt() from public,anon,authenticated;
grant execute on function public.whatsapp_receive(text,text,text,text,text,text,timestamptz), public.whatsapp_status(text,text,timestamptz,text) to service_role;
revoke all on function public.whatsapp_mark_read(uuid,timestamptz),public.whatsapp_inbox(),public.whatsapp_unread_total() from public,anon;
grant execute on function public.whatsapp_mark_read(uuid,timestamptz),public.whatsapp_inbox(),public.whatsapp_unread_total() to authenticated;

create function public.whatsapp_touch_conversation() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update whatsapp_conversations set last_message_at=greatest(last_message_at,new.sent_at) where id=new.conversation_id;
 return new;
end $$;
create trigger whatsapp_message_touch after insert on public.whatsapp_messages for each row execute function public.whatsapp_touch_conversation();
revoke all on function public.whatsapp_touch_conversation() from public,anon,authenticated;
