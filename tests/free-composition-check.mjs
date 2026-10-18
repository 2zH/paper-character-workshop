import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { workshop } from './held-rotation-check.mjs';

// Reuse the deterministic DOM host; execute production Binding.layout,
// layoutTable, keyboard, pointer and resize handlers rather than copied formulas.
const require=createRequire(import.meta.url);
const Model=require('../dist/workshop/workshop-model.js');
const plain=value=>JSON.parse(JSON.stringify(value));
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-7,`${message}: ${actual} vs ${expected}`);
const rotate=(x,y,angle)=>{const r=angle*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};

function fixture(){
  const c=Model.createCharacter();
  c.bindingEnabled=true;c.status='draft';c.modules=c.modules.slice(0,2);
  c.modules[0].id='identity';c.modules[1].id='attributes';
  Object.assign(c.modules[0],{mounted:true,cardPose:{x:84,y:117,width:220,angle:9},pose:{x:20,y:20,angle:9,z:3},paperWidth:22});
  Object.assign(c.modules[1],{mounted:false,pose:{x:3,y:125,angle:-2,z:2},paperWidth:19});
  return c;
}
const setup=(initialCurrent=fixture(),extra={})=>workshop({initialCurrent,dynamicDimensions:true,...extra});
const module=t=>t.state.current.modules[0];
const snapshot=t=>plain(module(t));
function transform(t){
  const m=t.papers.identity.style.transform.match(/translate3d\(([-\d.e]+)px,([-\d.e]+)px,0\) rotate\(([-\d.e]+)deg\) scale\(([-\d.e]+)\)/);
  assert.ok(m);const [x,y,angle,scale]=m.slice(1).map(Number);return {x,y,angle,scale,w:t.papers.identity.offsetWidth,h:t.papers.identity.offsetHeight};
}
function point(t,sx,sy){
  const p=transform(t),r=rotate(sx*p.w/2,sy*p.h/2,p.angle);
  return {x:p.x+p.w/2+r.x,y:100+p.y+p.h/2+r.y};
}
function downAt(t,x,y){return t.dispatch('pointerdown',{target:t.content('identity'),clientX:x,clientY:y});}
function beginResize(t,corner){
  const sx=corner.includes('e')?1:-1,sy=corner.includes('s')?1:-1,start=point(t,sx,sy),anchor=point(t,-sx,-sy),before=transform(t),handle=t.resizeHandle('identity',corner);
  t.dispatch('pointerdown',{target:handle,clientX:start.x,clientY:start.y});
  assert.ok(t.state.resizeDrag,'resize handler starts gesture');
  return {sx,sy,start,anchor,before,handle};
}
function grow(t,gesture,factor){
  const {sx,sy,start,before}=gesture,delta=rotate(sx*before.w*(factor-1),sy*before.h*(factor-1),before.angle);
  t.move(start.x+delta.x,start.y+delta.y);
}
let passed=0,failed=0;
function check(name,run){try{run();passed++;console.log(`PASS ${name}`);}catch(error){failed++;console.error(`FAIL ${name}: ${error.message}`);}}

check('render and layout retain arbitrary card-relative position, width and angle',()=>{
  const t=setup(),before=snapshot(t),placed=transform(t);
  for(let n=0;n<8;n++){t.render();t.layout();}
  assert.deepEqual(plain(module(t).cardPose),before.cardPose);
  assert.deepEqual(transform(t),placed);
  assert.notEqual(module(t).cardPose.x,22,'custom placement never snaps to reference identity slot');
});

check('A/D rotates mounted paper without detaching or relocating it',()=>{
  const t=setup(),before=snapshot(t);
  t.key('d');
  assert.equal(module(t).mounted,true);
  assert.equal(module(t).cardPose.angle,12);
  near(module(t).cardPose.x,before.cardPose.x,'x remains');
  near(module(t).cardPose.y,before.cardPose.y,'y remains');
  near(module(t).cardPose.width,before.cardPose.width,'width remains');
  t.render();assert.equal(transform(t).angle,12);
  t.key('z',{metaKey:true});assert.deepEqual(snapshot(t),before);
});

check('dropping a loose piece onto base keeps pointer placement, width and held rotation',()=>{
  const c=fixture();Object.assign(c.modules[0],{mounted:false,cardPose:null,paperWidth:14,pose:{x:4,y:140,angle:7,z:3}});
  const t=setup(c),before=snapshot(t),start=point(t,0,0),width=t.papers.identity.offsetWidth;
  downAt(t,start.x,start.y);t.move(500,500);t.key('d');
  const expected={x:500-width/2,y:500-100-t.papers.identity.offsetHeight/2};
  t.up();
  assert.equal(module(t).mounted,true);
  near(transform(t).x,expected.x,'drop x follows grab');near(transform(t).y,expected.y,'drop y follows grab');
  near(t.papers.identity.offsetWidth,width,'drop retains actual width');
  assert.equal(module(t).cardPose.angle,10);
  assert.equal(t.state.undoStack.length,1);
  const committed=plain(module(t).cardPose);t.render();assert.deepEqual(plain(module(t).cardPose),committed);
  t.key('z',{ctrlKey:true});assert.deepEqual(snapshot(t),before);
});

for(const cancellation of ['Escape','pointercancel'])check(`${cancellation} restores mounted drag position and cardPose`,()=>{
  const t=setup(),before=snapshot(t),start=point(t,0,0);
  downAt(t,start.x,start.y);t.move(start.x+72,start.y+45);t.key('a');
  if(cancellation==='Escape')t.key('Escape');else t.dispatch('pointercancel');
  assert.deepEqual(snapshot(t),before);
  assert.equal(t.state.drag,null);assert.equal(t.state.undoStack.length,0);
  assert.equal(t.papers.identity.hasPointerCapture(1),false);
});

for(const corner of ['nw','ne','sw','se'])check(`${corner} resize holds opposite rotated corner through commit and undo`,()=>{
  const t=setup(),before=snapshot(t),g=beginResize(t,corner);
  grow(t,g,1.23);
  let fixed=point(t,-g.sx,-g.sy);
  near(fixed.x,g.anchor.x,'held opposite corner x');near(fixed.y,g.anchor.y,'held opposite corner y');
  near(t.papers.identity.offsetWidth,g.before.w*1.23,'scaled width');
  t.up();
  fixed=point(t,-g.sx,-g.sy);
  near(fixed.x,g.anchor.x,'committed opposite corner x');near(fixed.y,g.anchor.y,'committed opposite corner y');
  near(module(t).cardPose.width,before.cardPose.width*1.23,'stored canonical width');
  assert.equal(module(t).mounted,true);assert.equal(t.state.undoStack.length,1);
  assert.equal(g.handle.hasPointerCapture(1),false);
  t.key('z',{metaKey:true});assert.deepEqual(snapshot(t),before);
});

for(const cancellation of ['Escape','pointercancel'])check(`${cancellation} restores resized dimensions without adding undo`,()=>{
  const t=setup(),before=snapshot(t),g=beginResize(t,'nw');grow(t,g,1.3);
  if(cancellation==='Escape')t.key('Escape');else t.dispatch('pointercancel');
  assert.deepEqual(snapshot(t),before);assert.equal(t.state.resizeDrag,null);assert.equal(t.state.undoStack.length,0);
  assert.equal(g.handle.hasPointerCapture(1),false);assert.equal(t.body.classList.contains('is-resizing'),false);
});

check('preview and board-width changes preserve canonical composition through persistence',()=>{
  const t=setup(fixture(),{viewportHeight:700}),before=snapshot(t),original=transform(t);
  t.setPreview(true);t.layout();
  assert.ok(t.papers.identity.offsetWidth<original.w,'preview scales card');
  assert.deepEqual(plain(module(t).cardPose),before.cardPose);
  t.persist();
  const saved=Model.normalizeCharacter(plain(t.state.saves.at(-1))).character;
  assert.deepEqual(saved.modules[0].cardPose,before.cardPose);
  const restored=setup(saved);
  near(transform(restored).x,original.x,'restored edit x');near(transform(restored).y,original.y,'restored edit y');
  near(transform(restored).w,original.w,'restored edit width');
  t.setPreview(false);t.board.clientWidth=600;t.layout();
  assert.deepEqual(plain(module(t).cardPose),before.cardPose);
  t.board.clientWidth=1000;t.layout();
  assert.deepEqual(transform(t),original,'return to original viewport restores same composition');
});

check('desk-fit permits drag and resize, then returns to full scale without changing composition',()=>{
  const c=fixture();Object.assign(c.modules[0],{mounted:false,cardPose:null,paperWidth:20,pose:{x:4,y:140,angle:2,z:3}});
  const t=setup(c,{viewportHeight:700});t.body.classList.add('desk-fit');t.layout();
  near(t.state.bindingLayout.frame.width,400,'fit frame uses viewport height');
  const start=point(t,0,0);downAt(t,start.x,start.y);t.move(500,430);t.key('d');t.up();
  assert.equal(module(t).mounted,true,'fit mode remains editable');
  near(t.papers.identity.offsetWidth,200,'fit docking preserves physical width');
  const g=beginResize(t,'se');grow(t,g,1.18);t.up();
  const canonical=plain(module(t).cardPose),fitPlacement=transform(t);
  t.body.classList.remove('desk-fit');t.layout();
  assert.deepEqual(plain(module(t).cardPose),canonical,'return to full size preserves card coordinates');
  near(t.papers.identity.offsetWidth,fitPlacement.w*620/400,'paper scales with card');
  const fullPlacement=transform(t);t.persist();
  const normalized=Model.normalizeCharacter(plain(t.state.saves.at(-1))).character;
  assert.deepEqual(normalized.modules[0].cardPose,canonical);
  const restored=setup(normalized,{viewportHeight:700});
  near(transform(restored).x,fullPlacement.x,'full-scale reload x');near(transform(restored).y,fullPlacement.y,'full-scale reload y');near(transform(restored).w,fullPlacement.w,'full-scale reload width');
  t.body.classList.add('desk-fit');t.layout();
  near(transform(t).x,fitPlacement.x,'fit toggle back x');near(transform(t).y,fitPlacement.y,'fit toggle back y');near(transform(t).w,fitPlacement.w,'fit toggle back width');
});

check('desk-fit large docking and resize retain canonical widths beyond the old 1100 limit',()=>{
  const c=fixture();Object.assign(c.modules[0],{mounted:false,cardPose:null,paperWidth:90,pose:{x:4,y:140,angle:0,z:3}});
  const t=setup(c,{viewportHeight:600});t.body.classList.add('desk-fit');t.layout();
  const start=point(t,0,0);downAt(t,start.x,start.y);t.move(500,400);t.key('a');t.key('d');t.up();
  const g=beginResize(t,'se');grow(t,g,1.02);t.up();
  assert.ok(module(t).cardPose.width>1500,'exercise large fit canonical width');
  const canonical=plain(module(t).cardPose);t.body.classList.remove('desk-fit');t.layout();
  assert.deepEqual(plain(module(t).cardPose),canonical);
  const normalized=Model.normalizeCharacter(plain(t.state.current)).character;
  assert.deepEqual(normalized.modules[0].cardPose,canonical,'large fitted width survives normalization');
  const restored=setup(normalized,{viewportHeight:600});near(transform(restored).w,transform(t).w,'large width survives full-scale reload');
});

check('desk-fit oversized piece can detach, shrink slightly and reload without collapsing its width',()=>{
  const c=fixture();Object.assign(c.modules[0],{mounted:false,cardPose:null,paperWidth:90,pose:{x:4,y:140,angle:0,z:3}});
  const t=setup(c,{viewportHeight:600});t.body.classList.add('desk-fit');t.layout();
  const start=point(t,0,0);downAt(t,start.x,start.y);t.move(500,400);t.key('a');t.key('d');t.up();
  const fitResize=beginResize(t,'se');grow(t,fitResize,1.02);t.up();
  t.body.classList.remove('desk-fit');t.layout();
  const largeWidth=t.papers.identity.offsetWidth;assert.ok(largeWidth>t.board.clientWidth,'exercise oversized full-scale paper');
  t.detach(module(t));t.render();t.persist();
  assert.equal(module(t).mounted,false);near(t.papers.identity.offsetWidth,largeWidth,'detach preserves oversized width');
  const detached=Model.normalizeCharacter(plain(t.state.current)).character;
  near(detached.modules[0].paperWidth,module(t).paperWidth,'normalization retains width over 100 percent');
  const restored=setup(detached,{viewportHeight:600});near(restored.papers.identity.offsetWidth,largeWidth,'detached reload preserves oversized width');
  const smallResize=beginResize(restored,'se');grow(restored,smallResize,.98);restored.up();
  near(restored.papers.identity.offsetWidth,largeWidth*.98,'slight resize changes width by the requested amount');
  assert.ok(restored.papers.identity.offsetWidth>restored.board.clientWidth,'slight resize does not collapse to 95 percent of board');
  const final=Model.normalizeCharacter(plain(restored.state.current)).character;
  const reloaded=setup(final,{viewportHeight:600});near(reloaded.papers.identity.offsetWidth,largeWidth*.98,'resized oversized width survives another reload');
});

check('narrow-board minimum loose width survives docking and model reload',()=>{
  const c=fixture();Object.assign(c.modules[0],{mounted:false,cardPose:null,paperWidth:8,pose:{x:4,y:140,angle:0,z:3}});
  const t=setup(c,{boardWidth:600}),start=point(t,0,0),width=t.papers.identity.offsetWidth;
  downAt(t,start.x,start.y);t.move(300,420);t.key('d');t.up();
  near(t.papers.identity.offsetWidth,width,'docking retains narrow piece');
  const normalized=Model.normalizeCharacter(plain(t.state.current)).character;
  assert.deepEqual(normalized.modules[0].cardPose,plain(module(t).cardPose),'normalization must preserve a legal narrow piece');
  const restored=setup(normalized,{boardWidth:600});near(restored.papers.identity.offsetWidth,width,'reload retains narrow piece');
});

check('large northwest resize stops at tabletop edge and keeps its anchor after model reload',()=>{
  const t=setup(),g=beginResize(t,'nw');grow(t,g,5);t.up();
  const before=plain(module(t).cardPose),normalized=Model.normalizeCharacter(plain(t.state.current)).character;
  assert.ok(transform(t).x>=0&&transform(t).y>=0,'extreme resize stays on tabletop');
  assert.deepEqual(normalized.modules[0].cardPose,before,'normalization must not move a legal resized piece');
  const restored=setup(normalized),fixed=point(restored,1,1);
  near(fixed.x,g.anchor.x,'reloaded fixed corner x');near(fixed.y,g.anchor.y,'reloaded fixed corner y');
});

check('a narrow docked paper can shrink slightly without jumping to a larger minimum',()=>{
  const c=fixture();c.modules[0].cardPose.width=52;
  const t=setup(c,{boardWidth:600}),g=beginResize(t,'se');grow(t,g,.93);
  assert.ok(t.papers.identity.offsetWidth<g.before.w,'shrinking must not enlarge an already valid paper');
  t.up();
  const normalized=Model.normalizeCharacter(plain(t.state.current)).character;
  near(normalized.modules[0].cardPose.width,module(t).cardPose.width,'small resized width persists');
});

check('detaching a valid small mounted piece preserves its loose width through reload',()=>{
  const c=fixture();c.modules[0].cardPose.width=40;
  const t=setup(c),before=t.papers.identity.offsetWidth;
  t.detach(module(t));t.render();t.persist();
  assert.equal(module(t).mounted,false);near(t.papers.identity.offsetWidth,before,'detaching retains width');
  const normalized=Model.normalizeCharacter(plain(t.state.current)).character;
  near(normalized.modules[0].paperWidth,module(t).paperWidth,'small detached width survives normalization');
  const restored=setup(normalized);near(restored.papers.identity.offsetWidth,before,'small detached width survives reload');
});

check('editing paper prevents drag/resize and editable A/D remains text entry',()=>{
  const t=setup(),before=snapshot(t);t.setEditing('identity');
  downAt(t,400,400);assert.equal(t.state.drag,null);
  t.dispatch('pointerdown',{target:t.resizeHandle('identity','se'),clientX:400,clientY:400});
  assert.equal(t.state.resizeDrag,null);
  assert.equal(t.key('a',{target:t.input}).defaultPrevented,false);
  assert.equal(t.key('d',{target:t.input}).defaultPrevented,false);
  assert.deepEqual(snapshot(t),before);
});

console.log(`${passed} free-composition regression checks passed; ${failed} failed.`);
if(failed)process.exitCode=1;
