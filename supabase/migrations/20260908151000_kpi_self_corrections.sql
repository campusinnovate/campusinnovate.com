create or replace function public.correct_my_kpi_item(target_result_id uuid, corrected_target numeric, correction_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_membership_id();r public.kpi_results%rowtype;a public.kpi_assignments%rowtype;period_status text;
begin
 select * into r from public.kpi_results where id=target_result_id;
 select * into a from public.kpi_assignments where id=r.assignment_id for update;
 select status into period_status from public.kpi_periods where id=a.period_id for share;
 if actor is null or a.membership_id is distinct from actor then raise exception 'Hanya pemilik yang dapat mengoreksi KPI.' using errcode='42501';end if;
 if a.status in ('locked','cancelled') or period_status='locked' then raise exception 'Periode terkunci atau assignment dibatalkan. Hubungi pengelola KPI.';end if;
 if corrected_target is null or corrected_target<0 or corrected_target::text in ('NaN','Infinity','-Infinity') or nullif(trim(correction_reason),'') is null then raise exception 'Target valid dan alasan koreksi wajib diisi.';end if;
 if r.formula_type in ('higher_better','lower_better','percentage','derived_ratio','compliance') and corrected_target<=0 then raise exception 'Target untuk rumus ini harus lebih besar dari nol.';end if;
 update public.kpi_results set target_value=corrected_target,raw_achievement=public.kpi_score_item(formula_type,corrected_target,actual_value),score=case when public.kpi_score_item(formula_type,corrected_target,actual_value) is null then null else least(public.kpi_score_item(formula_type,corrected_target,actual_value),100) end,reviewer_score=null,review_note=null,reviewed_by_membership_id=null,reviewed_at=null,updated_at=now() where id=target_result_id;
 -- Submitted/reviewed work must be submitted again after an owner correction.
 update public.kpi_assignments set status=case when status in ('submitted','reviewed') then 'revision_requested' else status end,review_note='Koreksi pemilik: '||trim(correction_reason),updated_at=now() where id=a.id;
 perform public.recalculate_kpi_assignment(a.id);
 insert into public.kpi_events(assignment_id,result_id,actor_membership_id,action,before_data,after_data,reason)
 values(a.id,r.id,actor,'target.corrected',to_jsonb(r),jsonb_build_object('target_value',corrected_target),trim(correction_reason));
 if a.reviewer_membership_id is not null and a.reviewer_membership_id<>actor then
  insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url,priority)
  values(a.reviewer_membership_id,actor,'kpi.corrected','Koreksi target KPI',r.name||': '||r.target_value||' → '||corrected_target||'. '||trim(correction_reason),'kpi_assignment',a.id::text,'/ruang-kawan/kpi/','normal');
 end if;
end;$$;
revoke all on function public.correct_my_kpi_item(uuid,numeric,text) from public,anon;
grant execute on function public.correct_my_kpi_item(uuid,numeric,text) to authenticated;
