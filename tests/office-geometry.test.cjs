const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');
function load(file){const ctx={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);return ctx.exports;}
const {pdfPlacement}=load('src/lib/office/geometry.ts');const {validPlacement}=load('src/lib/office/types.ts');
test('signature geometry matches screen coordinates on all PDF rotations',()=>{
 const p={x:.15,y:.23,width:.3,height:.1},W=595,H=842;
 for(const r of [0,90,180,270]){
  const d=pdfPlacement(p,W,H,r),rad=d.rotate*Math.PI/180;
  const points=[[0,0],[d.width,0],[0,d.height],[d.width,d.height]].map(([x,y])=>[d.x+x*Math.cos(rad)-y*Math.sin(rad),d.y+x*Math.sin(rad)+y*Math.cos(rad)]).map(([x,y])=>r===0?[x,H-y]:r===90?[y,x]:r===180?[W-x,y]:[H-y,W-x]);
  const dw=r%180?H:W,dh=r%180?W:H;
  assert.ok(Math.abs(Math.min(...points.map(p=>p[0]))/dw-p.x)<1e-10);
  assert.ok(Math.abs(Math.min(...points.map(p=>p[1]))/dh-p.y)<1e-10);
  assert.ok(Math.abs((Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])))/dw-p.width)<1e-10);
 }
});
test('placement rejects outside pages, negative coordinates and invalid dimensions',()=>{
 const p={membership_id:'a',page:1,x:.1,y:.2,width:.3,height:.1};assert.equal(validPlacement(p,2),true);
 for(const patch of [{page:0},{page:3},{page:1.5},{x:-.1},{width:0},{height:NaN},{y:.99}])assert.equal(validPlacement({...p,...patch},2),false);
 assert.equal(validPlacement({...p,page:2,y:.9},2),true);
});
