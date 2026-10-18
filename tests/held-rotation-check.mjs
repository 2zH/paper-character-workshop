import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const Model=require('../dist/workshop/workshop-model.js');

// Execute the production keyboard/pointer handlers with a small deterministic DOM.
// This checks gesture state and persistence; live browser checks cover native capture.
const source = readFileSync(new URL('../dist/workshop/workshop.js', import.meta.url), 'utf8');
function extract(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `production source markers exist: ${start}`);
  return source.slice(from, to);
}
const helpers = extract('  const clamp =', '  function duplicateModule(');
const paperCommands=extract('  function duplicateModule(', '  function finish(');
const atomicHelpers=extract('  const atomicTypes=', '  function getPath(');
const fieldHelpers=extract('  function getPath(', "  document.addEventListener('click',event=>{");
const keyboard = extract("  document.addEventListener('keydown',event=>{", "  $('#import-file').addEventListener(");
const pointer = extract('  // The paper itself moves', '  new ResizeObserver(');
const bindingScope={window:{}};
vm.runInNewContext(readFileSync(new URL('../dist/workshop/workshop-parts.js',import.meta.url),'utf8'),bindingScope);
vm.runInNewContext(readFileSync(new URL('../dist/workshop/workshop-binding.js',import.meta.url),'utf8'),bindingScope);

export function workshop({ reduced = false, initialCurrent=null, dynamicDimensions=false, viewportHeight=1000, boardWidth=1000, actualCommands=false, autoSplit=false } = {}) {
  const context = vm.createContext({ reduced, initialCurrent, dynamicDimensions, viewportHeight, boardWidth, actualCommands, autoSplit, CSS:{escape:value=>value}, M:Model, Parts:bindingScope.window.WorkshopParts, Binding:bindingScope.window.WorkshopBinding });
  vm.runInContext(`
    const clone = value => JSON.parse(JSON.stringify(value));
    const handlers = {}, raf = new Map(), notices = [];
    let nextFrame = 0, now = 0, saves = [], undoStack = [];
    let selectedId = 'identity', selectionVisible = true, preview = false, dialogOpen = false;
    let editingId = null, settingsId = null, bindingLayout = null;
    const calls = { duplicate: 0, remove: 0, renders: 0, animated: 0 };
    let current = initialCurrent?clone(initialCurrent):{step:0,status:'complete',bindingEnabled:false,modules:[
      {id:'identity',type:'identity',width:'half',mounted:false,pose:{x:20,y:20,angle:2,z:1}},
      {id:'attributes',type:'attributes',width:'half',mounted:false,pose:{x:55,y:20,angle:-1,z:2}}
    ]};
    const papers=()=>M.getPapers(current),paperById=id=>papers().find(item=>item.id===id),ownerOf=paper=>paper?.owner||paper;
    const steps = ['identity','attributes','skills','equipment','background'].map(type=>({type}));
    const toast=text=>notices.push(text);
    function classes() {
      const values = new Set();
      return {add: value=>values.add(value),remove:value=>values.delete(value),contains:value=>values.has(value),toggle(value,on){if(on)values.add(value);else values.delete(value);}};
    }
    function paper(id) {
      const captured = new Set(), attrs = new Map();
      return {
        dataset:{moduleId:id}, style:{setProperty(key,value){this[key]=value;}}, classList:classes(),
        get offsetWidth(){return dynamicDimensions?parseFloat(this.style.width)||200:200;},
        get offsetHeight(){if(!dynamicDimensions)return 200;const module=paperById(id),size=Binding.naturalSize(module);return parseFloat(this.style.height)||this.offsetWidth*size.h/size.w;},
        setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key),
        getAttribute:key=>attrs.get(key),
        setPointerCapture:id=>captured.add(id),releasePointerCapture:id=>captured.delete(id),
        hasPointerCapture:id=>captured.has(id),animate:()=>calls.animated++,
        querySelectorAll:()=>[],querySelector:()=>null,
        closest(selector){return selector==='.paper-piece'?this:null;}
      };
    }
    const paperNodes = Object.fromEntries(papers().map(module=>[module.id,paper(module.id)]));
    let dropGuide=null;
    const board = {
      clientWidth:boardWidth,style:{height:'1000px',setProperty(key,value){this[key]=value;}},
      get offsetHeight(){return parseFloat(this.style.height);},
      getBoundingClientRect(){return {left:0,top:100,width:this.clientWidth};},
      querySelector(selector){return selector==='.binding-drop-guide'?dropGuide:paperNodes[selector.match(/data-module-id="([^"]+)"/)?.[1]]||null;},
      querySelectorAll(selector){return selector==='.paper-piece'?Object.values(paperNodes):[];},
      append(node){dropGuide=node;},scrollIntoView(){}
    };
    const body = {classList:classes(),closest:()=>null};
    const input = {value:'unchanged',closest:selector=>selector.includes('input,textarea')?input:null};
    function content(id) {
      return {closest(selector){if(selector==='.paper-piece')return paperNodes[id];if(selector==='.piece-content')return this;return null;}};
    }
    const document = {body,createElement:()=>({style:{}}),querySelector:selector=>board.querySelector(selector),querySelectorAll:()=>[],addEventListener(type,handler){(handlers[type]??=[]).push(handler);}};
    const $ = selector=>selector==='#paper-board'?board:selector==='#component-dialog'?{close(){}}:selector==='dialog[open]'&&dialogOpen?{}:null;
    const window = {scrollBy(){}};
    const innerHeight=viewportHeight, performance={now:()=>now+=16};
    const requestAnimationFrame=fn=>{const id=++nextFrame;raf.set(id,fn);return id;};
    const cancelAnimationFrame=id=>raf.delete(id);
    const motion=()=>reduced?'auto':'smooth';
    const activeModule=()=>paperById(selectedId);
    const announce=text=>notices.push(text);
    function remember(snapshot=clone(current)){undoStack.push(snapshot);}
    function persist(){saves.push(clone(current));}
    function scheduleSave(){persist();}
    function flushEdit(){}
    function renderNavigation(){}
    function renderInspector(){}
    function updatePaperClasses(){const visible=papers();for(const id of Object.keys(paperNodes))if(!visible.some(item=>item.id===id))delete paperNodes[id];for(const module of visible){const node=paperNodes[module.id]??=paper(module.id);node.classList.toggle('binding-primary',!module.kind&&current.bindingEnabled&&['identity','attributes','equipment'].includes(module.type));node.classList.toggle('atomic-piece',!!module.kind);}}
    function renderBoard(){calls.renders++;updatePaperClasses();layoutTable();}
    function render(){if(actualCommands)syncAtomicRows();renderBoard();if(autoSplit&&splitLegacyPapers())renderBoard();}
    function focusPaper(){}
    function syncPaperSelection(){}
    function clearPaperSelection(){selectionVisible=false;}
    function chooseModule(id){selectedId=id;selectionVisible=true;}
    function mutate(operation){remember();operation();render();persist();}
    function undo(){if(undoStack.length){current=undoStack.pop();render();persist();}}
    ${actualCommands?paperCommands:'function duplicateModule(){calls.duplicate++;} function removeModule(){calls.remove++;}'}
    ${helpers}
    ${atomicHelpers}
    ${fieldHelpers}
    ${keyboard}
    ${pointer}
    updatePaperClasses();layoutTable();
    globalThis.test = {
      get state(){return {current,drag,resizeDrag,bindingLayout,selectedId,selectionVisible,saves,undoStack,calls,rafSize:raf.size};},
      papers:paperNodes,input,body,board,content,model: M,partsAPI: Parts,
      allPapers:papers,paperById,split:()=>{const changed=splitLegacyPapers();if(changed)renderBoard();return changed;},sync:syncAtomicRows,
      duplicate:duplicateModule,remove:removeModule,restore:restorePart,addPart:addAtomicPart,select:id=>{selectedId=id;selectionVisible=true;},
      assemble:assembleAll,writeField,normalizeField,formAction,
      field(id,path,value,type='number'){return {dataset:{path},value,type,step:'any',hasAttribute:()=>false,matches:selector=>selector==='[data-path]',closest(selector){if(selector==='[data-module-id]'||selector==='.paper-piece')return paperNodes[id];return null;}};},
      layout:()=>layoutTable(),render:()=>render(),persist:()=>persist(),
      rotate:rotateModule,detach:detachModule,rememberCardPlacement,
      resizeHandle(id,corner){const captures=new Set();return {dataset:{resize:corner},closest(selector){if(selector==='[data-resize]')return this;if(selector==='.paper-piece')return paperNodes[id];return null;},setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};},
      dispatch(type,overrides={}){
        const event={target:body,button:0,pointerId:1,clientX:245,clientY:340,
          metaKey:false,ctrlKey:false,altKey:false,shiftKey:false,isComposing:false,repeat:false,
          defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...overrides};
        for(const handler of handlers[type]??[])handler(event);
        return event;
      },
      frames(count=1){for(let i=0;i<count;i++){const pending=[...raf.values()];raf.clear();for(const fn of pending)fn();}},
      setDialog(value){dialogOpen=value;},setPreview(value){preview=value;},setEditing(id){editingId=id;paperNodes[id].classList.add('is-editing');}
    };
  `, context);
  const t = context.test;
  t.down = (id = 'identity') => t.dispatch('pointerdown', { target: t.content(id) });
  t.key = (key, options = {}) => t.dispatch('keydown', { key, ...options });
  t.move = (x, y) => t.dispatch('pointermove', { clientX: x, clientY: y });
  t.up = () => t.dispatch('pointerup');
  return t;
}
const plain = value => JSON.parse(JSON.stringify(value));
const pose = t => plain(t.state.current.modules[0].pose);
function checkGrip(t) {
  const d = t.state.drag;
  const match = d.source.style.transform.match(/translate3d\(([-\d.e]+)px,([-\d.e]+)px,0\) rotate\(([-\d.e]+)deg\) scale\(([-\d.e]+)\)/);
  assert.ok(match, 'held paper transform exists');
  const [x,y,angle,scale] = match.slice(1).map(Number), r = angle*Math.PI/180;
  const gripX = d.grip.x*scale*Math.cos(r)-d.grip.y*scale*Math.sin(r);
  const gripY = d.grip.x*scale*Math.sin(r)+d.grip.y*scale*Math.cos(r);
  assert.ok(Math.abs(x+d.w/2+gripX-d.pointerX)<1e-8,'horizontal grip remains under pointer');
  assert.ok(Math.abs(100+y+d.h/2+gripY-d.pointerY)<1e-8,'vertical grip remains under pointer');
}
let passed = 0;
function check(name, run) { run(); passed++; console.log(`PASS ${name}`); }

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
check('hold without movement rotates, preserves capture and commits one undo', () => {
  const t=workshop(), before=pose(t);
  t.down();
  assert.equal(t.state.drag.started,false);
  assert.equal(t.key('d').defaultPrevented,true);
  assert.equal(t.state.drag.started,true);
  assert.equal(t.state.drag.baseAngle,5);
  assert.equal(t.state.drag.angle,5);
  assert.equal(t.papers.identity.hasPointerCapture(1),true);
  assert.equal(t.state.calls.renders,0);
  checkGrip(t);
  t.key('d');t.key('a');
  t.up();
  assert.equal(t.state.drag,null);
  assert.equal(pose(t).angle,5);
  assert.equal(t.state.undoStack.length,1);
  assert.equal(t.state.saves.at(-1).modules[0].pose.angle,5);
  assert.equal(t.papers.identity.hasPointerCapture(1),false);
  t.key('z',{metaKey:true});
  assert.deepEqual(pose(t),before,'one undo restores entire gesture');
});

check('moving and repeated rotation retain angle on drop and fixed grip', () => {
  const t=workshop();t.down();t.move(400,420);t.frames(4);
  t.key('d');t.frames(20);checkGrip(t);
  t.move(360,400);t.key('a');t.key('a');t.frames(30);checkGrip(t);
  assert.equal(t.state.drag.baseAngle,-1);
  t.up();
  assert.equal(pose(t).angle,-1,'drop does not replace explicit rotation with horizontal motion');
  assert.notEqual(pose(t).x,20);
  assert.equal(t.state.undoStack.length,1);
});

check('held paper receives A/D despite previous input or another paper focus', () => {
  const t=workshop();t.down('attributes');
  assert.equal(t.key('d',{target:t.input}).defaultPrevented,true);
  assert.equal(t.state.drag.baseAngle,2);
  assert.equal(t.key('a',{target:t.papers.identity}).defaultPrevented,true);
  assert.equal(t.state.drag.baseAngle,-1);
  assert.equal(t.input.value,'unchanged');
  assert.equal(t.state.current.modules[0].pose.angle,2);
  assert.equal(t.state.calls.renders,0);
});

for(const cancellation of ['Escape','pointercancel'])check(`${cancellation} restores original pose and ends capture without undo`,()=>{
  const t=workshop(), before=pose(t);t.down();t.move(360,400);t.key('d');
  if(cancellation==='Escape')t.key('Escape');else t.dispatch('pointercancel');
  assert.deepEqual(pose(t),before);
  assert.equal(t.state.drag,null);
  assert.equal(t.state.undoStack.length,0);
  assert.equal(t.state.rafSize,0);
  assert.equal(t.papers.identity.hasPointerCapture(1),false);
  assert.equal(t.papers.identity.classList.contains('paper-lifted'),false);
  assert.equal(t.body.classList.contains('is-dragging'),false);
});

check('reduced motion keeps deliberate rotation but removes sway/scale animation',()=>{
  const t=workshop({reduced:true});t.down();t.move(400,420);t.key('d');t.frames(10);
  assert.equal(t.state.drag.angle,5);
  assert.equal(t.state.drag.scale,1);
  checkGrip(t);t.up();
  assert.equal(pose(t).angle,5);
  assert.equal(t.state.calls.animated,0);
});

check('held rotation respects both limits, including repeated keys',()=>{
  const t=workshop();t.down();
  for(let i=0;i<20;i++)t.key('d',{repeat:i>0});
  assert.equal(t.state.drag.baseAngle,15);
  t.move(400,420);t.frames(4);
  assert.ok(t.state.drag.angle<=15);
  for(let i=0;i<20;i++)t.key('a',{repeat:i>0});
  assert.equal(t.state.drag.baseAngle,-15);
  t.up();assert.equal(pose(t).angle,-15);
});

check('typing and editing shortcuts stay protected when no paper is held',()=>{
  const t=workshop(), before=pose(t);
  for(const key of ['a','d','A','D'])assert.equal(t.key(key,{target:t.input}).defaultPrevented,false);
  assert.equal(t.key('d',{metaKey:true,target:t.input}).defaultPrevented,false);
  assert.equal(t.key('d',{ctrlKey:true,target:t.input}).defaultPrevented,false);
  assert.deepEqual(pose(t),before);
  assert.equal(t.state.calls.duplicate,0);
  assert.equal(t.key('d',{metaKey:true}).defaultPrevented,true);
  assert.equal(t.key('d',{ctrlKey:true}).defaultPrevented,true);
  assert.equal(t.state.calls.duplicate,2);
  assert.deepEqual(pose(t),before,'copy chord does not rotate');
});

check('modifiers, IME, dialogs and preview cannot accidentally rotate held paper',()=>{
  const t=workshop();t.down();
  for(const options of [{metaKey:true},{ctrlKey:true},{altKey:true},{isComposing:true}])t.key('d',options);
  assert.equal(t.state.calls.duplicate,0);
  assert.equal(t.state.drag.baseAngle,2);
  t.setDialog(true);t.key('d');t.setDialog(false);
  t.setPreview(true);t.key('d');t.setPreview(false);
  assert.equal(t.state.drag.baseAngle,2);
  assert.equal(t.state.drag.started,false);
});

console.log(`${passed} held-rotation regression checks passed.`);
}
