import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { workshop } from './held-rotation-check.mjs';
const require=createRequire(import.meta.url),M=require('../dist/workshop/workshop-model.js');
const plain=value=>JSON.parse(JSON.stringify(value));
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-7,`${message}: ${a} vs ${b}`);
const rotate=(x,y,angle)=>{const r=angle*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
function fixture({grouped=true,binding=false,angles=[4,-2]}={}){
  const c=M.createCharacter();c.bindingEnabled=binding;c.modules=c.modules.filter(owner=>['attributes','equipment'].includes(owner.type));
  c.modules.forEach((owner,i)=>{
    const kind=i?'equipment':'attribute',part=M.createPart(kind,owner.data.items[0].id);
    Object.assign(part,{id:`p${i}`,groupId:grouped?'shared-group':null,paperWidth:i?9:7,pose:{x:i?35:20,y:i?28:25,angle:angles[i],z:i?3:8}});owner.parts=[part];
  });return c;
}
const setup=(options={})=>workshop({initialCurrent:fixture(options),dynamicDimensions:true,actualCommands:true,viewportHeight:720});
function box(t,id){const node=t.papers[id],m=node.style.transform.match(/translate3d\(([-\d.e]+)px,([-\d.e]+)px,0\) rotate\(([-\d.e]+)deg\) scale\(([-\d.e]+)\)/);assert.ok(m);const [x,y,angle,scale]=m.slice(1).map(Number);return {x,y,angle,scale,w:node.offsetWidth,h:node.offsetHeight};}
const center=b=>({x:b.x+b.w/2,y:b.y+b.h/2});
function down(t,id='p0',offset={x:0,y:0}){const b=box(t,id),p=center(b),r=rotate(offset.x,offset.y,b.angle);t.dispatch('pointerdown',{target:t.content(id),clientX:p.x+r.x,clientY:100+p.y+r.y});return {x:p.x+r.x,y:100+p.y+r.y};}
function selectGroup(t){t.choose('p0');assert.equal(t.selection().length,2);}
function pair(t){const a=box(t,'p0'),b=box(t,'p1'),ca=center(a),cb=center(b);return {a,b,dx:cb.x-ca.x,dy:cb.y-ca.y};}
function sameGeometry(actual,before,delta=0,scale=1){const expected=rotate(before.dx*scale,before.dy*scale,delta);near(actual.dx,expected.x,'relative center x');near(actual.dy,expected.y,'relative center y');for(const key of ['a','b']){near(actual[key].w,before[key].w*scale,'member width');near(actual[key].h,before[key].h*scale,'member height');near(actual[key].angle,before[key].angle+delta,'common rotation');}}
function mount(t,id){const p=t.paperById(id),b=box(t,id);p.mounted=true;t.rememberCardPlacement(p,b.x,b.y,b.w,b.angle);t.render();}
function resize(t,corner,factor){const items=t.capture(),bounds=t.bounds(items),sx=corner.includes('e')?1:-1,sy=corner.includes('s')?1:-1,handle=t.resizeHandle(t.state.selectedId,corner);handle.dataset.groupResize='true';const originalClosest=handle.closest.bind(handle);handle.closest=selector=>selector==='[data-group-resize]'?handle:selector==='.paper-piece'?null:originalClosest(selector);const start={x:bounds.x+(sx>0?bounds.w:0),y:100+bounds.y+(sy>0?bounds.h:0)};t.dispatch('pointerdown',{target:handle,clientX:start.x,clientY:start.y});assert.ok(t.state.resizeDrag?.groupBox,'group frame starts resize');t.move(start.x+sx*bounds.w*(factor-1),start.y+sy*bounds.h*(factor-1));return {bounds,handle,sx,sy};}
let passed=0,failed=0;
function check(name,run){try{run();passed++;console.log(`PASS ${name}`);}catch(error){failed++;console.error(`FAIL ${name}: ${error.stack}`);}}

check('real Shift pointer selection toggles whole groups and G/Shift+G undo atomically',()=>{
  const t=setup({grouped:false});t.key('Escape');
  for(const id of ['p0','p1']){t.dispatch('pointerdown',{target:t.content(id),shiftKey:true});assert.equal(t.state.drag,null);}
  assert.equal(t.selection().length,2);const before=plain(t.state.current);t.key('g');
  const group=t.paperById('p0').groupId;assert.ok(group);assert.equal(t.paperById('p1').groupId,group);assert.equal(t.state.undoStack.length,1);
  t.dispatch('pointerdown',{target:t.content('p1'),shiftKey:true});assert.equal(t.state.selectionVisible,false);assert.equal(t.state.selectedIds.size,0);
  t.dispatch('pointerdown',{target:t.content('p0'),shiftKey:true});assert.equal(t.selection().length,2);
  t.key('g',{shiftKey:true});assert.equal(t.paperById('p0').groupId,null);assert.equal(t.paperById('p1').groupId,null);
  t.key('z',{metaKey:true});assert.equal(t.paperById('p0').groupId,group);t.key('z',{metaKey:true});assert.deepEqual(plain(t.state.current),before);
});

check('group drag preserves all member geometry and layer order with one undo',()=>{
  const t=setup(),before=plain(t.state.current),geometry=pair(t),start=down(t,'p1');
  t.move(start.x+55,start.y+30);t.frames(5);assert.equal(t.state.drag.members.length,2);t.up();sameGeometry(pair(t),geometry);
  assert.ok(t.paperById('p0').pose.z>t.paperById('p1').pose.z);assert.equal(t.state.undoStack.length,1);
  t.key('z',{metaKey:true});assert.deepEqual(plain(t.state.current),before);
});

check('held group rotates before movement with fixed grip and a common angle limit',()=>{
  const t=setup({angles:[14,-5]}),before=pair(t),start=down(t,'p1',{x:10,y:-5});
  t.key('d',{target:t.input});assert.equal(t.state.drag.started,true);assert.equal(t.state.drag.baseAngle,-4);
  const held=box(t,'p1'),grip=rotate(t.state.drag.grip.x*held.scale,t.state.drag.grip.y*held.scale,held.angle),c=center(held);
  near(c.x+grip.x,start.x,'held grip x');near(100+c.y+grip.y,start.y,'held grip y');
  for(let i=0;i<6;i++)t.key('d');t.up();sameGeometry(pair(t),before,1);assert.equal(t.paperById('p0').pose.angle,15);
  assert.equal(t.papers.p1.hasPointerCapture(1),false);assert.equal(t.state.undoStack.length,1);
});

for(const cancellation of ['Escape','pointercancel'])check(`group drag ${cancellation} restores every member without undo`,()=>{
  const t=setup(),before=plain(t.state.current),start=down(t);t.move(start.x+65,start.y+25);t.key('a');
  if(cancellation==='Escape')t.key('Escape');else t.dispatch('pointercancel');
  assert.deepEqual(plain(t.state.current),before);assert.equal(t.state.drag,null);assert.equal(t.state.undoStack.length,0);
  assert.equal(t.papers.p0.hasPointerCapture(1),false);
});

check('mixed mounted and loose drag docks all then survives fit/full/reload without distortion',()=>{
  const t=setup({binding:true});mount(t,'p0');const before=pair(t),start=down(t);t.move(430,480);t.up();
  assert.ok(t.allPapers().every(p=>p.mounted));sameGeometry(pair(t),before);const canonical=plain(t.allPapers().map(p=>p.cardPose)),full=pair(t);
  t.body.classList.add('desk-fit');t.render();t.body.classList.remove('desk-fit');t.render();sameGeometry(pair(t),full);
  assert.deepEqual(plain(t.allPapers().map(p=>p.cardPose)),canonical);
  const reload=workshop({initialCurrent:M.normalizeCharacter(plain(t.state.current)).character,dynamicDimensions:true,actualCommands:true});sameGeometry(pair(reload),full);
  const moveStart=down(t);t.move(150,1100);t.up();assert.ok(t.allPapers().every(p=>!p.mounted));sameGeometry(pair(t),full);
});

for(const corner of ['nw','ne','sw','se'])check(`${corner} group resize keeps common scale/opposite anchor and undo`,()=>{
  const t=setup();selectGroup(t);const before=plain(t.state.current),geometry=pair(t),g=resize(t,corner,1.2),fixed={x:g.bounds.x+(g.sx>0?0:g.bounds.w),y:g.bounds.y+(g.sy>0?0:g.bounds.h)};
  const held=t.state.resizeDrag.position;near(held.x+(g.sx>0?0:held.w),fixed.x,'held opposite x');near(held.y+(g.sy>0?0:held.h),fixed.y,'held opposite y');
  t.up();sameGeometry(pair(t),geometry,0,1.2);const after=t.bounds(t.capture());near(after.x+(g.sx>0?0:after.w),fixed.x,'saved opposite x');near(after.y+(g.sy>0?0:after.h),fixed.y,'saved opposite y');
  assert.equal(t.state.undoStack.length,1);t.key('z',{ctrlKey:true});assert.deepEqual(plain(t.state.current),before);
});

for(const cancellation of ['Escape','pointercancel'])check(`group resize ${cancellation} restores all size/placement records`,()=>{
  const t=setup();selectGroup(t);const before=plain(t.state.current);resize(t,'se',.7);
  if(cancellation==='Escape')t.key('Escape');else t.dispatch('pointercancel');assert.deepEqual(plain(t.state.current),before);assert.equal(t.state.undoStack.length,0);
});

check('group duplication creates independent rows/new group and preserves relative geometry',()=>{
  const t=setup();selectGroup(t);const before=plain(t.state.current),items=t.capture(),geometry=pair(t);t.key('d',{metaKey:true});
  const copies=t.selection();assert.equal(copies.length,2);assert.ok(copies.every(p=>p.groupId===copies[0].groupId));assert.notEqual(copies[0].groupId,'shared-group');
  copies.forEach((copy,i)=>{const original=items.find(item=>item.module.type===copy.type);assert.notEqual(copy.rowId,original.module.rowId);near(box(t,copy.id).w,original.w,'copy width');near(copy.pose.angle,original.angle,'copy angle');});
  const centers=copies.map(p=>center(box(t,p.id)));near(centers[1].x-centers[0].x,geometry.dx,'copied relative x');near(centers[1].y-centers[0].y,geometry.dy,'copied relative y');assert.ok(copies[0].pose.z>copies[1].pose.z,'copied layer order remains');
  assert.equal(t.state.undoStack.length,1);t.key('z',{metaKey:true});assert.deepEqual(plain(t.state.current),before);
});

for(const limited of ['rows','parts'])check(`group duplicate preflights aggregated ${limited} limits and changes nothing`,()=>{
  const t=setup();selectGroup(t);const owner=t.state.current.modules[1];
  if(limited==='rows')while(owner.data.items.length<80)owner.data.items.push({...owner.data.items[0],id:M.uid('row')});
  else while(owner.parts.length<240)owner.parts.push({...plain(owner.parts[0]),id:M.uid('part'),groupId:null,hidden:true});
  const before=plain(t.state.current);t.key('d',{ctrlKey:true});assert.deepEqual(plain(t.state.current),before);assert.equal(t.state.undoStack.length,0);
});

for(const limited of ['rows','parts'])check(`two members sharing an owner cannot partially exceed its ${limited} limit`,()=>{
  const c=fixture();c.modules=c.modules.slice(1);const owner=c.modules[0],second=M.createPart('equipment',owner.data.items[1].id);
  Object.assign(second,{id:'p2',groupId:'shared-group',paperWidth:8,pose:{x:48,y:30,angle:3,z:7}});owner.parts.push(second);
  if(limited==='rows')while(owner.data.items.length<79)owner.data.items.push({...owner.data.items[0],id:M.uid('row')});
  else while(owner.parts.length<239)owner.parts.push({...plain(owner.parts[0]),id:M.uid('part'),groupId:null,hidden:true});
  const t=workshop({initialCurrent:c,dynamicDimensions:true,actualCommands:true});t.choose('p1');assert.equal(t.selection().length,2);
  const before=plain(t.state.current);t.key('d',{metaKey:true});assert.deepEqual(plain(t.state.current),before);assert.equal(t.state.undoStack.length,0);
});

check('small group members shrink uniformly to the common minimum without enlarging',()=>{
  const t=setup();selectGroup(t);const before=pair(t);resize(t,'se',.1);t.up();
  const factor=12/Math.min(before.a.w,before.b.w);sameGeometry(pair(t),before,0,factor);
  const normalized=M.normalizeCharacter(plain(t.state.current)).character,reload=workshop({initialCurrent:normalized,dynamicDimensions:true,actualCommands:true});sameGeometry(pair(reload),pair(t));
});

check('group growth stops at tabletop edge while retaining its opposite anchor',()=>{
  const t=setup();selectGroup(t);const before=pair(t),g=resize(t,'nw',4),held=t.state.resizeDrag.position;
  assert.ok(held.x>=-1e-7&&held.y>=-1e-7,'held box remains on tabletop');assert.ok(held.x+held.w<=1000+1e-7);
  near(held.x+held.w,g.bounds.x+g.bounds.w,'fixed right');near(held.y+held.h,g.bounds.y+g.bounds.h,'fixed bottom');
  const factor=held.w/g.bounds.w;t.up();sameGeometry(pair(t),before,0,factor);
});

check('group detach, hide, restore and undo preserve data, membership and relative placement',()=>{
  const t=setup({binding:true});mount(t,'p0');mount(t,'p1');selectGroup(t);const before=plain(t.state.current),geometry=pair(t),data=plain(t.state.current.modules.map(m=>m.data));
  t.key('Delete');assert.ok(t.allPapers().every(p=>!p.mounted));sameGeometry(pair(t),geometry);
  t.key('Delete');assert.equal(t.allPapers().length,0);assert.deepEqual(plain(t.state.current.modules.map(m=>m.data)),data);
  t.restore('p1');assert.equal(t.allPapers().length,2);assert.equal(t.selection().length,2);sameGeometry(pair(t),geometry);
  for(let i=0;i<3;i++)t.key('z',{metaKey:true});assert.deepEqual(plain(t.state.current),before);
});

check('inline typing and direct single-paper editing remain protected in a group',()=>{
  const t=setup();selectGroup(t);t.choose('p0',{edit:true});assert.equal(t.state.editingId,'p0');
  const before=plain(t.state.current);for(const [key,extra] of [['g',{}],['g',{shiftKey:true}],['a',{}],['d',{}],['d',{metaKey:true}]])assert.equal(t.key(key,{target:t.input,...extra}).defaultPrevented,false);
  assert.deepEqual(plain(t.state.current),before);assert.equal(t.state.undoStack.length,0);
});

check('mixed group creation stays rigid across fit/full views',()=>{
  const t=setup({binding:true,grouped:false});mount(t,'p0');t.choose('p0');t.choose('p1',{additive:true});t.key('g');
  const before=pair(t),oldFrame=t.state.bindingLayout.frame.width;t.body.classList.add('desk-fit');t.render();
  const scale=t.state.bindingLayout.frame.width/oldFrame;assert.ok(scale<1);sameGeometry(pair(t),before,0,scale);
});

check('resting group rotation at tabletop edge remains rigid',()=>{
  const c=fixture({angles:[0,0]});c.modules[0].parts[0].pose={x:0,y:20,angle:0,z:1};c.modules[1].parts[0].pose={x:0,y:50,angle:0,z:2};
  const t=workshop({initialCurrent:c,dynamicDimensions:true,actualCommands:true});selectGroup(t);const before=pair(t);t.key('d');sameGeometry(pair(t),before,3);
});

check('Cmd/Ctrl+G does not alter selected papers',()=>{
  for(const modifier of ['metaKey','ctrlKey']){const t=setup({grouped:false});t.choose('p0');t.choose('p1',{additive:true});const before=plain(t.state.current);assert.equal(t.key('g',{[modifier]:true}).defaultPrevented,false);assert.deepEqual(plain(t.state.current),before);}
});

check('undoing ungroup restores whole-group selection and the next drag',()=>{
  const t=setup();selectGroup(t);t.key('g',{shiftKey:true});t.key('z',{metaKey:true});
  assert.equal(t.selection().length,2,'restored group selects every member');
  const before=pair(t),start=down(t);t.move(start.x+35,start.y+20);assert.equal(t.state.drag.members.length,2);t.up();sameGeometry(pair(t),before);
});

check('tidy treats grouped papers as one rigid unit and one undo restores all layout',()=>{
  const t=setup(),extra=M.createPart('hp');Object.assign(extra,{id:'loose-extra',paperWidth:8,pose:{x:62,y:15,angle:8,z:11}});t.state.current.modules[0].parts.push(extra);t.render();
  const before=plain(t.state.current),geometry=pair(t),layers=t.allPapers().map(p=>p.pose.z);t.tidy();
  sameGeometry(pair(t),geometry);assert.equal(t.paperById('loose-extra').pose.angle,0,'single papers are straightened');
  assert.deepEqual(t.allPapers().map(p=>p.pose.z),layers);assert.ok(Math.abs(box(t,'p0').x-geometry.a.x)>1,'group was repositioned');
  assert.equal(t.state.undoStack.length,1);t.key('z',{metaKey:true});assert.deepEqual(plain(t.state.current),before);
});

check('opening the base parks a group intact with a reversible binding change',()=>{
  const t=setup(),before=plain(t.state.current),geometry=pair(t);t.openBase();
  assert.equal(t.state.current.bindingEnabled,true);assert.ok(t.allPapers().every(p=>!p.mounted));sameGeometry(pair(t),geometry);
  assert.ok(box(t,'p0').y>=t.state.bindingLayout.frame.y+t.state.bindingLayout.frame.height);
  assert.equal(t.state.undoStack.length,1);t.key('z',{metaKey:true});assert.deepEqual(plain(t.state.current),before);
});

check('detach all preserves mixed paper units and their owner data with one undo',()=>{
  const t=setup({binding:true});mount(t,'p0');mount(t,'p1');
  const hidden=M.createPart('hp');Object.assign(hidden,{id:'hidden-extra',groupId:'shared-group',hidden:true});t.state.current.modules[0].parts.push(hidden);
  const before=plain(t.state.current),geometry=pair(t);t.detachAll();assert.ok(t.allPapers().every(p=>!p.mounted));sameGeometry(pair(t),geometry);
  assert.deepEqual(plain(t.state.current.modules.map(m=>m.data)),before.modules.map(m=>m.data));assert.deepEqual(plain(t.state.current.modules[0].parts.at(-1)),plain(hidden));
  assert.equal(t.state.undoStack.length,1);t.key('z',{ctrlKey:true});assert.deepEqual(plain(t.state.current),before);
});

check('reference assembly translates a cross-owner group without resizing or changing membership',()=>{
  const t=setup(),hidden=M.createPart('hp');Object.assign(hidden,{id:'hidden-extra',groupId:'shared-group',hidden:true});t.state.current.modules[0].parts.push(hidden);
  const before=plain(t.state.current),geometry=pair(t),ids=t.allPapers().map(p=>p.id);t.assemble();
  assert.ok(t.allPapers().every(p=>p.mounted));sameGeometry(pair(t),geometry);assert.deepEqual(t.allPapers().map(p=>p.id),ids);assert.ok(t.allPapers().every(p=>p.groupId==='shared-group'));
  assert.ok(t.paperById('p0').pose.z>t.paperById('p1').pose.z);assert.deepEqual(plain(t.state.current.modules.map(m=>m.data)),before.modules.map(m=>m.data));
  assert.deepEqual(plain(t.state.current.modules[0].parts.at(-1)),plain(hidden));
  const normalized=M.normalizeCharacter(plain(t.state.current)).character,reload=workshop({initialCurrent:normalized,dynamicDimensions:true,actualCommands:true});sameGeometry(pair(reload),pair(t));
  assert.equal(t.state.undoStack.length,1);t.key('z',{metaKey:true});assert.deepEqual(plain(t.state.current),before);
});

console.log(`${passed} group-composition regression checks passed; ${failed} failed.`);
if(failed)process.exitCode=1;
