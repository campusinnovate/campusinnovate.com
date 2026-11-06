-- Grant the requested BD accounts team-level pipeline actions within sources they can access.
insert into public.member_permission_overrides (membership_id, permission_id, effect, reason)
select m.id, p.id, 'allow', 'BD can manage pipeline leads in accessible pipeline sources'
from public.memberships m cross join public.permissions p
where lower(m.email) in ('rnavaolivia@gmail.com','esyaprilas@gmail.com')
  and m.status='active' and p.key='pipeline.manage_team'
on conflict (membership_id,permission_id) do update
set effect='allow', reason=excluded.reason, granted_at=now();

CREATE OR REPLACE FUNCTION public.save_pipeline_lead(pipeline_lead_id uuid, payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor_id uuid:=public.current_membership_id(); owner_id uuid; source_uuid uuid;
  saved_activity_id uuid; saved_lead_id uuid; existing public.pipeline_leads%rowtype;
  existing_owner_id uuid; source_config jsonb; target_stage text; target_priority text;
  target_account text; target_next_action text; target_due_date date; target_date_added date;
  target_probability numeric; target_workflow text; target_progress integer; target_activity_type text;
begin
  if actor_id is null or not public.current_user_has_permission('pipeline.view') then raise exception 'Akses Pipeline BD diperlukan.' using errcode='42501'; end if;

  if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Payload harus object.'; end if;
  if pipeline_lead_id is not null then
    select * into existing from public.pipeline_leads where id=pipeline_lead_id for update;
    select a.owner_membership_id into existing_owner_id from public.activities a where a.id=existing.activity_id;
    if existing.id is null or not (public.can_access_activity(existing.activity_id) or (public.current_user_has_permission('pipeline.manage_team') and public.can_access_work_source(existing.source_id))) then
      raise exception 'Lead tidak dapat diakses.' using errcode='42501';
    end if;
    if payload ? 'expected_updated_at' and (payload->>'expected_updated_at')::timestamptz is distinct from existing.updated_at then
      raise exception 'Lead telah berubah. Muat ulang sebelum menyimpan.' using errcode='40001';
    end if;
    payload:=to_jsonb(existing)||jsonb_build_object(
      'owner_membership_id',(select owner_membership_id from public.activities where id=existing.activity_id),
      'linked_kpi',(select linked_kpi from public.activities where id=existing.activity_id)
    )||payload||jsonb_build_object(
      'follow_up_count',existing.follow_up_count,'last_contact_date',existing.last_contact_date,
      'extra_data',existing.extra_data||coalesce(payload->'extra_data','{}'::jsonb)||
        case when payload->'extra_data' ? 'qualification' then jsonb_build_object(
          'qualification',coalesce(existing.extra_data->'qualification','{}'::jsonb)||(payload->'extra_data'->'qualification')
        ) else '{}'::jsonb end
    );
  end if;
  owner_id:=coalesce(nullif(payload->>'owner_membership_id','')::uuid,actor_id);
  source_uuid:=nullif(payload->>'source_id','')::uuid;
  target_account:=trim(coalesce(payload->>'account_name',''));
  target_next_action:=trim(coalesce(payload->>'next_action',''));
  target_due_date:=nullif(payload->>'due_date','')::date;
  target_date_added:=coalesce(nullif(payload->>'date_added','')::date,current_date);
  target_stage:=trim(coalesce(payload->>'stage',''));
  target_priority:=coalesce(nullif(payload->>'priority',''),'Medium');
  target_activity_type:=coalesce(nullif(payload->>'activity_type',''),'Follow Up');
  target_probability:=nullif(payload->>'probability','')::numeric;
  if target_probability is not null and target_probability>1 then target_probability:=target_probability/100; end if;
  if target_account='' or target_next_action='' or target_due_date is null then raise exception 'Nama lead, next action, dan due date wajib diisi.'; end if;
  if (pipeline_lead_id is null or owner_id is distinct from existing_owner_id) and not exists(select 1 from public.memberships m where m.id=owner_id and m.status='active') then raise exception 'Owner Pipeline BD tidak valid.'; end if;
  select ws.module_config into source_config from public.work_sources ws where ws.id=source_uuid and ws.module_type='pipeline' and public.can_access_work_source(ws.id);
  if source_config is null then raise exception 'Sumber Pipeline BD tidak tersedia.' using errcode='42501'; end if;
  if target_stage='' or not coalesce(source_config->'stages','[]'::jsonb) ? target_stage then raise exception 'Stage tidak tersedia pada pipeline ini.'; end if;
  if jsonb_array_length(coalesce(source_config->'priorities','[]'::jsonb))>0 and not (source_config->'priorities') ? target_priority then raise exception 'Priority tidak tersedia pada pipeline ini.'; end if;
  if jsonb_array_length(coalesce(source_config->'activity_types','[]'::jsonb))>0 and not (source_config->'activity_types') ? target_activity_type then raise exception 'Jenis aktivitas tidak tersedia pada pipeline ini.'; end if;
  if target_probability is not null and target_probability not between 0 and 1 then raise exception 'Probability harus berada di antara 0 dan 100 persen.'; end if;
  if owner_id=actor_id then
    if not public.current_user_has_permission('pipeline.manage_self') then raise exception 'Izin kelola Pipeline BD diperlukan.' using errcode='42501'; end if;
  elsif not public.current_user_has_permission('pipeline.manage_team') and not public.current_user_has_permission('activity.assign_team') then
    raise exception 'Izin kelola Pipeline BD tim diperlukan.' using errcode='42501';
  end if;
  target_workflow:=case when coalesce(source_config->'closed_stages','[]'::jsonb) ? target_stage then 'done' else 'in_progress' end;
  target_progress:=case when target_workflow='done' then 100 else least(95,greatest(5,coalesce(round(target_probability*100)::integer,25))) end;

  if pipeline_lead_id is null then
    insert into public.activities(owner_membership_id,assigned_by_membership_id,source_id,title,activity_date,activity_type,linked_kpi,status,progress,priority,detail,output,next_action,evidence_url,created_by,updated_by)
    values(owner_id,actor_id,source_uuid,target_next_action||' · '||target_account,target_due_date,target_activity_type,nullif(trim(payload->>'linked_kpi'),''),target_workflow,target_progress,case lower(target_priority) when 'high' then 'high' when 'low' then 'low' else 'medium' end,nullif(trim(payload->>'notes'),''),target_stage,target_next_action,nullif(trim(payload->>'document_url'),''),auth.uid(),auth.uid()) returning id into saved_activity_id;
    insert into public.pipeline_leads(activity_id,source_id,lead_code,date_added,business_unit,account_name,account_type,contact_name,contact_role,contact_details,lead_source,priority,stage,outreach_date,follow_up_count,last_contact_date,meeting_date,qualification_status,proposal_date,deal_value,probability,activity_type,next_action,due_date,document_url,notes,trip_program,interest_level,next_follow_up,seats,price_per_person,payment_status,payment_date,community_join_date,payment_proof_url,extra_data)
    values(saved_activity_id,source_uuid,coalesce(nullif(trim(payload->>'lead_code'),''),upper(coalesce(source_config->>'lead_prefix','LEAD'))||'-'||upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,6))),target_date_added,nullif(trim(payload->>'business_unit'),''),target_account,nullif(trim(payload->>'account_type'),''),nullif(trim(payload->>'contact_name'),''),nullif(trim(payload->>'contact_role'),''),nullif(trim(payload->>'contact_details'),''),nullif(trim(payload->>'lead_source'),''),target_priority,target_stage,nullif(payload->>'outreach_date','')::date,coalesce(nullif(payload->>'follow_up_count','')::integer,0),nullif(payload->>'last_contact_date','')::date,nullif(payload->>'meeting_date','')::date,nullif(trim(payload->>'qualification_status'),''),nullif(payload->>'proposal_date','')::date,nullif(payload->>'deal_value','')::numeric,target_probability,target_activity_type,target_next_action,target_due_date,nullif(trim(payload->>'document_url'),''),nullif(trim(payload->>'notes'),''),nullif(trim(payload->>'trip_program'),''),nullif(trim(payload->>'interest_level'),''),nullif(payload->>'next_follow_up','')::date,nullif(payload->>'seats','')::integer,nullif(payload->>'price_per_person','')::numeric,nullif(trim(payload->>'payment_status'),''),nullif(payload->>'payment_date','')::date,nullif(payload->>'community_join_date','')::date,nullif(trim(payload->>'payment_proof_url'),''),coalesce(payload->'extra_data','{}'::jsonb)) returning id into saved_lead_id;
    update public.activities set source_record_id=saved_lead_id::text,custom_data=jsonb_build_object('pipeline_lead_id',saved_lead_id,'lead_code',(select lead_code from public.pipeline_leads where id=saved_lead_id)) where id=saved_activity_id;
    if owner_id<>actor_id then insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url) values(owner_id,actor_id,'assignment','Lead Pipeline BD baru',target_account,'activity',saved_activity_id::text,'/ruang-kawan/pipeline/'); end if;
    insert into public.activity_history(activity_id,actor_membership_id,event_type,after_data) values(saved_activity_id,actor_id,'pipeline_lead_created',payload);
  else
    select * into existing from public.pipeline_leads where id=pipeline_lead_id;
    if existing.id is null or not public.can_access_activity(existing.activity_id) then raise exception 'Lead tidak dapat diakses.' using errcode='42501'; end if;
    select a.owner_membership_id into existing_owner_id from public.activities a where a.id=existing.activity_id;
    if (existing_owner_id<>actor_id or owner_id<>actor_id) and not public.current_user_has_permission('pipeline.manage_team') and not public.current_user_has_permission('activity.assign_team') then raise exception 'Izin kelola Pipeline BD tim diperlukan.' using errcode='42501'; end if;
    saved_activity_id:=existing.activity_id;saved_lead_id:=existing.id;
    update public.activities set owner_membership_id=owner_id,source_id=source_uuid,title=target_next_action||' · '||target_account,activity_date=target_due_date,activity_type=target_activity_type,linked_kpi=nullif(trim(payload->>'linked_kpi'),''),status=target_workflow,progress=target_progress,priority=case lower(target_priority) when 'high' then 'high' when 'low' then 'low' else 'medium' end,detail=nullif(trim(payload->>'notes'),''),output=target_stage,next_action=target_next_action,evidence_url=nullif(trim(payload->>'document_url'),''),updated_by=auth.uid(),updated_at=now() where id=saved_activity_id;
    update public.pipeline_leads set source_id=source_uuid,lead_code=coalesce(nullif(trim(payload->>'lead_code'),''),lead_code),date_added=target_date_added,business_unit=nullif(trim(payload->>'business_unit'),''),account_name=target_account,account_type=nullif(trim(payload->>'account_type'),''),contact_name=nullif(trim(payload->>'contact_name'),''),contact_role=nullif(trim(payload->>'contact_role'),''),contact_details=nullif(trim(payload->>'contact_details'),''),lead_source=nullif(trim(payload->>'lead_source'),''),priority=target_priority,stage=target_stage,outreach_date=nullif(payload->>'outreach_date','')::date,follow_up_count=coalesce(nullif(payload->>'follow_up_count','')::integer,0),last_contact_date=nullif(payload->>'last_contact_date','')::date,meeting_date=nullif(payload->>'meeting_date','')::date,qualification_status=nullif(trim(payload->>'qualification_status'),''),proposal_date=nullif(payload->>'proposal_date','')::date,deal_value=nullif(payload->>'deal_value','')::numeric,probability=target_probability,activity_type=target_activity_type,next_action=target_next_action,due_date=target_due_date,document_url=nullif(trim(payload->>'document_url'),''),notes=nullif(trim(payload->>'notes'),''),trip_program=nullif(trim(payload->>'trip_program'),''),interest_level=nullif(trim(payload->>'interest_level'),''),next_follow_up=nullif(payload->>'next_follow_up','')::date,seats=nullif(payload->>'seats','')::integer,price_per_person=nullif(payload->>'price_per_person','')::numeric,payment_status=nullif(trim(payload->>'payment_status'),''),payment_date=nullif(payload->>'payment_date','')::date,community_join_date=nullif(payload->>'community_join_date','')::date,payment_proof_url=nullif(trim(payload->>'payment_proof_url'),''),extra_data=coalesce(payload->'extra_data','{}'::jsonb),updated_at=now() where id=pipeline_lead_id;
    insert into public.activity_history(activity_id,actor_membership_id,event_type,after_data) values(saved_activity_id,actor_id,'pipeline_lead_updated',payload);
  end if;
  return saved_lead_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.delete_pipeline_lead(target_pipeline_lead_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     or not (public.can_access_activity(lead.activity_id) or (public.current_user_has_permission('pipeline.manage_team') and public.can_access_work_source(lead.source_id)))
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
$function$
;
