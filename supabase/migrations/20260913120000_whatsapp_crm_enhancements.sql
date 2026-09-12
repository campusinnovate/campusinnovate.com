-- WhatsApp CRM Enhancements: Phases 2-4
-- Phase 2: Canonical Contacts & Lead Attribution
-- Phase 3: Intelligent Pipeline Handoff
-- Phase 4: Operational Excellence

-- ============================================================
-- PHASE 2: Canonical Contacts & Lead Attribution
-- ============================================================

-- 2.1 Contact Deduplication: merged_into for contact merging
alter table public.crm_contacts
  add column if not exists merged_into uuid references public.crm_contacts(id) on delete set null,
  add column if not exists dedup_confidence numeric(3,2) default 1.0 check (dedup_confidence between 0 and 1);

create index if not exists crm_contacts_merged_idx on public.crm_contacts(merged_into) where merged_into is not null;

-- 2.2 Website→WhatsApp Attribution Tracking
create table if not exists public.whatsapp_attribution (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_page text,
  conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  clicked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_attribution_session_idx on public.whatsapp_attribution(session_id);
create index if not exists whatsapp_attribution_conversation_idx on public.whatsapp_attribution(conversation_id) where conversation_id is not null;

alter table public.whatsapp_attribution enable row level security;
revoke all on public.whatsapp_attribution from anon, authenticated;
grant all on public.whatsapp_attribution to service_role;
grant select on public.whatsapp_attribution to authenticated;

create policy whatsapp_attribution_view on public.whatsapp_attribution
  for select to authenticated using (public.current_user_has_permission('pipeline.view'));

-- 2.3 Auto-extract contact entities from messages
-- Function to extract contact info from message text
create or replace function public.extract_contact_entities(message_text text)
returns jsonb language plpgsql immutable strict set search_path=public,pg_temp as $$
declare
  result jsonb := '{}'::jsonb;
  name_match text[];
  email_match text[];
  phone_match text[];
  org_match text[];
begin
  -- Extract email
  email_match := regexp_match(message_text, '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}');
  if email_match is not null then
    result := result || jsonb_build_object('email', email_match[1]);
  end if;

  -- Extract Indonesian phone numbers (various formats)
  phone_match := regexp_match(message_text, '(?:\+62|62|0)8[0-9]{8,11}');
  if phone_match is not null then
    result := result || jsonb_build_object('phone', public.whatsapp_normalize_contact_phone(phone_match[1]));
  end if;

  -- Extract name patterns: "Nama saya [Name]", "Saya [Name]", "ini [Name]"
  name_match := regexp_match(message_text, '(?:nama\s+saya|saya|ini)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)', 'i');
  if name_match is not null then
    result := result || jsonb_build_object('name', name_match[1]);
  end if;

  -- Extract company/org patterns: "dari [Company]", "perusahaan [Company]", "kantor [Company]"
  org_match := regexp_match(message_text, '(?:dari|perusahaan|kantor|instansi|organisasi)\s+([A-Z][a-zA-Z0-9\s&\-.]{2,50})', 'i');
  if org_match is not null then
    result := result || jsonb_build_object('organization', trim(org_match[1]));
  end if;

  return result;
end $$;

-- 2.4 Reference Code Generation for Conversations
alter table public.whatsapp_conversations
  add column if not exists reference_code text unique;

-- Generate reference code on insert
create or replace function public.generate_whatsapp_reference_code()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  year int := extract(year from now())::int;
  seq int;
  code text;
begin
  -- Get next sequence for this year
  select coalesce(max((split_part(reference_code, '-', 3))::int), 0) + 1
  into seq
  from public.whatsapp_conversations
  where reference_code like 'WA-' || year || '-%';

  code := 'WA-' || year || '-' || lpad(seq::text, 6, '0');
  new.reference_code := code;
  return new;
end $$;

drop trigger if exists whatsapp_generate_reference on public.whatsapp_conversations;
create trigger whatsapp_generate_reference
  before insert on public.whatsapp_conversations
  for each row execute function public.generate_whatsapp_reference_code();

-- Backfill existing conversations
with existing_sequences as (
  select split_part(reference_code, '-', 2)::int as reference_year,
    max(split_part(reference_code, '-', 3)::bigint) as last_sequence
  from public.whatsapp_conversations
  where reference_code ~ '^WA-[0-9]{4}-[0-9]+$'
  group by split_part(reference_code, '-', 2)::int
), numbered_conversations as (
  select c.id, extract(year from c.created_at)::int as reference_year,
    coalesce(s.last_sequence, 0) + row_number() over (
      partition by extract(year from c.created_at)
      order by c.created_at, c.id
    ) as reference_sequence
  from public.whatsapp_conversations c
  left join existing_sequences s on s.reference_year = extract(year from c.created_at)::int
  where c.reference_code is null
)
update public.whatsapp_conversations c
set reference_code = 'WA-' || n.reference_year || '-' || lpad(n.reference_sequence::text, 6, '0')
from numbered_conversations n
where c.id = n.id and c.reference_code is null;

-- ============================================================
-- PHASE 3: Intelligent Pipeline Handoff
-- ============================================================

-- 3.1 Conversation Scoring
alter table public.whatsapp_conversations
  add column if not exists lead_score int default 0 check (lead_score between 0 and 100),
  add column if not exists score_breakdown jsonb default '{}'::jsonb,
  add column if not exists last_scored_at timestamptz;

create index if not exists whatsapp_conversations_score_idx on public.whatsapp_conversations(lead_score desc) where lead_score > 0;

-- Keyword-based scoring function
create or replace function public.calculate_lead_score(conversation_id uuid)
returns int language plpgsql security definer set search_path=public,pg_temp as $$
declare
  conversation public.whatsapp_conversations%rowtype;
  messages text[];
  score int := 0;
  breakdown jsonb := '{}'::jsonb;
  keyword text;
  category text;
  config jsonb;
  weight int;
  matches int;
  kw_categories jsonb := '{
    "budget": {"keywords": ["budget", "anggaran", "harga", "biaya", "investasi", "cost", "price", "paket", "promo", "diskon"], "weight": 25},
    "timeline": {"keywords": ["timeline", "waktu", "bulan", "minggu", "hari", "deadline", "target", "segera", "cepat", "schedule", "jadwal"], "weight": 20},
    "authority": {"keywords": ["keputusan", "decision", "approval", "approve", "menyetujui", "direktur", "manager", "pimpinan", "bos", "owner", "founder", "ceo", "cto"], "weight": 25},
    "need": {"keywords": ["butuh", "perlu", "mencari", "ingin", "mau", "tertarik", "minat", "need", "want", "looking", "interested", "solusi", "solusi", "layanan", "jasa", "training", "pelatihan", "workshop", "event", "outbound", "capacity", "building", "ldks", "familirity"], "weight": 30}
  }'::jsonb;
begin
  select * into conversation from public.whatsapp_conversations where id = conversation_id;
  if conversation.id is null then return 0; end if;

  -- Get last 20 incoming messages
  select array_agg(content order by sent_at desc)
  into messages
  from public.whatsapp_messages
  where conversation_id = conversation.id
    and direction = 'incoming'
  limit 20;

  if messages is null then
    update public.whatsapp_conversations set lead_score = 0, score_breakdown = '{}', last_scored_at = now() where id = conversation_id;
    return 0;
  end if;

  -- Score each category
  for category, config in select * from jsonb_each(kw_categories) loop
    matches := 0;
    weight := (config->>'weight')::int;
    for keyword in select * from jsonb_array_elements_text(config->'keywords') loop
      for i in 1..array_length(messages, 1) loop
        if messages[i] ilike '%' || keyword || '%' then
          matches := matches + 1;
        end if;
      end loop;
    end loop;
    -- Cap matches per category at 3, normalize to weight
    score := score + least(matches, 3) * weight / 3;
    breakdown := breakdown || jsonb_build_object(category, jsonb_build_object('matches', matches, 'weight', weight, 'score', least(matches, 3) * weight / 3));
  end loop;

  score := least(score, 100);

  update public.whatsapp_conversations
  set lead_score = score, score_breakdown = breakdown, last_scored_at = now()
  where id = conversation_id;

  return score;
end $$;

-- 3.2 Auto-suggest Pipeline Source
create or replace function public.suggest_pipeline_source(conversation_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  conversation public.whatsapp_conversations%rowtype;
  messages text;
  best_source uuid;
  best_score int := 0;
  source_record record;
  keyword text;
  source_keywords jsonb := '{
    "b2b-services": ["b2b", "corporate", "perusahaan", "instansi", "organisasi", "hr", "human resource", "training", "pelatihan", "capacity building", "ldks", "outbound"],
    "coreva": ["coreva", "event", "acara", "wedding", "pernikahan", "ulang tahun", "birthday", "gathering", "reunion"],
    "traveler": ["travel", "wisata", "liburan", "tour", "paket wisata", "traveler", "peserta", "pendaftaran"]
  }'::jsonb;
begin
  select * into conversation from public.whatsapp_conversations where id = conversation_id;
  if conversation.id is null then return null; end if;

  select string_agg(content, ' ') into messages
  from public.whatsapp_messages
  where conversation_id = conversation.id
    and direction = 'incoming'
  limit 30;

  if messages is null then return null; end if;

  for source_record in
    select s.id, s.key, s.module_config
    from public.work_sources s
    where s.module_type = 'pipeline'
      and s.is_active
      and public.can_access_work_source(s.id)
  loop
    declare
      source_score int := 0;
      kw_category text;
    begin
      for kw_category in select * from jsonb_object_keys(source_keywords) loop
        if kw_category = source_record.key then
          for keyword in select * from jsonb_array_elements_text(source_keywords->kw_category) loop
            if messages ilike '%' || keyword || '%' then
              source_score := source_score + 10;
            end if;
          end loop;
        end if;
      end loop;

      -- Boost if lead_score is high
      if conversation.lead_score > 50 then
        source_score := source_score + 20;
      end if;

      if source_score > best_score then
        best_score := source_score;
        best_source := source_record.id;
      end if;
    end;
  end loop;

  return best_source;
end $$;

-- 3.3 Smart Lead Creation - Enhanced create_whatsapp_pipeline_lead
-- This will be handled in application code, but we add helper function
create or replace function public.build_lead_from_conversation(target_conversation_id uuid, source_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  conversation public.whatsapp_conversations%rowtype;
  contact public.crm_contacts%rowtype;
  config jsonb;
  last_messages text;
  next_action text;
  suggested_stage text;
begin
  select * into conversation from public.whatsapp_conversations where id = target_conversation_id;
  if conversation.id is null then raise exception 'Conversation not found'; end if;

  select * into contact from public.crm_contacts where id = conversation.contact_id;
  if contact.id is null then raise exception 'Contact not found'; end if;

  select s.module_config into config from public.work_sources s where s.id = source_id;
  if config is null then raise exception 'Source config not found'; end if;

  -- Get last few incoming messages for context
  select string_agg(content, ' | ' order by sent_at desc) into last_messages
  from public.whatsapp_messages
  where conversation_id = conversation.id
    and direction = 'incoming'
  limit 5;

  -- Determine next action based on messages
  if last_messages ilike '%harga%' or last_messages ilike '%biaya%' or last_messages ilike '%paket%' then
    next_action := 'Kirim proposal harga dan detail paket';
    suggested_stage := 'Proposal Sent';
  elsif last_messages ilike '%jadwal%' or last_messages ilike '%waktu%' or last_messages ilike '%kapan%' then
    next_action := 'Konfirmasi jadwal meeting/presentasi';
    suggested_stage := 'Follow Up';
  elsif last_messages ilike '%detail%' or last_messages ilike '%info%' or last_messages ilike '%informasi%' then
    next_action := 'Kirim brochure/detail layanan via WhatsApp';
    suggested_stage := 'Outreach';
  else
    next_action := 'Tindak lanjuti kebutuhan pelanggan WhatsApp';
    suggested_stage := config->'stages'->>0;
  end if;

  return jsonb_build_object(
    'account_name', coalesce(nullif(contact.organization, ''), contact.name),
    'contact_name', contact.name,
    'contact_role', contact.role,
    'contact_details', concat_ws(' · ', '+' || contact.phone, nullif(contact.email, '')),
    'notes', contact.notes,
    'lead_source', 'WhatsApp',
    'stage', suggested_stage,
    'priority', case when conversation.lead_score >= 70 then 'High' when conversation.lead_score >= 40 then 'Medium' else 'Low' end,
    'activity_type', 'Follow Up',
    'next_action', next_action,
    'due_date', current_date + 1,
    'extra_data', jsonb_build_object(
      'crm_contact_id', contact.id,
      'whatsapp_conversation_id', conversation.id,
      'whatsapp_phone', contact.phone,
      'lead_score', conversation.lead_score,
      'score_breakdown', conversation.score_breakdown,
      'reference_code', conversation.reference_code,
      'last_messages', last_messages
    )
  );
end $$;

-- 3.4 Assignment Rules
create table if not exists public.pipeline_assignment_rules (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.work_sources(id) on delete cascade,
  name text not null,
  business_unit text,
  region text,
  lead_score_min int default 0,
  lead_score_max int default 100,
  assignment_type text not null check (assignment_type in ('round_robin', 'least_loaded', 'specific')),
  specific_owner_id uuid references public.memberships(id) on delete set null,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists pipeline_assignment_rules_source_idx on public.pipeline_assignment_rules(source_id);

alter table public.pipeline_assignment_rules enable row level security;
revoke all on public.pipeline_assignment_rules from anon, authenticated;
grant all on public.pipeline_assignment_rules to service_role;
grant select on public.pipeline_assignment_rules to authenticated;

create policy pipeline_assignment_rules_view on public.pipeline_assignment_rules
  for select to authenticated using (public.current_user_has_permission('pipeline.view'));

-- Round-robin assignment state
create table if not exists public.pipeline_assignment_state (
  source_id uuid primary key references public.work_sources(id) on delete cascade,
  last_assigned_membership_id uuid references public.memberships(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp()
);

-- Auto-assign lead function
create or replace function public.assign_lead_automatically(target_lead_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  lead public.pipeline_leads%rowtype;
  rule public.pipeline_assignment_rules%rowtype;
  candidates uuid[];
  chosen uuid;
  state public.pipeline_assignment_state%rowtype;
  member_count int;
begin
  select * into lead from public.pipeline_leads where id = target_lead_id;
  if lead.id is null then raise exception 'Lead not found'; end if;

  -- Find matching rule
  select * into rule
  from public.pipeline_assignment_rules
  where source_id = lead.source_id
    and is_active
    and (business_unit is null or business_unit = lead.business_unit)
    and lead_score_min <= coalesce((lead.extra_data->>'lead_score')::int, 0)
    and lead_score_max >= coalesce((lead.extra_data->>'lead_score')::int, 0)
  order by sort_order
  limit 1;

  if rule.id is null then
    return lead.owner_membership_id; -- No rule, keep current owner
  end if;

  if rule.assignment_type = 'specific' and rule.specific_owner_id is not null then
    chosen := rule.specific_owner_id;
  elsif rule.assignment_type = 'round_robin' then
    -- Get eligible members for this source
    select array_agg(m.id) into candidates
    from public.memberships m
    join public.work_source_members wsm on wsm.membership_id = m.id
    where wsm.work_source_id = lead.source_id
      and m.status = 'active';

    if array_length(candidates, 1) = 0 then
      return lead.owner_membership_id;
    end if;

    -- Get last assigned
    select * into state from public.pipeline_assignment_state where source_id = lead.source_id;
    if state.last_assigned_membership_id is null or state.last_assigned_membership_id not in (select * from unnest(candidates)) then
      chosen := candidates[1];
    else
      -- Find next in round robin
      for i in 1..array_length(candidates, 1) loop
        if candidates[i] = state.last_assigned_membership_id then
          chosen := candidates[(i % array_length(candidates, 1)) + 1];
          exit;
        end if;
      end loop;
      if chosen is null then chosen := candidates[1]; end if;
    end if;

    -- Update state
    insert into public.pipeline_assignment_state (source_id, last_assigned_membership_id)
    values (lead.source_id, chosen)
    on conflict (source_id) do update set last_assigned_membership_id = chosen, updated_at = clock_timestamp();
  else
    -- least_loaded - assign to member with fewest open leads
    select m.id into chosen
    from public.memberships m
    join public.work_source_members wsm on wsm.membership_id = m.id
    where wsm.work_source_id = lead.source_id
      and m.status = 'active'
    order by (
      select count(*) from public.pipeline_leads pl
      join public.activities a on a.id = pl.activity_id
      where pl.owner_membership_id = m.id
        and pl.source_id = lead.source_id
        and a.status != 'done'
    ) asc
    limit 1;
  end if;

  if chosen is not null and chosen != lead.owner_membership_id then
    update public.pipeline_leads set owner_membership_id = chosen, updated_at = clock_timestamp() where id = target_lead_id;
    -- Activity history is handled by trigger on pipeline_leads
  end if;

  return chosen;
end $$;

-- ============================================================
-- PHASE 4: Operational Excellence
-- ============================================================

-- 4.1 Approved Template Messages
create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null check (category in ('marketing', 'utility', 'authentication')),
  language text not null default 'id',
  header_type text check (header_type in ('text', 'image', 'document', 'video', 'location')),
  header_text text,
  body_text text not null,
  footer_text text,
  buttons jsonb default '[]'::jsonb,
  meta_template_name text,
  meta_template_id text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  source_id uuid references public.work_sources(id) on delete set null,
  created_by uuid references public.memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists whatsapp_templates_source_idx on public.whatsapp_templates(source_id);
create index if not exists whatsapp_templates_status_idx on public.whatsapp_templates(status);

alter table public.whatsapp_templates enable row level security;
revoke all on public.whatsapp_templates from anon, authenticated;
grant all on public.whatsapp_templates to service_role;
grant select on public.whatsapp_templates to authenticated;

create policy whatsapp_templates_view on public.whatsapp_templates
  for select to authenticated using (public.current_user_has_permission('pipeline.view'));
create policy whatsapp_templates_manage on public.whatsapp_templates
  for all to authenticated using (public.current_user_has_permission('pipeline.manage_team'));

-- 4.2 Quick Replies / Snippets
create table if not exists public.whatsapp_quick_replies (
  id uuid primary key default gen_random_uuid(),
  shortcut text not null unique,
  content text not null,
  description text,
  source_id uuid references public.work_sources(id) on delete set null,
  created_by uuid references public.memberships(id) on delete set null,
  is_global boolean not null default false,
  usage_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists whatsapp_quick_replies_source_idx on public.whatsapp_quick_replies(source_id);
create index if not exists whatsapp_quick_replies_shortcut_idx on public.whatsapp_quick_replies(shortcut);

alter table public.whatsapp_quick_replies enable row level security;
revoke all on public.whatsapp_quick_replies from anon, authenticated;
grant all on public.whatsapp_quick_replies to service_role;
grant select on public.whatsapp_quick_replies to authenticated;

create policy whatsapp_quick_replies_view on public.whatsapp_quick_replies
  for select to authenticated using (public.current_user_has_permission('pipeline.view'));
create policy whatsapp_quick_replies_manage on public.whatsapp_quick_replies
  for all to authenticated using (public.current_user_has_permission('pipeline.manage_team'));

-- 4.3 Stale/Overdue Alerts - Conversation Tags
alter table public.whatsapp_conversations
  add column if not exists tags text[] default '{}',
  add column if not exists last_activity_at timestamptz,
  add column if not exists assigned_membership_id uuid references public.memberships(id) on delete set null;

create index if not exists whatsapp_conversations_tags_idx on public.whatsapp_conversations using gin(tags);
create index if not exists whatsapp_conversations_assigned_idx on public.whatsapp_conversations(assigned_membership_id) where assigned_membership_id is not null;
create index if not exists whatsapp_conversations_stale_idx on public.whatsapp_conversations(last_activity_at) where last_activity_at is not null;

-- Update last_activity_at on message insert/update
create or replace function public.whatsapp_update_activity()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.whatsapp_conversations
  set last_activity_at = greatest(last_activity_at, new.sent_at)
  where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists whatsapp_message_activity on public.whatsapp_messages;
create trigger whatsapp_message_activity
  after insert or update on public.whatsapp_messages
  for each row execute function public.whatsapp_update_activity();

-- Backfill last_activity_at
update public.whatsapp_conversations c
set last_activity_at = (
  select max(m.sent_at) from public.whatsapp_messages m where m.conversation_id = c.id
)
where last_activity_at is null;

-- 4.4 Stale conversation detection function
create or replace function public.check_stale_conversations()
returns int language plpgsql security definer set search_path=public,pg_temp as $$
declare
  stale_count int := 0;
  conv record;
begin
  for conv in
    select c.id, c.assigned_membership_id, c.pipeline_lead_id, c.last_activity_at
    from public.whatsapp_conversations c
    where c.last_activity_at < now() - interval '24 hours'
      and c.assigned_membership_id is not null
      and not exists (
        select 1 from public.activity_history ah
        where ah.after_data->>'conversation_id' = c.id::text
          and ah.event_type = 'stale_alert'
          and ah.created_at > now() - interval '24 hours'
      )
  loop
    if conv.pipeline_lead_id is not null then
      insert into public.activity_history (activity_id, actor_membership_id, event_type, after_data)
      select a.id, conv.assigned_membership_id, 'stale_alert',
        jsonb_build_object('conversation_id', conv.id, 'pipeline_lead_id', conv.pipeline_lead_id, 'hours_inactive', floor(extract(epoch from (now() - conv.last_activity_at))/3600))
      from public.pipeline_leads pl
      join public.activities a on a.id = pl.activity_id
      where pl.id = conv.pipeline_lead_id;
    else
      -- Create standalone activity for orphan conversations
      insert into public.activities (owner_membership_id, title, description, status, due_date, source_id)
      select conv.assigned_membership_id,
        'WhatsApp Conversation Stale',
        'Conversation ' || conv.id || ' inactive for 24+ hours',
        'open',
        current_date,
        null;
    end if;
    stale_count := stale_count + 1;
  end loop;
  return stale_count;
end $$;

-- 4.5 Conversation Transfer
create or replace function public.transfer_whatsapp_conversation(
  target_conversation_id uuid,
  new_owner_id uuid,
  transfer_note text default ''
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  conversation public.whatsapp_conversations%rowtype;
  old_owner uuid;
begin
  if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.view')
    or not (public.current_user_has_permission('pipeline.manage_self') or public.current_user_has_permission('pipeline.manage_team')) then
    raise exception 'Izin kelola Pipeline diperlukan.' using errcode='42501';
  end if;

  select * into conversation from public.whatsapp_conversations where id = target_conversation_id for update;
  if conversation.id is null then raise exception 'Percakapan tidak ditemukan.'; end if;

  old_owner := conversation.assigned_membership_id;

  update public.whatsapp_conversations
  set assigned_membership_id = new_owner_id
  where id = target_conversation_id;

  -- Log transfer in activity history if linked to pipeline lead
  if conversation.pipeline_lead_id is not null then
    insert into public.activity_history (activity_id, actor_membership_id, event_type, after_data)
    select a.id, public.current_membership_id(), 'whatsapp_conversation_transferred',
      jsonb_build_object('conversation_id', conversation.id, 'from_membership_id', old_owner, 'to_membership_id', new_owner_id, 'note', transfer_note)
    from public.pipeline_leads pl
    join public.activities a on a.id = pl.activity_id
    where pl.id = conversation.pipeline_lead_id;
  end if;

  return new_owner_id;
end $$;

-- ============================================================
-- PERMISSIONS & GRANTS
-- ============================================================

revoke all on function public.extract_contact_entities(text) from public, anon, authenticated;
grant execute on function public.extract_contact_entities(text) to authenticated;

revoke all on function public.calculate_lead_score(uuid) from public, anon, authenticated;
grant execute on function public.calculate_lead_score(uuid) to authenticated;

revoke all on function public.suggest_pipeline_source(uuid) from public, anon, authenticated;
grant execute on function public.suggest_pipeline_source(uuid) to authenticated;

revoke all on function public.build_lead_from_conversation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.build_lead_from_conversation(uuid, uuid) to authenticated;

revoke all on function public.assign_lead_automatically(uuid) from public, anon, authenticated;
grant execute on function public.assign_lead_automatically(uuid) to authenticated;

revoke all on function public.check_stale_conversations() from public, anon, authenticated;
grant execute on function public.check_stale_conversations() to service_role;

revoke all on function public.transfer_whatsapp_conversation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.transfer_whatsapp_conversation(uuid, uuid, text) to authenticated;

-- Enable pg_cron for stale checks (if available)
-- SELECT cron.schedule('check-stale-conversations', '0 * * * *', 'SELECT public.check_stale_conversations();');

-- ============================================================
-- HELPER: Update conversation tags from inbox
-- ============================================================
create or replace function public.update_whatsapp_conversation_tags(
  target_conversation_id uuid,
  new_tags text[]
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.view') then
    raise exception 'Akses inbox ditolak' using errcode='42501';
  end if;
  update public.whatsapp_conversations set tags = new_tags where id = target_conversation_id;
end $$;

revoke all on function public.update_whatsapp_conversation_tags(uuid, text[]) from public, anon, authenticated;
grant execute on function public.update_whatsapp_conversation_tags(uuid, text[]) to authenticated;
