-- Shared services used contextually by existing workspaces. No new top-level module.

insert into public.permissions(key,name,description) values
 ('employee_profile.view_self','Lihat profil sendiri','Melihat data administrasi pribadi.'),
 ('employee_profile.manage_self','Ubah profil sendiri','Mengubah data profil nonstruktural pribadi.'),
 ('employee_profile.view_sensitive','Lihat bank data pegawai','Melihat kontak, dokumen, dan rekening pegawai.'),
 ('employee_profile.manage_sensitive','Kelola bank data pegawai','Mengubah data administrasi sensitif pegawai.'),
 ('notifications.view_self','Lihat notifikasi sendiri','Melihat dan menandai notifikasi pribadi.'),
 ('mood.checkin','Mood Check-in','Mengisi mood pribadi harian.'),
 ('mood.aggregate','Lihat tren mood anonim','Melihat tren mood agregat tanpa identitas individu.'),
 ('report.action.assign','Assign report action item','Memberikan action item dari report.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.key in ('system_admin','executive','project_lead','finance_manager','people_hr_manager','staff','freelancer') and p.key in ('employee_profile.view_self','employee_profile.manage_self','notifications.view_self','mood.checkin'))
 or (r.key in ('system_admin','people_hr_manager','finance_manager') and p.key in ('employee_profile.view_sensitive','employee_profile.manage_sensitive'))
 or (r.key in ('system_admin','executive') and p.key in ('mood.aggregate','report.action.assign'))
 or (r.key in ('system_admin','executive','project_lead','finance_manager','people_hr_manager','staff','freelancer') and p.key in ('vendors.view','vendors.create'))
on conflict do nothing;

create table if not exists public.notifications(
 id uuid primary key default extensions.gen_random_uuid(),recipient_membership_id uuid not null references public.memberships(id) on delete cascade,
 actor_membership_id uuid references public.memberships(id),notification_type text not null,title text not null,message text,
 entity_type text,entity_id text,action_url text,read_at timestamptz,created_at timestamptz not null default now()
);
alter table public.notifications add column if not exists priority text not null default 'normal' check(priority in ('low','normal','high','urgent'));
alter table public.notifications add column if not exists dismissed_at timestamptz;
alter table public.notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_recipient_dedupe_unique on public.notifications(recipient_membership_id,dedupe_key) where dedupe_key is not null;
create index notifications_recipient_unread_idx on public.notifications(recipient_membership_id,created_at desc) where read_at is null and dismissed_at is null;

create table public.mood_checkins(
 id uuid primary key default extensions.gen_random_uuid(),membership_id uuid not null references public.memberships(id) on delete cascade,
 checkin_date date not null default (now() at time zone 'Asia/Jakarta')::date,score smallint not null check(score between 1 and 10),
 note text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(membership_id,checkin_date)
);

create table public.employee_private_profiles(
 membership_id uuid primary key references public.memberships(id) on delete cascade,phone text,address text,emergency_contact_name text,
 emergency_contact_phone text,administrative_id text,bank_name text,bank_account_number text,bank_account_holder text,
 employee_document_urls jsonb not null default '[]'::jsonb,administrative_notes text,
 updated_by_membership_id uuid references public.memberships(id),updated_at timestamptz not null default now()
);

create table public.vendors(
 id uuid primary key default extensions.gen_random_uuid(),vendor_code text not null unique,name text not null,category text,pic_name text,
 contact_phone text,contact_email text,location text,service_area text,services text[] not null default '{}'::text[],
 price_list_url text,portfolio_url text,capacity_notes text,legal_document_url text,bank_name text,bank_account_number text,
 bank_account_holder text,rating numeric(2,1) check(rating between 0 and 5),status text not null default 'candidate' check(status in ('candidate','active','inactive','blocked')),
 notes text,created_by_membership_id uuid not null references public.memberships(id),updated_by_membership_id uuid not null references public.memberships(id),
 deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create sequence public.vendor_seq;
create table public.vendor_evaluations(
 id uuid primary key default extensions.gen_random_uuid(),vendor_id uuid not null references public.vendors(id),source_module text,source_id text,
 evaluator_membership_id uuid not null references public.memberships(id),rating numeric(2,1) not null check(rating between 0 and 5),evaluation text,created_at timestamptz not null default now()
);
create table public.vendor_events(id bigint generated always as identity primary key,vendor_id uuid not null references public.vendors(id),actor_membership_id uuid not null references public.memberships(id),action text not null,before_data jsonb,after_data jsonb,created_at timestamptz not null default now());

alter table public.report_items drop constraint if exists report_items_section_check;
alter table public.report_items add constraint report_items_section_check check(section in ('progress','problem','plan','priority','notes','insight','action_item'));
alter table public.report_items drop constraint if exists report_items_source_type_check;
alter table public.report_items add constraint report_items_source_type_check check(source_type in ('kpi','activity','pipeline','project','finance','document','marketing','manual'));
create table public.report_action_items(
 id uuid primary key default extensions.gen_random_uuid(),report_id uuid not null references public.report_drafts(id) on delete cascade,
 report_item_id uuid references public.report_items(id) on delete set null,pic_membership_id uuid not null references public.memberships(id),
 title text not null,deadline date,priority text not null default 'medium' check(priority in ('low','medium','high','urgent')),
 status text not null default 'open' check(status in ('open','in_progress','done','cancelled')),
 source_module text,source_id text,created_by_membership_id uuid not null references public.memberships(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create or replace function public.dashboard_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$declare actor uuid:=public.current_membership_id();today_jkt date:=(now() at time zone 'Asia/Jakarta')::date;begin
 if actor is null then raise exception 'Login diperlukan.' using errcode='42501';end if;
 return jsonb_build_object(
  'mood',(select to_jsonb(m) from public.mood_checkins m where m.membership_id=actor and m.checkin_date=today_jkt),
   'notifications',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (select n.* from public.notifications n where n.recipient_membership_id=actor and n.dismissed_at is null order by n.created_at desc limit 20) q),'[]'::jsonb),
  'work',jsonb_build_object(
   'overdue',(select count(*) from public.activities a where a.owner_membership_id=actor and a.activity_date<today_jkt and a.status not in ('done')),
   'due_today',(select count(*) from public.activities a where a.owner_membership_id=actor and a.activity_date=today_jkt and a.status not in ('done')),
   'reviews',(select count(*) from public.activities a where a.reviewer_membership_id=actor and a.review_status='waiting_review'),
   'open_actions',(select count(*) from public.report_action_items i where i.pic_membership_id=actor and i.status not in ('done','cancelled'))
  ),
  'kpi',(select jsonb_build_object('score',a.final_score,'status',a.score_status,'period',p.name) from public.kpi_assignments a join public.kpi_periods p on p.id=a.period_id where a.membership_id=actor order by p.end_date desc limit 1)
 );end;$$;

create or replace function public.save_mood_checkin(score_value integer,note_value text default null)
returns void language plpgsql security definer set search_path=public as $$declare actor uuid:=public.current_membership_id();d date:=(now() at time zone 'Asia/Jakarta')::date;begin
 if actor is null or not public.current_user_has_permission('mood.checkin') then raise exception 'Mood Check-in tidak tersedia.' using errcode='42501';end if;
 insert into public.mood_checkins(membership_id,checkin_date,score,note) values(actor,d,score_value,nullif(note_value,'')) on conflict(membership_id,checkin_date) do update set score=excluded.score,note=excluded.note,updated_at=now();end;$$;

create or replace function public.mood_aggregate(days_back integer default 30)
returns jsonb language plpgsql stable security definer set search_path=public as $$begin
 if not public.current_user_has_permission('mood.aggregate') then raise exception 'Akses tren anonim diperlukan.' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(q) order by q.checkin_date) from (select checkin_date,round(avg(score),2) average_score,count(*) response_count from public.mood_checkins where checkin_date>=current_date-greatest(1,least(days_back,365)) group by checkin_date having count(*)>=3) q),'[]'::jsonb);end;$$;

create or replace function public.mark_notification_read(target uuid,dismiss boolean default false)
returns void language sql security definer set search_path=public as $$update public.notifications set read_at=coalesce(read_at,now()),dismissed_at=case when dismiss then now() else dismissed_at end where id=target and recipient_membership_id=public.current_membership_id();$$;

create or replace function public.vendor_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$begin
 if not public.current_user_has_permission('vendors.view') then raise exception 'Akses vendor diperlukan.' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'vendor_code',v.vendor_code,'name',v.name,'category',v.category,'pic_name',v.pic_name,'contact_phone',v.contact_phone,'contact_email',v.contact_email,'location',v.location,'service_area',v.service_area,'services',v.services,'price_list_url',v.price_list_url,'portfolio_url',v.portfolio_url,'capacity_notes',v.capacity_notes,'legal_document_url',v.legal_document_url,'bank_name',case when public.current_user_has_permission('vendors.manage_sensitive') then v.bank_name end,'bank_account_number',case when public.current_user_has_permission('vendors.manage_sensitive') then v.bank_account_number end,'bank_account_holder',case when public.current_user_has_permission('vendors.manage_sensitive') then v.bank_account_holder end,'rating',v.rating,'status',v.status,'notes',v.notes,'updated_at',v.updated_at) order by v.name) from public.vendors v where v.deleted_at is null),'[]'::jsonb);end;$$;

create or replace function public.save_vendor(target uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$declare actor uuid:=public.current_membership_id();saved uuid;before_row jsonb;account text:=nullif(payload->>'bank_account_number','');begin
 if actor is null or not public.current_user_has_permission(case when target is null then 'vendors.create' else 'vendors.manage' end) then raise exception 'Izin kelola vendor diperlukan.' using errcode='42501';end if;
 if account is not null and not public.current_user_has_permission('vendors.manage_sensitive') then raise exception 'Izin data rekening diperlukan.' using errcode='42501';end if;
 if target is null then insert into public.vendors(vendor_code,name,category,pic_name,contact_phone,contact_email,location,service_area,services,price_list_url,portfolio_url,capacity_notes,legal_document_url,bank_name,bank_account_number,bank_account_holder,status,notes,created_by_membership_id,updated_by_membership_id) values('VND-'||lpad(nextval('public.vendor_seq')::text,5,'0'),trim(payload->>'name'),nullif(payload->>'category',''),nullif(payload->>'pic_name',''),nullif(payload->>'contact_phone',''),nullif(payload->>'contact_email',''),nullif(payload->>'location',''),nullif(payload->>'service_area',''),coalesce(array(select jsonb_array_elements_text(coalesce(payload->'services','[]'::jsonb))),'{}'),nullif(payload->>'price_list_url',''),nullif(payload->>'portfolio_url',''),nullif(payload->>'capacity_notes',''),nullif(payload->>'legal_document_url',''),nullif(payload->>'bank_name',''),account,nullif(payload->>'bank_account_holder',''),coalesce(nullif(payload->>'status',''),'candidate'),nullif(payload->>'notes',''),actor,actor) returning id into saved;
 else select to_jsonb(v) into before_row from public.vendors v where v.id=target;update public.vendors set name=trim(payload->>'name'),category=nullif(payload->>'category',''),pic_name=nullif(payload->>'pic_name',''),contact_phone=nullif(payload->>'contact_phone',''),contact_email=nullif(payload->>'contact_email',''),location=nullif(payload->>'location',''),service_area=nullif(payload->>'service_area',''),services=coalesce(array(select jsonb_array_elements_text(coalesce(payload->'services','[]'::jsonb))),services),price_list_url=nullif(payload->>'price_list_url',''),portfolio_url=nullif(payload->>'portfolio_url',''),capacity_notes=nullif(payload->>'capacity_notes',''),legal_document_url=nullif(payload->>'legal_document_url',''),bank_name=case when public.current_user_has_permission('vendors.manage_sensitive') then nullif(payload->>'bank_name','') else bank_name end,bank_account_number=case when public.current_user_has_permission('vendors.manage_sensitive') then account else bank_account_number end,bank_account_holder=case when public.current_user_has_permission('vendors.manage_sensitive') then nullif(payload->>'bank_account_holder','') else bank_account_holder end,status=coalesce(nullif(payload->>'status',''),status),notes=nullif(payload->>'notes',''),updated_by_membership_id=actor,updated_at=now() where id=target returning id into saved;end if;
 insert into public.vendor_events(vendor_id,actor_membership_id,action,before_data,after_data) values(saved,actor,case when target is null then 'create' else 'update' end,before_row,payload-'bank_account_number');return saved;end;$$;

create or replace function public.save_report_action_item(target uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$declare actor uuid:=public.current_membership_id();saved uuid;pic uuid:=coalesce(nullif(payload->>'pic_membership_id','')::uuid,actor);begin
 if actor is null or (pic<>actor and not public.current_user_has_permission('report.action.assign')) then raise exception 'Tidak dapat memberikan action item.' using errcode='42501';end if;
 if target is null then insert into public.report_action_items(report_id,report_item_id,pic_membership_id,title,deadline,priority,status,source_module,source_id,created_by_membership_id) values((payload->>'report_id')::uuid,nullif(payload->>'report_item_id','')::uuid,pic,trim(payload->>'title'),nullif(payload->>'deadline','')::date,coalesce(nullif(payload->>'priority',''),'medium'),coalesce(nullif(payload->>'status',''),'open'),nullif(payload->>'source_module',''),nullif(payload->>'source_id',''),actor) returning id into saved;else update public.report_action_items set title=trim(payload->>'title'),deadline=nullif(payload->>'deadline','')::date,priority=payload->>'priority',status=payload->>'status',updated_at=now() where id=target and (pic_membership_id=actor or created_by_membership_id=actor) returning id into saved;end if;
 if pic<>actor then insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key) values(pic,actor,'report.action.assigned','Action item baru',payload->>'title','reports',saved::text,'/ruang-kawan/activity/',case when payload->>'priority'='urgent' then 'urgent' else 'normal' end,'report-action:'||saved::text) on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do update set message=excluded.message,read_at=null,dismissed_at=null,created_at=now();end if;return saved;end;$$;

alter table public.notifications enable row level security;alter table public.mood_checkins enable row level security;alter table public.employee_private_profiles enable row level security;alter table public.vendors enable row level security;alter table public.vendor_evaluations enable row level security;alter table public.vendor_events enable row level security;alter table public.report_action_items enable row level security;
revoke all on public.notifications,public.mood_checkins,public.employee_private_profiles,public.vendors,public.vendor_evaluations,public.vendor_events,public.report_action_items from anon,authenticated;
revoke all on function public.dashboard_workspace(),public.save_mood_checkin(integer,text),public.mood_aggregate(integer),public.mark_notification_read(uuid,boolean),public.vendor_workspace(),public.save_vendor(uuid,jsonb),public.save_report_action_item(uuid,jsonb) from anon,public;
grant execute on function public.dashboard_workspace(),public.save_mood_checkin(integer,text),public.mood_aggregate(integer),public.mark_notification_read(uuid,boolean),public.vendor_workspace(),public.save_vendor(uuid,jsonb),public.save_report_action_item(uuid,jsonb) to authenticated;
