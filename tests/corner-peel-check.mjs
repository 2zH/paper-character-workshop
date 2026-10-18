import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../dist/workshop/workshop-peel.js',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const near=(actual,expected,message,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} vs ${expected}`);
let passed=0,failed=0;
function check(name,run){try{run();passed++;console.log(`PASS ${name}`);}catch(error){failed++;console.error(`FAIL ${name}: ${error.stack}`);}}

// A deliberately small DOM drives the real gesture controller. It supports
// native pointer capture, event propagation and RAF; live browser acceptance
// separately checks native rendering of the diagonal paper strips.
function style(){return{setProperty(name,value){this[name]=String(value);},getPropertyValue(name){return this[name]||'';},removeProperty(name){delete this[name];}};}
const voidTags=new Set(['img','input','br','hr','meta','link','source','wbr']);
function parse(html,document){
  const root=document.createElement('fragment'),stack=[root];
  for(const token of String(html).matchAll(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|[^<]+/g)){
    const markup=token[0];if(markup.startsWith('<!--'))continue;
    if(!markup.startsWith('<')){stack.at(-1)._text+=markup;continue;}
    const closing=markup.startsWith('</'),tag=markup.match(/^<\/?([^\s/>]+)/)[1].toLowerCase();
    if(closing){assert.equal(stack.at(-1).tagName.toLowerCase(),tag,`balanced ${tag}`);stack.pop();continue;}
    const node=document.createElement(tag);
    for(const attr of markup.slice(tag.length+1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))node.setAttribute(attr[1],attr[2]??attr[3]??attr[4]??'');
    stack.at(-1).append(node);if(!markup.endsWith('/>')&&!voidTags.has(tag))stack.push(node);
  }
  assert.equal(stack.length,1,'balanced markup');return root.children;
}
function matches(node,selector){
  selector=selector.replace(/\s*>\s*/g,' ');
  return selector.split(',').some(part=>{
    part=part.trim();if(part==='*')return true;
    if(part.includes(' ')){const parts=part.split(/\s+/),last=parts.pop();if(!matches(node,last))return false;let parent=node.parentNode;for(let index=parts.length-1;index>=0;index--){while(parent&&!matches(parent,parts[index]))parent=parent.parentNode;if(!parent)return false;parent=parent.parentNode;}return true;}
    const tag=part.match(/^[A-Za-z][\w-]*/)?.[0],id=part.match(/#([\w-]+)/)?.[1];
    if(tag&&node.tagName.toLowerCase()!==tag.toLowerCase())return false;if(id&&node.id!==id)return false;
    for(const [,name]of part.matchAll(/\.([\w-]+)/g))if(!node.classList.contains(name))return false;
    for(const [,name,quoted,single,unquoted]of part.matchAll(/\[([\w:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g)){if(!node.hasAttribute(name))return false;const value=quoted??single??unquoted;if(value!==undefined&&node.getAttribute(name)!==value)return false;}
    return true;
  });
}
class Node{
  constructor(tag,document){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.parentNode=null;this.children=[];this.attrs=new Map();this.style=style();this._text='';this.events=new Map();this.captured=new Set();this.hidden=false;}
  get className(){return this.getAttribute('class')||'';}set className(value){this.setAttribute('class',value);}
  get id(){return this.getAttribute('id')||'';}set id(value){this.setAttribute('id',value);}
  get classList(){const node=this;return{contains(name){return node.className.split(/\s+/).includes(name);},add(...names){node.className=[...new Set([...node.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove(...names){node.className=node.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');},toggle(name,force){const on=force===undefined?!this.contains(name):!!force;this[on?'add':'remove'](name);return on;}};}
  get dataset(){const node=this;return new Proxy({}, {get:(_,name)=>node.getAttribute('data-'+String(name).replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()))??undefined,set:(_,name,value)=>{node.setAttribute('data-'+String(name).replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()),value);return true;}});}
  get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
  get childNodes(){return this.children;}get firstChild(){return this.children[0]||null;}get firstElementChild(){return this.firstChild;}
  get isConnected(){for(let node=this;node;node=node.parentNode)if(node===this.ownerDocument?.body)return true;return false;}
  get innerHTML(){return this._text+this.children.map(node=>node.outerHTML).join('');}
  set innerHTML(value){for(const child of this.children)child.parentNode=null;this.children=[];this._text='';for(const child of [...parse(value,this.ownerDocument)])this.append(child);}
  get outerHTML(){const attrs=[...this.attrs].map(([name,value])=>` ${name}="${value}"`).join(''),tag=this.tagName.toLowerCase();return `<${tag}${attrs}>${this.innerHTML}${voidTags.has(tag)?'':`</${tag}>`}`;}
  get textContent(){return this._text+this.children.map(node=>node.textContent).join('');}set textContent(value){this.children=[];this._text=String(value);}
  setAttribute(name,value){this.attrs.set(name,String(value));}getAttribute(name){return this.attrs.get(name)??null;}hasAttribute(name){return this.attrs.has(name);}removeAttribute(name){this.attrs.delete(name);}
  append(...nodes){for(const node of nodes){if(typeof node==='string'){this._text+=node;continue;}node.remove();node.parentNode=this;this.children.push(node);}}
  appendChild(node){this.append(node);return node;}prepend(node){node.remove();node.parentNode=this;this.children.unshift(node);}
  insertBefore(node,reference){if(!reference)return this.appendChild(node);node.remove();node.parentNode=this;this.children.splice(this.children.indexOf(reference),0,node);return node;}
  after(node){this.parentNode?.insertBefore(node,this.parentNode.children[this.parentNode.children.indexOf(this)+1]);}
  remove(){if(this.parentNode){const parent=this.parentNode;parent.children.splice(parent.children.indexOf(this),1);this.parentNode=null;}}
  replaceChildren(...nodes){for(const child of this.children)child.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(matches(child,selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}matches(selector){return matches(this,selector);}
  closest(selector){for(let node=this;node;node=node.parentNode)if(matches(node,selector))return node;return null;}
  contains(other){for(let node=other;node;node=node.parentNode)if(node===this)return true;return false;}
  cloneNode(deep=false){const copy=this.ownerDocument.createElement(this.tagName);copy.attrs=new Map(this.attrs);copy.style=Object.assign(style(),this.style);copy._text=this._text;copy.hidden=this.hidden;if(deep)for(const child of this.children)copy.append(child.cloneNode(true));return copy;}
  addEventListener(type,handler,options){const capture=options===true||options?.capture;(this.events.get(type)||this.events.set(type,[]).get(type)).push({handler,capture});}
  removeEventListener(type,handler){this.events.set(type,(this.events.get(type)||[]).filter(listener=>listener.handler!==handler));}
  setPointerCapture(id){this.captured.add(id);}hasPointerCapture(id){return this.captured.has(id);}releasePointerCapture(id){this.captured.delete(id);}
  focus(){this.ownerDocument.activeElement=this;}
  getBoundingClientRect(){return this.rect||{left:40,top:50,width:600,height:870,right:640,bottom:920,x:40,y:50};}
}
function fixture({reduced=false,zoom=1}={}){
  const document={createElement:tag=>new Node(tag,document),createElementNS:(_ns,tag)=>new Node(tag,document)};
  document.body=document.createElement('body');document.documentElement=document.body;document.activeElement=document.body;
  document.querySelector=selector=>document.body.querySelector(selector);document.querySelectorAll=selector=>document.body.querySelectorAll(selector);
  const events=new Node('document',document),windowEvents=new Node('window',document);
  document.addEventListener=events.addEventListener.bind(events);document.removeEventListener=events.removeEventListener.bind(events);
  const window={addEventListener:windowEvents.addEventListener.bind(windowEvents),removeEventListener:windowEvents.removeEventListener.bind(windowEvents),matchMedia:()=>({matches:reduced,addEventListener(){},removeEventListener(){}})};
  const board=document.createElement('section');board.id='paper-board';board.rect={left:40,top:50,width:900,height:1100,right:940,bottom:1150};document.body.append(board);
  board.innerHTML='<div class="binding-base"></div><div class="card-sheet"><div class="card-underpaint"><svg><path d="M 0 0 L 100 20" fill="red"></path></svg></div><div class="card-face-shell"><div class="card-face"><svg class="card-face-surface"><defs><mask id="card-mask"><path fill="white" d="M0 0 L600 0 L600 870 L0 870Z"></path><path fill="black" d="M20 30 L50 30 L50 50 Z"></path></mask><clipPath id="card-rim"><rect x="20" y="20" width="560" height="830"></rect></clipPath></defs><g mask="url(#card-mask)" clip-path="url(#card-rim)"><path d="M0 0 L600 0 L600 870 L0 870Z"></path></g></svg><div class="card-face-ink" style="mask:url(#card-mask)"><span>角色 林恩</span></div></div></div></div><article class="paper-piece sheet-attached" data-module-id="hp"><input value="85"></article>';
  board.querySelector('.card-face-ink').style.mask='url(#card-mask)';
  board.querySelector('.card-underpaint').style.clipPath='url(#card-rim)';
  let now=0,serial=0,writes=0;const raf=new Map(),callbacks={starts:0,ends:0};
  const context={window,document,Element:Node,HTMLElement:Node,performance:{now:()=>now},requestAnimationFrame:fn=>{const id=++serial;raf.set(id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),matchMedia:window.matchMedia,getComputedStyle:node=>node.style,CSS:{escape:value=>String(value)},localStorage:{setItem(){writes++;},getItem(){return null;}},console};
  Object.assign(window,{requestAnimationFrame:context.requestAnimationFrame,cancelAnimationFrame:context.cancelAnimationFrame,innerWidth:1200});
  vm.runInNewContext(source,context);const api=window.WorkshopPeel,frame={x:0,y:0,width:600,height:870};
  function sync(enabled=true){const sheet=board.querySelector('.card-sheet');if(sheet)sheet.rect={left:40,top:50,width:frame.width*zoom,height:frame.height*zoom};api.sync({board,frame,enabled,onStart(){callbacks.starts++;},onEnd(){callbacks.ends++;}});}
  function emit(type,target,overrides={}){
    const event={type,target,currentTarget:null,button:0,buttons:type==='pointerup'?0:1,pointerId:7,pointerType:'mouse',clientX:640,clientY:920,bubbles:true,cancelable:true,defaultPrevented:false,propagationStopped:false,immediateStopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;},stopImmediatePropagation(){this.immediateStopped=true;this.propagationStopped=true;},...overrides};
    const path=[];for(let node=target;node;node=node.parentNode)path.push(node);if(target!==windowEvents){if(target!==events)path.push(events);path.push(windowEvents);}
    function invoke(node,capture){event.currentTarget=node;for(const item of node.events?.get(type)||[]){if(!!item.capture!==capture)continue;item.handler(event);if(event.immediateStopped)break;}}
    for(const node of [...path].reverse()){invoke(node,true);if(event.propagationStopped)break;}
    if(!event.propagationStopped)for(const node of event.bubbles?path:[target]){invoke(node,false);if(event.propagationStopped)break;}
    return event;
  }
  function frames(count=1,dt=16.6667){for(let i=0;i<count;i++){now+=dt;const tasks=[...raf.values()];raf.clear();for(const fn of tasks)fn(now);}}
  return{api,board,document,documentEvents:events,window,windowEvents,frame,callbacks,raf,sync,emit,frames,get writes(){return writes;},get time(){return now;}};
}

const math=fixture().api,corners={tl:{x:0,y:0},tr:{x:600,y:0},bl:{x:0,y:870},br:{x:600,y:870}};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
const qPoint=(q,fold)=>({x:q*fold.normal.x,y:q*fold.normal.y});
const transformed=(matrix,point)=>({x:matrix[0]*point.x+matrix[4]*point.y+matrix[12],y:matrix[1]*point.x+matrix[5]*point.y+matrix[13],z:matrix[2]*point.x+matrix[6]*point.y+matrix[14]});
function projectedReach(fold){const depth=fold.max-fold.front,shift=depth-fold.radius*Math.sin(fold.angle),z=fold.radius*(1-Math.cos(fold.angle)),half=(fold.max-fold.min)/2;return half-(half-shift)*1700/(1700-z);}

check('all four corners begin as the same flat, unshifted paper',()=>{
  for(const corner of Object.keys(corners)){
    const fold=math.geometry(corner,0);near(Math.hypot(fold.normal.x,fold.normal.y),1,'unit bend normal');
    for(const point of [...Object.values(corners),{x:153.2,y:487.6}]){
      const actual=math.bendPoint(point,fold);near(actual.x,point.x,'flat x');near(actual.y,point.y,'flat y');near(actual.z,0,'flat height');
    }
  }
});

check('pulling each corner progressively lifts it while its opposite corner stays attached',()=>{
  const opposite={tl:'br',tr:'bl',bl:'tr',br:'tl'};
  for(const corner of Object.keys(corners)){
    let lastHeight=0;
    for(const amount of [.02,.1,.3,.6,1]){
      const fold=math.geometry(corner,amount),held=math.bendPoint(corners[corner],fold),fixed=math.bendPoint(corners[opposite[corner]],fold);
      assert.ok(held.z>lastHeight,`${corner} rises continuously with pull amount`);lastHeight=held.z;
      near(distance(fixed,corners[opposite[corner]]),0,`${corner} keeps distant corner on the desk`);
      for(const point of Object.values(corners)){const bent=math.bendPoint(point,fold);assert.ok(Object.values(bent).every(Number.isFinite));assert.ok(bent.z>=-1e-7,'paper never folds beneath painted backing');}
    }
  }
});

check('curved paper joins the stationary sheet without a position or tangent discontinuity',()=>{
  const epsilon=.0001;
  for(const corner of Object.keys(corners))for(const amount of [.1,.5,1]){
    const fold=math.geometry(corner,amount);
    for(const join of [fold.front,fold.front+fold.radius*fold.angle]){
      const before=math.bendPoint(qPoint(join-epsilon,fold),fold),middle=math.bendPoint(qPoint(join,fold),fold),after=math.bendPoint(qPoint(join+epsilon,fold),fold);
      assert.ok(distance(before,after)<epsilon*2.01,'no tear in paper at a curve join');
      for(const axis of ['x','y','z'])near((middle[axis]-before[axis])/epsilon,(after[axis]-middle[axis])/epsilon,'matching tangent',.0001);
    }
  }
});

check('each physical strip transform agrees with the continuous curved surface',()=>{
  for(const corner of Object.keys(corners))for(const amount of [.15,.6,1]){
    const fold=math.geometry(corner,amount);
    for(const fraction of [0,.2,.5,.8,1]){
      const q=fold.min+(fold.max-fold.min)*fraction,matrix=math.stripTransform(q,fold),point=qPoint(q,fold),expected=math.bendPoint(point,fold),actual=transformed(matrix,point);
      assert.equal(matrix.length,16);assert.ok(matrix.every(Number.isFinite));near(distance(actual,expected),0,'strip center lies on the curl',.00001);
      const tangent={x:-fold.normal.y*17,y:fold.normal.x*17},side={x:point.x+tangent.x,y:point.y+tangent.y},edge=transformed(matrix,side),curvedEdge=math.bendPoint(side,fold);
      near(distance(edge,curvedEdge),0,'strip keeps crosswise paper, text and apertures aligned',.00001);
    }
  }
});

const area=polygon=>Math.abs(polygon.reduce((sum,p,index)=>{const next=polygon[(index+1)%polygon.length];return sum+p.x*next.y-next.x*p.y;},0)/2);
check('diagonal strip clipping covers the whole card exactly without gaps or doubled stock',()=>{
  for(const corner of Object.keys(corners)){
    const fold=math.geometry(corner,.7);let total=0;
    for(let index=0;index<32;index++){
      const low=fold.min+(fold.max-fold.min)*index/32,high=fold.min+(fold.max-fold.min)*(index+1)/32,polygon=math.clipBand(low,high,fold);total+=area(polygon);
      for(const point of polygon){assert.ok(point.x>=-1e-6&&point.x<=600+1e-6&&point.y>=-1e-6&&point.y<=870+1e-6);const q=point.x*fold.normal.x+point.y*fold.normal.y;assert.ok(q>=low-1e-6&&q<=high+1e-6);}
    }
    near(total,600*870,'band partition is exactly one card',.001);
  }
});

check('release spring settles naturally at zero across common frame rates',()=>{
  for(const dt of [1/120,1/60,1/30]){
    let state={position:.9,velocity:.4},travel=0;
    for(let index=0;index<Math.ceil(4/dt);index++){
      const previous=state;state=math.springStep(state,0,dt);assert.ok(Number.isFinite(state.position)&&Number.isFinite(state.velocity));assert.ok(state.position>=-1e-7&&state.position<=1.1);travel+=Math.abs(state.position-previous.position);
    }
    near(state.position,0,'paper lies flat after release',.0001);near(state.velocity,0,'paper stops moving',.001);assert.ok(travel>=.89&&travel<1.1,'return does not oscillate through the backing');
  }
});

check('mouse distance continuously addresses every intermediate fold instead of toggling open',()=>{
  for(const corner of Object.keys(corners))for(const amount of [.03,.1,.25,.5,.75,1]){
    const fold=math.geometry(corner,amount),reach=projectedReach(fold);
    near(math.pullAmount(-fold.normal.x*reach,-fold.normal.y*reach,corner),amount,'inverse grip progress',.00002);
  }
  for(const corner of Object.keys(corners))assert.equal(math.pullAmount(0,0,corner),0,'a simple press does not jump the paper');
});

check('cloned face resources keep transparent windows, paper ribs and ink without duplicate IDs',()=>{
  const t=fixture(),original=t.board.querySelector('.card-face'),before=original.outerHTML;
  const first=t.api.cloneFace(original,'curl-one'),second=t.api.cloneFace(original,'curl-two');t.board.append(first,second);
  const ids=t.board.querySelectorAll('[id]').map(node=>node.id);assert.equal(ids.length,new Set(ids).size,'all SVG resources are unique');
  for(const clone of [first,second]){
    const ownIds=new Set(clone.querySelectorAll('[id]').map(node=>node.id));
    for(const node of [clone,...clone.querySelectorAll('*')])for(const {value}of node.attributes)for(const match of value.matchAll(/url\(#([^)]*)\)/g))assert.ok(ownIds.has(match[1]),`clone reference ${match[1]} resolves inside its own face`);
    assert.equal(clone.querySelectorAll('mask path[fill="black"]').length,1,'window stays cut out');assert.equal(clone.querySelectorAll('mask path[fill="white"]').length,1,'stock remains opaque');
    assert.match(clone.textContent,/角色 林恩/,'printed ink lifts with the stock');assert.equal(clone.getAttribute('aria-hidden'),'true');assert.ok(clone.hasAttribute('inert'));
  }
  assert.equal(original.outerHTML,before,'the source paper is never rewritten');
  assert.equal(t.api.remapReferences('url("#mask") url(#unrelated)',{mask:'copy-mask'}),'url(#copy-mask) url(#unrelated)');
  assert.equal(t.api.remapReferences('#mask',{mask:'copy-mask'}),'#copy-mask');
});

const grip=(t,corner='br')=>t.board.querySelector(`.corner-peel-grip[data-corner="${corner}"]`);
const progress=t=>Number(t.board.querySelector('.card-sheet').style.getPropertyValue('--corner-peel-amount')||0);
function pull(t,amount=.6,corner='br',pointerId=7){
  const button=grip(t,corner);t.emit('pointerdown',button,{pointerId});
  const fold=t.api.geometry(corner,amount),reach=projectedReach(fold),scale=t.board.querySelector('.card-sheet').getBoundingClientRect().width/600;
  t.emit('pointermove',t.windowEvents,{pointerId,clientX:640-fold.normal.x*reach*scale,clientY:920-fold.normal.y*reach*scale});t.frames(60);return button;
}
function settled(t){assert.equal(t.api.isActive(),false);assert.equal(t.raf.size,0);for(const selector of ['.corner-peel-mesh','.corner-peel-cast','.corner-peel-resources'])assert.equal(t.board.querySelector(selector),null);assert.equal(t.board.classList.contains('is-corner-peeling'),false);assert.equal(t.document.body.classList.contains('is-corner-peeling'),false);assert.equal(t.board.querySelector('.card-underpaint').style.clipPath,'url(#card-rim)','permanent backing clip restored before transient resources are discarded');assert.equal(progress(t),0);for(const button of t.board.querySelectorAll('.corner-peel-grip')){assert.equal(button.classList.contains('is-held'),false);assert.equal(button.hasPointerCapture(7),false);assert.equal(button.hasAttribute('aria-pressed'),false);}}

check('corner controls are separate from component drag targets and remain stable on sync',()=>{
  const t=fixture();t.sync();const controls=t.board.querySelector('.corner-peel-controls'),buttons=t.board.querySelectorAll('.corner-peel-grip');
  assert.equal(buttons.length,4);assert.deepEqual(buttons.map(node=>node.dataset.corner).sort(),['bl','br','tl','tr']);
  for(const button of buttons){assert.equal(button.closest('.paper-piece'),null);assert.ok(button.getAttribute('aria-label'));assert.equal(button.disabled,false);}
  t.sync();assert.equal(t.board.querySelector('.corner-peel-controls'),controls);assert.equal(t.board.querySelectorAll('.corner-peel-grip').length,4);
  t.sync(false);assert.equal(controls.hidden,true);assert.ok(buttons.every(button=>button.disabled));t.emit('pointerdown',buttons[0]);settled(t);assert.equal(t.callbacks.starts,0);
});

check('held drag tracks progress, captures only its pointer and leaves all character content untouched',()=>{
  const t=fixture();t.sync();const source=t.board.querySelector('.card-face'),sourceBefore=source.outerHTML,artBefore=t.board.querySelector('.card-underpaint').outerHTML,paperBefore=t.board.querySelector('.paper-piece').outerHTML;
  const button=pull(t,.5);assert.equal(button.hasPointerCapture(7),true);assert.ok(t.api.isActive());near(progress(t),.5,'continuous held progress',.0001);
  assert.equal(t.board.querySelectorAll('.corner-peel-mesh').length,1);const current=progress(t);
  t.emit('pointermove',t.windowEvents,{pointerId:42,clientX:40,clientY:50});t.emit('pointerup',t.windowEvents,{pointerId:42});t.frames(3);near(progress(t),current,'unrelated pointer does not move held paper',.0001);assert.ok(button.classList.contains('is-held'));
  t.sync();assert.equal(t.board.querySelectorAll('.corner-peel-mesh').length,1,'normal layout sync keeps the gesture');
  t.emit('pointerup',t.windowEvents);assert.equal(button.hasPointerCapture(7),false);const raised=progress(t);t.frames(1);assert.ok(progress(t)<raised,'release begins falling');t.frames(150);settled(t);
  assert.equal(source.outerHTML,sourceBefore);assert.equal(t.board.querySelector('.card-underpaint').outerHTML,artBefore);assert.equal(t.board.querySelector('.paper-piece').outerHTML,paperBefore);assert.equal(t.writes,0,'peeling never persists a different character or layout');assert.deepEqual(t.callbacks,{starts:1,ends:1});
});

check('successive quarter, half and full pulls remain distinct and return to exactly the closed surface',()=>{
  const t=fixture();t.sync();let prior=0;
  for(const amount of [.25,.5,1]){
    pull(t,amount,'tr');assert.ok(progress(t)>prior+.1);prior=progress(t);const bands=t.board.querySelectorAll('.corner-peel-band');assert.ok(bands.length>10,'narrow strips model a flexible surface');assert.ok(bands.some(node=>node.style.transform!==bands[0].style.transform),'paper bends rather than rigidly translates');
    const copies=t.board.querySelectorAll('.corner-peel-copy'),resources=t.board.querySelector('.corner-peel-resources'),surface=resources.querySelector('.card-face-surface');assert.equal(copies.length,bands.length);assert.equal(resources.querySelectorAll('mask path[fill="black"]').length,1,'one shared resource bank retains the real opening');
    assert.ok(copies.every(copy=>copy.querySelector('.card-face-surface use')?.getAttribute('href')===`#${surface.id}`),'every curved segment uses the same perforated surface');assert.ok(copies.every(copy=>copy.querySelectorAll('mask').length===0),'heavy aperture paths are not duplicated per strip');
    t.emit('pointerup',t.windowEvents);t.frames(150);settled(t);
  }
  assert.deepEqual(t.callbacks,{starts:3,ends:3});
});

check('cancel, lost capture, Escape, blur, tab hiding and printing cannot strand a raised face',()=>{
  for(const cause of ['pointercancel','lostpointercapture','Escape','blur','visibilitychange','beforeprint']){
    const t=fixture();t.sync();const button=pull(t,.6);
    if(cause==='lostpointercapture'){button.releasePointerCapture(7);t.emit(cause,button);}
    else if(cause==='Escape')t.emit('keydown',t.windowEvents,{key:'Escape'});
    else if(cause==='visibilitychange'){t.document.hidden=true;t.emit(cause,t.documentEvents);}
    else t.emit(cause,t.windowEvents);
    t.frames(150);settled(t);assert.equal(t.callbacks.ends,1,`${cause} ends once`);
  }
});

check('reduced motion still follows the hand, then lands immediately without an animated return',()=>{
  const t=fixture({reduced:true});t.sync();pull(t,.5,'tl');near(progress(t),.5,'direct manipulation remains available',.0001);
  t.emit('pointerup',t.windowEvents);settled(t);assert.deepEqual(t.callbacks,{starts:1,ends:1});
});

check('fitted card scale and ancestor zoom preserve how far a mouse pull peels the face',()=>{
  for(const width of [320,480,600])for(const zoom of [.7,1,1.4]){const t=fixture({zoom});t.frame.width=width;t.frame.height=width*870/600;t.sync();const hitSize=parseFloat(t.board.querySelector('.corner-peel-controls').style.getPropertyValue('--corner-hit-size'));assert.ok(hitSize*width/600*zoom>=44-.0001,'corner hit area stays at least 44 screen pixels');pull(t,.6);near(progress(t),.6,'scale-independent grip',.0001);t.api.cancel({immediate:true});settled(t);}
});

check('keyboard corner hold falls back on key release and when focus leaves its grip',()=>{
  for(const exit of ['keyup','blur']){
    const t=fixture();t.sync();const button=grip(t,'tr');t.emit('keydown',button,{key:' ',repeat:false});t.frames(60);near(progress(t),.38,'keyboard hold opens a corner',.0001);
    t.emit(exit,button,{key:' ',bubbles:exit!=='blur'});t.frames(150);settled(t);assert.deepEqual(t.callbacks,{starts:1,ends:1});
  }
});

check('layout changes, disabled preview and removed face clean up capture and pending frames',()=>{
  for(const change of ['moved','disabled','removed']){
    const t=fixture();t.sync();pull(t,.6);
    if(change==='moved')t.frame.width=480;if(change==='removed')t.board.querySelector('.card-face').remove();t.sync(change!=='disabled');settled(t);assert.equal(t.callbacks.ends,1);
  }
});

check('right button is ignored and a held corner consumes rotate/delete keys before component handlers',()=>{
  const t=fixture();t.sync();t.emit('pointerdown',grip(t),{button:2});assert.equal(t.api.isActive(),false);assert.equal(t.callbacks.starts,0);
  let paperKeys=0;t.document.addEventListener('keydown',()=>paperKeys++);pull(t,.4);
  for(const key of ['a','d','Delete','Backspace','z']){const event=t.emit('keydown',t.document.body,{key});assert.ok(event.immediateStopped);}
  assert.equal(paperKeys,0,'a preview cannot rotate, detach or undo a selected component');t.api.cancel({immediate:true});settled(t);
});

check('the hidden original face keeps its SVG resources visible to the lower painted sheet',()=>{
  // The backing's clip-path points into the original face's SVG defs. Hiding
  // that ancestor with visibility:hidden also hides the referenced clip shape
  // in native browsers, making the lower artwork vanish during the gesture.
  const css=readFileSync(new URL('../dist/workshop/workshop-peel.css',import.meta.url),'utf8');
  const rules=[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([,selector,body])=>({selectors:selector.trim().split(',').map(value=>value.trim()),body}));
  const face=rules.filter(rule=>rule.selectors.includes('.card-sheet.is-corner-peeling>.card-face-shell>.card-face'));
  assert.ok(face.some(rule=>/\bopacity\s*:\s*0\s*!important/.test(rule.body)),'source pixels fade while the SVG definitions remain usable');
  assert.ok(face.every(rule=>!/(?:visibility\s*:\s*hidden|display\s*:\s*none)/.test(rule.body)),'do not remove visibility from the shared SVG resource owner');
  const copies=rules.filter(rule=>rule.selectors.includes('.card-sheet .corner-peel-copy'));
  assert.ok(copies.some(rule=>/\bopacity\s*:\s*1\s*!important/.test(rule.body)),'every bent copy explicitly restores opacity');
  const resources=rules.filter(rule=>rule.selectors.includes('.corner-peel-resources'));
  assert.ok(resources.some(rule=>/\bopacity\s*:\s*0\b/.test(rule.body)&&/\bvisibility\s*:\s*visible\b/.test(rule.body)),'resource bank stays visible to SVG use and mask resolution while its own pixels are transparent');
});

check('one shared bank keeps ink, lower clip and all bent faces connected without duplicate resources',()=>{
  const t=fixture();t.sync();pull(t,.6);const resources=t.board.querySelector('.corner-peel-resources');assert.equal(t.board.querySelectorAll('.corner-peel-resources').length,1);assert.equal(resources.querySelectorAll('mask').length,1);
  const ids=t.board.querySelectorAll('[id]').map(node=>node.id);assert.equal(ids.length,new Set(ids).size,'shared bank has globally unique resource IDs');
  const bankIds=new Set(resources.querySelectorAll('[id]').map(node=>node.id)),clip=t.board.querySelector('.card-underpaint').style.clipPath.match(/url\(#([^)]*)\)/)?.[1];assert.ok(bankIds.has(clip),'lower painted sheet uses a stable visible outline in the bank');
  for(const copy of t.board.querySelectorAll('.corner-peel-copy'))for(const node of [copy,...copy.querySelectorAll('*')])for(const {value}of node.attributes)for(const ref of value.matchAll(/url\(#([^)]*)\)/g))assert.ok(bankIds.has(ref[1]),`ink clipping ${ref[1]} resolves to shared resources`);
  t.emit('pointerup',t.windowEvents);t.frames(150);settled(t);
});

check('the falling face casts cut-out shadows with live resource links that clean up on release',()=>{
  const t=fixture();t.sync();pull(t,.6);const cast=t.board.querySelector('.corner-peel-cast');assert.ok(cast);assert.equal(cast.getAttribute('aria-hidden'),'true');assert.ok(cast.hasAttribute('inert'));
  const uses=cast.querySelectorAll('use');assert.ok(uses.length>10,'curved segments cast their individual perforated silhouettes');
  const ids=new Map(t.board.querySelectorAll('[id]').map(node=>[node.id,node]));
  for(const use of uses){const href=use.getAttribute('href'),surface=ids.get(href.slice(1));assert.ok(surface,`cast reference ${href} is live`);assert.equal(surface.querySelectorAll('mask path[fill="black"]').length,1,'shadow retains the component aperture');}
  t.emit('pointerup',t.windowEvents);t.frames(150);settled(t);
});

check('releasing a component click or a stationary resize re-enables corner grips immediately',()=>{
  const app=readFileSync(new URL('../dist/workshop/workshop.js',import.meta.url),'utf8');
  function snippet(start,end){const from=app.indexOf(start),to=app.indexOf(end,from);assert.ok(from>=0&&to>from,`production markers ${start}`);return app.slice(from,to);}
  const sync=snippet('  function syncCardSheet()', '  function linkedPapers('),endDrag=snippet('  function endDrag(',"  document.addEventListener('pointerup'"),endResize=snippet('  function endResize(', '  function resizeWithKeyboard(');
  const context={};vm.runInNewContext(`
    let drag=null,resizeDrag=null,editingId=null,tableFrame=0,lastPaperTap=null,suppressClickUntil=0;
    const enabled=[],board={},bindingLayout={frame:{x:0,y:0,width:600,height:870}},record={name:'unchanged',hp:85};
    const source={classList:{remove(){}},removeAttribute(){},hasPointerCapture(){return false;}};
    const window={WorkshopSheet:{sync(){}},WorkshopPeel:{sync(options){enabled.push(options.enabled);}}};
    const document={body:{classList:{remove(){},contains(){return false;}}}},$=()=>board,papers=()=>[];
    function cancelAnimationFrame(){} function updateGroupSelection(){} function announce(){} function setLayersOpen(){}
    function chooseModule(){syncCardSheet();}
    ${sync}
    ${endDrag}
    ${endResize}
    const before=JSON.stringify(record);
    drag={id:'hp',pointerId:7,started:false,members:[{source}],handle:source};endDrag({pointerId:7});
    const clickResult={enabled:enabled.at(-1),drag};enabled.length=0;
    resizeDrag={pointerId:7,started:false,members:[{source}],handle:source};syncCardSheet();endResize({pointerId:7});
    globalThis.result={clickResult,resizeResult:{enabled:enabled.at(-1),resizeDrag},unchanged:JSON.stringify(record)===before};
  `,context);
  assert.deepEqual(plain(context.result),{clickResult:{enabled:true,drag:null},resizeResult:{enabled:true,resizeDrag:null},unchanged:true});
});

console.log(`${passed} corner-peel checks passed; ${failed} failed.`);if(failed)process.exitCode=1;

