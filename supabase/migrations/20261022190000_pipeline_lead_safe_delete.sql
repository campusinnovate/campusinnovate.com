-- Preserve ticket history when a lead is removed from the active Pipeline.
alter table public.pipeline_leads
  add column if not exists archived_at timestamptz;

create index if not exists pipeline_leads_archived_at_idx
  on public.pipeline_leads (archived_at)
  where archived_at is not null;

create or replace function public.list_pipeline_leads()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(pl)||jsonb_build_object(
    'weighted_value',round(coalesce(pl.proposal_value,0)*coalesce(pl.probability,0),2),
    'potential_revenue',round(coalesce(pl.seats,0)*coalesce(pl.price_per_person,0),2),
    'owner_membership_id',a.owner_membership_id,'assigned_by_membership_id',a.assigned_by_membership_id,
    'workflow_status',a.status,'progress',a.progress,'linked_kpi',a.linked_kpi,
    'owner_name',coalesce(m.full_name,m.email::text),'source_name',ws.name,'source_color',ws.color,'source_config',ws.module_config,
    'commercial_ticket_id',(select id from public.service_tickets t where t.pipeline_lead_id=pl.id and t.ticket_type='commercial'),
    'handover_ticket_id',(select id from public.service_tickets t where t.pipeline_lead_id=pl.id and t.ticket_type='handover')
  ) order by pl.due_date,pl.created_at desc),'[]'::jsonb)
  from public.pipeline_leads pl join public.activities a on a.id=pl.activity_id
  join public.work_sources ws on ws.id=pl.source_id join public.memberships m on m.id=a.owner_membership_id
  where public.current_user_has_permission('pipeline.view')
    and public.can_access_work_source(pl.source_id)
    and pl.archived_at is null;
$$;

create or replace function public.delete_pipeline_lead(target_pipeline_lead_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  lead public.pipeline_leads%rowtype;
  owner_id uuid;
  actor_id uuid := public.current_membership_id();
begin
  select * into lead
  from public.pipeline_leads
  where id=target_pipeline_lead_id
  for update;

  select a.owner_membership_id into owner_id
  from public.activities a
  where a.id=lead.activity_id;

  if lead.id is null
     or not public.can_access_activity(lead.activity_id)
     or (owner_id=actor_id and not public.current_user_has_permission('pipeline.manage_self'))
     or (owner_id<>actor_id and not public.current_user_has_permission('pipeline.manage_team')) then
    raise exception 'Lead tidak dapat dihapus.' using errcode='42501';
  end if;

  -- Ticket-linked leads leave the active board, while their tickets and timelines remain intact.
  if exists (select 1 from public.service_tickets t where t.pipeline_lead_id=lead.id) then
    update public.pipeline_leads
      set archived_at=coalesce(archived_at,now()), updated_at=now()
      where id=lead.id;
    return;
  end if;

  delete from public.activities where id=lead.activity_id;
end;
$$;
