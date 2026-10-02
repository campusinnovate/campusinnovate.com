export type MetricLead = {
  date_added: string; proposal_date: string | null; won_at: string | null;
  stage: string; proposal_value: number | null; won_value: number | null;
  extra_data?: Record<string, unknown>;
};
export const isWon = (lead: MetricLead) => ['Won', 'Closed Won', 'Deal', 'Paid/Booked'].includes(lead.stage);
// Legacy deal_value represented GM. Only explicitly entered amounts are revenue.
export function confirmedValue(lead: MetricLead, kind: 'proposal_value' | 'won_value'): number | null {
  const input = lead.extra_data?.[kind];
  if (input === undefined || input === null || input === '') return null;
  const amount = Number(input);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
export function dealDate(lead: MetricLead): string | null {
  const explicit = lead.extra_data?.won_date;
  return typeof explicit === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(explicit) ? explicit : null;
}
export function monthlyMetrics(leads: MetricLead[], startMonth: string, endMonth: string) {
  const rows: {month:string; leads:number; proposal:number; won:number; projects:number}[] = [];
  const start = new Date(`${startMonth}-01T00:00:00Z`);
  const end = new Date(`${endMonth}-01T00:00:00Z`);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || start > end) return rows;
  while (start <= end && rows.length < 120) {
    rows.push({month:start.toISOString().slice(0,7),leads:0,proposal:0,won:0,projects:0});
    start.setUTCMonth(start.getUTCMonth()+1);
  }
  const byMonth = new Map(rows.map(row=>[row.month,row]));
  for (const lead of leads) {
    const historicalYearOnly=lead.extra_data?.historical_date_precision==='year';
    const entered = historicalYearOnly ? undefined : byMonth.get(lead.date_added.slice(0,7));
    if (entered) entered.leads++;
    const proposedMonth=lead.proposal_date?.slice(0,7) ?? (typeof lead.extra_data?.proposal_month==='number' && typeof lead.extra_data?.proposal_year==='number' ? `${lead.extra_data.proposal_year}-${String(lead.extra_data.proposal_month).padStart(2,'0')}` : '');
    const proposal = byMonth.get(proposedMonth);
    if (proposal) proposal.proposal += confirmedValue(lead,'proposal_value')??0;
    const wonMonth=dealDate(lead)?.slice(0,7) ?? (typeof lead.extra_data?.won_month==='number' && typeof lead.extra_data?.won_year==='number' ? `${lead.extra_data.won_year}-${String(lead.extra_data.won_month).padStart(2,'0')}` : '');
    const won = byMonth.get(wonMonth);
    if (won && isWon(lead)) { won.projects++; won.won += confirmedValue(lead,'won_value')??0; }
  }
  return rows;
}
// A year-only archival record contributes to annual/all-time totals, never an invented month.
export function yearOnlyMetrics(leads: MetricLead[], startYear: string, endYear: string) {
  const total={leads:0,proposal:0,won:0,projects:0};
  for(const lead of leads){
    if(lead.extra_data?.historical_date_precision==='year' && lead.date_added.slice(0,4)>=startYear && lead.date_added.slice(0,4)<=endYear) total.leads++;
    const proposalYear=lead.extra_data?.proposal_year;
    if(lead.extra_data?.proposal_month==null && typeof proposalYear==='number' && String(proposalYear)>=startYear && String(proposalYear)<=endYear) total.proposal+=confirmedValue(lead,'proposal_value')??0;
    const wonYear=lead.extra_data?.won_year;
    if(lead.extra_data?.won_month==null && typeof wonYear==='number' && String(wonYear)>=startYear && String(wonYear)<=endYear && isWon(lead)){
      total.projects++;total.won+=confirmedValue(lead,'won_value')??0;
    }
  }
  return total;
}
