-- Include review state detail in the KPI workspace and make status notifications explicit.

create or replace function public.list_kpi_workspace()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();can_all boolean:=public.current_user_has_permission('kpi.view_all') or public.current_user_has_permission('kpi.manage') or public.current_user_has_permission('kpi.review');
begin
 if actor is null or not public.current_user_has_permission('kpi.view_self') then raise exception 'Akses KPI diperlukan.' using errcode='42501';end if;
 return jsonb_build_object(
  'periods',coalesce((select jsonb_agg(to_jsonb(kp) order by kp.start_date desc) from public.kpi_periods kp),'[]'::jsonb),
  'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'key',r.key,'name',r.name,'scoring_model',r.scoring_model,'description',r.description,'is_active',r.is_active,'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order) from public.kpi_categories c where c.kpi_role_id=r.id and c.is_active),'[]'::jsonb),'templates',coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order) from public.kpi_templates t where t.kpi_role_id=r.id and t.is_active),'[]'::jsonb)) order by r.name) from public.kpi_roles r where r.is_active),'[]'::jsonb),
  'members',case when can_all then coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'email',m.email::text) order by coalesce(m.full_name,m.email::text)) from public.memberships m where m.status='active'),'[]'::jsonb) else '[]'::jsonb end,
  'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'period_id',a.period_id,'membership_id',a.membership_id,'member_name',coalesce(m.full_name,m.email::text),'kpi_role_id',a.kpi_role_id,'role_name',r.name,'scoring_model',r.scoring_model,'reviewer_membership_id',a.reviewer_membership_id,'status',a.status,'review_note',a.review_note,'submitted_at',a.submitted_at,'reviewed_at',a.reviewed_at,'final_score',a.final_score,'raw_score',a.raw_score,'coverage',a.coverage,'score_status',a.score_status,'updated_at',a.updated_at) order by p.start_date desc,coalesce(m.full_name,m.email::text)) from public.kpi_assignments a join public.kpi_periods p on p.id=a.period_id join public.memberships m on m.id=a.membership_id join public.kpi_roles r on r.id=a.kpi_role_id where can_all or a.membership_id=actor or a.reviewer_membership_id=actor),'[]'::jsonb)
 );
end;$$;

create or replace function public.notify_kpi_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();recipient uuid;event_key text;title_value text;message_value text;
begin
 if new.status is not distinct from old.status then return new;end if;
 recipient:=case when new.status='submitted' then new.reviewer_membership_id else new.membership_id end;
 if recipient is null or recipient=actor then return new;end if;
 event_key:='kpi.'||new.status;
 title_value:=case new.status when 'submitted' then 'KPI perlu direview' when 'revision_requested' then 'KPI perlu direvisi' when 'reviewed' then 'KPI telah disetujui' when 'locked' then 'KPI telah dikunci' else 'Status KPI berubah' end;
 message_value:=case when new.status='revision_requested' then coalesce(new.review_note,'Buka KPI Management untuk melihat catatan reviewer.') else 'Buka KPI Management untuk melihat detail.' end;
 insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority,dedupe_key)
 values(recipient,actor,event_key,title_value,message_value,'kpi_assignment',new.id::text,'/ruang-kawan/kpi/',case when new.status in ('submitted','revision_requested') then 'high' else 'normal' end,event_key||':'||new.id::text)
 on conflict(recipient_membership_id,dedupe_key) where dedupe_key is not null do update set title=excluded.title,message=excluded.message,read_at=null,dismissed_at=null,created_at=now();return new;
end;$$;

revoke execute on function public.list_kpi_workspace() from anon,public;
grant execute on function public.list_kpi_workspace() to authenticated;
