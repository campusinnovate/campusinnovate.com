-- Kawan AI CEO MVP: authorized global context, read-only.
-- All time comparisons intentionally use Asia/Jakarta.

insert into public.permissions(key,name,description) values
  ('ai.ceo_assistant','Gunakan Kawan AI Asisten CEO','Membaca ringkasan kerja personal lintas modul secara read-only.')
on conflict(key) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in ('system_admin','executive') and p.key='ai.ceo_assistant'
on conflict do nothing;

create or replace function public.kawan_ai_ceo_context()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  me uuid:=public.current_membership_id();
  jakarta_today date:=(now() at time zone 'Asia/Jakarta')::date;
  feed jsonb:='[]'::jsonb;
  assignments jsonb:='[]'::jsonb;
  notifications jsonb:='[]'::jsonb;
begin
  if me is null
    or not public.current_user_has_permission('ai.use')
    or not public.current_user_has_permission('ai.ceo_assistant') then
    raise exception 'Kawan AI Asisten CEO tidak tersedia.' using errcode='42501';
  end if;

  if public.current_user_has_permission('activity.view_self') then
    select coalesce(public.list_my_activity_feed(),'[]'::jsonb) into feed;
  end if;

  if public.current_user_has_permission('assignments.view') then
    select coalesce(public.list_accessible_assignments(),'[]'::jsonb) into assignments;
  end if;

  if public.current_user_has_permission('notifications.view_self') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',n.id,'title',n.title,'message',n.message,'priority',n.priority,
      'notification_type',n.notification_type,'created_at',n.created_at,
      'action_url',n.action_url
    ) order by n.created_at desc),'[]'::jsonb)
    into notifications
    from (
      select * from public.notifications
      where recipient_membership_id=me and read_at is null and dismissed_at is null
      order by created_at desc limit 30
    ) n;
  end if;

  return jsonb_build_object(
    'timezone','Asia/Jakarta',
    'generated_at',now(),
    'today',jakarta_today,
    'today_tasks',coalesce((
      select jsonb_agg(x order by coalesce((x->>'priority')='urgent',false) desc, x->>'activity_date')
      from jsonb_array_elements(feed) x
      where coalesce(x->>'status','not_started') <> 'done'
        and x->>'activity_date'=jakarta_today::text
    ),'[]'::jsonb),
    'overdue_tasks',coalesce((
      select jsonb_agg(x order by x->>'activity_date')
      from jsonb_array_elements(feed) x
      where coalesce(x->>'status','not_started') <> 'done'
        and nullif(x->>'activity_date','')::date < jakarta_today
    ),'[]'::jsonb),
    'upcoming_deadlines',coalesce((
      select jsonb_agg(x order by x->>'activity_date')
      from jsonb_array_elements(feed) x
      where coalesce(x->>'status','not_started') <> 'done'
        and nullif(x->>'activity_date','')::date between jakarta_today + 1 and jakarta_today + 7
    ),'[]'::jsonb),
    'today_meetings',coalesce((
      select jsonb_agg(x order by x->>'start_at')
      from jsonb_array_elements(feed) x
      where x->>'activity_date'=jakarta_today::text
        and (lower(coalesce(x->>'activity_type','')) like '%meeting%'
          or lower(coalesce(x->>'title','')) like '%meeting%')
    ),'[]'::jsonb),
    'ceo_approvals',coalesce((
      select jsonb_agg(x)
      from jsonb_array_elements(feed) x
      where coalesce(x->>'relationship','')='review'
        or coalesce(x->>'review_status','') in ('waiting_review','revision_requested')
    ),'[]'::jsonb),
    'pipeline_followups',coalesce((
      select jsonb_agg(x order by x->>'activity_date')
      from jsonb_array_elements(feed) x
      where x->>'feed_kind'='pipeline'
        and coalesce(x->>'status','not_started') <> 'done'
    ),'[]'::jsonb),
    'assignments',assignments,
    'unread_notifications',notifications,
    'source_policy','Setiap item hanya berasal dari RPC dan tabel yang sudah dibatasi oleh izin pengguna aktif. Gunakan module_route atau action_url sebagai sumber.'
  );
end;
$$;

revoke all on function public.kawan_ai_ceo_context() from anon, public;
grant execute on function public.kawan_ai_ceo_context() to authenticated;
