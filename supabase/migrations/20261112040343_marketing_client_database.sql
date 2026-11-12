create table if not exists public.marketing_client_manual_contacts (
  id uuid primary key default extensions.gen_random_uuid(),
  company_name text not null check (char_length(trim(company_name)) between 1 and 240),
  pic_name text,
  pic_role text,
  email text,
  whatsapp text,
  phone text,
  address text,
  city text,
  website text,
  service_interest text,
  owner_membership_id uuid references public.memberships(id) on delete set null,
  created_by_membership_id uuid references public.memberships(id) on delete set null,
  updated_by_membership_id uuid references public.memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_client_touchpoints (
  id uuid primary key default extensions.gen_random_uuid(),
  identity_key text not null,
  channel text not null check (channel in ('Email','WhatsApp','Telepon','LinkedIn','Threads','Meeting','Lainnya')),
  funnel_stage text not null check (funnel_stage in ('TOFU','MOFU','BOFU')),
  topic text not null check (char_length(trim(topic)) between 1 and 1000),
  occurred_at timestamptz not null default now(),
  created_by_membership_id uuid references public.memberships(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists marketing_client_touchpoints_latest_idx
  on public.marketing_client_touchpoints (identity_key, occurred_at desc);

create table if not exists public.marketing_client_consents (
  identity_key text not null,
  channel text not null check (channel in ('email','whatsapp')),
  consented boolean not null default false,
  evidence text,
  updated_by_membership_id uuid references public.memberships(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (identity_key, channel),
  check (not consented or (evidence is not null and char_length(trim(evidence)) >= 3))
);

create table if not exists public.marketing_client_exclusions (
  identity_key text primary key,
  excluded_by_membership_id uuid references public.memberships(id) on delete set null,
  excluded_at timestamptz not null default now()
);

alter table public.marketing_client_manual_contacts enable row level security;
alter table public.marketing_client_touchpoints enable row level security;
alter table public.marketing_client_consents enable row level security;
alter table public.marketing_client_exclusions enable row level security;
revoke all on public.marketing_client_manual_contacts, public.marketing_client_touchpoints,
  public.marketing_client_consents, public.marketing_client_exclusions from public, anon, authenticated;
grant all on public.marketing_client_manual_contacts, public.marketing_client_touchpoints,
  public.marketing_client_consents, public.marketing_client_exclusions to service_role;

create or replace function public.client_database_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or public.current_membership_id() is null
     or not public.current_user_has_permission('pipeline.view') then
    raise exception 'Akses Pipeline BD diperlukan.' using errcode = '42501';
  end if;

  with pipeline_rows as (
    select
      l.id as pipeline_id,
      p.id as prospect_id,
      coalesce(nullif(trim(p.account_name), ''), nullif(trim(l.account_name), '')) as company_name,
      coalesce(nullif(trim(p.contact_name), ''), nullif(trim(l.contact_name), '')) as pic_name,
      coalesce(nullif(trim(p.contact_role), ''), nullif(trim(l.contact_role), '')) as pic_role,
      nullif(trim(p.email), '') as prospect_email,
      nullif(trim(l.email_contact), '') as lead_email,
      nullif(trim(p.phone), '') as prospect_phone,
      nullif(trim(l.whatsapp_contact), '') as lead_whatsapp,
      nullif(trim(l.contact_details), '') as lead_phone,
      nullif(trim(p.address), '') as address,
      nullif(trim(p.city), '') as city,
      nullif(trim(p.website), '') as website,
      coalesce(nullif(trim(l.business_unit), ''), nullif(trim(p.recommended_service), ''), nullif(trim(p.recommended_business_unit), '')) as service_interest,
      coalesce(nullif(trim(ws.name), ''), nullif(trim(p.primary_source), ''), 'Pipeline') as source_label,
      coalesce(nullif(trim(l.stage), ''), nullif(trim(p.inbox_status), '')) as lifecycle_status,
      coalesce(a.owner_membership_id, p.created_by_membership_id) as owner_membership_id,
      coalesce(nullif(trim(m.full_name), ''), nullif(trim(m.email::text), '')) as owner_name,
      greatest(l.updated_at, coalesce(p.updated_at, l.updated_at)) as source_updated_at,
      coalesce(last_event.occurred_at, l.last_contact_date::timestamptz) as source_last_contact_at,
      last_event.channel as source_last_contact_channel,
      last_event.topic as source_last_contact_topic,
      last_event.stage as source_last_contact_stage,
      jsonb_build_object('kind','pipeline','id',l.id) as source_ref
    from public.pipeline_leads l
    join public.activities a on a.id = l.activity_id
    join public.work_sources ws on ws.id = l.source_id
    left join public.memberships m on m.id = a.owner_membership_id
    left join lateral (
      select p0.* from public.prospects p0
      where p0.promoted_lead_id = l.id
      order by p0.updated_at desc
      limit 1
    ) p on true
    left join lateral (
      select event.occurred_at, event.channel, event.topic, event.stage
      from (
        select e.occurred_at, e.channel, e.notes as topic,
          case
            when lower(coalesce(e.notes,'')) ~ '(diskon|negosiasi|kontrak|closing|invoice|pembayaran|deal)' then 'BOFU'
            when lower(coalesce(e.notes,'')) ~ '(harga|price|pricelist|price list|proposal|demo|presentasi|meeting|penawaran)' then 'MOFU'
            when lower(coalesce(e.notes,'')) ~ '(compro|company profile|awareness|perkenalan|intro|brosur)' then 'TOFU'
            else null
          end as stage
        from public.pipeline_contact_events e where e.pipeline_lead_id = l.id
        union all
        select i.occurred_at, i.channel, i.note,
          case
            when lower(coalesce(i.note,'')) ~ '(diskon|negosiasi|kontrak|closing|invoice|pembayaran|deal)' then 'BOFU'
            when lower(coalesce(i.note,'')) ~ '(harga|price|pricelist|price list|proposal|demo|presentasi|meeting|penawaran)' then 'MOFU'
            when lower(coalesce(i.note,'')) ~ '(compro|company profile|awareness|perkenalan|intro|brosur)' then 'TOFU'
            else null
          end as stage
        from public.prospect_interactions i where i.prospect_id = p.id
      ) event
      order by event.occurred_at desc
      limit 1
    ) last_event on true
    where public.current_user_has_permission('pipeline.view')
      and public.can_access_work_source(l.source_id)
      and l.archived_at is null
  ), prospect_rows as (
    select
      null::uuid as pipeline_id,
      p.id as prospect_id,
      nullif(trim(p.account_name), '') as company_name,
      nullif(trim(p.contact_name), '') as pic_name,
      nullif(trim(p.contact_role), '') as pic_role,
      nullif(trim(p.email), '') as prospect_email,
      null::text as lead_email,
      nullif(trim(p.phone), '') as prospect_phone,
      null::text as lead_whatsapp,
      null::text as lead_phone,
      nullif(trim(p.address), '') as address,
      nullif(trim(p.city), '') as city,
      nullif(trim(p.website), '') as website,
      coalesce(nullif(trim(p.recommended_service), ''), nullif(trim(p.recommended_business_unit), '')) as service_interest,
      coalesce(nullif(trim(p.primary_source), ''), 'Prospect Inbox') as source_label,
      coalesce(nullif(trim(p.inbox_status), ''), nullif(trim(p.status), '')) as lifecycle_status,
      p.created_by_membership_id as owner_membership_id,
      coalesce(nullif(trim(m.full_name), ''), nullif(trim(m.email::text), '')) as owner_name,
      p.updated_at as source_updated_at,
      last_event.occurred_at as source_last_contact_at,
      last_event.channel as source_last_contact_channel,
      last_event.topic as source_last_contact_topic,
      last_event.stage as source_last_contact_stage,
      jsonb_build_object('kind','prospect','id',p.id) as source_ref
    from public.prospects p
    left join public.memberships m on m.id = p.created_by_membership_id
    left join lateral (
      select i.occurred_at, i.channel, i.note as topic,
        case
          when lower(coalesce(i.note,'')) ~ '(diskon|negosiasi|kontrak|closing|invoice|pembayaran|deal)' then 'BOFU'
          when lower(coalesce(i.note,'')) ~ '(harga|price|pricelist|price list|proposal|demo|presentasi|meeting|penawaran)' then 'MOFU'
          when lower(coalesce(i.note,'')) ~ '(compro|company profile|awareness|perkenalan|intro|brosur)' then 'TOFU'
          else null
        end as stage
      from public.prospect_interactions i where i.prospect_id = p.id
      order by i.occurred_at desc
      limit 1
    ) last_event on true
    where not exists (
      select 1 from public.pipeline_leads l
      where l.id = p.promoted_lead_id and l.archived_at is null
        and public.can_access_work_source(l.source_id)
    )
  ), crm_rows as (
    select
      null::uuid as pipeline_id, null::uuid as prospect_id,
      nullif(trim(c.organization), '') as company_name,
      nullif(trim(c.name), '') as pic_name,
      nullif(trim(c.role), '') as pic_role,
      nullif(trim(c.email), '') as prospect_email,
      null::text as lead_email,
      null::text as prospect_phone,
      nullif(trim(c.phone), '') as lead_whatsapp,
      null::text as lead_phone,
      null::text as address, null::text as city, null::text as website,
      null::text as service_interest, 'WhatsApp CRM'::text as source_label,
      null::text as lifecycle_status, c.updated_by_membership_id as owner_membership_id,
      null::text as owner_name, c.updated_at as source_updated_at,
      c.last_contact_at as source_last_contact_at,
      case when c.last_contact_at is not null then 'WhatsApp' else null end as source_last_contact_channel,
      nullif(trim(c.notes), '') as source_last_contact_topic,
      case
        when lower(coalesce(c.notes,'')) ~ '(diskon|negosiasi|kontrak|closing|invoice|pembayaran|deal)' then 'BOFU'
        when lower(coalesce(c.notes,'')) ~ '(harga|price|pricelist|price list|proposal|demo|presentasi|meeting|penawaran)' then 'MOFU'
        when lower(coalesce(c.notes,'')) ~ '(compro|company profile|awareness|perkenalan|intro|brosur)' then 'TOFU'
        else null
      end as source_last_contact_stage,
      jsonb_build_object('kind','whatsapp_crm','id',c.id) as source_ref
    from public.crm_contacts c
    where c.merged_into is null
  ), manual_rows as (
    select
      null::uuid as pipeline_id, null::uuid as prospect_id,
      nullif(trim(c.company_name), '') as company_name,
      nullif(trim(c.pic_name), '') as pic_name,
      nullif(trim(c.pic_role), '') as pic_role,
      nullif(trim(c.email), '') as prospect_email,
      null::text as lead_email,
      null::text as prospect_phone,
      nullif(trim(c.whatsapp), '') as lead_whatsapp,
      nullif(trim(c.phone), '') as lead_phone,
      nullif(trim(c.address), '') as address,
      nullif(trim(c.city), '') as city,
      nullif(trim(c.website), '') as website,
      nullif(trim(c.service_interest), '') as service_interest,
      'Manual'::text as source_label, null::text as lifecycle_status,
      c.owner_membership_id, coalesce(nullif(trim(m.full_name), ''), nullif(trim(m.email::text), '')) as owner_name,
      c.updated_at as source_updated_at, null::timestamptz as source_last_contact_at,
      null::text as source_last_contact_channel, null::text as source_last_contact_topic,
      null::text as source_last_contact_stage,
      jsonb_build_object('kind','manual','id',c.id) as source_ref
    from public.marketing_client_manual_contacts c
    left join public.memberships m on m.id = c.owner_membership_id
  ), all_rows as (
    select * from pipeline_rows
    union all select * from prospect_rows
    union all select * from crm_rows
    union all select * from manual_rows
  ), identified as (
    select
      a.*,
      case
        when nullif(lower(trim(coalesce(a.prospect_email,a.lead_email))), '') is not null
          then 'email:' || lower(trim(coalesce(a.prospect_email,a.lead_email)))
        when nullif(regexp_replace(coalesce(a.lead_whatsapp,a.prospect_phone,a.lead_phone,''), '[^0-9]', '', 'g'), '') is not null
          then 'phone:' || regexp_replace(coalesce(a.lead_whatsapp,a.prospect_phone,a.lead_phone,''), '[^0-9]', '', 'g')
        else 'name:' || lower(regexp_replace(coalesce(a.company_name,'') || '|' || coalesce(a.pic_name,''), '[^a-zA-Z0-9]+', ' ', 'g'))
      end as identity_key
    from all_rows a
    where nullif(trim(a.company_name), '') is not null
  ), with_chat as (
    select
      i.*,
      chat.internal_chat_at, chat.internal_chat_topic, chat.internal_chat_sender
    from identified i
    left join lateral (
      select cm.created_at as internal_chat_at,
        left(regexp_replace(cm.body, '[[:space:]]+', ' ', 'g'), 220) as internal_chat_topic,
        coalesce(nullif(trim(m.full_name), ''), nullif(trim(m.email::text), '')) as internal_chat_sender
      from public.chat_messages cm
      join public.chat_conversations cc on cc.id = cm.conversation_id
      left join public.memberships m on m.id = cm.sender_membership_id
      where cm.deleted_at is null
        and length(trim(i.company_name)) >= 4
        and position(lower(trim(i.company_name)) in lower(cm.body)) > 0
      order by cm.created_at desc
      limit 1
    ) chat on true
  ), ranked as (
    select
      w.*,
      row_number() over(partition by w.identity_key order by w.source_updated_at desc) as detail_rank,
      row_number() over(partition by w.identity_key order by w.internal_chat_at desc nulls last) as chat_rank
    from with_chat w
  ), touch_candidates as (
    select identity_key, source_last_contact_at as occurred_at, source_last_contact_channel as channel,
      source_last_contact_topic as topic, source_last_contact_stage as funnel_stage
    from identified where source_last_contact_at is not null
    union all
    select identity_key, occurred_at, channel, topic, funnel_stage
    from public.marketing_client_touchpoints
  ), grouped as (
    select
      identity_key,
      max(source_updated_at) as source_updated_at,
      max(internal_chat_at) as internal_chat_at,
      (array_agg(company_name order by source_updated_at desc))[1] as company_name,
      (array_agg(pic_name order by source_updated_at desc) filter (where pic_name is not null))[1] as pic_name,
      (array_agg(pic_role order by source_updated_at desc) filter (where pic_role is not null))[1] as pic_role,
      (array_agg(coalesce(prospect_email,lead_email) order by source_updated_at desc) filter (where coalesce(prospect_email,lead_email) is not null))[1] as email,
      (array_agg(coalesce(lead_whatsapp,prospect_phone,lead_phone) order by source_updated_at desc) filter (where coalesce(lead_whatsapp,prospect_phone,lead_phone) is not null))[1] as whatsapp,
      (array_agg(lead_phone order by source_updated_at desc) filter (where lead_phone is not null))[1] as phone,
      (array_agg(address order by source_updated_at desc) filter (where address is not null))[1] as address,
      (array_agg(city order by source_updated_at desc) filter (where city is not null))[1] as city,
      (array_agg(website order by source_updated_at desc) filter (where website is not null))[1] as website,
      (array_agg(service_interest order by source_updated_at desc) filter (where service_interest is not null))[1] as service_interest,
      (array_agg(source_label order by source_updated_at desc))[1] as source_label,
      (array_agg(lifecycle_status order by source_updated_at desc) filter (where lifecycle_status is not null))[1] as lifecycle_status,
      (array_agg(owner_name order by source_updated_at desc) filter (where owner_name is not null))[1] as owner_name,
      (array_agg(owner_membership_id order by source_updated_at desc) filter (where owner_membership_id is not null))[1] as owner_membership_id,
      jsonb_agg(distinct source_ref) as source_refs
    from ranked
    group by identity_key
  ), selected AS (
    select distinct on (identity_key)
      identity_key, occurred_at as touch_at, channel as touch_channel,
      topic as touch_topic, funnel_stage as touch_stage
    from touch_candidates
    order by identity_key, occurred_at desc
  ), chats AS (
    select identity_key, internal_chat_at, internal_chat_topic, internal_chat_sender
    from ranked where chat_rank = 1
  ), records AS (
    select
      g.*,
      t.touch_at as last_contact_at,
      t.touch_channel as last_contact_channel,
      t.touch_topic as last_contact_topic,
      t.touch_stage as last_contact_stage,
      ch.internal_chat_at, ch.internal_chat_topic, ch.internal_chat_sender,
      coalesce(ec.consented,false) as email_consented,
      coalesce(wc.consented,false) as whatsapp_consented,
      ex.excluded_at is not null and ex.excluded_at >= g.source_updated_at as archived
    from grouped g
    left join selected t on t.identity_key = g.identity_key
    left join chats ch on ch.identity_key = g.identity_key
    left join public.marketing_client_consents ec on ec.identity_key = g.identity_key and ec.channel='email'
    left join public.marketing_client_consents wc on wc.identity_key = g.identity_key and wc.channel='whatsapp'
    left join public.marketing_client_exclusions ex on ex.identity_key = g.identity_key
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'identity_key', r.identity_key, 'company_name', r.company_name, 'pic_name', r.pic_name, 'pic_role', r.pic_role,
    'email', r.email, 'whatsapp', r.whatsapp, 'phone', r.phone, 'address', r.address, 'city', r.city, 'website', r.website,
    'service_interest', r.service_interest, 'source_label', r.source_label, 'lifecycle_status', r.lifecycle_status,
    'owner_name', r.owner_name, 'owner_membership_id', r.owner_membership_id, 'source_refs', r.source_refs,
    'updated_at', r.source_updated_at, 'last_contact_at', r.last_contact_at, 'last_contact_channel', r.last_contact_channel,
    'last_contact_topic', r.last_contact_topic, 'last_contact_stage', r.last_contact_stage,
    'internal_chat_at', r.internal_chat_at, 'internal_chat_topic', r.internal_chat_topic, 'internal_chat_sender', r.internal_chat_sender,
    'email_consented', r.email_consented, 'whatsapp_consented', r.whatsapp_consented, 'archived', r.archived
  ) order by r.last_contact_at desc nulls last, r.company_name), '[]'::jsonb)
  into result
  from records r;
  return jsonb_build_object('records', coalesce(result,'[]'::jsonb), 'generated_at', now());
end;
$$;

create or replace function public.save_marketing_client_manual_contact(target_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member_id uuid := public.current_membership_id();
  saved_id uuid;
begin
  if auth.uid() is null or member_id is null or not public.current_user_has_permission('pipeline.view') then
    raise exception 'Akses Pipeline BD diperlukan.' using errcode='42501';
  end if;
  if jsonb_typeof(payload) is distinct from 'object'
    or char_length(trim(coalesce(payload->>'company_name',''))) not between 1 and 240 then
    raise exception 'Nama perusahaan wajib diisi (maksimal 240 karakter).';
  end if;
  if length(coalesce(payload->>'email','')) > 254 or length(coalesce(payload->>'address','')) > 1000 then
    raise exception 'Panjang email atau alamat melebihi batas.';
  end if;
  if target_id is null then
    insert into public.marketing_client_manual_contacts(
      company_name,pic_name,pic_role,email,whatsapp,phone,address,city,website,service_interest,owner_membership_id,created_by_membership_id,updated_by_membership_id
    ) values (
      trim(payload->>'company_name'), nullif(trim(payload->>'pic_name'),''), nullif(trim(payload->>'pic_role'),''),
      nullif(trim(payload->>'email'),''), nullif(trim(payload->>'whatsapp'),''), nullif(trim(payload->>'phone'),''),
      nullif(trim(payload->>'address'),''), nullif(trim(payload->>'city'),''), nullif(trim(payload->>'website'),''),
      nullif(trim(payload->>'service_interest'),''), nullif(payload->>'owner_membership_id','')::uuid, member_id, member_id
    ) returning id into saved_id;
  else
    update public.marketing_client_manual_contacts set
      company_name=trim(payload->>'company_name'), pic_name=nullif(trim(payload->>'pic_name'),''),
      pic_role=nullif(trim(payload->>'pic_role'),''), email=nullif(trim(payload->>'email'),''),
      whatsapp=nullif(trim(payload->>'whatsapp'),''), phone=nullif(trim(payload->>'phone'),''),
      address=nullif(trim(payload->>'address'),''), city=nullif(trim(payload->>'city'),''),
      website=nullif(trim(payload->>'website'),''), service_interest=nullif(trim(payload->>'service_interest'),''),
      owner_membership_id=nullif(payload->>'owner_membership_id','')::uuid,
      updated_by_membership_id=member_id, updated_at=now()
    where id=target_id returning id into saved_id;
    if saved_id is null then raise exception 'Kontak manual tidak ditemukan.' using errcode='P0002'; end if;
  end if;
  return jsonb_build_object('id',saved_id);
end;
$$;

create or replace function public.delete_marketing_client_manual_contact(target_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or public.current_membership_id() is null or not public.current_user_has_permission('pipeline.view') then
    raise exception 'Akses Pipeline BD diperlukan.' using errcode='42501';
  end if;
  delete from public.marketing_client_manual_contacts where id=target_id;
end;
$$;

create or replace function public.set_marketing_client_consent(target_identity_key text, target_channel text, target_consented boolean, consent_evidence text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or public.current_membership_id() is null or not public.current_user_has_permission('pipeline.view') then
    raise exception 'Akses Pipeline BD diperlukan.' using errcode='42501';
  end if;
  if target_channel not in ('email','whatsapp') then raise exception 'Channel consent tidak valid.'; end if;
  if target_consented and char_length(trim(coalesce(consent_evidence,''))) < 3 then
    raise exception 'Catat bukti izin sebelum mengaktifkan consent.';
  end if;
  insert into public.marketing_client_consents(identity_key,channel,consented,evidence,updated_by_membership_id,updated_at)
  values (target_identity_key,target_channel,target_consented,nullif(trim(consent_evidence),''),public.current_membership_id(),now())
  on conflict(identity_key,channel) do update set consented=excluded.consented,evidence=excluded.evidence,
    updated_by_membership_id=excluded.updated_by_membership_id,updated_at=excluded.updated_at;
end;
$$;

create or replace function public.archive_marketing_client_contact(target_identity_key text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or public.current_membership_id() is null or not public.current_user_has_permission('pipeline.view') then
    raise exception 'Akses Pipeline BD diperlukan.' using errcode='42501';
  end if;
  insert into public.marketing_client_exclusions(identity_key,excluded_by_membership_id,excluded_at)
  values (target_identity_key,public.current_membership_id(),now())
  on conflict(identity_key) do update set excluded_by_membership_id=excluded.excluded_by_membership_id,excluded_at=excluded.excluded_at;
end;
$$;

create or replace function public.restore_marketing_client_contact(target_identity_key text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or public.current_membership_id() is null or not public.current_user_has_permission('pipeline.view') then
    raise exception 'Akses Pipeline BD diperlukan.' using errcode='42501';
  end if;
  delete from public.marketing_client_exclusions where identity_key=target_identity_key;
end;
$$;

create or replace function public.log_marketing_client_touchpoint(target_identity_key text, target_channel text, target_stage text, target_topic text, target_at timestamptz default now())
returns uuid language plpgsql security definer set search_path=public as $$
declare touch_id uuid;
begin
  if auth.uid() is null or public.current_membership_id() is null or not public.current_user_has_permission('pipeline.view') then
    raise exception 'Akses Pipeline BD diperlukan.' using errcode='42501';
  end if;
  if target_channel not in ('Email','WhatsApp','Telepon','LinkedIn','Threads','Meeting','Lainnya')
    or target_stage not in ('TOFU','MOFU','BOFU')
    or char_length(trim(coalesce(target_topic,''))) not between 1 and 1000
    or target_at is null or target_at > now() then
    raise exception 'Detail aktivitas kontak tidak valid.';
  end if;
  insert into public.marketing_client_touchpoints(identity_key,channel,funnel_stage,topic,occurred_at,created_by_membership_id)
  values (target_identity_key,target_channel,target_stage,trim(target_topic),target_at,public.current_membership_id())
  returning id into touch_id;
  return touch_id;
end;
$$;

revoke all on function public.client_database_workspace() from public, anon;
revoke all on function public.save_marketing_client_manual_contact(uuid,jsonb) from public, anon;
revoke all on function public.delete_marketing_client_manual_contact(uuid) from public, anon;
revoke all on function public.set_marketing_client_consent(text,text,boolean,text) from public, anon;
revoke all on function public.archive_marketing_client_contact(text) from public, anon;
revoke all on function public.restore_marketing_client_contact(text) from public, anon;
revoke all on function public.log_marketing_client_touchpoint(text,text,text,text,timestamptz) from public, anon;
grant execute on function public.client_database_workspace() to authenticated;
grant execute on function public.save_marketing_client_manual_contact(uuid,jsonb) to authenticated;
grant execute on function public.delete_marketing_client_manual_contact(uuid) to authenticated;
grant execute on function public.set_marketing_client_consent(text,text,boolean,text) to authenticated;
grant execute on function public.archive_marketing_client_contact(text) to authenticated;
grant execute on function public.restore_marketing_client_contact(text) to authenticated;
grant execute on function public.log_marketing_client_touchpoint(text,text,text,text,timestamptz) to authenticated;
