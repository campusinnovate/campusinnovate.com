-- Ruang Kawan final consolidation: position-aware Marketing workspace.

insert into public.permissions(key,name,description) values
 ('marketing.view','Buka Marketing','Membuka Marketing Workspace sesuai tab yang diizinkan.'),
 ('marketing.overview.view','Lihat overview Marketing','Melihat ringkasan Marketing yang tidak sensitif.'),
 ('marketing.brand.view','Lihat Brand Config','Melihat panduan dan aset brand.'),
 ('marketing.brand.manage','Kelola Brand Config','Mengubah panduan dan aset brand.'),
 ('marketing.catalog.view','Lihat Service & Pricing','Melihat katalog layanan dan harga sesuai akses.'),
 ('marketing.catalog.manage','Kelola Service & Pricing','Mengubah katalog layanan dan harga.'),
 ('marketing.proposal.view','Lihat Proposal & Deck','Melihat proposal dan deck yang ditugaskan atau boleh direview.'),
 ('marketing.proposal.manage','Kelola Proposal & Deck','Membuat dan memperbarui proposal atau deck.'),
 ('marketing.proposal.review','Review Proposal & Deck','Memberi review dan meminta revisi proposal atau deck.'),
 ('marketing.proposal.approve','Setujui Proposal & Deck','Menyetujui proposal atau deck.'),
 ('vendors.view','Lihat Vendor','Melihat data operasional vendor.'),
 ('vendors.create','Tambah Vendor','Mendaftarkan kandidat vendor.'),
 ('vendors.manage','Kelola Vendor','Memvalidasi dan memperbarui vendor.'),
 ('vendors.manage_sensitive','Kelola data sensitif Vendor','Melihat dan mengubah rekening serta data sensitif vendor.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key='system_admin' and (p.key like 'marketing.%' or p.key like 'vendors.%')
   or r.key='executive' and (p.key like 'marketing.%' or p.key like 'vendors.%')
on conflict do nothing;

create table public.position_permissions(
 position_id uuid not null references public.positions(id) on delete cascade,
 permission_id uuid not null references public.permissions(id) on delete cascade,
 primary key(position_id,permission_id)
);

insert into public.position_permissions(position_id,permission_id)
select pos.id,perm.id from public.positions pos cross join public.permissions perm
where
 (pos.key in ('social_media_staff','growth_marketing_staff') and perm.key in
   ('marketing.view','marketing.overview.view','marketing.brand.view','marketing.brand.manage'))
 or (pos.key='business_development_staff' and perm.key in
   ('marketing.view','marketing.overview.view','marketing.catalog.view','marketing.proposal.view','marketing.proposal.manage','vendors.view','vendors.create'))
 or (pos.key in ('ceo','coo') and (perm.key like 'marketing.%' or perm.key like 'vendors.%'))
on conflict do nothing;

create or replace function public.current_user_has_permission(permission_key text)
returns boolean language sql stable security definer set search_path=public as $$
 select (
   exists(select 1 from public.memberships m join public.member_roles mr on mr.membership_id=m.id join public.role_permissions rp on rp.role_id=mr.role_id join public.permissions p on p.id=rp.permission_id where m.user_id=auth.uid() and m.status='active' and p.key=permission_key)
   or exists(select 1 from public.memberships m join public.position_permissions pp on pp.position_id=m.position_id join public.permissions p on p.id=pp.permission_id where m.user_id=auth.uid() and m.status='active' and p.key=permission_key)
   or exists(select 1 from public.memberships m join public.member_permission_overrides mpo on mpo.membership_id=m.id join public.permissions p on p.id=mpo.permission_id where m.user_id=auth.uid() and m.status='active' and p.key=permission_key and mpo.effect='allow')
 ) and not exists(select 1 from public.memberships m join public.member_permission_overrides mpo on mpo.membership_id=m.id join public.permissions p on p.id=mpo.permission_id where m.user_id=auth.uid() and m.status='active' and p.key=permission_key and mpo.effect='deny');
$$;

create or replace function public.get_my_access()
returns table(membership_status text,full_name text,position_name text,department_name text,engagement_type text,roles text[],permissions text[])
language sql stable security definer set search_path=public as $$
 with my_membership as(select m.* from public.memberships m where m.user_id=auth.uid() limit 1),
 my_roles as(select array_agg(distinct r.key order by r.key) role_keys from public.member_roles mr join public.roles r on r.id=mr.role_id join my_membership m on m.id=mr.membership_id),
 role_permission_keys as(select p.key from public.member_roles mr join public.role_permissions rp on rp.role_id=mr.role_id join public.permissions p on p.id=rp.permission_id join my_membership m on m.id=mr.membership_id),
 position_permission_keys as(select p.key from my_membership m join public.position_permissions pp on pp.position_id=m.position_id join public.permissions p on p.id=pp.permission_id),
 allowed_overrides as(select p.key from public.member_permission_overrides mpo join public.permissions p on p.id=mpo.permission_id join my_membership m on m.id=mpo.membership_id where mpo.effect='allow'),
 denied_overrides as(select p.key from public.member_permission_overrides mpo join public.permissions p on p.id=mpo.permission_id join my_membership m on m.id=mpo.membership_id where mpo.effect='deny'),
 effective_permissions as(select key from role_permission_keys union select key from position_permission_keys union select key from allowed_overrides except select key from denied_overrides)
 select m.status,coalesce(m.full_name,pr.full_name),pos.name,d.name,m.engagement_type,coalesce(mr.role_keys,'{}'::text[]),coalesce((select array_agg(key order by key) from effective_permissions),'{}'::text[])
 from my_membership m left join public.profiles pr on pr.user_id=m.user_id left join public.positions pos on pos.id=m.position_id left join public.departments d on d.id=m.department_id cross join my_roles mr;
$$;

create table public.marketing_brand_profiles(
 id uuid primary key default extensions.gen_random_uuid(),
 brand_key text not null unique,
 name text not null,
 description text,
 voice_tone text,
 primary_colors text[] not null default '{}'::text[],
 secondary_colors text[] not null default '{}'::text[],
 font_notes text,
 logo_url text,
 asset_folder_url text,
 guideline_url text,
 notes text,
 is_active boolean not null default true,
 updated_by_membership_id uuid references public.memberships(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create table public.service_catalog_items(
 id uuid primary key default extensions.gen_random_uuid(),service_code text not null unique,
 category text not null,service_name text not null,ideal_client text,trigger_problem text,core_scope text,
 add_ons text,proposal_output text,deck_requirement text,pricing_method text,reference_price text,
 target_margin text,staff_authority text,approval_requirement text,draft_sla text,
 template_status text not null default 'Belum Ada' check(template_status in ('Belum Ada','Perlu Dibuat','Draft','Sudah Ada','Perlu Update')),
 notes text,is_active boolean not null default true,sort_order integer not null default 100,
 updated_by_membership_id uuid references public.memberships(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create table public.marketing_workflow_stages(
 id uuid primary key default extensions.gen_random_uuid(),workflow_key text not null,stage_key text not null,label text not null,
 sort_order integer not null,terminal boolean not null default false,is_active boolean not null default true,
 unique(workflow_key,stage_key)
);

create sequence public.proposal_deliverable_seq;
create table public.proposal_deliverables(
 id uuid primary key default extensions.gen_random_uuid(),deliverable_code text not null unique,
 account_name text not null,deliverable_type text not null check(deliverable_type in ('Proposal','Deck','Quotation','Concept Note','Contract','Report')),
 service_catalog_id uuid references public.service_catalog_items(id),service_name_snapshot text,
 brief_source text,owner_membership_id uuid references public.memberships(id),reviewer_membership_id uuid references public.memberships(id),
 priority text not null default 'Medium' check(priority in ('Urgent','High','Medium','Low')),
 status text not null default 'Menunggu Discovery',start_date date,deadline date,draft_sla text,template_name text,
 missing_inputs text,next_action text,output_url text,period_label text,linked_pipeline_lead_id uuid references public.pipeline_leads(id),
 created_by_membership_id uuid not null references public.memberships(id),updated_by_membership_id uuid not null references public.memberships(id),
 approved_by_membership_id uuid references public.memberships(id),approved_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index proposal_owner_status_idx on public.proposal_deliverables(owner_membership_id,status,deadline);
create index proposal_reviewer_status_idx on public.proposal_deliverables(reviewer_membership_id,status,deadline);

create table public.marketing_events(
 id bigint generated always as identity primary key,entity_type text not null,entity_id uuid not null,
 actor_membership_id uuid not null references public.memberships(id),action text not null,before_data jsonb,after_data jsonb,created_at timestamptz not null default now()
);

insert into public.marketing_brand_profiles(brand_key,name,description) values
 ('campus_innovate','Campus Innovate','Brand utama perusahaan.'),('stripmate','Stripmate','Brand trip dan komunitas.')
on conflict(brand_key) do nothing;

insert into public.service_catalog_items(service_code,category,service_name,pricing_method,reference_price,target_margin,staff_authority,approval_requirement,draft_sla,template_status,sort_order) values
 ('DIG-WEB','Digital System','Institutional Website','Project based','Sesuai discovery','Min. 30%','BD boleh menawarkan scope standar','CEO approval untuk custom scope, diskon, dan harga','Sesuai kompleksitas','Sudah Ada',10),
 ('DIG-TMS','Digital System','Training Management System','Project based','Sesuai discovery','Min. 30%','BD boleh menawarkan scope standar','CEO approval untuk custom scope, diskon, dan harga','Sesuai kompleksitas','Sudah Ada',20),
 ('DIG-CAREER','Digital System','Career / Alumni Platform','Project based','Sesuai discovery','Min. 30%','BD boleh menawarkan scope standar','CEO approval untuk custom scope, diskon, dan harga','Sesuai kompleksitas','Sudah Ada',30),
 ('EVT-SUPPORT','Event','Event Support','Project based','Sesuai kebutuhan','25–30%','BD boleh menawarkan scope standar','CEO approval untuk harga khusus','Sesuai brief','Sudah Ada',40),
 ('EVT-FULL','Event','Full Event Management','Project based','Sesuai kebutuhan','25–30%','BD boleh menawarkan scope standar','CEO approval untuk custom scope dan harga','Sesuai brief','Sudah Ada',50),
 ('EVT-PARTNER','Event','Strategic Event Partner','Custom partnership','Sesuai discovery','25–30%','BD menyiapkan discovery dan draft','CEO approval wajib','Sesuai discovery','Perlu Update',60),
 ('PRG-CAPACITY','Program','Capacity Building','Per program','Sesuai peserta dan scope','30%','BD boleh menawarkan paket standar','CEO approval untuk customization','Sesuai brief','Sudah Ada',70),
 ('PRG-CSR','Program','Community Development / CSR','Custom program','Sesuai discovery','30%','BD menyiapkan discovery dan draft','CEO approval wajib','Sesuai discovery','Perlu Dibuat',80),
 ('MED-CREATIVE','Media','Creative & Media Package','Package / retainer','Sesuai paket','35%','BD boleh menawarkan paket standar','CEO approval untuk custom scope dan diskon','Sesuai brief','Sudah Ada',90),
 ('COREVA-PRO','Product','Coreva Pro','Subscription','Rp99.000/bulan atau Rp990.000/tahun','Validasi HPP','BD boleh menawarkan','CEO approval untuk diskon/customization','2 jam','Sudah Ada',100),
 ('COREVA-BUS','Product','Coreva Business','Subscription','Rp159.000/bulan atau Rp1.590.000/tahun','Validasi HPP','BD boleh menawarkan','CEO approval untuk diskon/customization','2 jam','Sudah Ada',110)
on conflict(service_code) do update set category=excluded.category,service_name=excluded.service_name,pricing_method=excluded.pricing_method,reference_price=excluded.reference_price,target_margin=excluded.target_margin,staff_authority=excluded.staff_authority,approval_requirement=excluded.approval_requirement,draft_sla=excluded.draft_sla,template_status=excluded.template_status,sort_order=excluded.sort_order;

insert into public.marketing_workflow_stages(workflow_key,stage_key,label,sort_order,terminal) values
 ('proposal','waiting_discovery','Menunggu Discovery',10,false),('proposal','waiting_brief','Menunggu Brief',20,false),
 ('proposal','bd_briefing','Briefing BD',30,false),('proposal','drafting','Drafting',40,false),
 ('proposal','ceo_review','Review CEO',50,false),('proposal','revision','Revision',60,false),
 ('proposal','approved','Approved',70,false),('proposal','sent','Sent',80,false),
 ('proposal','discussion','Discussion',90,false),('proposal','needs_update','Perlu Update',100,false),
 ('proposal','won','Won',110,true),('proposal','lost','Lost',120,true),
 ('proposal','completed','Completed',130,true),('proposal','archived','Archived',140,true)
on conflict(workflow_key,stage_key) do update set label=excluded.label,sort_order=excluded.sort_order,terminal=excluded.terminal;

create or replace function public.marketing_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();begin
 if actor is null or not public.current_user_has_permission('marketing.view') then raise exception 'Akses Marketing diperlukan.' using errcode='42501';end if;
 return jsonb_build_object(
  'permissions',(select coalesce(jsonb_agg(p.key order by p.key),'[]'::jsonb) from public.permissions p where public.current_user_has_permission(p.key) and (p.key like 'marketing.%' or p.key like 'vendors.%' or p.key in ('content_plan.view','pipeline.view'))),
  'brands',case when public.current_user_has_permission('marketing.brand.view') then coalesce((select jsonb_agg(to_jsonb(b) order by b.name) from public.marketing_brand_profiles b where b.is_active),'[]'::jsonb) else '[]'::jsonb end,
  'catalog',case when public.current_user_has_permission('marketing.catalog.view') then coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.service_name) from public.service_catalog_items c where c.is_active),'[]'::jsonb) else '[]'::jsonb end,
  'stages',case when public.current_user_has_permission('marketing.proposal.view') then coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order) from public.marketing_workflow_stages s where s.workflow_key='proposal' and s.is_active),'[]'::jsonb) else '[]'::jsonb end,
  'proposals',case when public.current_user_has_permission('marketing.proposal.view') then coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'deliverable_code',d.deliverable_code,'account_name',d.account_name,'deliverable_type',d.deliverable_type,'service_catalog_id',d.service_catalog_id,'service_name',coalesce(c.service_name,d.service_name_snapshot),'brief_source',d.brief_source,'owner_membership_id',d.owner_membership_id,'owner_name',coalesce(o.full_name,o.email::text),'reviewer_membership_id',d.reviewer_membership_id,'reviewer_name',coalesce(r.full_name,r.email::text),'priority',d.priority,'status',d.status,'start_date',d.start_date,'deadline',d.deadline,'draft_sla',d.draft_sla,'template_name',d.template_name,'missing_inputs',d.missing_inputs,'next_action',d.next_action,'output_url',d.output_url,'period_label',d.period_label,'updated_at',d.updated_at) order by d.updated_at desc) from public.proposal_deliverables d left join public.service_catalog_items c on c.id=d.service_catalog_id left join public.memberships o on o.id=d.owner_membership_id left join public.memberships r on r.id=d.reviewer_membership_id where public.current_user_has_permission('marketing.proposal.review') or public.current_user_has_permission('marketing.proposal.approve') or d.owner_membership_id=actor or d.reviewer_membership_id=actor or d.created_by_membership_id=actor),'[]'::jsonb) else '[]'::jsonb end,
  'members',case when public.current_user_has_permission('marketing.proposal.manage') then coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text)) order by coalesce(m.full_name,m.email::text)) from public.memberships m where m.status='active'),'[]'::jsonb) else '[]'::jsonb end
 );end;$$;

create or replace function public.save_service_catalog_item(target uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$declare actor uuid:=public.current_membership_id();saved uuid;before_row jsonb;begin
 if not public.current_user_has_permission('marketing.catalog.manage') then raise exception 'Izin kelola katalog diperlukan.' using errcode='42501';end if;
 if target is null then insert into public.service_catalog_items(service_code,category,service_name,ideal_client,trigger_problem,core_scope,add_ons,proposal_output,deck_requirement,pricing_method,reference_price,target_margin,staff_authority,approval_requirement,draft_sla,template_status,notes,sort_order,updated_by_membership_id) values(upper(trim(payload->>'service_code')),trim(payload->>'category'),trim(payload->>'service_name'),nullif(payload->>'ideal_client',''),nullif(payload->>'trigger_problem',''),nullif(payload->>'core_scope',''),nullif(payload->>'add_ons',''),nullif(payload->>'proposal_output',''),nullif(payload->>'deck_requirement',''),nullif(payload->>'pricing_method',''),nullif(payload->>'reference_price',''),nullif(payload->>'target_margin',''),nullif(payload->>'staff_authority',''),nullif(payload->>'approval_requirement',''),nullif(payload->>'draft_sla',''),coalesce(nullif(payload->>'template_status',''),'Belum Ada'),nullif(payload->>'notes',''),coalesce((payload->>'sort_order')::int,100),actor) returning id into saved;
 else select to_jsonb(c) into before_row from public.service_catalog_items c where c.id=target;update public.service_catalog_items set category=trim(payload->>'category'),service_name=trim(payload->>'service_name'),ideal_client=nullif(payload->>'ideal_client',''),trigger_problem=nullif(payload->>'trigger_problem',''),core_scope=nullif(payload->>'core_scope',''),add_ons=nullif(payload->>'add_ons',''),proposal_output=nullif(payload->>'proposal_output',''),deck_requirement=nullif(payload->>'deck_requirement',''),pricing_method=nullif(payload->>'pricing_method',''),reference_price=nullif(payload->>'reference_price',''),target_margin=nullif(payload->>'target_margin',''),staff_authority=nullif(payload->>'staff_authority',''),approval_requirement=nullif(payload->>'approval_requirement',''),draft_sla=nullif(payload->>'draft_sla',''),template_status=coalesce(nullif(payload->>'template_status',''),template_status),notes=nullif(payload->>'notes',''),sort_order=coalesce((payload->>'sort_order')::int,sort_order),updated_by_membership_id=actor,updated_at=now() where id=target returning id into saved;end if;
 insert into public.marketing_events(entity_type,entity_id,actor_membership_id,action,before_data,after_data) values('service_catalog',saved,actor,case when target is null then 'create' else 'update' end,before_row,payload);return saved;end;$$;

create or replace function public.save_proposal_deliverable(target uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$declare actor uuid:=public.current_membership_id();saved uuid;before_row jsonb;code text;begin
 if not public.current_user_has_permission('marketing.proposal.manage') then raise exception 'Izin kelola proposal diperlukan.' using errcode='42501';end if;
 if target is null then code:='DEL-'||lpad(nextval('public.proposal_deliverable_seq')::text,5,'0');insert into public.proposal_deliverables(deliverable_code,account_name,deliverable_type,service_catalog_id,service_name_snapshot,brief_source,owner_membership_id,reviewer_membership_id,priority,status,start_date,deadline,draft_sla,template_name,missing_inputs,next_action,output_url,period_label,created_by_membership_id,updated_by_membership_id) values(code,trim(payload->>'account_name'),payload->>'deliverable_type',nullif(payload->>'service_catalog_id','')::uuid,nullif(payload->>'service_name_snapshot',''),nullif(payload->>'brief_source',''),coalesce(nullif(payload->>'owner_membership_id','')::uuid,actor),nullif(payload->>'reviewer_membership_id','')::uuid,coalesce(nullif(payload->>'priority',''),'Medium'),coalesce(nullif(payload->>'status',''),'Menunggu Discovery'),nullif(payload->>'start_date','')::date,nullif(payload->>'deadline','')::date,nullif(payload->>'draft_sla',''),nullif(payload->>'template_name',''),nullif(payload->>'missing_inputs',''),nullif(payload->>'next_action',''),nullif(payload->>'output_url',''),nullif(payload->>'period_label',''),actor,actor) returning id into saved;
 else select to_jsonb(d) into before_row from public.proposal_deliverables d where d.id=target;update public.proposal_deliverables set account_name=trim(payload->>'account_name'),deliverable_type=payload->>'deliverable_type',service_catalog_id=nullif(payload->>'service_catalog_id','')::uuid,brief_source=nullif(payload->>'brief_source',''),owner_membership_id=coalesce(nullif(payload->>'owner_membership_id','')::uuid,owner_membership_id),reviewer_membership_id=nullif(payload->>'reviewer_membership_id','')::uuid,priority=payload->>'priority',status=payload->>'status',start_date=nullif(payload->>'start_date','')::date,deadline=nullif(payload->>'deadline','')::date,draft_sla=nullif(payload->>'draft_sla',''),template_name=nullif(payload->>'template_name',''),missing_inputs=nullif(payload->>'missing_inputs',''),next_action=nullif(payload->>'next_action',''),output_url=nullif(payload->>'output_url',''),period_label=nullif(payload->>'period_label',''),updated_by_membership_id=actor,updated_at=now(),approved_by_membership_id=case when payload->>'status'='Approved' and public.current_user_has_permission('marketing.proposal.approve') then actor else approved_by_membership_id end,approved_at=case when payload->>'status'='Approved' and public.current_user_has_permission('marketing.proposal.approve') then now() else approved_at end where id=target and (created_by_membership_id=actor or owner_membership_id=actor or reviewer_membership_id=actor or public.current_user_has_permission('marketing.proposal.review')) returning id into saved;end if;
 if saved is null then raise exception 'Proposal tidak dapat diubah.' using errcode='42501';end if;insert into public.marketing_events(entity_type,entity_id,actor_membership_id,action,before_data,after_data) values('proposal',saved,actor,case when target is null then 'create' else 'update' end,before_row,payload);return saved;end;$$;

alter table public.position_permissions enable row level security;alter table public.marketing_brand_profiles enable row level security;alter table public.service_catalog_items enable row level security;alter table public.marketing_workflow_stages enable row level security;alter table public.proposal_deliverables enable row level security;alter table public.marketing_events enable row level security;
revoke all on public.position_permissions,public.marketing_brand_profiles,public.service_catalog_items,public.marketing_workflow_stages,public.proposal_deliverables,public.marketing_events from anon,authenticated;
revoke all on function public.current_user_has_permission(text),public.get_my_access(),public.marketing_workspace(),public.save_service_catalog_item(uuid,jsonb),public.save_proposal_deliverable(uuid,jsonb) from anon,public;
grant execute on function public.current_user_has_permission(text),public.get_my_access(),public.marketing_workspace(),public.save_service_catalog_item(uuid,jsonb),public.save_proposal_deliverable(uuid,jsonb) to authenticated;
