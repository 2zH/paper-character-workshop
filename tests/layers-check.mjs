import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { workshop } from './held-rotation-check.mjs';
const require = createRequire(import.meta.url);
const Model = require('../dist/workshop/workshop-model.js');
const scope = {window:{}};
vm.runInNewContext(readFileSync(new URL('../dist/workshop/workshop-parts.js',import.meta.url),'utf8'),scope);
const Parts = scope.window.WorkshopParts;

// Parse only element hierarchy and attributes, so checks exercise the renderer's
// interactive structure without adding a browser dependency to this static demo.
function tree(html) {
  const root={tag:'#root',attrs:{},children:[],parent:null},stack=[root];
  for(const token of html.matchAll(/<\/?[A-Za-z][^>]*>/g)) {
    const markup=token[0],closing=markup.startsWith('</'),tag=markup.match(/^<\/?([^\s/>]+)/)[1].toLowerCase();
    if(closing){assert.equal(stack.at(-1).tag,tag,`balanced ${tag}`);stack.pop();continue;}
    const attrs={};
    for(const attr of markup.slice(tag.length+1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[attr[1]]=attr[2]??attr[3]??attr[4]??'';
    const parent=stack.at(-1),node={tag,attrs,children:[],parent};parent.children.push(node);
    if(!markup.endsWith('/>')&&!['img','input','br','hr','meta','link','source','wbr'].includes(tag))stack.push(node);
  }
  assert.equal(stack.length,1,'balanced rendered tree');return root;
}
const all=(node,match)=>node.children.flatMap(child=>[...(match(child)?[child]:[]),...all(child,match)]);
const hasClass=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name);
const hasAttr=(node,name)=>Object.hasOwn(node.attrs,name);
const nodesWith=(node,name)=>all(node,item=>hasAttr(item,name));
const inClass=(node,name)=>{for(let current=node;current;current=current.parent)if(hasClass(current,name))return true;return false;};
const record=Model.createCharacter(),owners=Object.fromEntries(record.modules.map(module=>[module.type,module]));
const kindOwners={'identity-meta':'identity',portrait:'identity',hp:'attributes',mp:'attributes',attribute:'attributes',radar:'attributes',equipment:'equipment',skill:'skills',story:'background',collection:'equipment'};
function paper(kind) {
  const owner=owners[kindOwners[kind]],rowId=kind==='story'?owner.data.fields[0].id:['attribute','equipment','skill'].includes(kind)?owner.data.items[0].id:null;
  return {...owner,id:`test-${kind}`,kind,rowId};
}
const layered=['portrait','hp','mp','attribute','radar','equipment','skill'];
let passed=0,failed=0;
function check(name,run){try{run();passed++;console.log(`PASS ${name}`);}catch(error){failed++;console.error(`FAIL ${name}: ${error.stack}`);}}

for(const kind of layered)check(`${kind} separates real cut surface from underlying artwork`,()=>{
  const p=paper(kind),before=JSON.stringify(p),root=tree(Parts.render(p));
  const bases=all(root,n=>hasClass(n,'paper-underlay')),faces=all(root,n=>hasClass(n,'paper-cut-face'));
  assert.equal(bases.length,1,'exactly one bottom sheet');assert.equal(faces.length,1,'exactly one top sheet');
  assert.equal(bases[0].parent,faces[0].parent,'both layers share an unchanged coordinate box');
  const masks=all(faces[0],n=>n.tag==='mask');assert.ok(masks.length,'upper paper has a physical cut mask');
  for(const mask of masks){assert.ok(all(mask,n=>n.attrs.fill==='white').length,'outer paper is opaque');assert.ok(all(mask,n=>n.attrs.fill==='black').length,'cut windows are transparent');}
  assert.equal(JSON.stringify(p),before,'rendering layers never changes saved character data');
  assert.ok(!/NaN|Infinity|undefined/.test(Parts.render(p)),'finite geometry');
});

check('copied papers and live re-renders never collide in SVG mask IDs',()=>{
  const originals=layered.map(kind=>Parts.render(paper(kind))),copies=layered.map(kind=>Parts.render({...paper(kind),id:`copy-${kind}`}));
  const rerenders=layered.map(kind=>Parts.render(paper(kind))),root=tree([...originals,...copies,...rerenders].join(''));
  const ids=nodesWith(root,'id').map(n=>n.attrs.id);assert.equal(new Set(ids).size,ids.length,'all SVG resources are independently addressable');
  for(const node of all(root,n=>Object.values(n.attrs).some(value=>/url\(#/.test(value))))for(const value of Object.values(node.attrs))for(const ref of value.matchAll(/url\(#([^)]*)\)/g))assert.ok(ids.includes(ref[1]),`local resource ${ref[1]} exists`);
});

check('layered inline fields stay unique and cannot be discarded by live-art refresh',()=>{
  for(const kind of layered){
    const root=tree(Parts.render(paper(kind))),fields=nodesWith(root,'data-inline-path');
    const paths=fields.map(node=>node.attrs['data-inline-path']);assert.equal(paths.length,new Set(paths).size,`${kind} has one editor per value`);
    for(const field of fields){assert.ok(inClass(field,'paper-cut-face'),`${kind} editable ink stays on face`);for(let parent=field.parent;parent;parent=parent.parent)assert.ok(!hasAttr(parent,'data-live-art'),`${kind} fields survive artwork replacement`);}
    const live=nodesWith(root,'data-live-art').map(n=>n.attrs['data-live-art']);assert.equal(live.length,new Set(live).size,`${kind} artwork refresh selectors resolve uniquely`);
  }
});

check('HP, MP and skill pigment on the bottom sheet follows current values',()=>{
  for(const kind of ['hp','mp','skill']){
    const p=paper(kind),data=structuredClone(p.data);p.data=data;
    if(kind==='skill')data.items[0].value=37.5;else{data[kind]=37.5;data[kind==='hp'?'maxHp':'maxMp']=100;}
    const marker=kind==='skill'?`skill-fill-${p.rowId}`:`${kind}-fill`,root=tree(Parts.render(p));
    const pigment=all(root,n=>n.attrs['data-live-art']===marker);assert.equal(pigment.length,1);assert.ok(inClass(pigment[0],'paper-underlay'),'colour remains on bottom sheet');
    assert.match(pigment[0].attrs.style,/width:37\.5%/);
    const field=nodesWith(root,'data-inline-path').find(n=>n.attrs['data-inline-path']===`data.${kind==='skill'?'items.0.value':kind}`);assert.ok(field,'same character field remains editable');
  }
});

check('portrait and equipment art belong to the bottom sheet, not the raised face',()=>{
  const portrait=tree(Parts.render(paper('portrait'))),knight=all(portrait,n=>hasClass(n,'atomic-knight'));
  assert.equal(knight.length,1);assert.ok(inClass(knight[0],'paper-underlay'));
  const gear=paper('equipment'),root=tree(Parts.render(gear)),drawing=all(root,n=>n.attrs['data-live-art']===`equipment-art-${gear.rowId}`);
  assert.equal(drawing.length,1);assert.ok(inClass(drawing[0],'paper-underlay'));
  const toggle=all(root,n=>n.attrs['data-card-action']==='toggle-equipment');assert.equal(toggle.length,1);assert.ok(inClass(toggle[0],'paper-cut-face'),'equipment toggle remains on face');
});

check('live-art replacement keeps every SVG mask reference connected to its new resource',()=>{
  for(const kind of layered){
    const p=paper(kind),old=tree(Parts.render(p));p.data=structuredClone(p.data);
    if(p.data.items?.length){p.data.items[0].value=123.5;p.data.items[0].key='NEW';p.data.items[0].equipped=false;}
    if(kind==='hp')p.data.hp=12;if(kind==='mp')p.data.mp=67;
    const next=tree(Parts.render(p));
    // Match refreshPaperArtwork's query-and-move behaviour, including template
    // resources regenerated with new IDs. This catches dangling url(#mask) refs.
    for(const node of nodesWith(old,'data-live-art')){
      const replacement=all(next,n=>n.attrs['data-live-art']===node.attrs['data-live-art'])[0];if(!replacement)continue;
      const parent=node.parent,index=parent.children.indexOf(node);if(index<0)continue;
      replacement.parent.children.splice(replacement.parent.children.indexOf(replacement),1);
      parent.children[index]=replacement;replacement.parent=parent;
    }
    const ids=nodesWith(old,'id').map(n=>n.attrs.id);assert.equal(ids.length,new Set(ids).size,`${kind} refresh resources stay unique`);
    for(const node of all(old,n=>Object.values(n.attrs).some(value=>/url\(#/.test(value))))for(const value of Object.values(node.attrs))for(const ref of value.matchAll(/url\(#([^)]*)\)/g))assert.ok(ids.includes(ref[1]),`${kind} refreshed mask ${ref[1]} remains connected`);
  }
});

check('plain identity, story and empty collection keep their original editable paper structure',()=>{
  for(const kind of ['identity-meta','story','collection']){
    const p=paper(kind),root=tree(Parts.render(p));assert.equal(all(root,n=>hasClass(n,'paper-cut-face')).length,0);assert.equal(all(root,n=>hasClass(n,'paper-underlay')).length,0);
    if(kind!=='collection')assert.ok(nodesWith(root,'data-inline-path').length>0,'plain sheet is still editable');
  }
});

check('Escape closes the peel view without changing the selected papers or saved layout',()=>{
  const t=workshop(),before=JSON.stringify(t.state.current);t.body.classList.add('layers-open');t.key('Escape');
  assert.equal(t.body.classList.contains('layers-open'),false);assert.equal(JSON.stringify(t.state.current),before);assert.equal(t.state.undoStack.length,0);assert.equal(t.state.selectionVisible,true);
});

check('beginning inline editing closes the peel view and keeps paper geometry',()=>{
  const t=workshop(),before=t.state.current.modules.map(item=>[item.pose.x,item.pose.y,item.pose.angle,item.paperWidth]);
  t.body.classList.add('layers-open');t.choose('identity',{edit:true});
  assert.equal(t.body.classList.contains('layers-open'),false);assert.equal(t.state.editingId,'identity');
  assert.deepEqual(t.state.current.modules.map(item=>[item.pose.x,item.pose.y,item.pose.angle,item.paperWidth]),before);
});

check('double tapping the exposed bottom sheet closes it and starts writing after pointer capture',()=>{
  const t=workshop(),before=t.state.current.modules.map(item=>[item.pose.x,item.pose.y,item.pose.angle,item.paperWidth]);
  t.body.classList.add('layers-open');
  for(let i=0;i<2;i++){t.dispatch('pointerdown',{target:t.content('identity')});t.up();}
  assert.equal(t.body.classList.contains('layers-open'),false);assert.equal(t.state.editingId,'identity');
  assert.deepEqual(t.state.current.modules.map(item=>[item.pose.x,item.pose.y,item.pose.angle,item.paperWidth]),before);
  assert.equal(t.state.undoStack.length,0);
});

console.log(`${passed} layered-paper render checks passed; ${failed} failed.`);if(failed)process.exitCode=1;
