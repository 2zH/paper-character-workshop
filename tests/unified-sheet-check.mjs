import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { workshop } from './held-rotation-check.mjs';
const require=createRequire(import.meta.url),Model=require('../dist/workshop/workshop-model.js');
const scope={window:{}};
vm.runInNewContext(readFileSync(new URL('../dist/workshop/workshop-parts.js',import.meta.url),'utf8'),scope);
vm.runInNewContext(readFileSync(new URL('../dist/workshop/workshop-sheet.js',import.meta.url),'utf8'),scope);
const Parts=scope.window.WorkshopParts,Sheet=scope.window.WorkshopSheet;
const plain=value=>JSON.parse(JSON.stringify(value));
const near=(actual,expected,message,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${message}: ${actual} vs ${expected}`);
const point=(matrix,x,y)=>({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});
const rotate=(x,y,angle)=>{const rad=angle*Math.PI/180;return{x:x*Math.cos(rad)-y*Math.sin(rad),y:x*Math.sin(rad)+y*Math.cos(rad)};};
function tree(html){
  const root={tag:'#root',attrs:{},children:[],parent:null},stack=[root];
  for(const token of html.matchAll(/<\/?[A-Za-z][^>]*>/g)){
    const markup=token[0],closing=markup.startsWith('</'),tag=markup.match(/^<\/?([^\s/>]+)/)[1].toLowerCase();
    if(closing){assert.equal(stack.at(-1).tag,tag,`balanced ${tag}`);stack.pop();continue;}
    const attrs={};for(const attr of markup.slice(tag.length+1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[attr[1]]=attr[2]??attr[3]??attr[4]??'';
    const parent=stack.at(-1),node={tag,attrs,children:[],parent};parent.children.push(node);
    if(!markup.endsWith('/>')&&!['img','input','br','hr','meta','link','source','wbr'].includes(tag))stack.push(node);
  }
  assert.equal(stack.length,1,'balanced HTML');return root;
}
const all=(node,match)=>node.children.flatMap(child=>[...(match(child)?[child]:[]),...all(child,match)]);
const has=(node,name)=>Object.hasOwn(node.attrs,name);
const cls=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name);
const record=Model.createCharacter(),owners=Object.fromEntries(record.modules.map(owner=>[owner.type,owner]));
const kindOwners={'identity-meta':'identity',portrait:'identity',hp:'attributes',mp:'attributes',attribute:'attributes',radar:'attributes',equipment:'equipment',skill:'skills',story:'background',collection:'equipment'};
function paper(kind){const owner=owners[kindOwners[kind]],rowId=kind==='story'?owner.data.fields[0].id:['attribute','equipment','skill'].includes(kind)?owner.data.items[0].id:null;return{...plain(owner),id:`test-${kind}`,kind,rowId};}
let passed=0,failed=0;
function check(name,run){try{run();passed++;console.log(`PASS ${name}`);}catch(error){failed++;console.error(`FAIL ${name}: ${error.stack}`);}}

check('every paper supplies deterministic natural geometry without an individual upper paper',()=>{
  for(const kind of Object.keys(kindOwners)){
    const p=paper(kind),before=JSON.stringify(p),first=Parts.sheetPart(p),second=Parts.sheetPart(p);
    assert.deepEqual(plain(first),plain(second),`${kind} descriptor is deterministic`);assert.equal(JSON.stringify(p),before,'descriptor does not mutate character');
    assert.deepEqual(plain({w:first.w,h:first.h}),plain(Parts.naturalSize(p)));assert.ok(Array.isArray(first.holes));
    assert.ok(!/NaN|Infinity|undefined/.test(JSON.stringify(first)));assert.ok(!/paper-cut-surface|paper-cut-face|<mask\b|<pattern\b/.test(first.underlay+first.face),`${kind} supplies no little paper frame`);
    for(const path of first.holes)assert.match(path,/^M.*[zZ]$/,'each window is a closed path');
  }
});

check('artwork is supplied below the sheet; editable ink is supplied once on its face',()=>{
  for(const kind of Object.keys(kindOwners)){
    const part=Parts.sheetPart(paper(kind)),paint=tree(part.underlay),ink=tree(part.face),standalone=tree(Parts.render(paper(kind)));
    assert.equal(all(paint,n=>has(n,'data-inline-path')).length,0,`${kind} has no underlying duplicate field`);
    const fields=all(ink,n=>has(n,'data-inline-path')),paths=fields.map(n=>n.attrs['data-inline-path']);assert.equal(paths.length,new Set(paths).size,'one field per data path');
    assert.deepEqual(paths,all(standalone,n=>has(n,'data-inline-path')).map(n=>n.attrs['data-inline-path']),`${kind} retains every on-paper editing target`);
    for(const field of fields)assert.ok(field.attrs['data-inline-label'],`${kind} field retains accessible name`);
    if(['identity-meta','story','collection'].includes(kind)){assert.equal(part.holes.length,0);assert.equal(part.underlay,'');}
  }
  assert.match(Parts.sheetPart(paper('portrait')).underlay,/atomic-knight/);assert.doesNotMatch(Parts.sheetPart(paper('portrait')).face,/atomic-knight/);
  assert.match(Parts.sheetPart(paper('equipment')).underlay,/equipment-art-/);assert.doesNotMatch(Parts.sheetPart(paper('equipment')).face,/equipment-art-/);
});

check('live resource values change lower pigment without shifting window geometry',()=>{
  for(const kind of ['hp','mp','skill']){
    const p=paper(kind),before=Parts.sheetPart(p);if(kind==='skill')p.data.items[0].value=37.5;else{p.data[kind]=37.5;p.data[kind==='hp'?'maxHp':'maxMp']=100;}
    const after=Parts.sheetPart(p);assert.deepEqual(plain(after.holes),plain(before.holes));assert.match(after.underlay,/width:37\.5%/);assert.match(after.face,/>37\.5<\/span>/);
  }
});

check('changing attribute count changes both radar apertures and labels without stale windows',()=>{
  const p=paper('radar');for(const count of [0,1,3,6,12,20]){
    p.data.items=Array.from({length:count},(_,index)=>({id:`row-${index}`,key:`R${index}`,value:index+1}));
    const part=Parts.sheetPart(p);assert.equal(part.holes.length,Math.max(3,count));assert.equal(all(tree(part.face),n=>n.tag==='text').length,count);assert.ok(!/NaN|Infinity|undefined/.test(JSON.stringify(part)));
  }
});

check('removing an equipment row removes its window rather than leaving a stale aperture',()=>{
  const p=paper('equipment');assert.equal(Parts.sheetPart(p).holes.length,1);p.data.items=p.data.items.filter(item=>item.id!==p.rowId);const empty=Parts.sheetPart(p);assert.equal(empty.holes.length,0);assert.equal(empty.underlay,'');
});

check('all apertures share one continuous stock mask and overlapping cuts form a union',()=>{
  const entries=['hp','portrait','radar'].map((kind,index)=>({...Parts.sheetPart(paper(kind)),matrix:[1,0,0,1,40+index*3,80]})),root=tree(Sheet.surfaceMarkup('test-face',entries));
  const masks=all(root,n=>n.tag==='mask'),stock=all(root,n=>cls(n,'sheet-paper-stock')),windows=all(root,n=>cls(n,'sheet-mask-windows')),edges=all(root,n=>cls(n,'sheet-cut-edges'));
  assert.equal(masks.length,1,'one mask for the full card');assert.equal(stock.length,1,'one continuous stock surface');assert.equal(windows.length,1,'all windows use one cut union');assert.equal(edges.length,1);
  assert.equal(all(masks[0],n=>n.attrs.fill==='white').length,1,'one opaque card outline');
  const holes=all(windows[0],n=>n.tag==='path');assert.equal(holes.length,entries.reduce((count,entry)=>count+entry.holes.length,0));assert.ok(holes.every(n=>n.attrs.fill==='black'),'overlap stays transparent by black paint union');
  assert.ok(!all(root,n=>n.attrs['fill-rule']==='evenodd').length,'overlap does not restore paper via XOR');
  assert.equal(stock[0].attrs.mask,'url(#test-face-mask)');assert.equal(edges[0].attrs.mask,stock[0].attrs.mask,'cut-edge strokes never cross an overlapping window interior');
  assert.deepEqual(windows[0].children.map(n=>n.attrs.transform),entries.map(entry=>`matrix(${entry.matrix.join(' ')})`));
});

check('off-card and overlapping windows preserve a continuous protected outer rim',()=>{
  const root=tree(Sheet.surfaceMarkup('rim-check',[{matrix:[1,0,0,1,-200,-200],holes:['M0 0 L1200 0 L1200 1400 L0 1400 Z'],weight:1}])),windows=all(root,n=>cls(n,'sheet-mask-windows'))[0],edges=all(root,n=>cls(n,'sheet-cut-edges'))[0];
  assert.equal(windows.attrs['clip-path'],'url(#rim-check-rim)');assert.equal(edges.attrs['clip-path'],windows.attrs['clip-path']);
  const clip=all(root,n=>n.tag==='clippath'&&n.attrs.id==='rim-check-rim')[0],rim=clip.children[0].attrs;
  assert.ok(Number(rim.x)>10&&Number(rim.y)>8);assert.ok(Number(rim.x)+Number(rim.width)<587&&Number(rim.y)+Number(rim.height)<857,'cuttable region is inset from all torn outer edges');
});

check('rebuilt or empty card surfaces contain no stale windows and every mask reference resolves',()=>{
  const entries=[{...Parts.sheetPart(paper('portrait')),matrix:[1,0,0,1,0,0]}],first=tree(Sheet.surfaceMarkup('first',entries)),empty=tree(Sheet.surfaceMarkup('empty',[])),combined=tree(Sheet.surfaceMarkup('first',entries)+Sheet.surfaceMarkup('copy',entries));
  assert.equal(all(first,n=>cls(n,'sheet-mask-windows'))[0].children.length,1);assert.equal(all(empty,n=>cls(n,'sheet-mask-windows'))[0].children.length,0);
  const ids=all(combined,n=>has(n,'id')).map(n=>n.attrs.id);assert.equal(ids.length,new Set(ids).size);
  for(const node of all(combined,n=>Object.values(n.attrs).some(value=>/url\(#/.test(value))))for(const value of Object.values(node.attrs))for(const ref of value.matchAll(/url\(#([^)]*)\)/g))assert.ok(ids.includes(ref[1]),`resource ${ref[1]} exists`);
});

check('decorative top-face mirrors have no duplicate editable fields, actions or IDs',()=>{
  for(const kind of Object.keys(kindOwners)){
    const descriptor=Parts.sheetPart(paper(kind)),root=tree(Sheet.sanitizeMarkup(descriptor.underlay+descriptor.face));
    for(const node of all(root,()=>true))for(const name of Object.keys(node.attrs))assert.ok(!/^(data-|aria-|on)|^(id|role|tabindex|contenteditable|autofocus|for|name)$/.test(name),`${kind}: no ${name} on visual mirror`);
    assert.equal(all(root,n=>['button','input','textarea','select'].includes(n.tag)).length,0,'original paper remains sole control owner');
  }
  const editing=tree(Sheet.sanitizeMarkup('<span data-inline-path="data.hp"><input id="hp" name="hp" value="42"></span><button data-action="remove" aria-label="remove">x</button><textarea name="note">text</textarea>'));
  assert.equal(all(editing,n=>['button','input','textarea'].includes(n.tag)).length,0);
});

// Flatten just the supported path commands to check that the reading rests on
// solid stock, rather than floating in the HP/MP hole when the face is lifted.
function polygon(path){const tokens=path.match(/[MLQZmlqz]|[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi),points=[];let index=0,x=0,y=0;while(index<tokens.length){const command=tokens[index++].toUpperCase();if(command==='Z')break;if(command==='M'||command==='L'){x=Number(tokens[index++]);y=Number(tokens[index++]);points.push([x,y]);}else if(command==='Q'){const cx=Number(tokens[index++]),cy=Number(tokens[index++]),ex=Number(tokens[index++]),ey=Number(tokens[index++]);for(let i=1;i<=20;i++){const t=i/20;points.push([(1-t)**2*x+2*(1-t)*t*cx+t*t*ex,(1-t)**2*y+2*(1-t)*t*cy+t*t*ey]);}x=ex;y=ey;}else throw Error(`Unexpected path command ${command}`);}return points;}
function contains(points,x,y){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const[a,b]=points[i],[c,d]=points[j];if(((b>y)!==(d>y))&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside;}
check('HP/MP readings rest on solid paper joined to the continuous face',()=>{
  for(const kind of ['hp','mp']){const part=Parts.sheetPart(paper(kind)),hole=polygon(part.holes[0]);assert.ok(contains(hole,125,9),'upper slit shows colour');assert.ok(contains(hole,70,20),'side opening shows colour');for(const y of [16,20,25,29])assert.equal(contains(hole,125,y),false,'reading tongue connects to uncut stock below');}
});

function checkPose(frame,element,natural){
  const pose=Sheet.pose(frame,element,natural),parsed=element.style.transform.match(/translate3d\(([-\d.e]+)px,\s*([-\d.e]+)px,\s*0\) rotate\(([-\d.e]+)deg\) scale\(([-\d.e]+)\)/);assert.ok(parsed);
  const[x,y,angle,scale]=parsed.slice(1).map(Number),w=parseFloat(element.style.width),h=parseFloat(element.style.height),cardScale=600/frame.width;
  for(const [px,py]of[[0,0],[natural.w/2,natural.h/2],[natural.w,natural.h],[natural.w*.37,natural.h*.73]]){
    const rotated=rotate((px/natural.w*w-w/2)*scale,(py/natural.h*h-h/2)*scale,angle),expected={x:(x+w/2+rotated.x-frame.x)*cardScale,y:(y+h/2+rotated.y-frame.y)*cardScale},actual=point(pose.matrix,px,py);
    // Serialized SVG/CSS matrices retain five decimal places: less than .005 card units across the largest part.
    near(actual.x,expected.x,'window/ink x matches physical paper',.005);near(actual.y,expected.y,'window/ink y matches physical paper',.005);
  }
  assert.ok(pose.matrix.every(Number.isFinite));return pose;
}
check('window transforms rotate around component center at every fit size',()=>{
  const natural={w:205,h:32};
  for(const frameWidth of [340,477.3,600,620])for(const angle of [-15,0,12.6])for(const scale of [1,1.025]){
    const frame={x:82.3,y:20,width:frameWidth,height:frameWidth*870/600},element={style:{width:'168.23px',height:'26.26029268292683px',transform:`translate3d(203.45px,138.93px,0) rotate(${angle}deg) scale(${scale})`}};
    checkPose(frame,element,natural);
  }
});

function fixture(){const c=Model.createCharacter();c.bindingEnabled=true;c.modules=c.modules.filter(owner=>['attributes','equipment'].includes(owner.type));c.modules.forEach((owner,index)=>{const part=Model.createPart(index?'equipment':'hp',index?owner.data.items[0].id:null);Object.assign(part,{id:`unified-${index}`,groupId:'joined-paper',mounted:true,cardPose:{x:100+index*170,y:180+index*60,width:index?90:180,angle:index?-4:7},pose:{x:20+index*20,y:30,angle:index?-4:7,z:index+1}});owner.parts=[part];});return c;}
function gesture(){return workshop({initialCurrent:fixture(),dynamicDimensions:true,actualCommands:true,viewportHeight:720});}
function snapshot(t){return t.allPapers().filter(p=>p.mounted).map(p=>({id:p.id,matrix:plain(checkPose(t.state.bindingLayout.frame,t.papers[p.id],Parts.naturalSize(p)).matrix)}));}
function down(t,id='unified-0'){const node=t.papers[id],match=node.style.transform.match(/translate3d\(([-\d.e]+)px,([-\d.e]+)px/),x=Number(match[1])+node.offsetWidth/2,y=100+Number(match[2])+node.offsetHeight/2;t.dispatch('pointerdown',{target:t.content(id),clientX:x,clientY:y});return{x,y};}
check('group drag and A/D keep apertures registered during lift scale and restore on cancel',()=>{
  const t=gesture(),before=snapshot(t),saved=JSON.stringify(t.state.current),start=down(t);t.move(start.x+38,start.y+26);t.frames(8);t.key('d');t.frames(8);
  const during=snapshot(t);assert.equal(during.length,2);assert.notDeepEqual(during,before);assert.ok(t.state.drag.scale>1,'checks transient lift scale');
  t.key('Escape');assert.deepEqual(snapshot(t),before);assert.equal(JSON.stringify(t.state.current),saved);
});
check('fitted and full card views produce the same canonical window coordinates',()=>{
  const t=gesture(),before=snapshot(t);t.body.classList.add('desk-fit');t.render();const fitted=snapshot(t);for(let i=0;i<before.length;i++)before[i].matrix.forEach((n,j)=>near(n,fitted[i].matrix[j],'canonical fit coordinate'));
  t.body.classList.remove('desk-fit');t.render();assert.deepEqual(snapshot(t),before);
});
check('in-progress group resize uses live dimensions then undo restores canonical windows',()=>{
  const t=gesture();t.choose('unified-0');const before=snapshot(t),bounds=t.bounds(t.capture()),handle=t.resizeHandle('unified-0','se'),originalClosest=handle.closest.bind(handle);handle.dataset.groupResize='true';handle.closest=selector=>selector==='[data-group-resize]'?handle:selector==='.paper-piece'?null:originalClosest(selector);
  const x=bounds.x+bounds.w,y=100+bounds.y+bounds.h;t.dispatch('pointerdown',{target:handle,clientX:x,clientY:y});t.move(x+bounds.w*.2,y+bounds.h*.2);
  assert.ok(t.state.resizeDrag.started);assert.notDeepEqual(snapshot(t),before);t.up();snapshot(t);t.key('z',{metaKey:true});assert.deepEqual(snapshot(t),before);
});
check('detaching and restoring a group changes the card aperture set without losing data',()=>{
  const t=gesture(),before=snapshot(t),data=JSON.stringify(t.state.current.modules.map(m=>m.data));t.choose('unified-0');t.key('Delete');assert.equal(snapshot(t).length,0);assert.equal(JSON.stringify(t.state.current.modules.map(m=>m.data)),data);t.key('z',{metaKey:true});assert.deepEqual(snapshot(t),before);
});

// A small tree DOM exercises the actual sheet compositor without introducing a
// browser/package dependency. Native canvas rib detection is checked in-browser.
function element(tag='div'){
  const node={tag,attrs:{},children:[],parent:null,style:{},hidden:false};
  Object.setPrototypeOf(node,elementPrototype);return node;
}
const elementPrototype={
  get parentNode(){return this.parent;},get className(){return this.attrs.class||'';},set className(value){this.attrs.class=value;},
  get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([name])=>name.startsWith('data-')).map(([name,value])=>[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase()),value]));},
  get classList(){const node=this;return{contains:name=>node.className.split(/\s+/).includes(name),add:name=>{node.className=[...new Set([...node.className.split(/\s+/).filter(Boolean),name])].join(' ');},remove:name=>{node.className=node.className.split(/\s+/).filter(value=>value!==name).join(' ');},toggle(name,on){if(on)this.add(name);else this.remove(name);}};},
  set innerHTML(html){const parsed=tree(html);const attach=(node,parent)=>{Object.setPrototypeOf(node,elementPrototype);node.parent=parent;node.style={};node.hidden=false;node.children.forEach(child=>attach(child,node));};this.children=parsed.children;this.children.forEach(child=>attach(child,this));},
  setAttribute(name,value){this.attrs[name]=String(value);},getAttribute(name){return this.attrs[name]??null;},
  append(node){node.remove();node.parent=this;this.children.push(node);},prepend(node){node.remove();node.parent=this;this.children.unshift(node);},
  after(node){if(!this.parent)return;node.remove();node.parent=this.parent;this.parent.children.splice(this.parent.children.indexOf(this)+1,0,node);},
  remove(){if(this.parent){const siblings=this.parent.children,index=siblings.indexOf(this);if(index>=0)siblings.splice(index,1);this.parent=null;}},
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
  querySelectorAll(selector){return all(this,node=>{const classes=[...selector.matchAll(/\.([\w-]+)/g)].map(match=>match[1]),attributes=[...selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)];return classes.every(name=>cls(node,name))&&attributes.every(([,name,value])=>has(node,name)&&(value===undefined||node.attrs[name]===value));});}
};
function compositor(t){
  const board=element(),base=element();base.className='binding-base';board.append(base);
  const context={window:{WorkshopParts:Parts},document:{createElement:element,createElementNS:(_ns,tag)=>element(tag)}};
  vm.runInNewContext(readFileSync(new URL('../dist/workshop/workshop-sheet.js',import.meta.url),'utf8'),context);
  const run=(editingId=null)=>{
    const papers=t.allPapers(),nodes=new Map(board.querySelectorAll('.paper-piece').map(node=>[node.dataset.moduleId,node]));
    for(const [id,node]of nodes)if(!papers.some(p=>p.id===id))node.remove();
    for(const paper of papers){let node=nodes.get(paper.id);if(!node){node=element('article');node.className='paper-piece';node.setAttribute('data-module-id',paper.id);board.append(node);}node.style={...t.papers[paper.id].style};}
    context.window.WorkshopSheet.sync({board,frame:t.state.current.bindingEnabled?t.state.bindingLayout.frame:null,papers,editingId});return board;
  };return{board,run};
}
check('actual compositor reuses one full face while edits refresh artwork and do not add controls',()=>{
  const t=gesture(),c=compositor(t),board=c.run(),sheet=board.querySelector('.card-sheet');
  assert.equal(board.querySelectorAll('.card-sheet').length,1);assert.equal(sheet.getAttribute('aria-hidden'),'true');assert.equal(sheet.getAttribute('inert'),'');
  assert.equal(board.querySelectorAll('.sheet-attached').length,2);assert.equal(board.querySelector('.sheet-mask-windows').children.length,2);
  const art=board.querySelector('.sheet-art-part');t.paperById('unified-0').data.hp=37.5;c.run();assert.equal(board.querySelector('.card-sheet'),sheet,'editing keeps the full face mounted');assert.notEqual(board.querySelector('.sheet-art-part'),art,'paint follows live data');
  for(const node of all(sheet,()=>true))assert.ok(!has(node,'data-inline-path')&&!has(node,'data-inline-editor')&&!has(node,'data-card-action'),'sheet has no duplicate live editors/actions');
  c.run('unified-0');assert.equal(board.querySelectorAll('.sheet-ink-part').filter(node=>node.hidden).length,1,'editing only hides its ink mirror');c.run();assert.equal(board.querySelectorAll('.sheet-ink-part').filter(node=>node.hidden).length,0);
});
check('actual compositor follows held transforms, removes detached windows and restores on undo',()=>{
  const t=gesture(),c=compositor(t);c.run();const before=c.board.querySelector('.sheet-mask-windows').children.map(node=>node.getAttribute('transform')),start=down(t);t.move(start.x+28,start.y+15);t.frames(4);c.run();
  const during=c.board.querySelector('.sheet-mask-windows').children.map(node=>node.getAttribute('transform'));assert.notDeepEqual(during,before);
  for(let i=0;i<t.allPapers().length;i++){const paper=t.allPapers()[i];assert.equal(during[i],Sheet.pose(t.state.bindingLayout.frame,t.papers[paper.id],Parts.naturalSize(paper)).svg);}
  t.key('Escape');c.run();assert.deepEqual(c.board.querySelector('.sheet-mask-windows').children.map(node=>node.getAttribute('transform')),before);
  t.choose('unified-0');t.key('Delete');c.run();assert.equal(c.board.querySelector('.sheet-mask-windows').children.length,0);assert.equal(c.board.querySelectorAll('.sheet-art-part').length,0);assert.equal(c.board.querySelectorAll('.sheet-attached').length,0);
  t.key('z',{metaKey:true});c.run();assert.deepEqual(c.board.querySelector('.sheet-mask-windows').children.map(node=>node.getAttribute('transform')),before);assert.equal(c.board.querySelectorAll('.card-sheet').length,1);
});
check('removing the base tears down the compositor and restoring it creates one clean sheet',()=>{
  const t=gesture(),c=compositor(t);c.run();t.state.current.bindingEnabled=false;t.render();c.run();assert.equal(c.board.querySelectorAll('.card-sheet').length,0);assert.equal(c.board.classList.contains('has-unified-sheet'),false);assert.equal(c.board.querySelectorAll('.sheet-attached').length,0);
  t.state.current.bindingEnabled=true;t.render();c.run();assert.equal(c.board.querySelectorAll('.card-sheet').length,1);assert.equal(c.board.querySelector('.sheet-mask-windows').children.length,2);
});

check('off-card mounted appendices remain visible as loose papers and rejoin the shared face on return',()=>{
  const t=gesture(),c=compositor(t);c.run();const paper=t.paperById('unified-1');paper.cardPose={...paper.cardPose,x:900,y:900};t.render();c.run();
  assert.equal(c.board.querySelector('.sheet-mask-windows').children.length,1);assert.equal(c.board.querySelectorAll('.sheet-art-part').length,1);
  const article=c.board.querySelector('.paper-piece[data-module-id="unified-1"]');assert.equal(article.classList.contains('sheet-attached'),false,'unrendered lower paint never makes the original disappear');
  paper.cardPose={...paper.cardPose,x:320,y:260};t.render();c.run();assert.equal(c.board.querySelector('.sheet-mask-windows').children.length,2);assert.equal(article.classList.contains('sheet-attached'),true);
});
check('off-card bounds include every rotated and scaled corner',()=>{
  const natural={w:340,h:455},frame={x:100,y:20,width:400,height:580},node={style:{width:'180px',height:'240.88235294117646px',transform:'translate3d(220px,138px,0) rotate(-15deg) scale(1.025)'}},pose=Sheet.pose(frame,node,natural),bounds=Sheet.bounds(pose,natural),corners=[[0,0],[natural.w,0],[natural.w,natural.h],[0,natural.h]].map(([x,y])=>point(pose.matrix,x,y));
  near(bounds.left,Math.min(...corners.map(p=>p.x)),'rotated left');near(bounds.right,Math.max(...corners.map(p=>p.x)),'rotated right');near(bounds.top,Math.min(...corners.map(p=>p.y)),'rotated top');near(bounds.bottom,Math.max(...corners.map(p=>p.y)),'rotated bottom');
});

console.log(`${passed} unified-sheet checks passed; ${failed} failed.`);if(failed)process.exitCode=1;
