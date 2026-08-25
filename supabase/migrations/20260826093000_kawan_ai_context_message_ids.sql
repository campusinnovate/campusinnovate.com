create or replace function public.kawan_ai_context(context_route text,context_entity_type text default null,context_entity_id text default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid:=public.current_membership_id(); access jsonb; module_context jsonb:='{}';
begin
 if me is null or not public.current_user_has_permission('ai.use') then raise exception 'Kawan AI tidak tersedia.' using errcode='42501'; end if;
 select jsonb_build_object('membership_id',m.id,'name',coalesce(m.full_name,m.email::text),'permissions',coalesce((select jsonb_agg(p.key) from public.permissions p where public.current_user_has_permission(p.key)),'[]'::jsonb)) into access from public.memberships m where m.id=me;
 if context_route like '/ruang-kawan/chat%' and context_entity_id is not null and public.is_chat_member(context_entity_id::uuid,me) then
  select jsonb_build_object('conversation_id',c.id,'conversation_name',coalesce(c.name,'Pesan langsung'),'recent_messages',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'sender',coalesce(m.full_name,m.email::text),'body',x.body,'created_at',x.created_at) order by x.created_at) from(select * from public.chat_messages where conversation_id=c.id and deleted_at is null order by created_at desc limit 40)x join public.memberships m on m.id=x.sender_membership_id),'[]'::jsonb)) into module_context from public.chat_conversations c where c.id=context_entity_id::uuid;
 elsif context_route like '/ruang-kawan/projects%' and context_entity_id is not null and public.current_user_has_permission('projects.view') then
  select jsonb_build_object('project',to_jsonb(p)) into module_context from public.projects p where p.id=context_entity_id::uuid and p.deleted_at is null;
 elsif context_route like '/ruang-kawan/activity%' then
  select jsonb_build_object('my_open_activities',coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'date',a.activity_date,'status',a.status,'priority',a.priority) order by a.activity_date) filter(where a.id is not null),'[]'::jsonb)) into module_context from public.activities a where a.owner_membership_id=me and a.status<>'done';
 end if;
 return jsonb_build_object('actor',access,'route',context_route,'entity_type',context_entity_type,'entity_id',context_entity_id,'module_context',module_context);
end;$$;
