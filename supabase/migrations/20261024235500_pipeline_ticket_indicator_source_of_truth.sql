-- Make the Pipeline ticket indicator read the same active CI-TKT records
-- shown in the Ticket workspace. Legacy service_tickets remain for old phase
-- gates, but must not imply that a lead has a current Commercial Ticket.
create or replace function public.list_pipeline_leads()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(pl)||jsonb_build_object(
    'weighted_value',round(coalesce(pl.proposal_value,0)*coalesce(pl.probability,0),2),
    'potential_revenue',round(coalesce(pl.seats,0)*coalesce(pl.price_per_person,0),2),
    'owner_membership_id',a.owner_membership_id,'assigned_by_membership_id',a.assigned_by_membership_id,
    'workflow_status',a.status,'progress',a.progress,'linked_kpi',a.linked_kpi,
    'owner_name',coalesce(m.full_name,m.email::text),'source_name',ws.name,'source_color',ws.color,'source_config',ws.module_config,
    'commercial_ticket_id',(
      select t.id
      from public.commercial_ticket_records t
      where t.pipeline_lead_id=pl.id
        and t.deleted_at is null
      order by t.created_at desc
      limit 1
    ),
    'handover_ticket_id',(select id from public.service_tickets t where t.pipeline_lead_id=pl.id and t.ticket_type='handover' order by t.created_at desc limit 1)
  ) order by pl.due_date,pl.created_at desc),'[]'::jsonb)
  from public.pipeline_leads pl join public.activities a on a.id=pl.activity_id
  join public.work_sources ws on ws.id=pl.source_id join public.memberships m on m.id=a.owner_membership_id
  where public.current_user_has_permission('pipeline.view')
    and public.can_access_work_source(pl.source_id)
    and pl.archived_at is null;
$$;
