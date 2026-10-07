-- Applied after initial shared DEV installer as finance_pilot_dev_storage_authorization_fix.
-- Current generated install.sql incorporates this fix; do not replay it blindly.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
create function finance_pilot_dev_private.can_upload() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from finance_pilot_dev.memberships m join finance_pilot_dev.positions p on p.id=m.position_id where m.id=finance_pilot_dev.current_membership_id() and p.key='coo') and finance_pilot_dev.current_user_has_permission('finance_next.manage');
$$;
revoke all on function finance_pilot_dev_private.can_upload() from public,anon;
grant execute on function finance_pilot_dev_private.can_upload() to authenticated;
alter policy finance_pilot_dev_evidence_upload on storage.objects with check(bucket_id='finance-pilot-dev-evidence' and (storage.foldername(name))[1]=auth.uid()::text and finance_pilot_dev_private.can_upload());
commit;
