import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('public/ittinerary/index.html','utf8');
function logic(){class DCLogic{constructor(){this.state={};}setState(v){this.state={...this.state,...v};}}const script=html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];return new(vm.runInNewContext(script+'\nComponent',{DCLogic}))({});}
test('both participant guide addresses serve a native document with working assets and anchors',()=>{
 assert.equal(readFileSync('public/itinerary/index.html','utf8'),html);assert.match(html,/Panduan Peserta · Beasiswa Pertamina 2026/);assert.doesNotMatch(html,/Elite Club|__bundler|hz:canvas|data-canvas-width|\$preview/);assert.match(html,/name="viewport"/);
 for(const [,path]of html.matchAll(/(?:src|href)="(\/(?:ittinerary\/assets|event-ui)\/[^"?]+)"/g))assert.ok(existsSync('public'+path),path);
 for(const [,id]of html.matchAll(/href="#([^"?]+)"/g))assert.ok(html.includes('id="'+id+'"'),id);
});
test('unreceived room names are not fabricated; search works after confirmed data is supplied',()=>{
 const c=logic();assert.equal(c.renderVals().rooms.length,0);assert.equal(c.renderVals().empty,true);
 c.setState({rooms:[{kamar:'101',nama:'Peserta Uji',kampus:'Kampus Uji',jk:'L',bus:'1'},{kamar:'202',nama:'Peserta Dua',kampus:'Contoh',jk:'P',bus:'2'}]});c.setState({q:'101'});assert.equal(c.renderVals().rooms.length,1);
 c.renderVals().setQ({target:{value:'  PESERTA UJI  '}});assert.equal(c.renderVals().rooms.length,1);c.setState({q:'tidak-ada'});assert.equal(c.renderVals().empty,true);
});
test('five confirmed contacts follow the PDF bus assignments and the user-confirmed Patir alias',()=>{
 const expected=JSON.parse(readFileSync('public/event-data/pertamina-2026-lo.json','utf8'));const los=logic().renderVals().los;assert.equal(los.length,5);
 assert.deepEqual(Array.from(los,l=>({name:l.name,phone:l.phone.replace(/^\+/,''),bus:l.bus})),expected.map(l=>({name:l.name,phone:l.phone,bus:l.bus})));
 assert.deepEqual(Array.from(los,l=>l.alias),['Nava','Faiza','Patir','Dicky','Fadhil']);assert.equal(los[2].name,'Muhamad Tirta Fabiansyah');assert.ok(los.every(l=>l.has&&!l.none));
 const contact=readFileSync('public/tracker/kontak.html','utf8');for(const lo of expected){assert.ok(contact.includes(lo.name));assert.ok(contact.includes('https://wa.me/'+lo.phone));}
});
