create or replace function public.current_user_has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
  exists (
    select 1
    from public.memberships m
    join public.member_roles mr on mr.membership_id = m.id
    join public.role_permissions rp on rp.role_id = mr.role_id
    join public.permissions p on p.id = rp.permission_id
    where m.user_id = auth.uid()
      and m.status = 'active'
      and p.key = permission_key
  ) or exists (
    select 1
    from public.memberships m
    join public.member_permission_overrides mpo on mpo.membership_id = m.id
    join public.permissions p on p.id = mpo.permission_id
    where m.user_id = auth.uid()
      and m.status = 'active'
      and p.key = permission_key
      and mpo.effect = 'allow'
  )) and not exists (
    select 1
    from public.memberships m
    join public.member_permission_overrides mpo on mpo.membership_id = m.id
    join public.permissions p on p.id = mpo.permission_id
    where m.user_id = auth.uid()
      and m.status = 'active'
      and p.key = permission_key
      and mpo.effect = 'deny'
  );
$$;

revoke all on function public.current_user_has_permission(text) from public, anon;
grant execute on function public.current_user_has_permission(text) to authenticated;

create or replace function public.admin_access_reference()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_user_has_permission('access.manage') then
    raise exception 'Akses administrator diperlukan.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'departments', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'key', d.key, 'name', d.name) order by d.name)
      from public.departments d where d.is_active
    ), '[]'::jsonb),
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'key', p.key, 'name', p.name, 'default_department_id', p.default_department_id) order by p.name)
      from public.positions p where p.is_active
    ), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('key', r.key, 'name', r.name, 'description', r.description) order by r.name)
      from public.roles r
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(jsonb_build_object('key', p.key, 'name', p.name, 'description', p.description) order by p.name)
      from public.permissions p
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_access_reference() from public, anon;
grant execute on function public.admin_access_reference() to authenticated;

create or replace function public.admin_member_snapshot(target_membership_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', m.id,
    'email', m.email,
    'full_name', coalesce(m.full_name, pr.full_name),
    'position_id', m.position_id,
    'department_id', m.department_id,
    'engagement_type', m.engagement_type,
    'status', m.status,
    'user_id', m.user_id,
    'role_keys', coalesce((
      select jsonb_agg(r.key order by r.key)
      from public.member_roles mr join public.roles r on r.id = mr.role_id
      where mr.membership_id = m.id
    ), '[]'::jsonb),
    'permission_overrides', coalesce((
      select jsonb_object_agg(p.key, mpo.effect)
      from public.member_permission_overrides mpo
      join public.permissions p on p.id = mpo.permission_id
      where mpo.membership_id = m.id
    ), '{}'::jsonb)
  )
  from public.memberships m
  left join public.profiles pr on pr.user_id = m.user_id
  where m.id = target_membership_id;
$$;

revoke all on function public.admin_member_snapshot(uuid) from public, anon, authenticated;

create or replace function public.admin_list_members()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_user_has_permission('access.manage') then
    raise exception 'Akses administrator diperlukan.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      public.admin_member_snapshot(m.id)
      || jsonb_build_object(
        'position_name', pos.name,
        'department_name', d.name,
        'created_at', m.created_at,
        'updated_at', m.updated_at
      )
      order by case m.status when 'active' then 0 when 'invited' then 1 else 2 end,
               lower(m.email::text)
    )
    from public.memberships m
    left join public.positions pos on pos.id = m.position_id
    left join public.departments d on d.id = m.department_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_members() from public, anon;
grant execute on function public.admin_list_members() to authenticated;

create or replace function public.admin_list_access_logs(log_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_user_has_permission('access.manage') then
    raise exception 'Akses administrator diperlukan.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id,
      'action', l.action,
      'entity_id', l.entity_id,
      'before_data', l.before_data,
      'after_data', l.after_data,
      'reason', l.reason,
      'created_at', l.created_at,
      'actor_email', pr.email
    ) order by l.created_at desc)
    from (
      select * from public.activity_logs
      where entity_type = 'membership'
      order by created_at desc
      limit least(greatest(log_limit, 1), 100)
    ) l
    left join public.profiles pr on pr.user_id = l.actor_user_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_access_logs(integer) from public, anon;
grant execute on function public.admin_list_access_logs(integer) to authenticated;

create or replace function public.admin_save_member(
  membership_id uuid,
  member_email text,
  member_full_name text,
  member_position_id uuid,
  member_department_id uuid,
  member_engagement_type text,
  member_status text,
  member_role_keys text[],
  member_permission_overrides jsonb default '{}'::jsonb,
  change_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  saved_id uuid;
  normalized_email text := lower(trim(member_email));
  before_snapshot jsonb;
  after_snapshot jsonb;
  current_membership_id uuid;
  linked_user_id uuid;
  permission_entry record;
begin
  if not public.current_user_has_permission('access.manage') then
    raise exception 'Akses administrator diperlukan.' using errcode = '42501';
  end if;

  if normalized_email = '' or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Format email tidak valid.';
  end if;
  if member_engagement_type not in ('employee', 'freelance', 'contractor', 'intern') then
    raise exception 'Status kerja tidak valid.';
  end if;
  if member_status not in ('invited', 'active', 'suspended', 'inactive') then
    raise exception 'Status akses tidak valid.';
  end if;
  if member_position_id is not null and not exists (select 1 from public.positions where id = member_position_id and is_active) then
    raise exception 'Posisi tidak ditemukan.';
  end if;
  if member_department_id is not null and not exists (select 1 from public.departments where id = member_department_id and is_active) then
    raise exception 'Departemen tidak ditemukan.';
  end if;
  if exists (
    select 1 from unnest(coalesce(member_role_keys, '{}'::text[])) requested(key)
    where not exists (select 1 from public.roles r where r.key = requested.key)
  ) then
    raise exception 'Ada peran yang tidak valid.';
  end if;

  select id into current_membership_id from public.memberships where user_id = auth.uid();

  if membership_id is null then
    insert into public.memberships (
      email, full_name, position_id, department_id, engagement_type, status, created_by
    ) values (
      normalized_email, nullif(trim(member_full_name), ''), member_position_id, member_department_id,
      member_engagement_type, 'invited', auth.uid()
    )
    returning id into saved_id;
  else
    select user_id into linked_user_id from public.memberships where id = membership_id for update;
    if not found then raise exception 'Anggota tidak ditemukan.'; end if;

    before_snapshot := public.admin_member_snapshot(membership_id);

    if linked_user_id is not null and normalized_email <> lower(before_snapshot->>'email') then
      raise exception 'Email akun yang sudah terhubung tidak dapat diubah.';
    end if;
    if membership_id = current_membership_id
       and (member_status <> 'active' or not ('system_admin' = any(coalesce(member_role_keys, '{}'::text[])))) then
      raise exception 'Administrator tidak dapat menonaktifkan atau mencabut peran admin dari akunnya sendiri.';
    end if;

    update public.memberships set
      email = normalized_email,
      full_name = nullif(trim(member_full_name), ''),
      position_id = member_position_id,
      department_id = member_department_id,
      engagement_type = member_engagement_type,
      status = case when linked_user_id is null and member_status = 'active' then 'invited' else member_status end,
      updated_at = now()
    where id = membership_id
    returning id into saved_id;
  end if;

  delete from public.member_roles where member_roles.membership_id = saved_id;
  insert into public.member_roles (membership_id, role_id, granted_by)
  select saved_id, r.id, auth.uid()
  from public.roles r
  where r.key = any(coalesce(member_role_keys, '{}'::text[]));

  delete from public.member_permission_overrides where member_permission_overrides.membership_id = saved_id;
  for permission_entry in select key, value from jsonb_each_text(coalesce(member_permission_overrides, '{}'::jsonb))
  loop
    if permission_entry.value not in ('allow', 'deny') then
      raise exception 'Nilai izin tambahan tidak valid.';
    end if;
    insert into public.member_permission_overrides (membership_id, permission_id, effect, granted_by, reason)
    select saved_id, p.id, permission_entry.value, auth.uid(), nullif(trim(change_reason), '')
    from public.permissions p where p.key = permission_entry.key;
    if not found then raise exception 'Izin tambahan tidak ditemukan: %', permission_entry.key; end if;
  end loop;

  after_snapshot := public.admin_member_snapshot(saved_id);
  insert into public.activity_logs (actor_user_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (
    auth.uid(),
    case when membership_id is null then 'membership.created' else 'membership.updated' end,
    'membership', saved_id::text, before_snapshot, after_snapshot, nullif(trim(change_reason), '')
  );

  return saved_id;
end;
$$;

revoke all on function public.admin_save_member(uuid, text, text, uuid, uuid, text, text, text[], jsonb, text) from public, anon;
grant execute on function public.admin_save_member(uuid, text, text, uuid, uuid, text, text, text[], jsonb, text) to authenticated;
