import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const names=['index','rundown','panitia','peserta','logistik','kontak'];
const read=name=>readFileSync(`public/tracker/${name}.html`,'utf8');
function instantiate(name, data=new Map(), blocked=false){
 const html=read(name), js=html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
 const notice={textContent:''};
 class DCLogic { constructor(){this.state={};} setState(value, callback){this.state={...this.state,...(typeof value==='function'?value(this.state):value)};callback?.();} }
 const context=vm.createContext({DCLogic,localStorage:{getItem:key=>data.get(key),setItem:(key,val)=>{if(blocked)throw Error('blocked');data.set(key,val);}},document:{getElementById:()=>notice}});
 const C=vm.runInContext(js+'\nComponent',context);const c=new C({});c.componentDidMount?.();return {c,data,notice};
}
test('tracker pages use normal native documents, local assets and valid portal routes',()=>{
 for(const name of names){const html=read(name);
  assert.match(html,/name="viewport"/);assert.match(html,/noindex, nofollow/);
  assert.doesNotMatch(html,/__bundler|<iframe|\.dc\.html|\$preview|<h2>Beranda/);
  for(const [,src]of html.matchAll(/(?:src|href)="(\/tracker\/assets\/[^"?]+)"/g))assert.ok(existsSync('public'+src),src);
  for(const [,url]of html.matchAll(/href="(\/tracker(?:\/[a-z]+)?)"/g)){assert.ok(url==='/tracker'||names.includes(url.split('/').pop()),url);}
 }
});
test('preparation progress updates, survives reload and keeps task IDs unique',()=>{
 const {c,data}=instantiate('index');let view=c.renderVals();const initial=view.doneCount;view.phases.flatMap(p=>p.items).find(item=>!item.done).toggle();assert.equal(c.renderVals().doneCount,initial+1);
 c.setState({newPhase:'Tahap tambahan',newWhen:'H+1'});c.renderVals().addPhase();
 const restored=instantiate('index',data).c;assert.equal(restored.renderVals().doneCount,initial+1);assert.ok(restored.state.phases.some(x=>x.name==='Tahap tambahan'));
 restored.setState({newPhase:'Tahap berikutnya'});restored.renderVals().addPhase();assert.equal(new Set(restored.state.phases.map(x=>x.id)).size,restored.state.phases.length);
});
test('rundown edits recalculate times, reorder rows and remain isolated from other pages',()=>{
 const {c,data}=instantiate('rundown');c.renderVals().rundown[0].setDur({target:{value:'30'}});assert.equal(c.renderVals().rundown[0].to,'08.30');
 const first=c.state.days[0].items[0].id;c.renderVals().rundown[0].down();assert.equal(c.state.days[0].items[1].id,first);
 const restored=instantiate('rundown',data).c;assert.equal(restored.state.days[0].items[1].dur,30);
 assert.equal(instantiate('index',data).c.renderVals().doneCount,instantiate('index').c.renderVals().doneCount);
});
test('participants can be added and filtered; blocked storage keeps the interface usable',()=>{
 const {c}=instantiate('peserta');const before=c.state.peserta.length;c.setState({nNama:'Peserta Uji',nKamar:'A-103',nKampus:'Kampus Uji',nJk:'P'});c.renderVals().addPeserta();assert.equal(c.state.peserta.length,before+1);c.renderVals().filters[2].pick();assert.ok(c.renderVals().peserta.every(p=>p.jk==='P'));
 const blocked=instantiate('panitia',new Map(),true);blocked.c.renderVals().bring[0].toggle();assert.equal(blocked.c.renderVals().bringOk,1);assert.match(blocked.notice.textContent,/Penyimpanan browser tidak tersedia/);
});
test('contact form builds the official WhatsApp link with selected topic and encoded message',()=>{
 const {c}=instantiate('kontak');c.setState({name:'Fauzan',msg:'Cek bus & kamar',topic:'Bus'});const href=c.renderVals().waHref;assert.match(href,/^https:\/\/wa.me\/6285882514394\?text=/);assert.match(decodeURIComponent(href),/Fauzan.*Pertamina Foundation/);assert.ok(decodeURIComponent(href).includes('Cek bus & kamar'));
});
