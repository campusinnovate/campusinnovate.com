create or replace function public.ticketing_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id(); rows jsonb;
begin
 if not public.current_user_has_permission('ticketing.view') then raise exception 'Akses ticketing tidak tersedia.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',t.id,'ticket_code',t.ticket_code,'pipeline_lead_id',t.pipeline_lead_id,'phase',t.phase,'ticket_status',t.ticket_status,
  'service_main',t.service_main,'phase_owner_membership_id',t.phase_owner_membership_id,'phase_deadline',t.phase_deadline,
  'next_action',t.next_action,'next_action_due',t.next_action_due,'blocker',t.blocker,'conversation_id',t.conversation_id,'project_id',t.project_id,'project_conversation_id',t.project_conversation_id,
  'account_name',pl.account_name,'lead_code',pl.lead_code,'stage',pl.stage,'lead_source',pl.lead_source,'deal_value',pl.deal_value,
  'proposal_value',pl.proposal_value,'won_value',pl.won_value,
  'owner_name',coalesce(m.full_name,m.email::text),
  'can_accept_handover',t.phase='handover' and public.current_user_has_permission('projects.create') and exists(select 1 from public.memberships me join public.positions pos on pos.id=me.position_id where me.id=actor and (pos.key=case when t.service_main='Event Management' then 'coo' when t.service_main='Digital System' then 'cto' else pos.key end)),
  'can_contribute',public.current_user_has_permission('ticketing.manage') or (public.current_user_has_permission('ticketing.contribute') and (t.phase_owner_membership_id=actor or exists(select 1 from public.commercial_ticket_members own where own.ticket_id=t.id and own.membership_id=actor and own.member_role in('assignee','approver')))),
  'checklist',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'phase',c.phase,'label',c.label,'required',c.required,'done',c.completed_at is not null,'evidence',c.evidence) order by c.sort_order),'[]'::jsonb) from public.commercial_ticket_checklist c where c.ticket_id=t.id),
  'members',(select coalesce(jsonb_agg(jsonb_build_object('membership_id',tm.membership_id,'name',coalesce(mm.full_name,mm.email::text),'member_role',tm.member_role)),'[]'::jsonb) from public.commercial_ticket_members tm join public.memberships mm on mm.id=tm.membership_id where tm.ticket_id=t.id),
  'conversation_name',(select name from public.chat_conversations where id=t.conversation_id),
  'project_code',(select project_code from public.projects where id=t.project_id)
 ) order by t.phase_deadline,t.created_at desc),'[]'::jsonb) into rows
 from public.commercial_tickets t join public.pipeline_leads pl on pl.id=t.pipeline_lead_id
 join public.activities a on a.id=pl.activity_id join public.memberships m on m.id=t.phase_owner_membership_id
 where public.can_access_activity(a.id) or t.phase_owner_membership_id=actor
   or (t.phase='handover' and public.current_user_has_permission('projects.create') and (t.service_main not in('Event Management','Digital System') or exists(select 1 from public.memberships hm join public.positions hp on hp.id=hm.position_id where hm.id=actor and hp.key=case when t.service_main='Event Management' then 'coo' else 'cto' end)))
   or exists(select 1 from public.commercial_ticket_members x where x.ticket_id=t.id and x.membership_id=actor);
 return jsonb_build_object('tickets',rows,'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'position',p.name) order by coalesce(m.full_name,m.email::text)),'[]'::jsonb) from public.memberships m left join public.positions p on p.id=m.position_id where m.status='active'),'can_manage',public.current_user_has_permission('ticketing.manage'),'can_contribute',public.current_user_has_permission('ticketing.contribute'),'can_transition',public.current_user_has_permission('ticketing.transition'));
end $$;