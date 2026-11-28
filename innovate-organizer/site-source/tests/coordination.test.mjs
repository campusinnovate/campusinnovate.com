import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const data=JSON.parse(readFileSync('public/event-data/pertamina-2026-coordination.json','utf8'));
function tracker(){class DCLogic{constructor(){this.state={};}setState(v){this.state={...this.state,...v};}}const html=readFileSync('public/tracker/rundown.html','utf8'),script=html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];return new(vm.runInNewContext(script+'\nComponent',{DCLogic,localStorage:{getItem:()=>null,setItem:()=>{}},document:{getElementById:()=>null}}))({});}
test('bus, room and group allocations reconcile to confirmed participant totals',()=>{
 assert.equal(data.buses.length,5);assert.equal(data.buses.reduce((s,b)=>s+b.total,0),295);assert.equal(data.buses.reduce((s,b)=>s+b.female,0),153);assert.equal(data.buses.reduce((s,b)=>s+b.male,0),142);
 assert.equal(data.rooms.reduce((s,r)=>s+r[1],0),87);assert.equal(data.rooms.reduce((s,r)=>s+r[2],0),310);assert.equal(data.groups.length,15);assert.equal(data.groups.reduce((s,g)=>s+g.count,0),295);
 assert.equal(Object.values(data.confirmations).flat().length,32);
});
test('rundown includes all three days, the afternoon sessions and unconfirmed final timings',()=>{
 const c=tracker();assert.equal(c.state.days.length,3);assert.equal(c.state.days[0].items.length,13);assert.equal(c.state.days[0].start,'08:00');
 c.renderVals().days[1].pick();let view=c.renderVals();assert.equal(view.start,'05:00');assert.ok(view.rundown.some(r=>r.title.startsWith('Role play')&&r.from==='14.00'));assert.ok(view.rundown.some(r=>r.title.includes('Desa Energi')&&r.from==='15.00'));assert.equal(view.endTime,'TBC');
 view.days[2].pick();view=c.renderVals();assert.equal(view.fixedDay,true);assert.equal(view.rundown[0].timeLabel,'06.00');assert.match(view.dayNote,/menunggu PF/);assert.equal(view.rundown[1].timeLabel,'06.30 – 08.55');assert.ok(view.rundown[1].pic.includes('08.25'));
});
test('guide excludes crew-only briefing and each portal gets the compact keyboard-accessible menu',()=>{
 const guide=readFileSync('public/ittinerary/index.html','utf8');assert.ok(!guide.includes('Briefing crew &amp; cek armada'));assert.ok(guide.includes('05.30'));assert.ok(guide.includes('kemeja putih')||guide.includes('Kemeja putih'));
 for(const file of ['public/ittinerary/index.html',...['index','rundown','panitia','peserta','logistik','kontak'].map(n=>'public/tracker/'+n+'.html')]){
  const html=readFileSync(file,'utf8');assert.ok(html.includes('class="portal-menu"'));assert.ok(html.includes('/event-ui/navigation.js'));assert.ok(html.indexOf('class="portal-topbar"')<html.indexOf('<section'));assert.ok(!/9 (?:big )?bus/.test(html));
 }
});
