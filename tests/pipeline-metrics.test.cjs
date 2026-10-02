const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');
const compiled=ts.transpileModule(fs.readFileSync('src/app/ruang-kawan/pipeline/metrics.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exportsObject={};new Function('exports',compiled)(exportsObject);
const {monthlyMetrics,confirmedValue}=exportsObject;
const lead={date_added:'2026-01-10',proposal_date:'2026-03-10',won_at:'2026-05-10T10:00:00Z',stage:'Won',proposal_value:100,won_value:80,extra_data:{proposal_value:100,won_value:80,won_date:'2026-05-10'}};
test('events fall into separate months, including older leads that close inside the selected period',()=>{
 const rows=monthlyMetrics([lead],'2026-03','2026-05');assert.equal(rows.length,3);assert.deepEqual(rows[0],{month:'2026-03',leads:0,proposal:100,won:0,projects:0});assert.equal(rows[1].won,0);assert.equal(rows[2].won,80);assert.equal(rows[2].projects,1);
});
test('GM backfill and missing event dates do not become revenue or artificial monthly events',()=>{
 const old={...lead,extra_data:{}};assert.equal(confirmedValue(old,'proposal_value'),null);
 assert.equal(monthlyMetrics([old],'2026-01','2026-12').reduce((n,r)=>n+r.won+r.proposal,0),0);
 assert.equal(monthlyMetrics([{...lead,proposal_date:null}],'2026-01','2026-12').reduce((n,r)=>n+r.proposal,0),0);
});
test('reopened deals excluded; zero values retained; invalid periods empty',()=>{
 assert.equal(monthlyMetrics([{...lead,stage:'Negotiation'}],'2026-05','2026-05')[0].won,0);
 assert.equal(confirmedValue({...lead,extra_data:{won_value:0}},'won_value'),0);
 assert.deepEqual(monthlyMetrics([lead],'2026-05','2026-01'),[]);
});
