-- Ruang Kawan Prospect Harvester
-- Discovery -> raw staging -> deduped prospects -> signals -> human review -> existing Pipeline BD.

create table if not exists public.prospect_raw_items (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null,
  external_id text not null,
  search_query text,
  prospect_id uuid,
  raw_data jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_data)='object'),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,external_id)
);

create table if not exists public.prospects (
  id uuid primary key default extensions.gen_random_uuid(),
  account_name text not null check (char_length(trim(account_name)) between 1 and 180),
  account_type text,
  industry text,
  city text,
  address text,
  website text,
  phone text,
  email text,
  linkedin_url text,
  threads_url text,
  instagram_url text,
  google_maps_url text,
  primary_source text not null default 'Manual',
  fit_score smallint not null default 0 check (fit_score between 0 and 40),
  intent_score smallint not null default 0 check (intent_score between 0 and 40),
  accessibility_score smallint not null default 0 check (accessibility_score between 0 and 20),
  recommended_pipeline text,
  recommended_service text,
  recommended_business_unit text,
  contact_name text,
  contact_role text,
  ai_summary text,
  status text not null default 'new' check (status in ('new','reviewed','promoted','archived')),
  promoted_lead_id uuid references public.pipeline_leads(id) on delete set null,
  promoted_at timestamptz,
  last_enriched_at timestamptz,
  raw_data jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_data)='object'),
  created_by_membership_id uuid references public.memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prospect_raw_items_prospect_fk'
      and conrelid = 'public.prospect_raw_items'::regclass
  ) then
    alter table public.prospect_raw_items
      add constraint prospect_raw_items_prospect_fk
      foreign key (prospect_id) references public.prospects(id) on delete set null;
  end if;
end;
$$;

create table if not exists public.prospect_signals (
  id uuid primary key default extensions.gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  source text not null,
  signal_type text not null default 'General',
  content text,
  url text,
  detected_at timestamptz not null default now(),
  intent text,
  service_match text,
  signal_score smallint not null default 0 check (signal_score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);

create table if not exists public.prospect_search_configs (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null check (provider in ('google_maps','threads')),
  segment text not null,
  label text not null,
  search_query text not null,
  search_type text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,search_query)
);

create table if not exists public.prospect_outreach_drafts (
  id uuid primary key default extensions.gen_random_uuid(),
  prospect_id uuid not null unique references public.prospects(id) on delete cascade,
  recommended_channel text,
  drafts jsonb not null default '{}'::jsonb check (jsonb_typeof(drafts)='object'),
  generated_at timestamptz not null default now(),
  generated_by_membership_id uuid references public.memberships(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists prospects_status_score_idx on public.prospects(status,((fit_score+intent_score+accessibility_score)) desc,created_at desc);
create index if not exists prospects_account_search_idx on public.prospects using gin(to_tsvector('simple',account_name||' '||coalesce(city,'')||' '||coalesce(industry,'')));
create index if not exists prospect_signals_prospect_detected_idx on public.prospect_signals(prospect_id,detected_at desc);
create index if not exists prospect_raw_items_prospect_idx on public.prospect_raw_items(prospect_id,fetched_at desc);
create unique index if not exists prospect_signals_source_url_unique on public.prospect_signals(prospect_id,source,url) where url is not null and trim(url)<>'';

alter table public.prospect_raw_items enable row level security;
alter table public.prospects enable row level security;
alter table public.prospect_signals enable row level security;
alter table public.prospect_search_configs enable row level security;
alter table public.prospect_outreach_drafts enable row level security;
revoke all on public.prospect_raw_items,public.prospects,public.prospect_signals,public.prospect_search_configs,public.prospect_outreach_drafts from anon,authenticated;

insert into public.prospect_search_configs(provider,segment,label,search_query,search_type,sort_order) values
 ('google_maps','School','SMA Swasta Bogor','SMA swasta Bogor',null,10),
 ('google_maps','School','SMA Swasta Jakarta','SMA swasta Jakarta',null,11),
 ('google_maps','School','International School Jabodetabek','international school Jakarta',null,12),
 ('google_maps','School','Boarding School Bogor','boarding school Bogor',null,13),
 ('google_maps','Campus','Universitas Swasta Jakarta','universitas swasta Jakarta',null,20),
 ('google_maps','Campus','Universitas Swasta Bogor','universitas swasta Bogor',null,21),
 ('google_maps','Campus','Perguruan Tinggi Bandung','universitas politeknik sekolah tinggi Bandung',null,22),
 ('google_maps','Company','Corporate Office Jakarta','corporate office Jakarta',null,30),
 ('google_maps','Company','Perusahaan Tangerang','perusahaan Tangerang',null,31),
 ('google_maps','Company','Manufacturing Cibinong','manufacturing company Cibinong Bogor',null,32),
 ('google_maps','Company','Training Center Jakarta','training center Jakarta',null,33),
 ('threads','Event','Cari EO','cari EO','RECENT',100),
 ('threads','Event','Butuh EO','butuh EO','RECENT',101),
 ('threads','Event','Vendor Event','vendor event','RECENT',102),
 ('threads','Event','Company Gathering','company gathering','RECENT',103),
 ('threads','Event','Team Building','team building kantor','RECENT',104),
 ('threads','Training','Capacity Building','capacity building','RECENT',110),
 ('threads','Training','Cari Trainer','cari trainer','RECENT',111),
 ('threads','Training','Training Karyawan','training karyawan','RECENT',112),
 ('threads','Digital','Butuh Website','butuh website','RECENT',120),
 ('threads','Digital','Cari Jasa Website','cari jasa website','RECENT',121),
 ('threads','Digital','Landing Page','butuh landing page','RECENT',122),
 ('threads','Education','Leadership Camp','leadership camp sekolah','RECENT',130),
 ('threads','Education','Pelatihan Siswa','pelatihan siswa','RECENT',131),
 ('threads','Education','Seminar Sekolah','seminar sekolah','RECENT',132)
on conflict(provider,search_query) do update set segment=excluded.segment,label=excluded.label,search_type=excluded.search_type,sort_order=excluded.sort_order;

create or replace function public.prospect_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.current_user_has_permission('pipeline.view') then raise exception 'Akses Pipeline BD diperlukan.' using errcode='42501'; end if;
  return jsonb_build_object(
    'prospects',coalesce((select jsonb_agg(
      to_jsonb(p)||jsonb_build_object(
        'total_score',p.fit_score+p.intent_score+p.accessibility_score,
        'signals',coalesce((select jsonb_agg(to_jsonb(s) order by s.detected_at desc) from public.prospect_signals s where s.prospect_id=p.id),'[]'::jsonb),
        'outreach',(select to_jsonb(o) from public.prospect_outreach_drafts o where o.prospect_id=p.id)
      ) order by case p.status when 'new' then 0 when 'reviewed' then 1 when 'promoted' then 2 else 3 end,(p.fit_score+p.intent_score+p.accessibility_score) desc,p.created_at desc
    ) from public.prospects p),'[]'::jsonb),
    'configs',coalesce((select jsonb_agg(to_jsonb(c) order by c.provider,c.sort_order,c.label) from public.prospect_search_configs c where c.is_active),'[]'::jsonb),
    'pipeline_sources',coalesce((select jsonb_agg(jsonb_build_object('id',ws.id,'key',ws.key,'name',ws.name,'color',ws.color,'module_config',ws.module_config) order by ws.sort_order) from public.work_sources ws where ws.module_type='pipeline' and ws.is_active and public.can_access_work_source(ws.id)),'[]'::jsonb),
    'members',public.list_pipeline_members()
  );
end; $$;

create or replace function public.ingest_prospect_candidate(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  actor_id uuid:=public.current_membership_id();
  provider_name text:=coalesce(nullif(trim(payload->>'provider'),''),'Manual');
  external_key text:=coalesce(nullif(trim(payload->>'external_id'),''),extensions.gen_random_uuid()::text);
  account_value text:=trim(coalesce(payload->>'account_name',''));
  city_value text:=nullif(trim(payload->>'city'),'');
  website_value text:=nullif(trim(payload->>'website'),'');
  prospect_uuid uuid;
  raw_uuid uuid;
  fit_value integer:=least(40,greatest(0,coalesce(nullif(payload->>'fit_score','')::integer,0)));
  intent_value integer:=least(40,greatest(0,coalesce(nullif(payload->>'intent_score','')::integer,0)));
  access_value integer:=least(20,greatest(0,coalesce(nullif(payload->>'accessibility_score','')::integer,0)));
begin
  if actor_id is null or not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
  if account_value='' then raise exception 'Nama prospect wajib diisi.'; end if;

  insert into public.prospect_raw_items(provider,external_id,search_query,raw_data,fetched_at)
  values(provider_name,external_key,nullif(trim(payload->>'search_query'),''),coalesce(payload->'raw_data','{}'::jsonb),coalesce(nullif(payload->>'fetched_at','')::timestamptz,now()))
  on conflict(provider,external_id) do update set search_query=coalesce(excluded.search_query,public.prospect_raw_items.search_query),raw_data=excluded.raw_data,fetched_at=excluded.fetched_at,updated_at=now()
  returning id,prospect_id into raw_uuid,prospect_uuid;

  if prospect_uuid is null and website_value is not null then
    select id into prospect_uuid from public.prospects where lower(trim(website))=lower(trim(website_value)) limit 1;
  end if;
  if prospect_uuid is null then
    select id into prospect_uuid from public.prospects where lower(trim(account_name))=lower(account_value) and coalesce(lower(trim(city)),'')=coalesce(lower(city_value),'') limit 1;
  end if;

  if prospect_uuid is null then
    insert into public.prospects(account_name,account_type,industry,city,address,website,phone,email,linkedin_url,threads_url,instagram_url,google_maps_url,primary_source,fit_score,intent_score,accessibility_score,recommended_pipeline,recommended_service,recommended_business_unit,contact_name,contact_role,ai_summary,raw_data,created_by_membership_id)
    values(account_value,nullif(trim(payload->>'account_type'),''),nullif(trim(payload->>'industry'),''),city_value,nullif(trim(payload->>'address'),''),website_value,nullif(trim(payload->>'phone'),''),nullif(trim(payload->>'email'),''),nullif(trim(payload->>'linkedin_url'),''),nullif(trim(payload->>'threads_url'),''),nullif(trim(payload->>'instagram_url'),''),nullif(trim(payload->>'google_maps_url'),''),provider_name,fit_value,intent_value,access_value,nullif(trim(payload->>'recommended_pipeline'),''),nullif(trim(payload->>'recommended_service'),''),nullif(trim(payload->>'recommended_business_unit'),''),nullif(trim(payload->>'contact_name'),''),nullif(trim(payload->>'contact_role'),''),nullif(trim(payload->>'ai_summary'),''),jsonb_build_object('providers',jsonb_build_array(provider_name)),actor_id)
    returning id into prospect_uuid;
  else
    update public.prospects set
      account_type=coalesce(account_type,nullif(trim(payload->>'account_type'),'')),industry=coalesce(industry,nullif(trim(payload->>'industry'),'')),city=coalesce(city,city_value),address=coalesce(address,nullif(trim(payload->>'address'),'')),website=coalesce(website,website_value),phone=coalesce(phone,nullif(trim(payload->>'phone'),'')),email=coalesce(email,nullif(trim(payload->>'email'),'')),linkedin_url=coalesce(linkedin_url,nullif(trim(payload->>'linkedin_url'),'')),threads_url=coalesce(threads_url,nullif(trim(payload->>'threads_url'),'')),instagram_url=coalesce(instagram_url,nullif(trim(payload->>'instagram_url'),'')),google_maps_url=coalesce(google_maps_url,nullif(trim(payload->>'google_maps_url'),'')),fit_score=greatest(fit_score,fit_value),intent_score=greatest(intent_score,intent_value),accessibility_score=greatest(accessibility_score,access_value),recommended_pipeline=coalesce(nullif(trim(payload->>'recommended_pipeline'),''),recommended_pipeline),recommended_service=coalesce(nullif(trim(payload->>'recommended_service'),''),recommended_service),recommended_business_unit=coalesce(nullif(trim(payload->>'recommended_business_unit'),''),recommended_business_unit),contact_name=coalesce(contact_name,nullif(trim(payload->>'contact_name'),'')),contact_role=coalesce(contact_role,nullif(trim(payload->>'contact_role'),'')),ai_summary=coalesce(nullif(trim(payload->>'ai_summary'),''),ai_summary),raw_data=jsonb_set(coalesce(raw_data,'{}'::jsonb),'{last_provider}',to_jsonb(provider_name),true),updated_at=now()
    where id=prospect_uuid;
  end if;
  update public.prospect_raw_items set prospect_id=prospect_uuid,updated_at=now() where id=raw_uuid;

  if nullif(trim(payload->>'signal_content'),'') is not null then
    insert into public.prospect_signals(prospect_id,source,signal_type,content,url,detected_at,intent,service_match,signal_score,metadata)
    values(prospect_uuid,provider_name,coalesce(nullif(trim(payload->>'signal_type'),''),'Discovery'),nullif(trim(payload->>'signal_content'),''),nullif(trim(payload->>'signal_url'),''),coalesce(nullif(payload->>'signal_detected_at','')::timestamptz,now()),nullif(trim(payload->>'signal_intent'),''),nullif(trim(payload->>'signal_service_match'),''),least(100,greatest(0,coalesce(nullif(payload->>'signal_score','')::integer,0))),coalesce(payload->'signal_metadata','{}'::jsonb))
    on conflict do nothing;
  end if;
  return prospect_uuid;
end; $$;

create or replace function public.apply_prospect_enrichment(target_prospect_id uuid,payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare e jsonb;
begin
  if not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
  update public.prospects set
    account_type=coalesce(nullif(trim(payload->>'account_type'),''),account_type),industry=coalesce(nullif(trim(payload->>'industry'),''),industry),city=coalesce(nullif(trim(payload->>'city'),''),city),website=coalesce(nullif(trim(payload->>'website'),''),website),phone=coalesce(nullif(trim(payload->>'phone'),''),phone),email=coalesce(nullif(trim(payload->>'email'),''),email),linkedin_url=coalesce(nullif(trim(payload->>'linkedin_url'),''),linkedin_url),instagram_url=coalesce(nullif(trim(payload->>'instagram_url'),''),instagram_url),fit_score=least(40,greatest(0,coalesce(nullif(payload->>'fit_score','')::integer,fit_score))),intent_score=least(40,greatest(0,coalesce(nullif(payload->>'intent_score','')::integer,intent_score))),accessibility_score=least(20,greatest(0,coalesce(nullif(payload->>'accessibility_score','')::integer,accessibility_score))),recommended_pipeline=coalesce(nullif(trim(payload->>'recommended_pipeline'),''),recommended_pipeline),recommended_service=coalesce(nullif(trim(payload->>'recommended_service'),''),recommended_service),recommended_business_unit=coalesce(nullif(trim(payload->>'recommended_business_unit'),''),recommended_business_unit),contact_name=coalesce(nullif(trim(payload->>'contact_name'),''),contact_name),contact_role=coalesce(nullif(trim(payload->>'contact_role'),''),contact_role),ai_summary=coalesce(nullif(trim(payload->>'ai_summary'),''),ai_summary),status=case when status='new' then 'reviewed' else status end,last_enriched_at=now(),raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('ai_enrichment',coalesce(payload,'{}'::jsonb)),updated_at=now()
  where id=target_prospect_id;
  if not found then raise exception 'Prospect tidak ditemukan.'; end if;
  for e in select value from jsonb_array_elements(coalesce(payload->'evidence','[]'::jsonb)) loop
    insert into public.prospect_signals(prospect_id,source,signal_type,content,url,detected_at,intent,service_match,signal_score,metadata)
    values(target_prospect_id,coalesce(nullif(trim(e->>'source'),''),'AI Enrichment'),coalesce(nullif(trim(e->>'signal_type'),''),'Evidence'),nullif(trim(e->>'content'),''),nullif(trim(e->>'url'),''),now(),nullif(trim(e->>'intent'),''),nullif(trim(e->>'service_match'),''),least(100,greatest(0,coalesce(nullif(e->>'signal_score','')::integer,50))),coalesce(e->'metadata','{}'::jsonb))
    on conflict do nothing;
  end loop;
end; $$;

create or replace function public.save_prospect_outreach(target_prospect_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare saved_id uuid; actor_id uuid:=public.current_membership_id();
begin
  if actor_id is null or not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
  if not exists(select 1 from public.prospects where id=target_prospect_id) then raise exception 'Prospect tidak ditemukan.'; end if;
  insert into public.prospect_outreach_drafts(prospect_id,recommended_channel,drafts,generated_by_membership_id)
  values(target_prospect_id,nullif(trim(payload->>'recommended_channel'),''),coalesce(payload->'drafts','{}'::jsonb),actor_id)
  on conflict(prospect_id) do update set recommended_channel=excluded.recommended_channel,drafts=excluded.drafts,generated_at=now(),generated_by_membership_id=excluded.generated_by_membership_id,updated_at=now()
  returning id into saved_id;
  return saved_id;
end; $$;

create or replace function public.set_prospect_status(target_prospect_id uuid,target_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
  if target_status not in ('new','reviewed','archived') then raise exception 'Status prospect tidak valid.'; end if;
  update public.prospects set status=target_status,updated_at=now() where id=target_prospect_id and promoted_lead_id is null;
  if not found then raise exception 'Prospect tidak dapat diperbarui.'; end if;
end; $$;

create or replace function public.promote_prospect_to_pipeline(target_prospect_id uuid,target_source_id uuid,target_owner_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  p public.prospects%rowtype; config jsonb; source_key text; owner_id uuid:=coalesce(target_owner_id,public.current_membership_id());
  chosen_stage text; chosen_priority text; chosen_unit text; chosen_activity text; chosen_kpi text; chosen_qualification text;
  score integer; lead_id uuid; contact_blob text; lead_payload jsonb;
begin
  if not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
  select * into p from public.prospects where id=target_prospect_id for update;
  if p.id is null then raise exception 'Prospect tidak ditemukan.'; end if;
  if p.promoted_lead_id is not null then return p.promoted_lead_id; end if;
  if p.status='archived' then raise exception 'Prospect diarsipkan.'; end if;
  select ws.module_config,ws.key into config,source_key from public.work_sources ws where ws.id=target_source_id and ws.module_type='pipeline' and public.can_access_work_source(ws.id);
  if config is null then raise exception 'Pipeline tujuan tidak tersedia.' using errcode='42501'; end if;

  chosen_stage:=case when coalesce(config->'stages','[]'::jsonb) ? 'Researched' then 'Researched' else config->'stages'->>0 end;
  score:=p.fit_score+p.intent_score+p.accessibility_score;
  chosen_priority:=case when score>=80 then 'High' when score>=60 then 'Medium' else 'Low' end;
  if jsonb_array_length(coalesce(config->'priorities','[]'::jsonb))>0 and not (config->'priorities') ? chosen_priority then chosen_priority:=coalesce(config->'priorities'->>0,'Medium'); end if;
  chosen_unit:=case when p.recommended_business_unit is not null and coalesce(config->'business_units','[]'::jsonb) ? p.recommended_business_unit then p.recommended_business_unit else config->'business_units'->>0 end;
  chosen_activity:=case when coalesce(config->'activity_types','[]'::jsonb) ? 'Follow Up' then 'Follow Up' else coalesce(config->'activity_types'->>0,'Follow Up') end;
  chosen_qualification:=case when coalesce(config->'qualification_statuses','[]'::jsonb) ? 'Pending' then 'Pending' else null end;
  if source_key='pipeline_coreva' and coalesce(config->'kpi_options','[]'::jsonb) ? 'Outreach Client Coreva' then chosen_kpi:='Outreach Client Coreva';
  elsif (coalesce(p.recommended_service,'') ilike '%website%' or coalesce(p.recommended_service,'') ilike '%digital%' or coalesce(p.recommended_service,'') ilike '%system%') and coalesce(config->'kpi_options','[]'::jsonb) ? 'Outreach Client Website/Landing Page & Sistem Digital' then chosen_kpi:='Outreach Client Website/Landing Page & Sistem Digital';
  elsif coalesce(config->'kpi_options','[]'::jsonb) ? 'Outreach Client EO' then chosen_kpi:='Outreach Client EO'; else chosen_kpi:=config->'kpi_options'->>0; end if;
  contact_blob:=nullif(trim(concat_ws(' · ',nullif(p.phone,''),nullif(p.email,''))),'');
  lead_payload:=jsonb_build_object('source_id',target_source_id,'owner_membership_id',owner_id,'date_added',current_date,'business_unit',chosen_unit,'account_name',p.account_name,'account_type',p.account_type,'contact_name',p.contact_name,'contact_role',p.contact_role,'contact_details',contact_blob,'lead_source',p.primary_source,'priority',chosen_priority,'stage',chosen_stage,'qualification_status',chosen_qualification,'activity_type',chosen_activity,'next_action','Hubungi '||p.account_name||case when p.recommended_service is not null then ' terkait '||p.recommended_service else '' end,'due_date',current_date+1,'document_url',p.website,'notes',p.ai_summary,'linked_kpi',chosen_kpi,'extra_data',jsonb_build_object('prospect_id',p.id,'prospect_score',score,'fit_score',p.fit_score,'intent_score',p.intent_score,'accessibility_score',p.accessibility_score,'recommended_service',p.recommended_service,'google_maps_url',p.google_maps_url,'linkedin_url',p.linkedin_url,'threads_url',p.threads_url,'instagram_url',p.instagram_url,'website',p.website));
  lead_id:=public.save_pipeline_lead(null,lead_payload);
  update public.prospects set status='promoted',promoted_lead_id=lead_id,promoted_at=now(),updated_at=now() where id=p.id;
  return lead_id;
end; $$;

revoke all on function public.prospect_workspace(),public.ingest_prospect_candidate(jsonb),public.apply_prospect_enrichment(uuid,jsonb),public.save_prospect_outreach(uuid,jsonb),public.set_prospect_status(uuid,text),public.promote_prospect_to_pipeline(uuid,uuid,uuid) from public,anon;
grant execute on function public.prospect_workspace(),public.ingest_prospect_candidate(jsonb),public.apply_prospect_enrichment(uuid,jsonb),public.save_prospect_outreach(uuid,jsonb),public.set_prospect_status(uuid,text),public.promote_prospect_to_pipeline(uuid,uuid,uuid) to authenticated;
