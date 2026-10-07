-- Snapshot uses decimal Postgres totals, the existing posted ledger and canonical documents.
-- All aggregates precede UI limits. No conversion of legacy cash transactions to accrual journals.
create or replace function public.finance_pilot_snapshot(
 p_view text default 'MTD',p_asof date default (now() at time zone 'Asia/Jakarta')::date,
 p_start date default null,p_end date default null,p_service text default null,p_project uuid default null,
 p_client text default null,p_compare text default 'Previous Period',p_payment text default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare pol jsonb:=finance_pilot_private.policy(); ac jsonb; v_start_date date; v_end_date date; v_fy_start date; v_fs int; v_fy int;
 v_cmp_start date; v_cmp_end date; result jsonb;
begin
 perform finance_pilot_private.actor('view'); ac:=pol->'accounts'; v_fs:=(pol->>'fiscal_start')::int;
 if p_view not in ('MTD','QTD','YTD','Custom') or p_compare not in ('Previous Period','Previous Year','Budget','Target') or p_asof is null then raise exception 'Filter tidak valid.'; end if;
 v_end_date:=case when p_view='Custom' then p_end else p_asof end;
 p_asof:=v_end_date;
 if v_fs is not null then
 v_fy:=extract(year from p_asof)::int-case when extract(month from p_asof)<v_fs then 1 else 0 end;
 v_fy_start:=make_date(v_fy,v_fs,1);
 end if;
 v_start_date:=case p_view when 'MTD' then date_trunc('month',p_asof)::date
 when 'QTD' then case when v_fs is null then null else (v_fy_start+((floor(((extract(year from p_asof)-extract(year from v_fy_start))*12+extract(month from p_asof)-extract(month from v_fy_start))/3)*3)::int||' months')::interval)::date end
 when 'YTD' then v_fy_start else p_start end;
 if p_view='Custom' and (p_start is null or p_end is null or p_start>p_end) then raise exception 'Custom range wajib valid.'; end if;
 if p_service is not null and not exists(select 1 from public.finance_next_service_lines where service_line_key=p_service) then raise exception 'Service line tidak valid.'; end if;
 if p_compare='Previous Year' then v_cmp_start:=(v_start_date-interval '1 year')::date; v_cmp_end:=(v_end_date-interval '1 year')::date;
 elsif p_view='MTD' then v_cmp_start:=(v_start_date-interval '1 month')::date; v_cmp_end:=least((v_end_date-interval '1 month')::date,(v_start_date-interval '1 day')::date);
 elsif p_view='QTD' then v_cmp_start:=(v_start_date-interval '3 months')::date; v_cmp_end:=(v_end_date-interval '3 months')::date;
 elsif p_view='YTD' then v_cmp_start:=(v_start_date-interval '1 year')::date; v_cmp_end:=(v_end_date-interval '1 year')::date;
 else v_cmp_end:=v_start_date-1; v_cmp_start:=v_cmp_end-(v_end_date-v_start_date); end if;

 with
 all_lines as (
 select l.*,e.entry_date,e.description as entry_description,e.source_type,e.source_id,e.reversal_of_id,c.name as account_name,c.account_class,c.cash_flow_category,
 case when coalesce(r.payload->>'business_event',orig.payload->>'business_event')='vendor_payment' then (select bill.payload->>'business_event' from public.finance_next_requests bill where bill.id::text=coalesce(r.payload->>'vendor_bill_id',orig.payload->>'vendor_bill_id'))
 else coalesce(r.payload->>'business_event',orig.payload->>'business_event',case when coalesce(d.document_type,od.document_type)='receipt' then 'customer_receipt' when coalesce(d.document_type,od.document_type)='invoice' then 'client_invoice' end) end as business_event
 from public.finance_next_journal_lines l join public.finance_next_journal_entries e on e.id=l.journal_entry_id
 join public.finance_coa c on c.code=l.coa_code
 left join public.finance_next_requests r on r.id::text=e.source_id and e.source_type='request'
 left join public.finance_documents d on d.id::text=e.source_id and e.source_type='finance_document'
 left join public.finance_next_journal_entries oe on oe.id=e.reversal_of_id
 left join public.finance_documents od on od.id::text=oe.source_id and oe.source_type='finance_document'
 left join public.finance_next_requests orig on orig.id::text=oe.source_id and oe.source_type='request'
 where e.status='posted'
 ), dim as (
 select * from all_lines where (p_service is null or service_line_key=p_service) and (p_project is null or project_id=p_project) and (p_client is null or client=p_client)
 ), period_lines as (select * from dim where entry_date between v_start_date and v_end_date),
 income as (
 select coalesce(sum(credit-debit) filter(where account_class='Pendapatan'),0) as revenue,
 coalesce(sum(debit-credit) filter(where account_class='Beban Langsung Proyek'),0) as hpp,
 coalesce(sum(debit-credit) filter(where account_class='Beban Operasional'),0) as opex,
 coalesce(sum(debit-credit) filter(where account_class='Beban Non-Operasional'),0) as other,
 coalesce(sum(debit-credit) filter(where account_class='Pajak'),0) as tax from period_lines
 ), prior as (
 select coalesce(sum(credit-debit) filter(where account_class='Pendapatan'),0) as revenue,
 coalesce(sum(debit-credit) filter(where account_class='Beban Langsung Proyek'),0) as hpp,
 coalesce(sum(debit-credit) filter(where account_class='Beban Operasional'),0) as opex from dim where entry_date between v_cmp_start and v_cmp_end
 ), balances as (
 select c.code,c.name,c.account_class,coalesce(sum(d.debit-d.credit) filter(where d.entry_date<v_start_date),0) as opening,
 coalesce(sum(d.debit) filter(where d.entry_date between v_start_date and v_end_date),0) as debit,
 coalesce(sum(d.credit) filter(where d.entry_date between v_start_date and v_end_date),0) as credit,
 coalesce(sum(d.debit-d.credit) filter(where d.entry_date<=v_end_date),0) as closing
 from public.finance_coa c left join dim d on d.coa_code=c.code where c.is_active and c.account_class not like 'Kontrol%' group by c.code,c.name,c.account_class
 ), liquidity as (
 select coalesce(sum(debit-credit) filter(where coa_code=ac->>'cash'),0) as book_cash,
 coalesce(sum(credit-debit) filter(where coa_code=ac->>'payable'),0) as payables,
 coalesce(sum(credit-debit) filter(where coa_code=ac->>'tax_payable'),0) as taxes,
 coalesce(sum(credit-debit) filter(where coa_code=ac->>'distribution_payable'),0) as distribution,
 md5(coalesce(string_agg(id::text,',' order by id) filter(where coa_code=ac->>'cash'),'')) as fingerprint
 from all_lines where entry_date<=v_end_date
 ), recon as (
 select r.* from public.finance_next_reconciliations r where r.bank_coa_code=ac->>'cash' and r.as_of_date=v_end_date order by r.created_at desc limit 1
 ), fund_plan as (
 select payload from public.finance_next_requests where kind='funds' and state='posted' and (payload->>'as_of')::date<=v_end_date order by (payload->>'as_of')::date desc,reviewed_at desc limit 1
 ), buckets as (
 select value->>'key' as key,value->>'label' as label,(value->>'amount')::numeric as amount,true as restricted from fund_plan,jsonb_array_elements(payload->'buckets')
 ), inv as (
 select d.*,coalesce((select sum(r.total) from public.finance_documents r where r.finance_pilot is true and r.document_type='receipt' and r.linked_invoice_id=d.id and r.document_date<=v_end_date and r.pilot_journal_id is not null and not exists(select 1 from public.finance_next_journal_entries re where re.reversal_of_id=r.pilot_journal_id and re.entry_date<=v_end_date)),0) as asof_paid
 from public.finance_documents d where d.finance_pilot is true and d.document_type='invoice' and d.pilot_journal_id is not null and d.document_date<=v_end_date and not exists(select 1 from public.finance_next_journal_entries re where re.reversal_of_id=d.pilot_journal_id and re.entry_date<=v_end_date)
 and (p_service is null or d.pilot_service_line_key=p_service) and (p_project is null or d.pilot_project_id=p_project) and (p_client is null or d.client=p_client)
 ), invoice_rows as (
 select *,total-asof_paid as asof_balance,case when asof_paid=total then 'paid' when due_date<v_end_date then 'overdue' when asof_paid>0 then 'partially_paid' else 'issued' end as asof_status from inv
 ), selected_invoices as (select * from invoice_rows where p_payment is null or asof_status=p_payment),
 rec as (
 select r.* from public.finance_documents r join selected_invoices i on i.id=r.linked_invoice_id where r.finance_pilot is true and r.document_type='receipt' and r.pilot_journal_id is not null and r.document_date between v_start_date and v_end_date and not exists(select 1 from public.finance_next_journal_entries re where re.reversal_of_id=r.pilot_journal_id and re.entry_date<=v_end_date)
 ), vendor_bills_all as (
 select rq.id,rq.payload->>'reference' as reference,rq.payload->>'client' as vendor,(rq.payload->>'date')::date as bill_date,
 (rq.payload->>'due_date')::date as due_date,nullif(rq.payload->>'project_id','')::uuid as project_id,
 (select service_line_key from public.finance_next_project_controls where project_id=nullif(rq.payload->>'project_id','')::uuid) as service_line_key,
 rq.result_id as journal_id,rq.payload->>'evidence_path' as evidence_path,
 (select sum(l.credit-l.debit) from public.finance_next_journal_lines l where l.journal_entry_id=rq.result_id and l.coa_code=ac->>'payable') as amount,
 finance_pilot_private.ap_balance(rq.id,v_end_date) as balance
 from public.finance_next_requests rq where rq.kind='journal' and rq.state='posted' and rq.payload->>'business_event'<>'vendor_payment'
 and (rq.payload->>'date')::date<=v_end_date and exists(select 1 from public.finance_next_journal_lines where journal_entry_id=rq.result_id and coa_code=ac->>'payable' and credit>0)
 ), vendor_bills as (
 select * from vendor_bills_all where (p_service is null or service_line_key=p_service) and (p_project is null or project_id=p_project) and (p_client is null or vendor=p_client)
 ), target as (
 select r.* from public.finance_next_requests r where r.kind='target' and r.state='posted' and (r.payload->>'fiscal_year')::int=v_fy order by reviewed_at desc,id limit 1
 ), original_target as (
 select payload from public.finance_next_requests where kind='target' and state='posted' and (payload->>'fiscal_year')::int=v_fy order by reviewed_at,id limit 1
 ), monthly as (
 select month,coalesce((select sum((a->>'amount')::numeric) from target,jsonb_array_elements(payload->'allocations') a where (a->>'month')::int=month and (p_service is null or a->>'service_line_key'=p_service)),0) as target,
 coalesce((select sum(credit-debit) from dim where account_class='Pendapatan' and entry_date>=(v_fy_start+((month-1)||' months')::interval)::date and entry_date<(v_fy_start+(month||' months')::interval)::date and entry_date<=p_asof),0) as actual
 from generate_series(1,12) month
 ), outcome as (
 select l.id,l.lead_code,l.account_name,l.stage,l.business_unit,l.lead_source,l.proposal_value,l.won_value,l.win_loss_reason,l.won_at,l.lost_at,l.proposal_date,ct.project_id,
 case when l.stage='Won' then (l.won_at at time zone 'Asia/Jakarta')::date when l.stage='Lost' then (l.lost_at at time zone 'Asia/Jakarta')::date else l.proposal_date end as outcome_date,
 s.service_line_key
 from public.pipeline_leads l left join public.finance_next_service_lines s on s.label=l.business_unit
 left join lateral(select project_id from public.commercial_tickets where pipeline_lead_id=l.id order by created_at desc limit 1) ct on true
 where l.stage in ('Proposal','Proposal / Offer','Decision','Proposal Sent','Submitted','Negotiation','Won','Lost','On Hold','Cancelled')
 ), selected_outcome as (
 select * from outcome where outcome_date between v_start_date and v_end_date and (p_service is null or service_line_key=p_service) and (p_project is null or project_id=p_project) and (p_client is null or account_name=p_client)
 ), service_stats as (
 select s.service_line_key,s.label,coalesce(sum(d.credit-d.debit) filter(where d.account_class='Pendapatan'),0) as revenue,coalesce(sum(d.debit-d.credit) filter(where d.account_class='Beban Langsung Proyek'),0) as hpp
 from public.finance_next_service_lines s left join period_lines d on d.service_line_key=s.service_line_key group by s.service_line_key,s.label
 ), journal_rows as (
 select e.*, (select jsonb_agg(jsonb_build_object('line_number',l.line_number,'coa_code',l.coa_code,'description',l.description,'debit',l.debit,'credit',l.credit,'project_id',l.project_id,'project_name',l.project_name,'client',l.client,'service_line_key',l.service_line_key) order by l.line_number) from public.finance_next_journal_lines l where l.journal_entry_id=e.id) as finance_next_journal_lines
 from public.finance_next_journal_entries e where e.id in (select journal_entry_id from period_lines) order by e.entry_date desc,e.created_at desc limit 100
 ), project_rows as (
 select p.id,p.project_code,p.name,p.client_name,coalesce(pc.service_line_key,'unmapped') as service_line_key,p.status,
 pc.contract_value,pc.budgeted_hpp,pc.committed_cost,pc.financially_closed_at,pc.delivery_confirmed_at,
 coalesce((select sum(credit-debit) from period_lines where project_id=p.id and account_class='Pendapatan'),0) as recognized_revenue,
 coalesce((select sum(debit-credit) from period_lines where project_id=p.id and account_class='Beban Langsung Proyek'),0) as actual_hpp,
 coalesce((select sum(total) from selected_invoices where pilot_project_id=p.id and document_date between v_start_date and v_end_date),0) as billed_amount,
 coalesce((select sum(total) from rec where pilot_project_id=p.id),0) as cash_collected
 from public.projects p left join public.finance_next_project_controls pc on pc.project_id=p.id where p.deleted_at is null and (p_service is null or pc.service_line_key=p_service) and (p_project is null or p.id=p_project) and (p_client is null or p.client_name=p_client)
 ), cashflow as (
 select coalesce(sum(debit-credit) filter(where business_event not in ('asset_purchase','owner_receivable','opening_adjustment')),0) as operating,
 coalesce(sum(debit-credit) filter(where business_event in ('asset_purchase','owner_receivable')),0) as investing,
 coalesce(sum(debit-credit) filter(where business_event='opening_adjustment'),0) as financing
 from period_lines where coa_code=ac->>'cash'
 ), report as (
 select jsonb_build_object(
 'income',jsonb_build_array(jsonb_build_object('label','Recognized Revenue','value',revenue),jsonb_build_object('label','Direct Project Cost / HPP','value',-hpp),jsonb_build_object('label','Gross Profit','value',revenue-hpp),jsonb_build_object('label','Operating Expense','value',-opex),jsonb_build_object('label','Operating Profit','value',revenue-hpp-opex),jsonb_build_object('label','Other Expense','value',-other),jsonb_build_object('label','Tax Expense','value',-tax),jsonb_build_object('label','Net Profit','value',revenue-hpp-opex-other-tax)),
 'position',coalesce((select jsonb_agg(jsonb_build_object('label',code||' · '||name,'value',case when account_class='Aset' then closing else -closing end,'coa_code',code)) from balances where account_class in ('Aset','Kewajiban','Ekuitas')), '[]'::jsonb)||jsonb_build_array(jsonb_build_object('label','Unclosed retained profit','value',coalesce((select sum(case when account_class='Pendapatan' then credit-debit else credit-debit end) from dim where entry_date<=v_end_date and account_class in ('Pendapatan','Beban Langsung Proyek','Beban Operasional','Beban Non-Operasional','Pajak')),0))),
 'trial',coalesce((select jsonb_agg(jsonb_build_object('label',code||' · '||name,'value',closing,'coa_code',code,'opening',opening,'debit',debit,'credit',credit)) from balances),'[]'::jsonb),
 'cashflow',jsonb_build_array(jsonb_build_object('label','Operating activities','value',cf.operating),jsonb_build_object('label','Investing activities','value',cf.investing),jsonb_build_object('label','Financing activities','value',cf.financing),jsonb_build_object('label','Net cash movement','value',cf.operating+cf.investing+cf.financing)),
 'equity',coalesce((select jsonb_agg(jsonb_build_object('label',code||' · '||name,'value',-closing,'opening',-opening,'change',credit-debit,'coa_code',code)) from balances where account_class='Ekuitas'),'[]'::jsonb)||jsonb_build_array(jsonb_build_object('label','Period retained profit','value',revenue-hpp-opex-other-tax)),
 'aging',coalesce((select jsonb_agg(jsonb_build_object('label','AR · '||document_number||' · '||client,'value',asof_balance,'due_date',due_date,'days_overdue',greatest(v_end_date-due_date,0),'aging_bucket',case when due_date>=v_end_date then 'Current' when v_end_date-due_date<=30 then '1–30' when v_end_date-due_date<=60 then '31–60' when v_end_date-due_date<=90 then '61–90' else '>90' end,'document_id',id,'coa_code',ac->>'receivable')) from selected_invoices where asof_balance>0),'[]'::jsonb)
 ||coalesce((select jsonb_agg(jsonb_build_object('label','AP · '||reference||' · '||vendor,'value',balance,'due_date',due_date,'days_overdue',greatest(v_end_date-due_date,0),'aging_bucket',case when due_date>=v_end_date then 'Current' when v_end_date-due_date<=30 then '1–30' when v_end_date-due_date<=60 then '31–60' when v_end_date-due_date<=90 then '61–90' else '>90' end,'request_id',id,'journal_id',journal_id,'coa_code',ac->>'payable')) from vendor_bills where balance>0),'[]'::jsonb)
 ) as data from income cross join cashflow cf
 )
 select jsonb_build_object(
 'period',jsonb_build_object('start',v_start_date,'end',v_end_date,'view',p_view,'compare',p_compare,'comparison_start',v_cmp_start,'comparison_end',v_cmp_end,'fiscal_year',v_fy,'fiscal_start',v_fy_start),
 'updated_at',now(),'policy',pol,
 'accounts',(select coalesce(jsonb_agg(to_jsonb(c) order by c.code),'[]'::jsonb) from public.finance_coa c where is_active),
 'services',(select jsonb_agg(to_jsonb(s) order by service_line_key) from public.finance_next_service_lines s),
 'project_options',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'project_code',p.project_code,'name',p.name,'client_name',p.client_name,'service_line_key',pc.service_line_key,'status',p.status)),'[]'::jsonb) from public.projects p left join public.finance_next_project_controls pc on pc.project_id=p.id where deleted_at is null),
 'projects',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from project_rows p),
 'journals',(select coalesce(jsonb_agg(to_jsonb(j)),'[]'::jsonb) from journal_rows j),
 'journal_count',(select count(distinct journal_entry_id) from period_lines),
 'posted_value',(select coalesce(sum(debit),0) from period_lines),
 'periods',(select coalesce(jsonb_agg(to_jsonb(p) order by period_month desc),'[]'::jsonb) from public.finance_next_periods p),
 'requests',(select coalesce(jsonb_agg(to_jsonb(r) order by created_at desc),'[]'::jsonb) from public.finance_next_requests r where state in ('draft','submitted','approved','rejected') or (kind='target' and (payload->>'fiscal_year')::int=v_fy)),
 'invoices',(select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('invoice_number',document_number,'invoice_date',document_date,'service_line_key',pilot_service_line_key,'project_id',pilot_project_id,'management_fee',management_fee,'paid',asof_paid,'balance',asof_balance,'status',asof_status,'finance_next_invoice_items',(select jsonb_agg(a||jsonb_build_object('line_total',round((a->>'quantity')::numeric*(a->>'unit_price')::numeric,2))) from jsonb_array_elements(items) a))),'[]'::jsonb) from selected_invoices d),
 'vendor_bills',(select coalesce(jsonb_agg(to_jsonb(v) order by due_date,id),'[]'::jsonb) from vendor_bills v),
 'receipts',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('receipt_number',document_number,'invoice_id',linked_invoice_id,'receipt_date',document_date,'amount',total,'deposit_coa_code',pilot_deposit_coa_code,'payment_reference',reference_number)),'[]'::jsonb) from rec r),
 'totals',(select to_jsonb(i)||jsonb_build_object('gross_profit',revenue-hpp,'operating_profit',revenue-hpp-opex,'net_profit',revenue-hpp-opex-other-tax,
 'billed',(select coalesce(sum(total),0) from selected_invoices where document_date between v_start_date and v_end_date),'collected',(select coalesce(sum(debit-credit),0) from period_lines where coa_code=ac->>'cash' and business_event='customer_receipt'),'outstanding',(select coalesce(sum(asof_balance),0) from selected_invoices)) from income i),
 'comparison',(select to_jsonb(p) from prior p),
 'service_stats',(select jsonb_agg(to_jsonb(s) order by revenue desc) from service_stats s),
 'cash',(select to_jsonb(l)||jsonb_build_object('reconciled',coalesce((select ledger_fingerprint=l.fingerprint and book_balance=l.book_cash from recon),false),'reconciliation',(select to_jsonb(r) from recon r),'buckets',(select coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) from buckets b),'operating_target',(select (payload->>'operating_target')::numeric from fund_plan),'restrictions',(select coalesce(sum(amount),0) from buckets),'free_cash',case when coalesce((select ledger_fingerprint=l.fingerprint and book_balance=l.book_cash from recon),false) and exists(select 1 from fund_plan) then l.book_cash-(select coalesce(sum(amount),0) from buckets)-l.payables-l.taxes-l.distribution else null end) from liquidity l),
 'target',jsonb_build_object('latest',(select to_jsonb(t) from target t),'original',(select payload from original_target),'monthly',(select jsonb_agg(to_jsonb(m) order by month) from monthly m),'actual',(select coalesce(sum(credit-debit),0) from dim where account_class='Pendapatan' and entry_date between v_fy_start and p_asof)),
 'reports',(select data from report),
 'outcomes',(select coalesce(jsonb_agg(to_jsonb(o)),'[]'::jsonb) from selected_outcome o),
 'quality',jsonb_build_object('policy_configured',pol is not null,'unmapped_legacy_count',(select count(*) from public.finance_transactions t where not exists(select 1 from public.finance_next_legacy_mappings m where m.source_type='finance_transaction' and m.source_id=t.id::text)),
 'ledger_difference',(select coalesce(sum(debit-credit),0) from all_lines),'unallocated_ap',(select payables-(select coalesce(sum(balance),0) from vendor_bills_all) from liquidity),'unmapped_deals',(select count(*) from outcome where service_line_key is null or (stage in ('Won','Lost') and outcome_date is null)),
 'scope','Pilot ledger only; historical finance has not been converted or reconciled. No cutover.')
 ) into result;
 return result;
end $$;
revoke all on function public.finance_pilot_snapshot(text,date,date,date,text,uuid,text,text,text) from public,anon;
grant execute on function public.finance_pilot_snapshot(text,date,date,date,text,uuid,text,text,text) to authenticated;
