-- Conversation history and once-per-day morning briefing for Kawan AI — Asisten CEO.

create table if not exists public.kawan_ai_ceo_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  message_kind text not null default 'chat' check (message_kind in ('chat','morning_briefing')),
  content text not null check (char_length(trim(content)) between 1 and 12000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources)='array'),
  briefing_date date,
  created_at timestamptz not null default now(),
  check ((message_kind='morning_briefing' and briefing_date is not null) or (message_kind='chat' and briefing_date is null))
);

create unique index if not exists kawan_ai_ceo_one_briefing_per_day
  on public.kawan_ai_ceo_messages(membership_id, briefing_date)
  where message_kind='morning_briefing';

alter table public.kawan_ai_ceo_messages enable row level security;

create policy "Members can read their CEO AI conversation"
on public.kawan_ai_ceo_messages for select to authenticated
using (membership_id=public.current_membership_id());

create policy "Members can write their CEO AI conversation"
on public.kawan_ai_ceo_messages for insert to authenticated
with check (
  membership_id=public.current_membership_id()
  and public.current_user_has_permission('ai.ceo_assistant')
);

create or replace function public.kawan_ai_ceo_history()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid:=public.current_membership_id();
begin
  if me is null or not public.current_user_has_permission('ai.ceo_assistant') then
    raise exception 'Kawan AI Asisten CEO tidak tersedia.' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',id,'role',role,'message_kind',message_kind,'content',content,
      'sources',sources,'created_at',created_at
    ) order by created_at)
    from (
      select * from public.kawan_ai_ceo_messages
      where membership_id=me order by created_at desc limit 60
    ) recent
  ),'[]'::jsonb);
end;$$;

revoke all on public.kawan_ai_ceo_messages from anon,public;
grant select,insert on public.kawan_ai_ceo_messages to authenticated;
revoke all on function public.kawan_ai_ceo_history() from anon,public;
grant execute on function public.kawan_ai_ceo_history() to authenticated;
