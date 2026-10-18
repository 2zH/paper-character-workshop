import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { workshop } from './held-rotation-check.mjs';
const require=createRequire(import.meta.url),M=require('../dist/workshop/workshop-model.js');
const plain=value=>JSON.parse(JSON.stringify(value));
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-7,`${message}: ${a} vs ${b}`);
const rotate=(x,y,angle)=>{const r=angle*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
function fixture(type='attributes'){
  const c=M.createCharacter();c.bindingEnabled=true;c.modules=c.modules.filter(owner=>owner.type===type);
  const owner=c.modules[0];owner.id='owner-'+type;owner.mounted=true;
  owner.cardPose={x:180,y:150,width:type==='equipment'?180:type==='attributes'?205:300,angle:7};
  owner.pose={x:20,y:20,angle:7,z:3};return c;
}
function setup(type='attributes',initialCurrent=fixture(type)){
  const t=workshop({initialCurrent,dynamicDimensions:true,actualCommands:true});t.split();
  t.select(t.allPapers()[0]?.id);return t;
}
const owner=t=>t.state.current.modules[0];
const record=(t,id)=>owner(t).parts.find(part=>part.id===id);
const find=(t,kind)=>t.allPapers().find(paper=>paper.kind===kind);
function box(t,id){const node=t.papers[id],m=node.style.transform.match(/translate3d\(([-\d.e]+)px,([-\d.e]+)px,0\) rotate\(([-\d.e]+)deg\) scale\(([-\d.e]+)\)/);assert.ok(m);const [x,y,angle,scale]=m.slice(1).map(Number);return {x,y,angle,scale,w:node.offsetWidth,h:node.offsetHeight};}
function point(t,id,sx=0,sy=0){const b=box(t,id),r=rotate(sx*b.w/2,sy*b.h/2,b.angle);return {x:b.x+b.w/2+r.x,y:100+b.y+b.h/2+r.y};}
function down(t,id){const p=point(t,id);t.dispatch('pointerdown',{target:t.content(id),clientX:p.x,clientY:p.y});return p;}
function resize(t,id,corner,factor){
  t.select(id);const sx=corner.includes('e')?1:-1,sy=corner.includes('s')?1:-1,start=point(t,id,sx,sy),anchor=point(t,id,-sx,-sy),before=box(t,id),handle=t.resizeHandle(id,corner);
  t.dispatch('pointerdown',{target:handle,clientX:start.x,clientY:start.y});
  const delta=rotate(sx*before.w*(factor-1),sy*before.h*(factor-1),before.angle);
  t.move(start.x+delta.x,start.y+delta.y);return {anchor,sx,sy,before,handle};
}
let passed=0,failed=0;
function check(name,run){try{run();passed++;console.log(`PASS ${name}`);}catch(error){failed++;console.error(`FAIL ${name}: ${error.message}`);}}

check('legacy migration preserves data and each rotated local rectangle',()=>{
  const c=fixture(),t=workshop({initialCurrent:c,dynamicDimensions:true,actualCommands:true}),parent=box(t,c.modules[0].id),before=plain(owner(t).data);
  const specs=t.partsAPI.splitRects(owner(t),{primary:true}),scale=parent.w/205;
  assert.equal(t.split(),true);assert.equal(owner(t).parts.length,9);
  assert.deepEqual(plain(owner(t).data),before);
  owner(t).parts.forEach((part,index)=>{
    const spec=specs[index],local=rotate((spec.x+spec.w/2)*scale-parent.w/2,(spec.y+spec.h/2)*scale-parent.h/2,parent.angle),actual=box(t,part.id);
    near(actual.x+actual.w/2,parent.x+parent.w/2+local.x,'split center x');near(actual.y+actual.h/2,parent.y+parent.h/2+local.y,'split center y');
    near(actual.w,spec.w*scale,'split width');near(actual.h,spec.h*scale,'split height');assert.equal(actual.angle,parent.angle);
  });
  const once=plain(owner(t).parts);assert.equal(t.split(),false);t.render();assert.deepEqual(plain(owner(t).parts),once);
});

check('small mounted and loose legacy groups split without growing on reload',()=>{
  for(const mounted of [true,false]){
    const c=fixture('equipment');Object.assign(c.modules[0],{mounted,cardPose:mounted?{x:100,y:150,width:40,angle:0}:null,paperWidth:mounted?null:1,pose:{x:20,y:20,angle:0,z:3}});
    const t=setup('equipment',c),before=plain(owner(t).parts),normalized=M.normalizeCharacter(plain(t.state.current)).character;
    normalized.modules[0].parts.forEach((part,i)=>{if(mounted)near(part.cardPose.width,before[i].cardPose.width,'tiny card width persists');near(part.paperWidth,before[i].paperWidth,'tiny loose width persists');});
    const restored=setup('equipment',normalized);owner(t).parts.forEach(part=>near(box(restored,part.id).w,box(t,part.id).w,'split width survives reload'));
  }
});

check('moving and held A/D rotate only one atomic paper and undo restores its record',()=>{
  const t=setup(),paper=find(t,'attribute'),id=paper.id,before=plain(t.state.current),others=plain(owner(t).parts.filter(p=>p.id!==id));
  t.select(id);const start=down(t,id);t.move(start.x+45,start.y+28);t.key('d');t.up();
  assert.equal(record(t,id).cardPose.angle,10);assert.equal(record(t,id).mounted,true);
  assert.deepEqual(plain(owner(t).parts.filter(p=>p.id!==id)),others);assert.deepEqual(plain(owner(t).data),before.modules[0].data);
  assert.equal(t.state.undoStack.length,1);t.key('z',{metaKey:true});assert.deepEqual(plain(t.state.current),before);
});

for(const cancellation of ['Escape','pointercancel'])check(`atomic drag ${cancellation} restores the part without modifying siblings`,()=>{
  const t=setup(),id=find(t,'hp').id,before=plain(t.state.current),start=down(t,id);
  t.move(start.x+50,start.y+45);t.key('a');if(cancellation==='Escape')t.key('Escape');else t.dispatch('pointercancel');
  assert.deepEqual(plain(t.state.current),before);assert.equal(t.state.drag,null);assert.equal(t.state.undoStack.length,0);
});

for(const corner of ['nw','ne','sw','se'])check(`${corner} atomic resize anchors opposite corner and supports undo`,()=>{
  const t=setup('equipment'),id=find(t,'equipment').id,before=plain(t.state.current),g=resize(t,id,corner,1.25);
  let fixed=point(t,id,-g.sx,-g.sy);near(fixed.x,g.anchor.x,'held anchor x');near(fixed.y,g.anchor.y,'held anchor y');
  t.up();fixed=point(t,id,-g.sx,-g.sy);near(fixed.x,g.anchor.x,'saved anchor x');near(fixed.y,g.anchor.y,'saved anchor y');near(box(t,id).w,g.before.w*1.25,'saved size');
  assert.equal(t.state.undoStack.length,1);t.key('z',{ctrlKey:true});assert.deepEqual(plain(t.state.current),before);
});

check('small atomic equipment can shrink further and cancel restores the exact record',()=>{
  const t=setup('equipment'),id=find(t,'equipment').id,before=plain(t.state.current),g=resize(t,id,'se',.7);
  assert.ok(g.before.w<80,'exercise a part below the old group minimum');near(box(t,id).w,g.before.w*.7,'small part still shrinks');
  t.key('Escape');assert.deepEqual(plain(t.state.current),before);assert.equal(t.state.resizeDrag,null);assert.equal(t.state.undoStack.length,0);
});

for(const [type,kind,key] of [['attributes','attribute','items'],['skills','skill','items'],['equipment','equipment','items'],['background','story','fields']])check(`${kind} duplicate adds independent row and part with one undo`,()=>{
  const t=setup(type),paper=find(t,kind),before=plain(t.state.current),row=owner(t).data[key].find(r=>r.id===paper.rowId),oldCount=owner(t).data[key].length;
  t.duplicate(paper.id);const copy=t.paperById(t.state.selectedId);
  assert.notEqual(copy.id,paper.id);assert.notEqual(copy.rowId,paper.rowId);assert.equal(owner(t).data[key].length,oldCount+1);assert.equal(owner(t).parts.length,before.modules[0].parts.length+1);
  assert.deepEqual({...plain(owner(t).data[key].at(-1)),id:row.id},plain(row));
  owner(t).data[key].at(-1)[key==='fields'?'value':'name']='independent';assert.notEqual(row[key==='fields'?'value':'name'],'independent');
  assert.equal(copy.mounted,false);assert.equal(t.state.undoStack.length,1);t.key('z',{metaKey:true});assert.deepEqual(plain(t.state.current),before);
});

for(const [type,kind,key,limit] of [['attributes','attribute','items',24],['skills','skill','items',60],['equipment','equipment','items',80],['background','story','fields',40]])check(`${kind} duplicate at its row limit is rejected without data loss`,()=>{
  const c=fixture(type),rows=c.modules[0].data[key],sample=plain(rows[0]);while(rows.length<limit)rows.push({...plain(sample),id:M.uid('row')});
  const t=setup(type,c),before=plain(t.state.current);t.duplicate(find(t,kind).id);
  assert.deepEqual(plain(t.state.current),before);assert.equal(t.state.undoStack.length,0);
});

check('HP duplicate shares owner values without duplicating underlying rows',()=>{
  const t=setup(),hp=find(t,'hp'),rowCount=owner(t).data.items.length;t.duplicate(hp.id);const copy=t.paperById(t.state.selectedId);
  assert.notEqual(copy.id,hp.id);assert.equal(copy.data,hp.data);assert.equal(owner(t).data.items.length,rowCount);
  t.writeField(t.field(copy.id,'data.hp','37'));assert.equal(owner(t).data.hp,37);assert.equal(t.paperById(hp.id).data.hp,37);
  assert.match(t.partsAPI.render(t.paperById(hp.id)),/>37</);assert.match(t.partsAPI.render(t.paperById(copy.id)),/>37</);
});

check('Delete detaches then hides one paper, restore and undo retain all owner data',()=>{
  const t=setup('equipment'),id=find(t,'equipment').id,values=plain(owner(t).data),count=t.allPapers().length;
  t.remove(id);assert.equal(record(t,id).mounted,false);assert.equal(record(t,id).hidden,false);assert.equal(t.allPapers().length,count);
  t.remove(id);assert.equal(record(t,id).hidden,true);assert.equal(t.allPapers().length,count-1);assert.deepEqual(plain(owner(t).data),values);
  t.render();assert.equal(record(t,id).hidden,true,'render does not resurrect hidden paper');
  t.restore(id);assert.equal(record(t,id).hidden,false);assert.equal(record(t,id).mounted,false);assert.equal(t.allPapers().length,count);
  t.key('z',{metaKey:true});assert.equal(record(t,id).hidden,true);assert.deepEqual(plain(owner(t).data),values);
});

check('explicitly empty parts remain empty after render and migration',()=>{
  const c=fixture();c.modules[0].parts=[];const t=workshop({initialCurrent:c,dynamicDimensions:true,actualCommands:true});
  assert.equal(t.split(),false);t.render();assert.equal(t.allPapers().length,0);assert.equal(owner(t).parts.length,0);assert.equal(owner(t).data.items.length,6);
});

check('row removal clears its part and surviving paper resolves its new data index',()=>{
  const t=setup(),rows=owner(t).data.items,target=find(t,'attribute'),survivor=t.allPapers().find(p=>p.kind==='attribute'&&p.rowId===rows[1].id),survivorId=survivor.id;
  const button=t.field(target.id,'','');button.dataset={formAction:'remove-attribute',index:'0'};t.formAction(button);
  assert.equal(t.paperById(target.id),undefined);assert.equal(t.paperById(survivorId).rowId,owner(t).data.items[0].id);
  assert.match(t.partsAPI.render(t.paperById(survivorId)),/data-inline-path="data\.items\.0\.value"/);
  t.select(survivorId);t.writeField(t.field(survivorId,'data.items.0.value','123.5'));assert.equal(owner(t).data.items[0].value,123.5);
  const add=t.field(survivorId,'','');add.dataset={formAction:'add-attribute'};const before=owner(t).parts.length;t.formAction(add);
  assert.equal(owner(t).parts.length,before+1);assert.ok(owner(t).parts.some(p=>p.rowId===owner(t).data.items.at(-1).id));
});

check('reference layout preserves copied part IDs, hidden parts and owner data',()=>{
  const t=setup(),hp=find(t,'hp');t.duplicate(hp.id);const copyId=t.state.selectedId;const attr=find(t,'attribute');t.remove(attr.id);t.remove(attr.id);
  const ids=owner(t).parts.map(p=>p.id),data=plain(owner(t).data);t.assemble();
  assert.deepEqual(owner(t).parts.map(p=>p.id),ids);assert.equal(record(t,attr.id).hidden,true);assert.ok(t.paperById(copyId));assert.deepEqual(plain(owner(t).data),data);
  assert.ok(t.allPapers().every(p=>p.mounted));assert.notEqual(record(t,hp.id).cardPose.x,record(t,copyId).cardPose.x);
});

check('paper capacity guards duplication, component-box additions and form-row additions',()=>{
  const t=setup(),hp=find(t,'hp');while(owner(t).parts.length<240){const p=plain(hp.record);p.id=M.uid('part');owner(t).parts.push(p);}
  t.render();const before=plain(t.state.current);t.duplicate(hp.id);t.addPart('hp');
  const button=t.field(hp.id,'','');button.dataset={formAction:'add-attribute'};t.formAction(button);
  assert.deepEqual(plain(t.state.current),before);assert.equal(t.state.undoStack.length,0);
});

check('adding a requested atom without an owner creates only that atom',()=>{
  for(const kind of ['hp','equipment','identity-meta']){
    const c=M.createCharacter();c.modules=[];const t=workshop({initialCurrent:c,dynamicDimensions:true,actualCommands:true});
    t.addPart(kind);assert.equal(t.state.current.modules.length,1);assert.equal(t.allPapers().length,1);assert.equal(t.allPapers()[0].kind,kind);
    if(kind==='equipment')assert.equal(owner(t).data.items.length,1);
    if(kind==='hp')assert.equal(owner(t).data.items.length,0);
    t.render();assert.equal(t.allPapers().length,1,'render must not add a whole family');
  }
});

check('all 80 equipment atoms retain distinct reference rows through normalization and reload',()=>{
  const c=fixture('equipment'),o=c.modules[0];while(o.data.items.length<80)o.data.items.push({...plain(o.data.items[0]),id:M.uid('gear')});
  o.cardPose={x:43,y:631,width:316,angle:0};const t=setup('equipment',c),before=plain(owner(t).parts);
  assert.equal(before.length,80);assert.ok(before.at(-1).cardPose.y>3300,'exercise lower reference rows');
  const normalized=M.normalizeCharacter(plain(t.state.current)).character;
  normalized.modules[0].parts.forEach((part,i)=>near(part.cardPose.y,before[i].cardPose.y,'row y survives normalization'));
  const restored=setup('equipment',normalized);before.forEach(part=>near(box(restored,part.id).y,box(t,part.id).y,'reference row survives reload'));
  assert.equal(new Set(normalized.modules[0].parts.map(part=>part.cardPose.y)).size,27);
});

console.log(`${passed} atomic-paper regression checks passed; ${failed} failed.`);if(failed)process.exitCode=1;
