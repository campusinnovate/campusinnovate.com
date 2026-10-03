-- Prospect Inbox interaction log and explicit Pipeline entry decision.
create table public.prospect_interactions (
  id uuid primary key default extensions.gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  actor_membership_id uuid not null references public.memberships(id),
  channel text not null check (channel in ('linkedin','whatsapp','email','call','other')),
  outcome text not null check (outcome in ('sent','seen','waiting_reply','soft_reply','not_now','interested','meeting_agreed','not_interested')),
  occurred_at timestamptz not null default now(),
  note text not null default '',
  follow_up_date date,
  created_at timestamptz not null default now()
);
create index prospect_interactions_latest_idx on public.prospect_interactions(prospect_id,occurred_at desc,created_at desc);
alter table public.prospect_interactions enable row level security;
revoke all on public.prospect_interactions from anon,authenticated;

alter table public.prospects
  add column pipeline_entry_path text check (pipeline_entry_path in ('active_outreach','opportunity')),
  add column pipeline_entry_reason text,
  add column pipeline_next_action text,
  add column pipeline_due_date date;

create or replace function public.log_prospect_interaction(target_prospect_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare saved_id uuid; actor_id uuid:=public.current_membership_id(); p public.prospects%rowtype;
begin
  if actor_id is null or not public.current_user_has_permission('pipeline.manage_self') then
    raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501';
  end if;
  select * into p from public.prospects where id=target_prospect_id for update;
  if p.id is null then raise exception 'Prospect tidak ditemukan.'; end if;
  if p.promoted_lead_id is not null then raise exception 'Catat kontak selanjutnya di Pipeline BD.'; end if;
  if p.inbox_status in ('junk','duplicate') then raise exception 'Review status prospect sebelum mencatat interaksi.'; end if;
  if coalesce(payload->>'channel','') not in ('linkedin','whatsapp','email','call','other')
    or coalesce(payload->>'outcome','') not in ('sent','seen','waiting_reply','soft_reply','not_now','interested','meeting_agreed','not_interested') then
    raise exception 'Channel atau hasil interaksi tidak valid.';
  end if;
  if length(coalesce(payload->>'note',''))>3000 then raise exception 'Catatan maksimal 3000 karakter.'; end if;
  insert into public.prospect_interactions(prospect_id,actor_membership_id,channel,outcome,occurred_at,note,follow_up_date)
  values(target_prospect_id,actor_id,payload->>'channel',payload->>'outcome',
    coalesce(nullif(payload->>'occurred_at','')::timestamptz,now()),
    trim(coalesce(payload->>'note','')),nullif(payload->>'follow_up_date','')::date)
  returning id into saved_id;
  update public.prospects set updated_at=now() where id=target_prospect_id;
  return saved_id;
end; $$;

create or replace function public.promote_ready_inbox_prospect(target_prospect_id uuid,target_source_id uuid,target_owner_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare p public.prospects%rowtype; lead_id uuid; entry_path text:=payload->>'entry_path'; due_on date;
begin
  if public.current_membership_id() is null or not public.current_user_has_permission('pipeline.manage_self') then
    raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501';
  end if;
  select * into p from public.prospects where id=target_prospect_id for update;
  if p.id is null then raise exception 'Prospect tidak ditemukan.'; end if;
  if p.promoted_lead_id is not null then return p.promoted_lead_id; end if;
  if p.inbox_status in ('junk','duplicate','replace_pic','new','needs_review') then
    raise exception 'Tandai prospect Potential dan pastikan bukan junk, duplicate, atau perlu ganti PIC.';
  end if;
  if nullif(trim(p.account_name),'') is null or nullif(trim(coalesce(p.contact_name,'')),'') is null
    or nullif(trim(coalesce(p.recommended_service,'')),'') is null
    or (nullif(trim(coalesce(p.linkedin_url,'')),'') is null and nullif(trim(coalesce(p.phone,'')),'') is null and nullif(trim(coalesce(p.email,'')),'') is null
      and not exists(select 1 from public.prospect_interactions i where i.prospect_id=p.id and i.channel='linkedin')) then
    raise exception 'Lengkapi account, PIC, layanan, dan minimal satu kanal kontak di review terlebih dahulu.';
  end if;
  if payload->>'fit_confirmed' is distinct from 'true' or payload->>'pic_confirmed' is distinct from 'true'
    or payload->>'service_confirmed' is distinct from 'true' then
    raise exception 'Konfirmasi fit, PIC, dan layanan sebelum masuk Pipeline.';
  end if;
  if entry_path not in ('active_outreach','opportunity') or length(trim(coalesce(payload->>'reason','')))<12
    or length(trim(coalesce(payload->>'next_action','')))<5 then
    raise exception 'Pilih jalur masuk, tulis alasan minimal 12 karakter, dan next action yang jelas.';
  end if;
  due_on:=nullif(payload->>'due_date','')::date;
  if due_on is null or due_on<(now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Tanggal next action harus hari ini atau setelahnya.';
  end if;
  if entry_path='opportunity' and not exists (
    select 1 from public.prospect_interactions i where i.prospect_id=p.id and i.outcome in ('interested','meeting_agreed')
  ) then raise exception 'Jalur peluang konkret memerlukan interaksi Tertarik atau Meeting disepakati.'; end if;
  if target_owner_id is not null and not exists(select 1 from public.memberships m where m.id=target_owner_id and m.status='active') then
    raise exception 'Owner harus staf aktif.';
  end if;
  update public.prospects set pipeline_entry_path=entry_path,pipeline_entry_reason=trim(payload->>'reason'),
    pipeline_next_action=trim(payload->>'next_action'),pipeline_due_date=due_on,updated_at=now() where id=p.id;
  lead_id:=public.promote_inbox_prospect_to_pipeline(target_prospect_id,target_source_id,target_owner_id);
  -- The existing Harvester/Pipeline promotion function stays unchanged. Enrich only
  -- this newly promoted lead, including its paired My Activity record.
  update public.pipeline_leads pl set
    next_action=trim(payload->>'next_action'),due_date=due_on,
    extra_data=pl.extra_data||jsonb_build_object(
      'pipeline_entry_path',entry_path,'pipeline_entry_reason',trim(payload->>'reason'),
      'inbox_interactions',(select coalesce(jsonb_agg(jsonb_build_object(
        'channel',i.channel,'outcome',i.outcome,'occurred_at',i.occurred_at,
        'note',i.note,'follow_up_date',i.follow_up_date) order by i.occurred_at),'[]'::jsonb)
        from (select * from public.prospect_interactions where prospect_id=p.id order by occurred_at desc limit 100) i)),
    updated_at=now()
  where pl.id=lead_id;
  update public.activities a set
    title=trim(payload->>'next_action')||' · '||p.account_name,
    activity_date=due_on,next_action=trim(payload->>'next_action'),
    updated_by=auth.uid(),updated_at=now()
  where a.id=(select pl.activity_id from public.pipeline_leads pl where pl.id=lead_id);
  return lead_id;
end; $$;

revoke all on function public.log_prospect_interaction(uuid,jsonb),public.promote_ready_inbox_prospect(uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function public.log_prospect_interaction(uuid,jsonb),public.promote_ready_inbox_prospect(uuid,uuid,uuid,jsonb) to authenticated;

-- Extend existing read APIs while preserving the original research payload.
create or replace function public.prospect_inbox_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.current_user_has_permission('pipeline.view') then
    raise exception 'Akses Pipeline BD diperlukan.' using errcode='42501';
  end if;
  return jsonb_build_object(
    'prospects',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',p.id,'account_name',p.account_name,'account_type',p.account_type,'industry',p.industry,
          'city',p.city,'primary_source',p.primary_source,'contact_name',p.contact_name,'contact_role',p.contact_role,
          'recommended_service',p.recommended_service,'recommended_pipeline',p.recommended_pipeline,
          'fit_score',p.fit_score,'intent_score',p.intent_score,'accessibility_score',p.accessibility_score,
          'total_score',p.fit_score+p.intent_score+p.accessibility_score,'inbox_status',p.inbox_status,
          'duplicate_of_prospect_id',p.duplicate_of_prospect_id,'promoted_lead_id',p.promoted_lead_id,
          'updated_at',p.updated_at,'lead_code',r.lead_code,'source_status',r.source_status,
          'pipeline_category',r.pipeline_category,'confidence',r.confidence,'research_date',r.research_date,
          'position_status',r.position_status,'next_action',r.next_action,
          'last_outcome',last_i.outcome,'last_channel',last_i.channel,'last_contact_at',last_i.occurred_at,
          'follow_up_date',last_i.follow_up_date,'interaction_count',(select count(*) from public.prospect_interactions ix where ix.prospect_id=p.id)
        ) order by
          case p.inbox_status when 'needs_review' then 0 when 'new' then 1 when 'replace_pic' then 2 when 'potential' then 3 when 'duplicate' then 4 when 'junk' then 5 else 6 end,
          p.updated_at desc
      )
      from public.prospects p
      left join public.prospect_research_records r on r.prospect_id=p.id
      left join lateral (select i.outcome,i.channel,i.occurred_at,i.follow_up_date from public.prospect_interactions i where i.prospect_id=p.id order by i.occurred_at desc,i.created_at desc limit 1) last_i on true
    ),'[]'::jsonb),
    'stats',jsonb_build_object(
      'total',(select count(*) from public.prospects),
      'needs_review',(select count(*) from public.prospects where inbox_status in ('new','needs_review','replace_pic')),
      'potential',(select count(*) from public.prospects where inbox_status='potential'),
      'duplicates',(select count(*) from public.prospects where inbox_status='duplicate'),
      'converted',(select count(*) from public.prospects where inbox_status='converted'),
      'contacted',(select count(distinct prospect_id) from public.prospect_interactions),
      'follow_up_due',(select count(*) from public.prospects p join lateral (select follow_up_date from public.prospect_interactions i where i.prospect_id=p.id order by i.occurred_at desc,i.created_at desc limit 1) i on true where p.promoted_lead_id is null and i.follow_up_date <= (now() at time zone 'Asia/Jakarta')::date)
    ),
    'pipeline_sources',coalesce((
      select jsonb_agg(jsonb_build_object('id',ws.id,'key',ws.key,'name',ws.name,'color',ws.color,'module_config',ws.module_config) order by ws.sort_order)
      from public.work_sources ws where ws.module_type='pipeline' and ws.is_active and public.can_access_work_source(ws.id)
    ),'[]'::jsonb),
    'members',public.list_pipeline_members(),
    'imports',coalesce((
      select jsonb_agg(to_jsonb(b) order by b.created_at desc) from (
        select * from public.prospect_import_batches order by created_at desc limit 10
      ) b
    ),'[]'::jsonb)
  );
end; $$;

create or replace function public.prospect_inbox_detail(target_prospect_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.current_user_has_permission('pipeline.view') then
    raise exception 'Akses Pipeline BD diperlukan.' using errcode='42501';
  end if;
  select to_jsonb(p)||jsonb_build_object(
    'total_score',p.fit_score+p.intent_score+p.accessibility_score,
    'research',(select to_jsonb(r) from public.prospect_research_records r where r.prospect_id=p.id),
    'signals',coalesce((select jsonb_agg(to_jsonb(s) order by s.detected_at desc) from public.prospect_signals s where s.prospect_id=p.id),'[]'::jsonb),
    'outreach',(select to_jsonb(o) from public.prospect_outreach_drafts o where o.prospect_id=p.id),
    'interactions',coalesce((select jsonb_agg(to_jsonb(i) order by i.occurred_at desc,i.created_at desc) from (select * from public.prospect_interactions where prospect_id=p.id order by occurred_at desc,created_at desc limit 100) i),'[]'::jsonb),
    'review_events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select * from public.prospect_review_events where prospect_id=p.id order by created_at desc limit 30) e),'[]'::jsonb),
    'duplicate_of',(select jsonb_build_object('id',d.id,'account_name',d.account_name,'contact_name',d.contact_name,'promoted_lead_id',d.promoted_lead_id) from public.prospects d where d.id=p.duplicate_of_prospect_id)
  ) into result from public.prospects p where p.id=target_prospect_id;
  if result is null then raise exception 'Prospect tidak ditemukan.'; end if;
  return result;
end; $$;
