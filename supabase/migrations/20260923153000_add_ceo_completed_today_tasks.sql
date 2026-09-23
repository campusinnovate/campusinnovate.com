-- Kawan AI CEO: only actionable pipeline stages belong in the active briefing.
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
  projects jsonb:='[]'::jsonb;
  chat_attention jsonb:='{}'::jsonb;
begin
  if me is null or not public.kawan_ai_ceo_access() then
    raise exception 'Kawan AI Asisten CEO tidak tersedia.' using errcode='42501';
  end if;
  if public.current_user_has_permission('activity.view_self') then
    select coalesce(public.list_my_activity_feed(),'[]'::jsonb) into feed;
    select coalesce(public.list_accessible_assignments(),'[]'::jsonb) into assignments;
  end if;
  if public.current_user_has_permission('projects.view') then select coalesce(public.list_projects(),'[]'::jsonb) into projects; end if;
  if public.current_user_has_permission('chat.view') then select coalesce(public.chat_workspace(),'{}'::jsonb) into chat_attention; end if;
  if public.current_user_has_permission('notifications.view_self') then
    select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'message',n.message,'priority',n.priority,'notification_type',n.notification_type,'created_at',n.created_at,'action_url',n.action_url) order by n.created_at desc),'[]'::jsonb)
    into notifications from (
      select * from public.notifications where recipient_membership_id=me and read_at is null and dismissed_at is null order by created_at desc limit 30
    ) n;
  end if;
  return jsonb_build_object(
    'timezone','Asia/Jakarta','generated_at',now(),'today',jakarta_today,
    'today_tasks',coalesce((select jsonb_agg(x order by coalesce((x->>'priority')='urgent',false) desc,x->>'activity_date') from jsonb_array_elements(feed) x where coalesce(x->>'status','not_started')<>'done' and x->>'activity_date'=jakarta_today::text),'[]'::jsonb),
    'overdue_tasks',coalesce((select jsonb_agg(x order by x->>'activity_date') from jsonb_array_elements(feed) x where coalesce(x->>'status','not_started')<>'done' and nullif(x->>'activity_date','')::date<jakarta_today),'[]'::jsonb),
    'completed_today_tasks',coalesce((select jsonb_agg(x order by x->>'activity_date') from jsonb_array_elements(feed) x where coalesce(x->>'status','not_started')='done' and x->>'activity_date'=jakarta_today::text),'[]'::jsonb),
    'upcoming_deadlines',coalesce((select jsonb_agg(x order by x->>'activity_date') from jsonb_array_elements(feed) x where coalesce(x->>'status','not_started')<>'done' and nullif(x->>'activity_date','')::date between jakarta_today+1 and jakarta_today+7),'[]'::jsonb),
    'today_meetings',coalesce((select jsonb_agg(x order by x->>'start_at') from jsonb_array_elements(feed) x where x->>'activity_date'=jakarta_today::text and (lower(coalesce(x->>'activity_type','')) like '%meeting%' or lower(coalesce(x->>'title','')) like '%meeting%')),'[]'::jsonb),
    'ceo_approvals',coalesce((select jsonb_agg(x) from jsonb_array_elements(feed) x where coalesce(x->>'relationship','')='review' or coalesce(x->>'review_status','') in ('waiting_review','revision_requested')),'[]'::jsonb),
    'pipeline_followups',coalesce((
      select jsonb_agg(x order by x->>'activity_date')
      from jsonb_array_elements(feed) x
      left join public.pipeline_leads pl on pl.id=nullif(x->'custom_data'->>'pipeline_lead_id','')::uuid
      where x->>'feed_kind'='pipeline'
        and coalesce(x->>'status','not_started')<>'done'
        and coalesce(lower(trim(pl.stage)),'') not in ('target','nurture','win','won','lost')
    ),'[]'::jsonb),
    'assignments',assignments,'project_risks',projects,'chat_attention',chat_attention,'unread_notifications',notifications,
    'source_policy','Setiap item hanya berasal dari RPC dan tabel yang sudah dibatasi oleh izin pengguna aktif.'
  );
end;
$$;