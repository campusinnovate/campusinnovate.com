-- Ruang Kawan: direct-relevance unified feed for My Activity.
-- Calendar remains backed by the same activities records; this RPC only changes
-- which accessible work items are composed into the personal feed.

create or replace function public.list_my_activity_feed()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select public.current_membership_id() as membership_id
  ), feed as (
    select
      a.*,
      ws.key as source_key,
      ws.name as source_name,
      ws.color as source_color,
      ws.icon as source_icon,
      ws.source_kind,
      ws.field_schema,
      ws.module_type,
      coalesce(owner_m.full_name, owner_m.email::text) as owner_name,
      coalesce(assigner_m.full_name, assigner_m.email::text) as assigned_by_name,
      coalesce(reviewer_m.full_name, reviewer_m.email::text) as reviewer_name,
      case
        when ws.module_type = 'content_plan' then 'content_plan'
        when ws.module_type = 'pipeline' then 'pipeline'
        when a.assigned_by_membership_id is not null then 'assignment'
        else 'manual'
      end as feed_kind,
      case
        when a.owner_membership_id = me.membership_id then 'mine'
        when a.reviewer_membership_id = me.membership_id then 'review'
        else 'assigned_by_me'
      end as relationship,
      case
        when ws.module_type = 'content_plan' then '/ruang-kawan/content-plan/'
        when ws.module_type = 'pipeline' then '/ruang-kawan/pipeline/'
        when a.assigned_by_membership_id is not null then '/ruang-kawan/assignments/'
        else null
      end as module_route
    from public.activities a
    join me on me.membership_id is not null
    join public.work_sources ws on ws.id = a.source_id
    join public.memberships owner_m on owner_m.id = a.owner_membership_id
    left join public.memberships assigner_m on assigner_m.id = a.assigned_by_membership_id
    left join public.memberships reviewer_m on reviewer_m.id = a.reviewer_membership_id
    where public.current_user_has_permission('activity.view_self')
      and (
        a.owner_membership_id = me.membership_id
        or a.assigned_by_membership_id = me.membership_id
        or a.reviewer_membership_id = me.membership_id
      )
  )
  select coalesce(jsonb_agg(
    to_jsonb(feed)
    - 'source_key' - 'source_name' - 'source_color' - 'source_icon'
    - 'source_kind' - 'field_schema' - 'module_type'
    || jsonb_build_object(
      'work_sources', jsonb_build_object(
        'id', feed.source_id,
        'key', feed.source_key,
        'name', feed.source_name,
        'color', feed.source_color,
        'icon', feed.source_icon,
        'source_kind', feed.source_kind,
        'field_schema', feed.field_schema,
        'module_type', feed.module_type
      )
    )
    order by feed.activity_date desc, feed.created_at desc
  ), '[]'::jsonb)
  from feed;
$$;

revoke all on function public.list_my_activity_feed() from public, anon;
grant execute on function public.list_my_activity_feed() to authenticated;
