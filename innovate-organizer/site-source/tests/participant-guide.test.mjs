import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('public/ittinerary/index.html','utf8');
function logic(){
 class DCLogic {constructor(){this.state={};}setState(value){this.state={...this.state,...value};}}
 const script=html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
 const Component=vm.runInNewContext(script+'\nComponent',{DCLogic});return new Component({});
}
test('new participant guide replaces both addresses with native, resolvable web resources',()=>{
 assert.equal(readFileSync('public/itinerary/index.html','utf8'),html);
 assert.match(html,/Panduan Peserta · Beasiswa Pertamina 2026/);
 assert.doesNotMatch(html,/Elite Club|__bundler|hz:canvas|data-canvas-width|\$preview/);
 assert.match(html,/name="viewport"/);assert.match(html,/https:\/\/io.campusinnovate.com\/ittinerary/);
 for(const [,path]of html.matchAll(/(?:src|href)="(\/ittinerary\/assets\/[^"?]+)"/g))assert.ok(existsSync('public'+path),path);
 for(const [,id]of html.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes('id="'+id+'"'),id);
 for(const name of ['ittinerary','itinerary'])assert.match(readFileSync(`app/${name}/route.ts`,'utf8'),/public\/ittinerary\/index.html\?raw/);
});
test('room search matches room and participant text, ignores case and returns an empty state',()=>{
 const c=logic();assert.equal(c.renderVals().rooms.length,6);
 c.setState({q:'101'});assert.equal(c.renderVals().rooms.length,2);
 c.renderVals().setQ({target:{value:'  NAMA PESERTA  '}});assert.equal(c.renderVals().rooms.length,6);
 c.setState({q:'nama-yang-tidak-ada'});assert.equal(c.renderVals().rooms.length,0);assert.equal(c.renderVals().empty,true);
});
test('the five confirmed LO contacts preserve name/number pairings without assigning buses',()=>{
 const expected=JSON.parse(readFileSync('public/event-data/pertamina-2026-lo.json','utf8'));
 const los=logic().renderVals().los;assert.equal(los.length,5);
 assert.deepEqual(Array.from(los,l=>({name:l.name,phone:l.phone.replace(/^\+/,''),bus:l.bus})),expected);
 assert.ok(los.every(lo=>lo.has===true&&lo.none===false&&lo.bus===null));
 const contact=readFileSync('public/tracker/kontak.html','utf8');
 for(const lo of expected){assert.ok(contact.includes(lo.name));assert.ok(contact.includes('https://wa.me/'+lo.phone));}
});
