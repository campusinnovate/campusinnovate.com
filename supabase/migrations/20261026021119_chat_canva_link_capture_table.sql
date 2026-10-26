create table public.chat_canva_links (
 id uuid primary key default gen_random_uuid(),
 source_message_id uuid not null references public.chat_messages(id) on delete cascade,
 conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
 sender_membership_id uuid references public.memberships(id) on delete set null,
 url text not null,
 normalized_url text not null,
 title_hint text,
 shared_at timestamptz not null,
 created_at timestamptz not null default now(),
 constraint chat_canva_links_message_url_key unique(source_message_id,normalized_url)
);
create index chat_canva_links_shared_at_idx on public.chat_canva_links(shared_at desc);
alter table public.chat_canva_links enable row level security;
create policy "Marketing can view captured Canva links" on public.chat_canva_links
 for select to authenticated using (public.current_user_has_permission('marketing.proposal.view'));
grant select on public.chat_canva_links to authenticated;
