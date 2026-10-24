-- Convert existing ticket announcements to the same structured-chat card format.
-- Only the root announcement body changes; threads, messages, and room history remain intact.
do $$
declare
  t record;
  pic_lines text;
  new_body text;
begin
  for t in
    select r.*,coalesce(m.full_name,m.email::text,'BD') as creator_name
    from public.commercial_ticket_records r
    left join public.memberships m on m.id=r.created_by_membership_id
    where r.chat_message_id is not null
  loop
    select coalesce(string_agg(
      '• '||case p.pic_role
        when 'account_manager' then 'AM' when 'operations' then 'Ops'
        when 'sales' then 'Sales' when 'marketing' then 'Marketing'
        when 'social_media_specialist' then 'Sosmed Specialist'
        when 'coo' then 'COO' when 'cto' then 'CTO' when 'hr' then 'HR PIC'
        else 'PIC' end||': @'||coalesce(m.full_name,m.email::text),
      E'\n' order by p.pic_role,coalesce(m.full_name,m.email::text)
    ),'')
    into pic_lines
    from public.commercial_ticket_record_pics p
    join public.memberships m on m.id=p.membership_id
    where p.ticket_id=t.id;

    new_body := case when t.deleted_at is null then '🎫 TICKET BARU  ·  ' else '🗄️ TICKET DIHAPUS  ·  ' end||t.ticket_code||E'\n'||
      '🏢 CLIENT'||E'\n'||t.client_name||E'\n'||
      '🤝 HUBUNGAN CLIENT'||E'\n'||case t.client_type when 'repeat_order' then 'Repeat Order' else 'Client Baru' end||E'\n'||
      '🧩 LAYANAN'||E'\n'||t.service_name||E'\n'||
      '📋 KEBUTUHAN'||E'\n'||t.requirements||E'\n'||
      '📆 TARGET PROPOSAL'||E'\n'||to_char(t.target_proposal_date,'DD/MM/YYYY')||E'\n'||
      '🗺️ RENCANA PROJECT'||E'\n'||t.project_plan||E'\n'||
      '📡 STATUS RRU'||E'\n'||case t.rru_status when 'ready' then 'Ready · Siap ditindaklanjuti' when 'response' then 'Response · Prospek sudah merespons' else 'Unreachable · Belum dapat dijangkau' end||E'\n'||
      '👤 DITERBITKAN OLEH'||E'\n'||t.creator_name||E'\n'||
      '🧭 PROGRES'||E'\n'||'Commercial → Proposal & Deal → Handover → Delivery → Report & Close'||E'\n'||
      'Balas pada thread pengumuman ini untuk memulai chat teknis bersama PIC.'||E'\n'||
      '👥 PIC'||E'\n'||pic_lines;

    update public.chat_messages
      set body=new_body,edited_at=now(),updated_at=now()
      where id=t.chat_message_id;
  end loop;
end;
$$;
