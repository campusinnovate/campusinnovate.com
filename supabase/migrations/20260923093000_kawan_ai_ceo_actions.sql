-- CEO action gateway: limited, audited write actions for Kawan AI.
-- Only explicitly enabled CEO memberships may call this function.

create table if not exists public.kawan_ai_ceo_action_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  action_type text not null,
  command_text text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);

alter table public.kawan_ai_ceo_action_logs enable row level security;
revoke all on public.kawan_ai_ceo_action_logs from anon, public;
grant select on public.kawan_ai_ceo_action_logs to authenticated;
drop policy if exists "CEO can read own action log" on public.kawan_ai_ceo_action_logs;
create policy "CEO can read own action log" on public.kawan_ai_ceo_action_logs
for select to authenticated using (membership_id=public.current_membership_id());

create or replace function public.kawan_ai_ceo_execute_action(
  action_type text,
  action_payload jsonb default '{}'::jsonb,
  command_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  me uuid:=public.current_membership_id();
  owner_id uuid:=coalesce(nullif(action_payload->>'owner_membership_id','')::uuid,me);
  source_id uuid;
  saved_id uuid;
  title_value text:=trim(coalesce(action_payload->>'title',''));
  due_date_value date:=coalesce(nullif(action_payload->>'due_date','')::date,(now() at time zone 'Asia/Jakarta')::date);
  priority_value text:=coalesce(nullif(action_payload->>'priority',''),'medium');
  result_value jsonb;
begin
  if me is null or not public.kawan_ai_ceo_access() then
    raise exception 'Kawan AI Asisten CEO tidak tersedia untuk akun ini.' using errcode='42501';
  end if;

  if action_type='create_task' then
    if title_value='' then raise exception 'Judul task wajib diisi.'; end if;
    if priority_value not in ('low','medium','high','urgent') then raise exception 'Prioritas task tidak valid.'; end if;
    if owner_id<>me and not public.current_user_has_permission('activity.assign_team') then
      raise exception 'Izin assignment tim diperlukan.' using errcode='42501';
    end if;
    select ws.id into source_id
    from public.work_sources ws
    where ws.is_active and ws.key in ('assignment','manual_activity')
      and public.can_access_work_source(ws.id)
    order by case ws.key when 'assignment' then 0 else 1 end
    limit 1;
    if source_id is null then raise exception 'Sumber My Activity belum tersedia.' using errcode='42501'; end if;

    insert into public.activities(
      owner_membership_id,assigned_by_membership_id,reviewer_membership_id,source_id,
      title,activity_date,priority,detail,next_action,created_by,updated_by
    ) values (
      owner_id,me,nullif(action_payload->>'reviewer_membership_id','')::uuid,source_id,
      title_value,due_date_value,priority_value,nullif(trim(action_payload->>'detail'),''),nullif(trim(action_payload->>'next_action'),''),
      auth.uid(),auth.uid()
    ) returning id into saved_id;

    if owner_id<>me then
      insert into public.notifications(recipient_membership_id,actor_membership_id,notification_type,title,message,entity_type,entity_id,action_url)
      values(owner_id,me,'assignment','Task dari Asisten CEO',title_value,'activity',saved_id::text,'/ruang-kawan/activity/');
    end if;
    insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,after_data)
    values(auth.uid(),'kawan_ai_ceo.task.create','activity',saved_id::text,action_payload);
    result_value:=jsonb_build_object('id',saved_id,'label',title_value,'url','/ruang-kawan/activity/');

  elsif action_type='update_pipeline' then
    if nullif(action_payload->>'pipeline_lead_id','') is null then raise exception 'Lead Pipeline wajib dipilih.'; end if;
    if trim(coalesce(action_payload->>'stage',''))='' or trim(coalesce(action_payload->>'next_action',''))='' or nullif(action_payload->>'due_date','') is null then
      raise exception 'Stage, next action, dan due date Pipeline wajib diisi.';
    end if;
    perform public.quick_update_pipeline_lead(
      (action_payload->>'pipeline_lead_id')::uuid,
      trim(action_payload->>'stage'),
      trim(action_payload->>'next_action'),
      (action_payload->>'due_date')::date
    );
    result_value:=jsonb_build_object('id',action_payload->>'pipeline_lead_id','label',trim(action_payload->>'stage'),'url','/ruang-kawan/pipeline/');

  elsif action_type='save_project_task' then
    saved_id:=public.save_project_task(null,action_payload);
    result_value:=jsonb_build_object('id',saved_id,'label',title_value,'url','/ruang-kawan/projects/');

  elsif action_type='save_project_record' then
    saved_id:=public.save_project_record(null,action_payload);
    result_value:=jsonb_build_object('id',saved_id,'label',title_value,'url','/ruang-kawan/projects/');

  elsif action_type='complete_activity' then
    if nullif(action_payload->>'activity_id','') is null then raise exception 'Aktivitas wajib dipilih.'; end if;
    result_value:=public.set_activity_completion((action_payload->>'activity_id')::uuid,coalesce((action_payload->>'completed')::boolean,true));
    result_value:=result_value || jsonb_build_object('url','/ruang-kawan/activity/');

  else
    raise exception 'Jenis aksi CEO belum didukung: %', action_type;
  end if;

  insert into public.kawan_ai_ceo_action_logs(membership_id,action_type,command_text,payload,result)
  values(me,action_type,nullif(trim(command_text),''),coalesce(action_payload,'{}'::jsonb),result_value);
  return result_value;
end;
$$;

revoke all on function public.kawan_ai_ceo_execute_action(text,jsonb,text) from anon, public;
grant execute on function public.kawan_ai_ceo_execute_action(text,jsonb,text) to authenticated;
