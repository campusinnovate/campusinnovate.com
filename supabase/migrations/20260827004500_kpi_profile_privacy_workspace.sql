-- Ruang Kawan: clearer KPI workspace modes and field-level employee privacy.
-- Additive, Finance-neutral, and safe to run after the 2026-08-26 migrations.

insert into public.permissions(key,name,description) values
 ('employee_profile.view_bank','Lihat rekening pegawai','Melihat informasi rekening pembayaran pegawai.'),
 ('employee_profile.manage_bank','Kelola rekening pegawai','Memperbarui informasi rekening pembayaran pegawai.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

-- Every active internal role may use the basic directory. Private fields stay protected.
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in('system_admin','executive','finance_manager','people_hr_manager','project_lead','staff','freelancer')
  and p.key='employee_profile.view_directory'
on conflict do nothing;

-- System Admin controls access but does not automatically receive private employee data.
delete from public.role_permissions rp
using public.roles r,public.permissions p
where rp.role_id=r.id and rp.permission_id=p.id
  and r.key in('system_admin','executive','finance_manager','people_hr_manager')
  and p.key in('employee_profile.view_sensitive','employee_profile.manage_sensitive','employee_profile.view_bank','employee_profile.manage_bank');

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.key='people_hr_manager' and p.key in('employee_profile.view_sensitive','employee_profile.manage_sensitive','employee_profile.view_bank','employee_profile.manage_bank'))
   or (r.key='finance_manager' and p.key in('employee_profile.view_bank','employee_profile.manage_bank'))
on conflict do nothing;

delete from public.position_permissions pp
using public.positions pos,public.permissions p
where pp.position_id=pos.id and pp.permission_id=p.id
  and pos.key in('ceo','coo','cto')
  and p.key in('employee_profile.view_sensitive','employee_profile.manage_sensitive','employee_profile.view_bank','employee_profile.manage_bank');

create or replace function public.employee_profile_self()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();
begin
 if actor is null or not public.current_user_has_permission('employee_profile.view_self') then
  raise exception 'Akses profil pribadi diperlukan.' using errcode='42501';
 end if;
 return (
  select jsonb_build_object(
   'membership_id',m.id,'full_name',coalesce(m.full_name,pr.full_name,m.email::text),'email',m.email::text,
   'avatar_url',pr.avatar_url,'position_name',pos.name,'department_name',d.name,'engagement_type',m.engagement_type,
   'preferred_name',ep.preferred_name,'phone',ep.phone,'address',ep.address,'city',ep.city,
   'birth_date',ep.birth_date,'employment_start_date',ep.employment_start_date,
   'emergency_contact_name',ep.emergency_contact_name,'emergency_contact_phone',ep.emergency_contact_phone,
   'administrative_id',ep.administrative_id,'tax_id',ep.tax_id,
   'bank_name',ep.bank_name,'bank_branch',ep.bank_branch,'bank_account_number',ep.bank_account_number,
   'bank_account_holder',ep.bank_account_holder,'employee_document_urls',coalesce(ep.employee_document_urls,'[]'::jsonb),
   'administrative_notes',ep.administrative_notes,'updated_at',ep.updated_at
  )
  from public.memberships m
  left join public.profiles pr on pr.user_id=m.user_id
  left join public.positions pos on pos.id=m.position_id
  left join public.departments d on d.id=m.department_id
  left join public.employee_private_profiles ep on ep.membership_id=m.id
  where m.id=actor
 );
end;$$;

create or replace function public.employee_directory()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
 actor uuid:=public.current_membership_id();
 can_sensitive boolean:=public.current_user_has_permission('employee_profile.view_sensitive');
 can_bank boolean:=public.current_user_has_permission('employee_profile.view_bank') or can_sensitive;
begin
 if actor is null or not public.current_user_has_permission('employee_profile.view_directory') then
  raise exception 'Akses direktori pegawai diperlukan.' using errcode='42501';
 end if;
 return jsonb_build_object(
  'my_membership_id',actor,
  'can_manage_sensitive',public.current_user_has_permission('employee_profile.manage_sensitive'),
  'can_manage_bank',public.current_user_has_permission('employee_profile.manage_bank') or public.current_user_has_permission('employee_profile.manage_sensitive'),
  'members',coalesce((
   select jsonb_agg(jsonb_build_object(
    'membership_id',m.id,'full_name',coalesce(m.full_name,pr.full_name,m.email::text),'email',m.email::text,
    'avatar_url',pr.avatar_url,'position_name',pos.name,'department_name',d.name,'engagement_type',m.engagement_type,
    'preferred_name',case when m.id=actor or can_sensitive then ep.preferred_name else null end,
    'phone',case when m.id=actor or can_sensitive then ep.phone else null end,
    'address',case when m.id=actor or can_sensitive then ep.address else null end,
    'city',case when m.id=actor or can_sensitive then ep.city else null end,
    'birth_date',case when m.id=actor or can_sensitive then ep.birth_date else null end,
    'employment_start_date',case when m.id=actor or can_sensitive then ep.employment_start_date else null end,
    'emergency_contact_name',case when m.id=actor or can_sensitive then ep.emergency_contact_name else null end,
    'emergency_contact_phone',case when m.id=actor or can_sensitive then ep.emergency_contact_phone else null end,
    'administrative_id',case when m.id=actor or can_sensitive then ep.administrative_id else null end,
    'tax_id',case when m.id=actor or can_sensitive then ep.tax_id else null end,
    'bank_name',case when m.id=actor or can_bank then ep.bank_name else null end,
    'bank_branch',case when m.id=actor or can_bank then ep.bank_branch else null end,
    'bank_account_number',case when m.id=actor or can_bank then ep.bank_account_number else null end,
    'bank_account_holder',case when m.id=actor or can_bank then ep.bank_account_holder else null end,
    'employee_document_urls',case when m.id=actor or can_sensitive then coalesce(ep.employee_document_urls,'[]'::jsonb) else '[]'::jsonb end,
    'administrative_notes',case when m.id=actor or can_sensitive then ep.administrative_notes else null end,
    'updated_at',case when m.id=actor or can_sensitive or can_bank then ep.updated_at else null end
   ) order by coalesce(m.full_name,pr.full_name,m.email::text))
   from public.memberships m
   left join public.profiles pr on pr.user_id=m.user_id
   left join public.positions pos on pos.id=m.position_id
   left join public.departments d on d.id=m.department_id
   left join public.employee_private_profiles ep on ep.membership_id=m.id
   where m.status='active'
  ),'[]'::jsonb)
 );
end;$$;

create or replace function public.save_employee_profile(target_membership_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
 actor uuid:=public.current_membership_id();
 is_self boolean:=actor=target_membership_id;
 can_sensitive boolean:=public.current_user_has_permission('employee_profile.manage_sensitive');
 can_bank boolean:=public.current_user_has_permission('employee_profile.manage_bank') or can_sensitive;
 existing public.employee_private_profiles%rowtype;
 before_row jsonb;
 saved uuid;
 account text;
begin
 if actor is null or not(is_self or can_sensitive or can_bank) then
  raise exception 'Profil pegawai tidak dapat diubah.' using errcode='42501';
 end if;
 if is_self and not public.current_user_has_permission('employee_profile.manage_self') then
  raise exception 'Izin mengubah profil diperlukan.' using errcode='42501';
 end if;
 select * into existing from public.employee_private_profiles where membership_id=target_membership_id;
 before_row:=to_jsonb(existing);
 account:=case when is_self or can_bank then nullif(trim(payload->>'bank_account_number'),'') else existing.bank_account_number end;

 insert into public.employee_private_profiles(
  membership_id,preferred_name,phone,address,city,birth_date,employment_start_date,emergency_contact_name,
  emergency_contact_phone,administrative_id,tax_id,bank_name,bank_branch,bank_account_number,bank_account_holder,
  employee_document_urls,administrative_notes,updated_by_membership_id
 ) values(
  target_membership_id,
  case when is_self or can_sensitive then nullif(trim(payload->>'preferred_name'),'') else existing.preferred_name end,
  case when is_self or can_sensitive then nullif(trim(payload->>'phone'),'') else existing.phone end,
  case when is_self or can_sensitive then nullif(trim(payload->>'address'),'') else existing.address end,
  case when is_self or can_sensitive then nullif(trim(payload->>'city'),'') else existing.city end,
  case when is_self or can_sensitive then nullif(payload->>'birth_date','')::date else existing.birth_date end,
  case when is_self or can_sensitive then nullif(payload->>'employment_start_date','')::date else existing.employment_start_date end,
  case when is_self or can_sensitive then nullif(trim(payload->>'emergency_contact_name'),'') else existing.emergency_contact_name end,
  case when is_self or can_sensitive then nullif(trim(payload->>'emergency_contact_phone'),'') else existing.emergency_contact_phone end,
  case when is_self or can_sensitive then nullif(trim(payload->>'administrative_id'),'') else existing.administrative_id end,
  case when is_self or can_sensitive then nullif(trim(payload->>'tax_id'),'') else existing.tax_id end,
  case when is_self or can_bank then nullif(trim(payload->>'bank_name'),'') else existing.bank_name end,
  case when is_self or can_bank then nullif(trim(payload->>'bank_branch'),'') else existing.bank_branch end,
  account,
  case when is_self or can_bank then nullif(trim(payload->>'bank_account_holder'),'') else existing.bank_account_holder end,
  case when is_self or can_sensitive then coalesce(payload->'employee_document_urls','[]'::jsonb) else coalesce(existing.employee_document_urls,'[]'::jsonb) end,
  case when is_self or can_sensitive then nullif(trim(payload->>'administrative_notes'),'') else existing.administrative_notes end,
  actor
 ) on conflict(membership_id) do update set
  preferred_name=excluded.preferred_name,phone=excluded.phone,address=excluded.address,city=excluded.city,
  birth_date=excluded.birth_date,employment_start_date=excluded.employment_start_date,
  emergency_contact_name=excluded.emergency_contact_name,emergency_contact_phone=excluded.emergency_contact_phone,
  administrative_id=excluded.administrative_id,tax_id=excluded.tax_id,bank_name=excluded.bank_name,
  bank_branch=excluded.bank_branch,bank_account_number=excluded.bank_account_number,
  bank_account_holder=excluded.bank_account_holder,employee_document_urls=excluded.employee_document_urls,
  administrative_notes=excluded.administrative_notes,updated_by_membership_id=actor,updated_at=now()
 returning membership_id into saved;

 if is_self or can_sensitive then
  update public.memberships set full_name=coalesce(nullif(trim(payload->>'full_name'),''),full_name),updated_at=now() where id=target_membership_id;
  update public.profiles set full_name=coalesce(nullif(trim(payload->>'full_name'),''),full_name),updated_at=now()
   where user_id=(select user_id from public.memberships where id=target_membership_id);
 end if;
 insert into public.employee_profile_events(membership_id,actor_membership_id,action,before_data,after_data)
 values(saved,actor,'profile.updated',
  case when before_row is null then null else before_row-'bank_account_number'||jsonb_build_object('bank_account_last4',right(coalesce(before_row->>'bank_account_number',''),4)) end,
  (payload-'bank_account_number')||jsonb_build_object('bank_account_last4',right(coalesce(account,''),4)));
 return saved;
end;$$;

revoke all on function public.employee_profile_self() from anon,public;
grant execute on function public.employee_profile_self() to authenticated;

