-- CEO Assistant: safe due-date updates and reply threading.
alter table public.kawan_ai_ceo_messages
  add column if not exists parent_message_id uuid references public.kawan_ai_ceo_messages(id) on delete set null;

create index if not exists kawan_ai_ceo_messages_parent_idx
  on public.kawan_ai_ceo_messages(parent_message_id, created_at);

create or replace function public.kawan_ai_ceo_update_activity_due(
  target_activity_id uuid,
  target_due_date date,
  command_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  me uuid:=public.current_membership_id();
  saved public.activities%rowtype;
begin
  if me is null or not public.kawan_ai_ceo_access() then
    raise exception 'Kawan AI Asisten CEO tidak tersedia untuk akun ini.' using errcode='42501';
  end if;
  if target_due_date is null then raise exception 'Tanggal deadline wajib diisi.'; end if;

  update public.activities
  set activity_date=target_due_date, updated_by=auth.uid(), updated_at=now()
  where id=target_activity_id
    and (owner_membership_id=me or assigned_by_membership_id=me)
  returning * into saved;

  if saved.id is null then
    raise exception 'Task tidak ditemukan atau Anda tidak memiliki izin mengubahnya.' using errcode='42501';
  end if;

  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,after_data)
  values(auth.uid(),'kawan_ai_ceo.activity.reschedule','activity',saved.id::text,jsonb_build_object('activity_date',target_due_date,'command',command_text));

  insert into public.kawan_ai_ceo_action_logs(membership_id,action_type,command_text,payload,result)
  values(me,'update_activity_due',nullif(trim(command_text),''),jsonb_build_object('activity_id',target_activity_id,'due_date',target_due_date),jsonb_build_object('id',saved.id,'label',saved.title,'url','/ruang-kawan/activity/'));

  return jsonb_build_object('id',saved.id,'label',saved.title,'url','/ruang-kawan/activity/');
end;
$$;

revoke all on function public.kawan_ai_ceo_update_activity_due(uuid,date,text) from public, anon;
grant execute on function public.kawan_ai_ceo_update_activity_due(uuid,date,text) to authenticated;

create or replace function public.kawan_ai_ceo_history()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare me uuid:=public.current_membership_id();
begin
  if me is null or not public.kawan_ai_ceo_access() then
    raise exception 'Kawan AI Asisten CEO tidak tersedia.' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',id,'role',role,'message_kind',message_kind,'content',content,'sources',sources,'briefing_date',briefing_date,'parent_message_id',parent_message_id,'created_at',created_at) order by created_at)
    from (select * from public.kawan_ai_ceo_messages where membership_id=me order by created_at desc limit 60) recent
  ),'[]'::jsonb);
end;
$$;