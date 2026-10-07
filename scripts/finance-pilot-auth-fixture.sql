CREATE OR REPLACE FUNCTION public.current_user_has_permission(permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select (
   exists(select 1 from public.memberships m join public.member_roles mr on mr.membership_id=m.id join public.role_permissions rp on rp.role_id=mr.role_id join public.permissions p on p.id=rp.permission_id where m.user_id=auth.uid() and m.status='active' and p.key=permission_key)
   or exists(select 1 from public.memberships m join public.position_permissions pp on pp.position_id=m.position_id join public.permissions p on p.id=pp.permission_id where m.user_id=auth.uid() and m.status='active' and p.key=permission_key)
   or exists(select 1 from public.memberships m join public.member_permission_overrides mpo on mpo.membership_id=m.id join public.permissions p on p.id=mpo.permission_id where m.user_id=auth.uid() and m.status='active' and p.key=permission_key and mpo.effect='allow')
 ) and not exists(select 1 from public.memberships m join public.member_permission_overrides mpo on mpo.membership_id=m.id join public.permissions p on p.id=mpo.permission_id where m.user_id=auth.uid() and m.status='active' and p.key=permission_key and mpo.effect='deny');
$function$
