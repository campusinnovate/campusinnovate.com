create or replace function public.kawan_ai_context(context_route text,context_entity_type text default null,context_entity_id text default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  me uuid:=public.current_membership_id();
  access jsonb;
  module_context jsonb:='{}'::jsonb;
  workspace jsonb;
  selected_id uuid;
begin
  if me is null or not public.current_user_has_permission('ai.use') then
    raise exception 'Kawan AI tidak tersedia.' using errcode='42501';
  end if;

  if context_entity_id is not null and context_entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    selected_id:=context_entity_id::uuid;
  end if;

  select jsonb_build_object(
    'membership_id',m.id,
    'name',coalesce(m.full_name,m.email::text),
    'permissions',coalesce((select jsonb_agg(p.key) from public.permissions p where public.current_user_has_permission(p.key)),'[]'::jsonb)
  ) into access from public.memberships m where m.id=me;

  if context_route like '/ruang-kawan/chat%' then
    if selected_id is not null and public.is_chat_member(selected_id,me) then
      select jsonb_build_object(
        'conversation_id',c.id,
        'conversation_name',coalesce(c.name,'Pesan langsung'),
        'conversation_kind',c.kind,
        'recent_messages',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',x.id,'sender',coalesce(m.full_name,m.email::text),'body',x.body,
            'reply_to_message_id',x.parent_message_id,'created_at',x.created_at
          ) order by x.created_at)
          from (select * from public.chat_messages where conversation_id=c.id and deleted_at is null order by created_at desc limit 30)x
          join public.memberships m on m.id=x.sender_membership_id
        ),'[]'::jsonb)
      ) into module_context from public.chat_conversations c where c.id=selected_id;
    else
      select public.chat_workspace() into workspace;
      module_context:=jsonb_build_object('workspace',workspace);
    end if;

  elsif context_route like '/ruang-kawan/dashboard%' then
    select public.dashboard_workspace() into module_context;

  elsif context_route like '/ruang-kawan/activity%' then
    module_context:=jsonb_build_object('feed',jsonb_path_query_array(public.list_my_activity_feed(),'$[0 to 29]'));

  elsif context_route like '/ruang-kawan/notes%' then
    module_context:=jsonb_build_object(
      'personal_notes',coalesce((
      select jsonb_agg(to_jsonb(n) order by n.is_pinned desc,n.updated_at desc)
      from (select id,title,content,color,is_pinned,created_at,updated_at from public.personal_notes where owner_membership_id=me order by is_pinned desc,updated_at desc limit 25)n
      ),'[]'::jsonb),
      'spreadsheet',(select jsonb_build_object('id',s.id,'status',s.status,'updated_at',s.updated_at) from public.personal_spreadsheets s where s.owner_membership_id=me)
    );

  elsif context_route like '/ruang-kawan/assignments%' then
    module_context:=jsonb_build_object('assignments',jsonb_path_query_array(public.list_accessible_assignments(),'$[0 to 29]'));

  elsif context_route like '/ruang-kawan/content-plan%' then
    if not public.current_user_has_permission('content_plan.view') then raise exception 'Akses Content Plan diperlukan.' using errcode='42501'; end if;
    module_context:=jsonb_build_object('content_items',jsonb_path_query_array(public.list_content_items(),'$[0 to 29]'));

  elsif context_route like '/ruang-kawan/pipeline%' then
    if not public.current_user_has_permission('pipeline.view') then raise exception 'Akses Pipeline diperlukan.' using errcode='42501'; end if;
    module_context:=jsonb_build_object(
      'leads',jsonb_path_query_array(public.list_pipeline_leads(),'$[0 to 29]'),
      'configuration',case when public.current_user_has_permission('pipeline.configure') then public.pipeline_configuration_workspace() else '{}'::jsonb end
    );

  elsif context_route like '/ruang-kawan/projects%' then
    if not public.current_user_has_permission('projects.view') then raise exception 'Akses Project diperlukan.' using errcode='42501'; end if;
    if selected_id is not null and public.can_access_project(selected_id) then
      module_context:=jsonb_build_object(
        'project',(select to_jsonb(p) from public.projects p where p.id=selected_id and p.deleted_at is null),
        'tasks',public.list_project_tasks(selected_id),
        'members',public.list_project_members(selected_id),
        'records',public.list_project_records(selected_id)
      );
    else
      module_context:=jsonb_build_object('projects',jsonb_path_query_array(public.list_projects(),'$[0 to 19]'));
    end if;

  elsif context_route like '/ruang-kawan/kpi%' then
    if not public.current_user_has_permission('kpi.view_self') then raise exception 'Akses KPI diperlukan.' using errcode='42501'; end if;
    select public.list_kpi_workspace() into workspace;
    if selected_id is not null then
      module_context:=jsonb_build_object('workspace',workspace,'selected_assignment',public.kpi_assignment_detail(selected_id));
    else
      module_context:=workspace;
    end if;

  elsif context_route like '/ruang-kawan/marketing%' then
    if not public.current_user_has_permission('marketing.view') then raise exception 'Akses Marketing diperlukan.' using errcode='42501'; end if;
    select public.marketing_workspace() into module_context;

  elsif context_route like '/ruang-kawan/finance%' then
    if not public.current_user_has_permission('finance.view') then raise exception 'Akses Finance diperlukan.' using errcode='42501'; end if;
    module_context:=jsonb_build_object(
      'transactions',coalesce((select jsonb_agg(to_jsonb(x) order by x.transaction_date desc,x.created_at desc) from (select * from public.finance_transactions order by transaction_date desc,created_at desc limit 20)x),'[]'::jsonb),
      'documents',coalesce((select jsonb_agg(to_jsonb(x) order by x.document_date desc,x.created_at desc) from (select * from public.finance_documents where deleted_at is null order by document_date desc,created_at desc limit 20)x),'[]'::jsonb),
      'budgets',coalesce((select jsonb_agg(to_jsonb(x) order by x.period_month desc) from (select * from public.finance_budgets order by period_month desc limit 20)x),'[]'::jsonb),
      'accounts',coalesce((select jsonb_agg(to_jsonb(x) order by x.code) from (select * from public.finance_accounts where is_active order by code)x),'[]'::jsonb),
      'assets',coalesce((select jsonb_agg(to_jsonb(x) order by x.asset_name) from (select * from public.finance_assets where is_active order by asset_name limit 20)x),'[]'::jsonb)
    );

  elsif context_route like '/ruang-kawan/documents%' then
    if not public.current_user_has_permission('documents.view') then raise exception 'Akses Document Center diperlukan.' using errcode='42501'; end if;
    select public.document_center_workspace() into module_context;

  elsif context_route like '/ruang-kawan/reports%' then
    if not public.current_user_has_permission('reports.view_self') then raise exception 'Akses Report diperlukan.' using errcode='42501'; end if;
    if selected_id is not null then
      module_context:=jsonb_build_object('workspace',public.report_workspace(),'selected_report',public.get_report_detail(selected_id));
    else
      select public.report_workspace() into module_context;
    end if;

  elsif context_route like '/ruang-kawan/notifications%' then
    if not public.current_user_has_permission('notifications.view_self') then raise exception 'Akses notifikasi diperlukan.' using errcode='42501'; end if;
    module_context:=jsonb_build_object(
      'unread',(select count(*) from public.notifications where recipient_membership_id=me and read_at is null and dismissed_at is null),
      'items',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from (select * from public.notifications where recipient_membership_id=me and dismissed_at is null order by created_at desc limit 30)n),'[]'::jsonb)
    );

  elsif context_route like '/ruang-kawan/profile%' then
    if not public.current_user_has_permission('employee_profile.view_self') then raise exception 'Akses profil diperlukan.' using errcode='42501'; end if;
    module_context:=jsonb_build_object('profile',(
      select jsonb_build_object(
        'membership_id',m.id,'name',coalesce(m.full_name,p.full_name,m.email::text),'email',m.email::text,
        'position',pos.name,'department',d.name,'engagement_type',m.engagement_type,
        'preferred_name',ep.preferred_name,'phone',ep.phone,'city',ep.city,
        'employment_start_date',ep.employment_start_date,'bank_name',ep.bank_name,
        'bank_account_holder',ep.bank_account_holder,'bank_account_last4',right(coalesce(ep.bank_account_number,''),4),
        'updated_at',ep.updated_at
      ) from public.memberships m left join public.profiles p on p.user_id=m.user_id
      left join public.positions pos on pos.id=m.position_id left join public.departments d on d.id=m.department_id
      left join public.employee_private_profiles ep on ep.membership_id=m.id where m.id=me
    ));

  elsif context_route like '/ruang-kawan/admin%' then
    if not public.current_user_has_permission('access.manage') then raise exception 'Akses Admin diperlukan.' using errcode='42501'; end if;
    module_context:=jsonb_build_object(
      'active_members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.full_name,m.email::text),'status',m.status,'engagement_type',m.engagement_type,'role',r.name,'position',p.name) order by coalesce(m.full_name,m.email::text)) from public.memberships m left join public.roles r on r.id=m.role_id left join public.positions p on p.id=m.position_id where m.status='active'),'[]'::jsonb),
      'work_sources',case when context_route like '/ruang-kawan/admin/sources%' then coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'key',w.key,'name',w.name,'module_type',w.module_type,'is_active',w.is_active,'sort_order',w.sort_order) order by w.sort_order,w.name) from public.work_sources w),'[]'::jsonb) else '[]'::jsonb end
    );
  end if;

  return jsonb_build_object(
    'actor',access,'route',context_route,'entity_type',context_entity_type,
    'entity_id',context_entity_id,'module_context',coalesce(module_context,'{}'::jsonb)
  );
end;$$;

revoke all on function public.kawan_ai_context(text,text,text) from anon,public;
grant execute on function public.kawan_ai_context(text,text,text) to authenticated;
