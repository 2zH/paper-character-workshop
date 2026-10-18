(() => {
  'use strict';
  const M = window.WorkshopModel, Forms = window.WorkshopForms, Cards = window.WorkshopCards, Binding = window.WorkshopBinding, Parts = window.WorkshopParts;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const STORAGE = 'paper-character-workshop-v1';
  const steps = [
    {type:'identity',name:'身份',en:'A NAME',guide:'给冒险者一个名字。年龄、职业与第一印象，都写在这一张纸上。'},
    {type:'attributes',name:'属性',en:'PAPER DOTS',guide:'自由填写属性。纸孔使用相对刻度；需要时可开启自定义规则校验。'},
    {type:'skills',name:'技能',en:'LITTLE TALENTS',guide:'自由记录角色的本领与数值。总额、范围及整数要求可以单独设置。'},
    {type:'equipment',name:'装备',en:'IN THE BAG',guide:'把随身物品放进纸窗。数量、重量、说明与装配状态可以分别填写。'},
    {type:'background',name:'背景',en:'A STORY',guide:'写下牵挂、来历与心愿。每个故事片段都能自由增加和移除。'},
    {type:'review',name:'检查装订',en:'READY TO GO',guide:'最后看一遍所有纸片，检查配点，收好这一张属于你的角色卡。'}
  ];
  const libraryDescriptions = {identity:'人物立绘、姓名、年龄与职业。',attributes:'自由填写属性数值，可选自定义规则校验。',skills:'自由记录技能数值，可选自定义规则校验。',equipment:'手绘物品窗口与可扩展行囊。',background:'有横线的故事笺，写下角色牵挂。'};
  const symbols = {identity:'♢',attributes:'◌',skills:'✧',equipment:'⌑',background:'✎'};
  let characters = [], current, selectedId, selectionVisible = false, preview = false, undoStack = [], editSession = null, toastTimer, saveTimer, saveFailed = false;
  let editingId = null, settingsId = null, bindingLayout = null, selectedIds = new Set();
  let loadNotice = '';
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.characters)) throw new Error('invalid storage');
      characters = saved.characters.map(item => M.normalizeCharacter(item).character);
      current = characters.find(item => item.id === saved.activeId) || characters[0];
    }
  } catch { loadNotice = '本地记录暂时无法读取。原记录未被覆盖；可导入之前导出的角色备份。'; saveFailed = true; }
  if (!current) { current = M.createCharacter({sample:true}); characters.push(current); }
  selectedId = current.modules.find(item => item.type === steps[current.step].type)?.id || current.modules[0]?.id;
  const characterName = c => c.modules.find(item => item.type === 'identity' && item.data.name.trim())?.data.name || '未命名的冒险者';
  const papers = () => M.getPapers(current);
  const paperById = id => papers().find(item=>item.id===id);
  const ownerOf = paper => paper?.owner||paper;
  const activeModule = () => paperById(selectedId);
  const stepErrors = type => M.validateCharacter(current).errors.filter(error => current.modules.find(item => item.id === error.moduleId)?.type === type || (!error.moduleId && type === 'identity'));
  const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  function announce(text) { $('#drag-announcement').textContent = text; }
  function toast(text) { $('#toast').textContent=text; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2800); }
  function persist() {
    clearTimeout(saveTimer);
    current.name=characterName(current); current.updatedAt=new Date().toISOString();
    const i=characters.findIndex(item=>item.id===current.id);
    if(i<0) characters.push(current); else characters[i]=current;
    if (saveFailed) { $('#save-status').textContent='请导出备份'; return false; }
    try { localStorage.setItem(STORAGE,JSON.stringify({activeId:current.id,characters})); $('#save-status').textContent='已保存在此浏览器'; return true; }
    catch { $('#save-status').textContent='存储空间不足，请导出'; toast('浏览器暂时无法保存，请导出 JSON 留存角色。'); return false; }
  }
  function scheduleSave() { $('#save-status').textContent='正在保存…'; clearTimeout(saveTimer); saveTimer=setTimeout(persist,300); }
  function remember(snapshot=clone(current)) { undoStack.push(snapshot); if(undoStack.length>40)undoStack.shift(); $('#undo-button').disabled=false; }
  function flushEdit() {
    if (!editSession) return;
    if (JSON.stringify(editSession) !== JSON.stringify(current)) remember(editSession);
    editSession=null;
  }
  function mutate(operation, message) { flushEdit(); remember(); operation(); current.status='draft'; render(); persist(); if(message)toast(message); }
  function undo() {
    flushEdit(); const previous=undoStack.pop(); if(!previous)return;
    current=previous; if(!paperById(selectedId))selectedId=papers()[0]?.id;
    render(); persist(); toast('已恢复上一步。');
  }

  function renderNavigation() {
    const validation=M.validateCharacter(current);
    $('#character-heading').textContent=characterName(current);
    $('#character-signature').textContent=current.status==='complete'?'BOUND & READY':'A CHARACTER IN THE MAKING';
    $('#step-nav').innerHTML=steps.map((step,index)=>{
      const modules=current.modules.filter(item=>item.type===step.type);
      const done=index===5?current.status==='complete':modules.length>0 && stepErrors(step.type).length===0;
      return `<button data-action="step" data-step="${index}" class="${done?'done':''}" ${index===current.step?'aria-current="step"':''} aria-label="第${index+1}步 ${step.name}"><span>${done?'✓':String(index+1).padStart(2,'0')}</span><div><b>${step.name}</b><small>${step.en}</small></div></button>`;
    }).join('');
    $('#module-count').textContent=`${papers().length} 张独立纸片 · ${new Set(current.modules.map(item=>item.type)).size} 类组件`;
    $('#journey-progress').textContent=`${String(current.step+1).padStart(2,'0')} / 06 · ${steps[current.step].name}`;
    $('#journey-hint').textContent=current.step===5?validation.valid?'检查通过，可以装订保存。':`还有 ${validation.errors.length} 处需要填写或调整。`:'布局与填写内容会自动保存在此浏览器。';
    $('#previous-step').disabled=current.step===0;
    $('#next-step').textContent=current.step===5?'完成并保存 ✓':`下一步：${steps[current.step+1].name} →`;
    $('#next-step').disabled=current.step===5&&!validation.valid;
    $('#undo-button').disabled=undoStack.length===0;
    $('#unbind-button').hidden=!current.bindingEnabled;
    $('#base-button').hidden=current.bindingEnabled;
    $('#fit-button').hidden=!current.bindingEnabled;
    const hasCutPaper=papers().some(paper=>['portrait','hp','mp','attribute','radar','equipment','skill'].includes(paper.kind));
    $('#layers-button').disabled=!hasCutPaper;
    if(!hasCutPaper)setLayersOpen(false);
    $('#assembly-caption').textContent=current.bindingEnabled?'Shift 多选 · G 组合 / Shift+G 解组 · 拖四角缩放 · A / D 旋转 · 双击填写':'Shift 多选 · G 组合 / Shift+G 解组 · 拖四角缩放 · A / D 旋转 · 双击填写';
  }
  function pieceHTML(module) {
    const selected=selectionVisible&&selectionMembers(selectedId).some(item=>item.id===module.id);
    const mounted=!!(current.bindingEnabled&&module.mounted),primary=!!bindingLayout?.primaryIds?.includes(module.id),atomic=!!module.kind;
    const content=atomic?Parts.render(module):primary?Binding.renderModule(module):Cards.render(module,{selected,stepActive:module.type===steps[current.step].type});
    const footer=primary||atomic?'<div class="paper-edit-footer"><span>直接在纸面上填写</span><button data-action="paper-settings">条目与规则</button><button data-action="finish-inline">完成填写 ✓</button></div>':'';
    return `<article class="paper-piece ${selected?'selected':''} ${editingId===module.id?'is-editing':''} ${primary?'binding-primary':''} ${atomic?'atomic-piece':''} ${selected&&selectionMembers(selectedId).length>1?'multi-selected':''}" data-group-id="${esc(module.groupId||'')}" data-part-kind="${module.kind||''}" data-owner-id="${module.parentId||module.id}" data-mounted="${mounted}" data-module-id="${module.id}" data-width="${module.width}" tabindex="0" role="group" aria-label="${esc(module.title)}纸雕组件" aria-describedby="assembly-caption" aria-keyshortcuts="A D G Shift+G Meta+d Control+d Delete Backspace">
      <button class="piece-edit-button" data-action="edit-module" aria-label="填写${esc(module.title)}组件" title="填写" tabindex="${selected?0:-1}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15.5 4.5 4 4M4 20l4.8-1.1L20 7.7a2.8 2.8 0 0 0-4-4L4.9 15zM5 15l4 4"/></svg></button>
      ${['nw','ne','sw','se'].map(corner=>`<button class="paper-resize-handle resize-${corner}" data-resize="${corner}" aria-label="缩放${esc(module.title)}组件${{nw:'左上',ne:'右上',sw:'左下',se:'右下'}[corner]}角" title="拖动调整大小" tabindex="${selected?0:-1}"></button>`).join('')}
      <div class="piece-content" data-action="select-module">${content}${footer}</div>${editingId===module.id?'<div class="paper-rule-feedback" role="status" aria-live="polite"></div>':''}${settingsId===module.id?`<section class="paper-settings inspector" aria-label="${esc(module.title)}条目与规则">${Forms.render(module)}<button data-action="paper-settings">收起这页设置</button></section>`:''}
    </article>`;
  }
  function syncPaperSelection() {
    document.querySelectorAll('.paper-piece').forEach(el=>{
      const selected=selectionVisible&&selectionMembers(selectedId).some(item=>item.id===el.dataset.moduleId);el.classList.toggle('multi-selected',selected&&selectionMembers(selectedId).length>1);
      el.classList.toggle('selected',selected);el.querySelector('.piece-edit-button').tabIndex=selected?0:-1;el.querySelectorAll('.paper-resize-handle').forEach(handle=>handle.tabIndex=selected?0:-1);const module=paperById(el.dataset.moduleId);if(module?.pose)el.style.zIndex=String(editingId===module.id?10001:module.pose.z);
    });
    updateGroupSelection();
  }
  function clearPaperSelection() { selectionVisible=false;selectedIds.clear();syncPaperSelection();if(document.activeElement?.closest('.paper-piece'))document.activeElement.blur();if(editingId){flushEdit();editingId=null;settingsId=null;renderBoard();persist();} }
  function focusPaper() { document.querySelector(`[data-module-id="${selectedId}"]`)?.focus({preventScroll:true}); }
  function renderBoard() {
    const opened=new Map([...document.querySelectorAll('.paper-piece')].map(paper=>[paper.dataset.moduleId,[...paper.querySelectorAll('details[open]')].map(detail=>detail.className)]));
    bindingLayout=boardGeometry();
    $('#paper-board').classList.toggle('has-binding',!!bindingLayout);
    $('#paper-board').innerHTML=(bindingLayout?Binding.renderBase({...current,modules:papers()},bindingLayout):'')+(papers().length?papers().map(pieceHTML).join(''):`<div class="empty-board"><h2>桌上，还是一片空白。</h2><p>从组件匣拿出身份、属性或故事，开始组合你的角色。</p><button data-action="add" class="button-cream">＋ 添加第一张组件</button></div>`);
    activatePaperInputs();document.querySelectorAll('.paper-piece details').forEach(detail=>{if(opened.get(detail.closest('.paper-piece').dataset.moduleId)?.includes(detail.className))detail.open=true;});layoutTable();updateRuleFeedback();
  }
  function reviewHTML() {
    const validation=M.validateCharacter(current);
    return `<small class="kicker">THE FINAL BINDING</small><h2>把冒险装订起来。</h2><p class="guide-copy">组件可以自由取舍。保留的组件会检查姓名、数值和配点；故事内容可以留待冒险继续。</p><div class="review-list">${steps.slice(0,5).map(step=>{
      const list=current.modules.filter(item=>item.type===step.type),errors=stepErrors(step.type);
      const rules=list.filter(item=>item.data.rules?.enabled).length;
      return `<div class="review-item ${errors.length?'warning':''}"><span>${errors.length?'!':list.length?'✓':'—'}</span><div><b>${step.name}</b><small>${errors.length?`${errors.length} 处待调整`:list.length?`${list.length} 组数据，已检查${rules?' · '+rules+' 组规则通过':''}`:'未装入这类组件'}</small></div></div>`;
    }).join('')}</div>${validation.errors.length?`<div class="validation-errors">${validation.errors.map((error,index)=>`<button data-action="fix-error" data-error-index="${index}">${esc(error.message)} ↗</button>`).join('')}</div>`:''}<button data-action="finish" class="finish-button" ${validation.valid?'':'disabled'}>完成并保存这张角色卡 ✓</button><p class="review-note">自由填写与规则校验可以并用。已开启的规则会检查自定义总额、上下限及整数要求；不会自动改写你的数值。</p>${validation.warnings.length?`<details><summary>${validation.warnings.length} 条可选补充</summary><p class="review-note">${validation.warnings.map(esc).join('<br>')}</p></details>`:''}`;
  }
  function renderInspector() {
    $('.review-inspector').hidden=current.step!==5;
    $('#inspector-content').innerHTML=current.step===5?reviewHTML():'';
    updateRuleFeedback();
  }
  function render() { syncAtomicRows();selectedIds=new Set([...selectedIds].filter(id=>paperById(id))); if(editingId&&!paperById(editingId)){editingId=null;settingsId=null;}renderNavigation();renderBoard();if(splitLegacyPapers()){renderNavigation();renderBoard();}if(!paperById(selectedId))selectedId=papers().find(p=>p.type===steps[current.step].type)?.id||papers()[0]?.id;syncPaperSelection();renderInspector(); }
  function chooseModule(id,{scroll=false,edit=false,additive=false}={}) {
    flushEdit();
    if(edit)setLayersOpen(false);
    if(selectionVisible)selectedIds=new Set(selectionMembers().map(paper=>paper.id));
    const linked=linkedPapers(id);
    if(additive){
      if(!selectionVisible)selectedIds.clear();
      const remove=linked.every(item=>selectedIds.has(item.id));
      linked.forEach(item=>remove?selectedIds.delete(item.id):selectedIds.add(item.id));
      selectedId=selectedIds.has(id)?id:[...selectedIds][0];selectionVisible=selectedIds.size>0;
      editingId=null;settingsId=null;renderBoard();syncPaperSelection();if(selectedId)focusPaper();return;
    }
    if(!selectionVisible||!selectedIds.has(id)||edit)selectedIds=new Set(linked.map(item=>item.id));
    selectedId=id;selectionVisible=true;const module=activeModule();if(!module)return;
    current.step=steps.findIndex(step=>step.type===module.type);
    if(module.pose)raisePapers(selectionMembers(id));
    const changed=editingId&&editingId!==id;
    if(changed){editingId=null;settingsId=null;}
    if(edit)editingId=id;
    renderNavigation();if(edit||changed)renderBoard();syncPaperSelection();renderInspector();persist();
    if(scroll) document.querySelector(`[data-module-id="${id}"]`)?.scrollIntoView({behavior:motion(),block:'start'});
    if(edit)document.querySelector(`[data-module-id="${id}"] [data-inline-editor]`)?.focus({preventScroll:true});else focusPaper();
  }
  function goStep(index) {
    flushEdit();editingId=null;settingsId=null;selectionVisible=false; current.step=Math.max(0,Math.min(5,index));
    selectedId=papers().find(item=>item.type===steps[current.step].type)?.id;
    render(); persist();
    if(current.step<5&&selectedId)document.querySelector(`[data-module-id="${selectedId}"]`)?.scrollIntoView({behavior:motion(),block:'start'});
    else if(current.step===5)$('.review-inspector').scrollIntoView({behavior:motion(),block:'start'});
  }
  function addModule(type,mounted=false) {
    if(current.modules.length>=30){toast('一张角色卡最多放 30 个组件。');return;}
    mutate(()=>{const module=M.createModule(type);module.mounted=mounted;if(current.bindingEnabled&&!mounted)module.pose=loosePose();const index=current.modules.findIndex(item=>item.id===selectedId);current.modules.splice(index<0?current.modules.length:index+1,0,module);selectedId=module.id;current.step=steps.findIndex(step=>step.type===type);},'已添上一张纸雕组件。');
    $('#component-dialog').close(); chooseModule(selectedId,{scroll:true});
  }
  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  // Peeling is a view of the two sheets, never a change to their saved placement.
  function setLayersOpen(open) {
    document.body.classList.toggle('layers-open',open);
    const button=$('#layers-button'),note=$('#layers-note');
    if(button){button.textContent=open?'盖回纸面':'揭开纸面';button.title=open?'将镂空面纸合回彩绘底纸':'揭开镂空面纸，看看下面的彩绘底纸';button.setAttribute('aria-pressed',String(open));}
    if(note)note.hidden=!open;
  }
  function linkedPapers(id) {
    const paper=paperById(id);if(!paper)return [];
    return paper.groupId?papers().filter(item=>item.groupId===paper.groupId):[paper];
  }
  function selectionMembers(id=selectedId) {
    if(!selectionVisible||!selectedIds.has(id))return linkedPapers(id);
    const ids=new Set([...selectedIds].flatMap(memberId=>linkedPapers(memberId).map(paper=>paper.id)));
    return papers().filter(item=>ids.has(item.id));
  }
  function raisePapers(members) {
    const ordered=[...members].filter(item=>item.pose).sort((a,b)=>a.pose.z-b.pose.z),base=Math.min(10000-ordered.length,frontZ());
    ordered.forEach((paper,index)=>paper.pose.z=base+index);
  }
  function captureMembers(id=selectedId) {
    const width=$('#paper-board').clientWidth;
    return selectionMembers(id).map(module=>{
      const source=document.querySelector(`[data-module-id="${module.id}"]`);if(!source||!module.pose)return null;
      return {id:module.id,module,source,w:parseFloat(source.style.width)||source.offsetWidth,h:parseFloat(source.style.height)||source.offsetHeight,x:module.pose.x/100*width,y:module.pose.y/100*width,angle:module.pose.angle,original:clone({pose:module.pose,cardPose:module.cardPose,paperWidth:module.paperWidth,mounted:module.mounted})};
    }).filter(Boolean);
  }
  function paperBounds(items) {
    const corners=items.flatMap(item=>[-1,1].flatMap(sx=>[-1,1].map(sy=>{const point=rotatePoint(sx*item.w/2,sy*item.h/2,item.angle);return {x:item.x+item.w/2+point.x,y:item.y+item.h/2+point.y};})));
    const x=Math.min(...corners.map(p=>p.x)),y=Math.min(...corners.map(p=>p.y));
    return {x,y,w:Math.max(...corners.map(p=>p.x))-x,h:Math.max(...corners.map(p=>p.y))-y};
  }
  function updateGroupSelection() {
    const board=$('#paper-board'),tools=$('#paper-selection-tools');if(!tools)return;
    const members=selectionVisible?selectionMembers():[],grouped=members.length>0&&members[0].groupId&&members.every(item=>item.groupId===members[0].groupId);
    tools.hidden=preview||!!editingId||members.length<2&&!grouped;
    tools.innerHTML=tools.hidden?'':`<span>${grouped?'已组合':'已选中'} · ${members.length} 张纸片</span>${!grouped&&members.length>1?'<button data-action="group-papers">组合 <kbd>G</kbd></button>':''}${members.some(item=>item.groupId)?'<button data-action="ungroup-papers">解组 <kbd>⇧ G</kbd></button>':''}<button data-action="clear-selection" aria-label="取消纸片选择">×</button>`;
    if(resizeDrag)return;
    board.querySelector('.paper-group-frame')?.remove();
    if(preview||editingId||members.length<2||drag)return;
    const items=captureMembers();if(items.length<2)return;
    const box=paperBounds(items),frame=document.createElement('div');frame.className='paper-group-frame';frame.setAttribute('aria-label',`选中的 ${items.length} 张纸片`);
    Object.assign(frame.style,{left:box.x+'px',top:box.y+'px',width:box.w+'px',height:box.h+'px'});
    frame.innerHTML=['nw','ne','sw','se'].map(corner=>`<button class="paper-resize-handle resize-${corner}" data-resize="${corner}" data-group-resize="true" aria-label="缩放整组${{nw:'左上',ne:'右上',sw:'左下',se:'右下'}[corner]}角"></button>`).join('');board.append(frame);
  }
  function groupSelection() {
    const members=selectionMembers();if(!selectionVisible||members.length<2)return;
    const items=captureMembers(),mounted=!!(current.bindingEnabled&&members.some(paper=>paper.mounted)),previousGroups=new Set(members.map(paper=>paper.groupId).filter(Boolean));
    mutate(()=>{const groupId=M.uid('group');current.modules.forEach(owner=>(owner.parts||[]).forEach(part=>{if(previousGroups.has(part.groupId))part.groupId=groupId;}));items.forEach(item=>{item.module.groupId=groupId;setMemberPlacement(item,{x:item.x,y:item.y,w:item.w,angle:item.angle},mounted);});selectedIds=new Set(members.map(p=>p.id));},`已把 ${members.length} 张纸片组合，抓住其中任意一张一起移动。`);focusPaper();
  }
  function ungroupSelection() {
    const members=selectionMembers(),ids=new Set(members.map(p=>p.groupId).filter(Boolean));if(!ids.size)return;
    mutate(()=>{current.modules.forEach(owner=>(owner.parts||[]).forEach(part=>{if(ids.has(part.groupId))part.groupId=null;}));selectedIds.clear();if(selectedId)selectedIds.add(selectedId);},'已解组，可以继续单独摆放纸片。');focusPaper();
  }
  function restoreMembers(items) {items.forEach(item=>Object.assign(item.module,clone(item.original)));}
  function angleForMembers(items,primaryAngle,requested) {
    const delta=clamp(requested-primaryAngle,Math.max(...items.map(item=>-15-item.angle)),Math.min(...items.map(item=>15-item.angle)));
    return primaryAngle+delta;
  }
  function setMemberPlacement(item,box,mounted) {
    const width=$('#paper-board').clientWidth;
    item.module.pose={...item.module.pose,x:box.x/width*100,y:box.y/width*100,angle:box.angle};item.module.paperWidth=box.w/width*100;item.module.mounted=mounted;
    if(mounted&&bindingLayout)rememberCardPlacement(item.module,box.x,box.y,box.w,box.angle);
  }
  function constrainPaperBoxes(boxes) {
    const visual=paperBounds(boxes),width=$('#paper-board').clientWidth;
    const left=Math.min(visual.x,...boxes.map(box=>box.x)),right=Math.max(visual.x+visual.w,...boxes.map(box=>box.x+box.w)),top=Math.min(visual.y,...boxes.map(box=>box.y));
    const dx=right-left<=width?clamp(0,-left,width-right):Math.max(0,-left),dy=Math.max(0,-top);
    boxes.forEach(box=>{box.x+=dx;box.y+=dy;});return boxes;
  }
  function rotateSelection(id,amount) {
    const items=captureMembers(id);if(items.length<2)return false;
    const box=paperBounds(items),cx=box.x+box.w/2,cy=box.y+box.h/2,delta=angleForMembers(items,0,amount);
    const boxes=items.map(item=>{const point=rotatePoint(item.x+item.w/2-cx,item.y+item.h/2-cy,delta);return {item,x:cx+point.x-item.w/2,y:cy+point.y-item.h/2,w:item.w,h:item.h,angle:item.angle+delta};});
    constrainPaperBoxes(boxes);mutate(()=>{boxes.forEach(box=>setMemberPlacement(box.item,box,box.item.module.mounted));raisePapers(items.map(item=>item.module));});focusPaper();return true;
  }
  function frontZ() { return Math.min(10000,Math.max(0,...papers().map(module=>module.pose?.z||0))+1); }
  function tableTransform(x,y,angle,scale=1) { return `translate3d(${x}px,${y}px,0) rotate(${angle}deg) scale(${scale})`; }
  function boardGeometry() {
    return current.bindingEnabled?Binding.layout({...current,modules:papers()},$('#paper-board').clientWidth,{maxCardWidth:preview||document.body.classList.contains('desk-fit')?Math.min(620,Math.max(340,(innerHeight-120)*600/870)):620}):null;
  }
  function rememberCardPlacement(module,x,y,width,angle) {
    const frame=bindingLayout.frame,scale=600/frame.width;
    module.cardPose={x:(x-frame.x)*scale,y:(y-frame.y)*scale,width:width*scale,angle};
  }
  function capturePaperUnits() {
    const width=$('#paper-board').clientWidth,units=new Map();
    papers().forEach(module=>{
      const source=document.querySelector(`[data-module-id="${module.id}"]`);if(!source||!module.pose)return;
      const key=module.groupId?'group:'+module.groupId:'paper:'+module.id;
      if(!units.has(key))units.set(key,{groupId:module.groupId||null,items:[]});
      units.get(key).items.push({id:module.id,module,source,w:parseFloat(source.style.width)||source.offsetWidth,h:parseFloat(source.style.height)||source.offsetHeight,x:module.pose.x/100*width,y:module.pose.y/100*width,angle:module.pose.angle});
    });
    return [...units.values()];
  }
  function arrangeLooseUnits(units) {
    const width=$('#paper-board').clientWidth,pad=width*.025,gap=width*.035;
    let x=pad,y=bindingLayout?bindingLayout.frame.y+bindingLayout.frame.height+45:pad,rowHeight=0;
    units.forEach(unit=>{
      const items=unit.items.map(item=>({...item,angle:unit.groupId?item.angle:0}));if(!items.length)return;
      const visual=paperBounds(items),left=Math.min(visual.x,...items.map(item=>item.x)),top=Math.min(visual.y,...items.map(item=>item.y));
      const box={x:left,y:top,w:Math.max(visual.x+visual.w,...items.map(item=>item.x+item.w))-left,h:Math.max(visual.y+visual.h,...items.map(item=>item.y+item.h))-top};
      const full=items.some(item=>item.module.width==='full');
      if(x>pad&&(full||x+box.w>width-pad)){x=pad;y+=rowHeight+gap;rowHeight=0;}
      const dx=x-box.x,dy=y-box.y;
      items.forEach(item=>setMemberPlacement(item,{x:item.x+dx,y:item.y+dy,w:item.w,angle:item.angle},false));
      rowHeight=Math.max(rowHeight,box.h);x+=box.w+gap;
      if(full||x>width-pad){x=pad;y+=rowHeight+gap;rowHeight=0;}
    });
  }
  function detachAllPapers() {
    const units=capturePaperUnits();editingId=null;settingsId=null;selectionVisible=false;
    mutate(()=>arrangeLooseUnits(units),'纸片已全部拆到桌面，组合内的位置、角度与大小保持不变。');
  }
  function layoutTable(arrange=false) {
    const board=$('#paper-board'),width=board.clientWidth;if(!width)return;
    bindingLayout=boardGeometry();
    if(arrange){arrangeLooseUnits(capturePaperUnits().filter(unit=>unit.items.every(item=>!current.bindingEnabled||!item.module.mounted)));arrange=false;}
    if(bindingLayout){const base=board.querySelector('.binding-base');if(base)base.outerHTML=Binding.renderBase({...current,modules:papers()},bindingLayout);}
    if(!papers().length){board.style.height=bindingLayout?bindingLayout.frame.height+100+'px':'auto';return;}
    const pad=width*.025,gap=width*.035,half=(width-pad*2-gap)/2;
    const looseStart=bindingLayout?bindingLayout.frame.y+bindingLayout.frame.height+45:pad;
    let y=looseStart,rowHeight=0,column=0,bottom=bindingLayout?bindingLayout.frame.y+bindingLayout.frame.height:0;
    const initial=papers().every(module=>!module.pose);
    papers().forEach((module,index)=>{
      const el=board.querySelector(`[data-module-id="${module.id}"]`);if(!el)return;
      const primary=el.classList.contains('binding-primary')||el.classList.contains('atomic-piece'),natural=module.kind?Parts.naturalSize(module):Binding.naturalSize(module);
      const placement=bindingLayout?.placements?.[module.id];
      if(module.mounted&&placement){
        el.style.width=placement.w+'px';el.style.height=primary?placement.w*natural.h/natural.w+'px':'';
        const angle=module.cardPose?.angle??placement.angle??0;
        // Legacy cards get their original layout once. Subsequent renders read only card-relative coordinates.
        if(!module.cardPose)rememberCardPlacement(module,placement.x,placement.y,placement.w,angle);
        module.pose={x:placement.x/width*100,y:placement.y/width*100,angle,z:module.pose?.z||index+1};
        el.style.transform=tableTransform(placement.x,placement.y,angle);el.style.zIndex=String(editingId===module.id?10001:module.pose.z);
        bottom=Math.max(bottom,placement.y+el.offsetHeight);return;
      }
      const full=module.width==='full',w=module.paperWidth?module.paperWidth/100*width:primary?natural.w/600*(bindingLayout?.frame.width||600):full?width-pad*2:half;
      el.style.width=w+'px';el.style.height=primary?w*natural.h/natural.w+'px':'';
      const height=el.offsetHeight;
      if(arrange||initial){
        if(full&&column){y+=rowHeight+gap;column=0;rowHeight=0;}
        const x=column?pad+half+gap:pad;
        module.pose={x:x/width*100,y:y/width*100,angle:arrange?0:[-.7,.65,-.45,.8,-.35][index%5],z:index+1};
        if(full){y+=height+gap;column=0;rowHeight=0;}
        else{rowHeight=Math.max(rowHeight,height);column++;if(column===2){y+=rowHeight+gap;column=0;rowHeight=0;}}
      }else if(!module.pose){module.pose={x:2.5,y:(bottom+gap)/width*100,angle:.7,z:frontZ()};}
      // Group members were constrained as one unit; per-piece clamping would deform the group.
      if(!module.groupId){module.pose.x=clamp(module.pose.x,0,Math.max(0,(width-w)/width*100));module.pose.y=clamp(module.pose.y,0,module.kind?50000:3000);}
      const x=module.pose.x/100*width,top=module.pose.y/100*width;
      el.style.transform=tableTransform(x,top,module.pose.angle);el.style.zIndex=String(editingId===module.id?10001:module.pose.z);
      bottom=Math.max(bottom,top+height);
    });
    board.style.height=Math.ceil(bottom+Math.max(100,width*.16))+'px';
    board.style.setProperty('--print-board-height',board.style.height);
    updateGroupSelection();
    board.querySelectorAll('.paper-piece').forEach(el=>{el.style.setProperty('--print-piece-width',el.style.width);el.style.setProperty('--print-piece-height',el.style.height||'auto');el.style.setProperty('--print-piece-transform',el.style.transform);});
  }
  function openBase() {
    const units=capturePaperUnits();editingId=null;settingsId=null;selectionVisible=false;
    mutate(()=>{current.bindingEnabled=true;bindingLayout=boardGeometry();arrangeLooseUnits(units);},'底卡已铺开，组合保持原样停放在旁边。抓住纸片拖入任意位置，自由拼装。');
    $('#paper-board').scrollIntoView({behavior:motion(),block:'start'});
  }
  function assembleAll() {
    const units=capturePaperUnits();editingId=null;settingsId=null;selectionVisible=false;
    mutate(()=>{
      current.bindingEnabled=true;bindingLayout=boardGeometry();
      const reference=Binding.layout({...current,modules:current.modules.map(module=>({...module,mounted:true,cardPose:null}))},$('#paper-board').clientWidth,{maxCardWidth:bindingLayout.frame.width}),targets=new Map();
      current.modules.forEach(owner=>{
        const box=reference.placements[owner.id];if(!box)return;
        if(!Array.isArray(owner.parts)){targets.set(owner.id,{x:box.x,y:box.y,w:box.w});return;}
        const primary=reference.primaryIds.includes(owner.id),logicalWidth=primary?Binding.naturalSize(owner).w:340,scale=box.w/logicalWidth;
        const specs=Parts.splitRects(owner,{primary}),counts={};
        owner.parts.filter(record=>!record.hidden).forEach(record=>{
          const spec=specs.find(item=>item.kind===record.kind&&item.rowId===record.rowId);if(!spec)return;
          const key=record.kind+':'+record.rowId,offset=(counts[key]||0)*12;counts[key]=(counts[key]||0)+1;
          targets.set(record.id,{x:box.x+(spec.x+offset)*scale,y:box.y+(spec.y+offset)*scale,w:spec.w*scale});
        });
      });
      const handled=new Set();
      units.forEach(unit=>{
        if(!unit.groupId)return;
        const anchor=unit.items.find(item=>targets.has(item.id));if(!anchor)return;
        const target=targets.get(anchor.id),dx=target.x-anchor.x,dy=target.y-anchor.y;
        const boxes=constrainPaperBoxes(unit.items.map(item=>({item,x:item.x+dx,y:item.y+dy,w:item.w,h:item.h,angle:item.angle})));
        boxes.forEach(box=>{setMemberPlacement(box.item,box,true);handled.add(box.item.id);});
        raisePapers(unit.items.map(item=>item.module));
      });
      targets.forEach((box,id)=>{
        if(handled.has(id))return;
        const paper=paperById(id);if(paper)placePartRecord(paper,box,0,true,frontZ());
      });
    },'已放入参考排版；组合整体移动，内部的位置、角度与大小保持不变。');
    $('#paper-board').scrollIntoView({behavior:motion(),block:'start'});
  }
  function loosePose() {
    const width=$('#paper-board').clientWidth;
    return {x:3,y:((bindingLayout?bindingLayout.frame.y+bindingLayout.frame.height:0)+45)/width*100,angle:-2,z:frontZ()};
  }
  function detachModule(module) { const paper=document.querySelector(`[data-module-id="${module.id}"]`);if(paper)module.paperWidth=paper.offsetWidth/$('#paper-board').clientWidth*100;module.mounted=false;module.pose=loosePose(); }
  function rotateModule(id,amount) {
    if(rotateSelection(id,amount))return;
    mutate(()=>{const module=paperById(id);if(!module?.pose)return;module.pose.angle=clamp(module.pose.angle+amount,-15,15);if(current.bindingEnabled&&module.mounted&&module.cardPose)module.cardPose.angle=module.pose.angle;module.pose.z=frontZ();selectedId=id;current.step=steps.findIndex(step=>step.type===module.type);});
    focusPaper();announce('已转动纸片。');
  }
  function duplicateSelection(id) {
    const items=captureMembers(id);if(items.length<2)return false;
    const counts=new Map(),limits={attributes:24,skills:60,equipment:80,background:40};
    for(const item of items){const paper=item.module;if(!paper.kind)return true;const count=counts.get(paper.owner)||{parts:0,rows:0};count.parts++;if(paper.rowId)count.rows++;counts.set(paper.owner,count);}
    for(const [owner,count] of counts){const rows=owner.data[owner.type==='background'?'fields':'items']||[];if(owner.parts.length+count.parts>240||rows.length+count.rows>(limits[owner.type]||Infinity)){toast('这一组的条目或纸片数量已满，未复制。');return true;}}
    const box=paperBounds(items),loose=loosePose(),width=$('#paper-board').clientWidth,dx=loose.x/100*width-box.x,dy=loose.y/100*width-box.y;
    mutate(()=>{
      const groupId=M.uid('group'),copies=[];
      items.sort((a,b)=>a.module.pose.z-b.module.pose.z).forEach(item=>{
        const paper=item.module,owner=paper.owner,record=clone(paper.record);record.id=M.uid('part');record.groupId=groupId;record.hidden=false;record.mounted=false;
        if(paper.rowId){const rows=owner.data[paper.type==='background'?'fields':'items'],row=clone(rows.find(row=>row.id===paper.rowId));row.id=M.uid('row');rows.push(row);record.rowId=row.id;record.title='';}
        placePartRecord(record,{x:item.x+dx,y:item.y+dy,w:item.w},item.angle,false,frontZ());owner.parts.push(record);copies.push(record.id);
      });selectedIds=new Set(copies);selectedId=copies[0];selectionVisible=true;editingId=null;settingsId=null;
    },'已复制整组；装备、属性等条目独立，立绘和状态条仍关联角色数据。');focusPaper();return true;
  }
  function removeSelection(id) {
    const items=captureMembers(id);if(items.length<2)return false;
    const mounted=current.bindingEnabled&&items.some(item=>item.module.mounted),box=paperBounds(items),loose=loosePose(),width=$('#paper-board').clientWidth;
    mutate(()=>{
      if(mounted)items.forEach(item=>setMemberPlacement(item,{x:item.x+loose.x/100*width-box.x,y:item.y+loose.y/100*width-box.y,w:item.w,angle:item.angle},false));
      else{items.forEach(item=>item.module.hidden=true);selectionVisible=false;selectedIds.clear();selectedId=null;}
      editingId=null;settingsId=null;
    },mounted?'整组已拆到桌面，彼此的位置保持不变。':'整组已收回组件匣，数据和组合关系仍保留。');if(mounted)focusPaper();return true;
  }
  function duplicateModule(id) {
    if(duplicateSelection(id))return;
    const paper=paperById(id);if(!paper)return;
    if(paper.kind){
      const owner=paper.owner;if(owner.parts.length>=240){toast('这一组纸片已满。');return;}
      const rowKey=paper.type==='background'?'fields':'items',rows=owner.data[rowKey];
      const limits={attributes:24,skills:60,equipment:80,background:40};
      if(paper.rowId&&rows.length>=limits[paper.type]){toast('这一组条目已满。');return;}
      mutate(()=>{
        const record=clone(paper.record);record.id=M.uid('part');record.groupId=null;record.hidden=false;record.mounted=false;
        if(paper.rowId){const row=clone(rows.find(item=>item.id===paper.rowId));row.id=M.uid('row');rows.push(row);record.rowId=row.id;record.title='';}
        const el=document.querySelector(`[data-module-id="${id}"]`);record.paperWidth=el?el.offsetWidth/$('#paper-board').clientWidth*100:paper.paperWidth;
        record.pose=loosePose();owner.parts.push(record);selectedId=record.id;selectionVisible=true;editingId=null;settingsId=null;
      },paper.rowId?'已复制为独立条目与纸片。':'已复制纸片，数值与原件保持同步。');
      focusPaper();return;
    }
    const index=current.modules.findIndex(item=>item.id===id);if(index<0||current.modules.length>=30)return;
    mutate(()=>{const module=M.cloneModule(current.modules[index]);module.pose=loosePose();current.modules.splice(index+1,0,module);selectedId=module.id;selectionVisible=true;editingId=null;settingsId=null;},'已复制组件。');focusPaper();
  }
  function removeModule(id) {
    if(removeSelection(id))return;
    const paper=paperById(id);if(!paper)return;
    if(current.bindingEnabled&&paper.mounted){mutate(()=>{detachModule(paper);editingId=null;settingsId=null;},'这张纸片已单独拆出，拖回底卡任意位置即可拼合。');focusPaper();return;}
    if(paper.kind){mutate(()=>{paper.hidden=true;selectedId=null;selectionVisible=false;editingId=null;settingsId=null;},'纸片已收回组件匣，角色数值仍保留；也可以撤销。');return;}
    mutate(()=>{current.modules=current.modules.filter(module=>module.id!==id);selectedId=null;selectionVisible=false;},'组件已移除，可以撤销。');
  }
  function finish() {
    flushEdit(); const validation=M.validateCharacter(current);
    if(!validation.valid){goStep(5);toast('先调整检查页列出的项目，再装订角色。');return;}
    current.status='complete'; current.step=5; render(); const saved=persist();
    $('#finish-title').textContent=`${characterName(current)}，准备出发。`;
    $('#finish-copy').textContent=saved?`${papers().length} 张纸雕组件已经收好。布局、规则、数值、装备与故事均已保存在此浏览器。`:`${papers().length} 张组件检查通过。浏览器未能保存，请立即导出 JSON；关闭页面前保留备份。`;
    $('#finish-dialog').showModal();
  }
  function exportJSON() {
    flushEdit(); const data=M.exportCharacter(current);
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`${characterName(current).replace(/[\\/:*?"<>|]/g,'_')}-纸雕角色.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('角色与组件布局已导出。');
  }
  function showNotice(title,lines) { $('#notice-title').textContent=title;$('#notice-content').innerHTML=`<div class="notice-lines">${lines.map(esc).join('<br>')}</div>`;$('#notice-dialog').showModal(); }
  function renderLibrary() {
    $('#character-library').innerHTML=[...characters].reverse().map(record=>`<div class="character-record"><div class="record-icon">${record.status==='complete'?'✧':'✎'}</div><div><b>${esc(characterName(record))}</b><small>${record.status==='complete'?'已装订':'草稿'} · ${M.getPapers(record).length} 张纸片 · ${new Date(record.updatedAt).toLocaleDateString('zh-CN')}</small></div><div class="record-actions"><button data-action="open-character" data-id="${record.id}">${record.id===current.id?'正在编辑':'打开'}</button><button data-action="clone-character" data-id="${record.id}">复制</button></div></div>`).join('');
  }
  function switchCharacter(record) { flushEdit();persist();setLayersOpen(false);current=record;editingId=null;settingsId=null;selectionVisible=false;selectedId=papers().find(item=>item.type===steps[current.step].type)?.id||current.modules[0]?.id;undoStack=[];preview=false;document.body.classList.remove('card-preview');$('#preview-button').textContent='预览整卡';render();persist();$('#library-dialog').close();window.scrollTo({top:0,behavior:motion()}); }
  function createCharacter(sample) { switchCharacter(M.createCharacter({sample}));toast(sample?'已放入一份独立的骑士示例。':'新的空白角色已经铺开。'); }

  const atomicTypes={
    'identity-meta':{type:'identity',title:'身份文字',copy:'姓名、等级、年龄与职业。'},portrait:{type:'identity',title:'立绘',copy:'一张独立人物纸雕，可单独移动与缩放。'},
    hp:{type:'attributes',title:'HP',copy:'独立生命条，数值与角色关联。'},mp:{type:'attributes',title:'MP',copy:'独立魔力条，数值与角色关联。'},attribute:{type:'attributes',title:'属性条',copy:'添加一项属性，单独摆放纸孔与数值。'},radar:{type:'attributes',title:'属性雷达图',copy:'跟随这组属性数值同步变化。'},
    skill:{type:'skills',title:'技能条',copy:'一项本领，一条独立纸带。'},equipment:{type:'equipment',title:'单件装备',copy:'每件装备都有自己的纸窗。'},story:{type:'background',title:'背景便笺',copy:'每段来历、牵挂或秘密，独立成笺。'}
  };
  function placePartRecord(record,box,angle,mounted,z) {
    const width=$('#paper-board').clientWidth;
    record.pose={x:box.x/width*100,y:box.y/width*100,angle,z};record.paperWidth=box.w/width*100;record.mounted=mounted;
    if(mounted&&bindingLayout)rememberCardPlacement(record,box.x,box.y,box.w,angle);
  }
  function splitLegacyPapers() {
    let changed=false;
    for(const module of current.modules){
      if(Array.isArray(module.parts))continue;
      const el=document.querySelector(`[data-module-id="${module.id}"]`);if(!el||!module.pose)continue;
      const primary=el.classList.contains('binding-primary'),logicalWidth=primary?Binding.naturalSize(module).w:340;
      const scale=el.offsetWidth/logicalWidth,w=el.offsetWidth,h=el.offsetHeight,boardWidth=$('#paper-board').clientWidth,angle=module.pose.angle;
      const origin={x:module.pose.x/100*boardWidth,y:module.pose.y/100*boardWidth};
      module.parts=Parts.splitRects(module,{primary}).map((spec,index)=>{
        const part=M.createPart(spec.kind,spec.rowId||null),pw=spec.w*scale,ph=spec.h*scale;
        const center=rotatePoint((spec.x+spec.w/2)*scale-w/2,(spec.y+spec.h/2)*scale-h/2,angle);
        placePartRecord(part,{x:origin.x+w/2+center.x-pw/2,y:origin.y+h/2+center.y-ph/2,w:pw},angle,module.mounted,(module.pose.z||1)+index);
        return part;
      });changed=true;
    }
    return changed;
  }
  function addRecordNear(owner,record,anchor=activeModule()) {
    const width=$('#paper-board').clientWidth,natural=Parts.naturalSize({...record,type:owner.type,data:owner.data});
    const anchorPaper=anchor&&document.querySelector(`[data-module-id="${anchor.id}"]`);
    const w=natural.w/600*(bindingLayout?.frame.width||600),pose=anchor&&ownerOf(anchor).id===owner.id&&anchor.pose?anchor.pose:loosePose();
    const x=clamp(pose.x/100*width+16,0,Math.max(0,width-w)),y=pose.y/100*width+(anchorPaper?anchorPaper.offsetHeight+16:0);
    placePartRecord(record,{x,y,w},0,!!(anchor&&ownerOf(anchor).id===owner.id&&anchor.mounted),frontZ());
  }
  function syncAtomicRows() {
    for(const owner of current.modules){
      if(!Array.isArray(owner.parts))continue;
      const rows=owner.type==='background'?owner.data.fields:owner.data.items;
      if(!rows)continue;
      owner.parts=owner.parts.filter(part=>!part.rowId||rows.some(row=>row.id===part.rowId));
      if(rows.length)owner.parts=owner.parts.filter(part=>part.kind!=='collection');
    }
  }
  function renderComponentBox() {
    const options=Object.entries(atomicTypes).map(([kind,info])=>`<button class="component-option" data-action="add-part" data-kind="${kind}"><span>${symbols[info.type]}</span><b>${info.title}</b><small>${info.copy}</small></button>`).join('');
    const stored=current.modules.flatMap(owner=>(owner.parts||[]).filter(part=>part.hidden).map(part=>({owner,part})));
    $('#component-options').innerHTML=options+(stored.length?`<h3 class="stored-papers-title">收回的纸片 · 数值仍保留</h3>${stored.map(({owner,part})=>{const visible={...part,hidden:false};const paper=M.getPapers({modules:[{...owner,parts:[visible]}]})[0];return `<button class="component-option" data-action="restore-part" data-id="${part.id}"><span>↗</span><b>${esc(paper?.title||'纸片')}</b><small>重新放回桌面</small></button>`;}).join('')}`:'');
  }
  function addAtomicPart(kind) {
    const info=atomicTypes[kind];if(!info)return;
    let owner=current.modules.find(module=>module.type===info.type),newOwner=false;
    if(!owner){
      if(current.modules.length>=30){toast('角色数据已满。');return;}
      owner=M.createModule(info.type);owner.parts=[];newOwner=true;
      if(owner.data.items)owner.data.items=[];if(owner.data.fields)owner.data.fields=[];
      if(owner.type==='identity')Object.assign(owner.data,{name:'',age:null,occupation:'',appearance:''});
    }
    if(!Array.isArray(owner.parts)||owner.parts.length>=240){toast('这一组纸片已满。');return;}
    const rowKey=kind==='story'?'fields':'items',rowKinds=['attribute','skill','equipment','story'];
    const limits={attribute:24,skill:60,equipment:80,story:40};
    if(rowKinds.includes(kind)&&owner.data[rowKey].length>=limits[kind]){toast('这一组条目已满。');return;}
    mutate(()=>{
      if(newOwner)current.modules.push(owner);
      let rowId=null;
      if(rowKinds.includes(kind)){
        rowId=M.uid('row');const row=kind==='attribute'?{id:rowId,key:'NEW',name:'新属性',value:0}:kind==='skill'?{id:rowId,name:'新技能',value:0}:kind==='equipment'?{id:rowId,name:'新的随身物品',detail:'',quantity:1,weight:0,equipped:false,assetIndex:null}:{id:rowId,label:'新的故事片段',value:''};owner.data[rowKey].push(row);
      }
      const part=M.createPart(kind,rowId);addRecordNear(owner,part,null);part.mounted=false;owner.parts.push(part);selectedId=part.id;selectionVisible=true;editingId=null;settingsId=null;current.step=steps.findIndex(step=>step.type===info.type);
    },'已添上一张独立纸片。');$('#component-dialog').close();chooseModule(selectedId,{scroll:true});
  }
  function restorePart(id) {
    const owner=current.modules.find(module=>module.parts?.some(part=>part.id===id)),record=owner?.parts.find(part=>part.id===id);if(!record)return;
    mutate(()=>{const records=record.groupId?current.modules.flatMap(module=>module.parts||[]).filter(part=>part.groupId===record.groupId):[record];records.forEach(part=>{part.hidden=false;part.mounted=false;if(!part.pose)part.pose=loosePose();});selectedIds=new Set(records.map(part=>part.id));selectedId=id;selectionVisible=true;},record.groupId?'整组已放回桌面。':'纸片已放回桌面。');$('#component-dialog').close();chooseModule(id,{scroll:true});
  }

  function getPath(root,path){return path.split('.').reduce((value,key)=>value?.[key],root);}
  function setPath(root,path,value){const parts=path.split('.');if(parts.some(key=>['__proto__','constructor','prototype'].includes(key)))return;const leaf=parts.pop();const parent=parts.reduce((object,key)=>object?.[key],root);if(parent)parent[leaf]=value;}
  function activatePaperInputs() {
    if(!editingId||preview)return;
    const paper=document.querySelector(`[data-module-id="${editingId}"]`),module=paperById(editingId);
    if(!paper||!module)return;
    paper.querySelectorAll('[data-inline-path]').forEach(node=>{
      const input=document.createElement(node.dataset.inlineMultiline==='true'?'textarea':'input');
      input.className='paper-inline-input';input.dataset.path=node.dataset.inlinePath;input.dataset.inlineEditor='true';
      input.setAttribute('aria-label',node.dataset.inlineLabel||'填写');
      if(input.tagName==='INPUT'){input.type=node.dataset.inlineType==='number'?'number':'text';if(input.type==='number'){input.step='any';input.inputMode='decimal';}else input.maxLength=2000;}
      else{input.rows=3;input.maxLength=6000;}
      if(node.dataset.inlineNullable==='true')input.setAttribute('data-nullable','');
      if(module.type==='identity'&&input.type==='number'){input.step='1';input.min=node.dataset.inlinePath==='data.level'?'1':'0';input.max=node.dataset.inlinePath==='data.level'?'99':'999';}
      input.value=getPath(module,input.dataset.path)??'';
      node.replaceChildren(input);
    });
  }
  function finishPaperEditing() { flushEdit();editingId=null;settingsId=null;render();persist();focusPaper(); }
  function refreshPaperArtwork(module) {
    const owner=ownerOf(module);
    papers().filter(item=>ownerOf(item).id===owner.id).forEach(item=>{
      const paper=document.querySelector(`[data-module-id="${item.id}"]`);if(!paper)return;
      const template=document.createElement('template');template.innerHTML=item.kind?Parts.render(item):paper.classList.contains('binding-primary')?Binding.renderModule(item):Cards.render(item);
      paper.querySelectorAll('.piece-underpainting,[data-live-art]').forEach(node=>{
        const selector=node.dataset.liveArt?`[data-live-art="${CSS.escape(node.dataset.liveArt)}"]`:'.piece-underpainting';
        const replacement=template.content.querySelector(selector);if(replacement&&!node.querySelector('[data-inline-editor]'))node.replaceWith(replacement);
      });
      paper.querySelectorAll('[data-inline-path]').forEach(node=>{
        const value=getPath(item,node.dataset.inlinePath)??'';
        const input=node.querySelector('[data-inline-editor]');if(input){if(input!==document.activeElement)input.value=value;}else node.textContent=value;
      });
    });
  }
  function numberFromInput(input) {
    if(input.value===''&&(input.hasAttribute('data-nullable')||input.dataset.path==='data.age'))return null;
    let value=Number(input.value);if(!Number.isFinite(value))value=0;
    if(input.hasAttribute('min'))value=Math.max(Number(input.min),value);
    if(input.hasAttribute('max'))value=Math.min(Number(input.max),value);
    if(input.step!=='any')value=Number(input.step)<1?Math.round(value*100)/100:Math.round(value);
    return value;
  }
  function fieldModule(input) { const id=input.closest('[data-module-id]')?.dataset.moduleId;return id?paperById(id):activeModule(); }
  function syncFieldCopies(input,value) {
    const paper=input.closest('.paper-piece');if(!paper)return;
    paper.querySelectorAll(`[data-path="${CSS.escape(input.dataset.path)}"]`).forEach(other=>{if(other!==input){if(other.type==='checkbox')other.checked=!!value;else other.value=value??'';}});
  }
  function writeField(input) {
    const module=fieldModule(input);if(!module)return;
    const value=input.type==='checkbox'?input.checked:input.type==='number'?numberFromInput(input):input.value;
    setPath(module,input.dataset.path,value);syncFieldCopies(input,value);current.status='draft';
    if(input.closest('.paper-piece'))refreshPaperArtwork(module);else renderBoard();
    renderNavigation();updateLiveTotals(module);scheduleSave();
  }
  function updateRuleFeedback() {
    const module=activeModule();if(!module)return;
    const errors=M.validateCharacter(current).errors.filter(error=>error.moduleId===ownerOf(module).id);
    const feedback=$('.editor-rule-feedback');
    if(feedback)feedback.innerHTML=module.data.rules?.enabled?(errors.length?errors.map(error=>`<p class="rule-error">${esc(error.message)}</p>`).join(''):'<p class="rule-pass">✓ 当前数值通过本组件规则。</p>'):'<p class="rule-neutral">当前为自由填写，未启用规则约束。</p>';
    const paperFeedback=$('.paper-rule-feedback');if(paperFeedback)paperFeedback.innerHTML=errors.map(error=>`<p>${esc(error.message)}</p>`).join('');
    document.querySelectorAll('.inspector [data-path],[data-inline-editor]').forEach(input=>{const invalid=errors.some(error=>'data.'+error.field===input.dataset.path);if(invalid)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');});
  }
  function updateLiveTotals(module) {
    const totals=M.getTotals(module),node=$('.editor-budget-status');
    if(node){
      const status=totals.budget===null?`合计 ${totals.total} · 总额不限`:`合计 ${totals.total} / ${totals.budget} · ${totals.remaining<0?'超出 '+(-totals.remaining):'剩余 '+totals.remaining}`;
      const rules=module.data.rules||{};
      const limits=`最小值 ${rules.min==null||rules.min===''?'不限':rules.min} · 最大值 ${rules.max==null||rules.max===''?'不限':rules.max} · ${rules.integer?'仅允许整数':'允许小数'}`;
      node.innerHTML=`${esc(status)}<br>${esc(limits)}`;
      node.dataset.budgetState=totals.remaining<0?'over':totals.remaining===0?'complete':totals.budget===null?'unlimited':'remaining';
      const progress=$('.editor-budget-progress');if(progress){progress.max=Math.max(totals.budget||1,1);progress.value=Math.min(totals.total,totals.budget||1);progress.setAttribute('aria-valuetext',node.textContent);}
    }
    if(module.type==='equipment'&&$('.editor-summary')){const quantity=module.data.items.reduce((n,item)=>n+(Number(item.quantity)||0),0),weight=module.data.items.reduce((n,item)=>n+(Number(item.quantity)||0)*(Number(item.weight)||0),0);$('.editor-summary').textContent=`共 ${quantity} 件 · 总重 ${Number(weight.toFixed(2))} kg`;}
    updateRuleFeedback();
  }
  function normalizeField(input) {
    if(!input.matches('[data-path]'))return;
    const path=input.dataset.path,module=fieldModule(input);if(!module)return;
    if(input.type==='number'){
      const value=numberFromInput(input);
      setPath(module,path,value);input.value=value??'';syncFieldCopies(input,value);
    }
    persist();updateLiveTotals(module);
  }
  function formAction(button) {
    const module=fieldModule(button);if(!module)return;
    const action=button.dataset.formAction,index=Number(button.dataset.index);
    if(action==='toggle-budget'){mutate(()=>module.data.budget=button.checked?null:M.getTotals(module).total);return;}
    const limits={attributes:24,skills:60,equipment:80,background:40};
    const rows=module.type==='background'?module.data.fields:module.data.items;
    if(action.startsWith('add-')&&(rows.length>=limits[module.type]||ownerOf(module).parts?.length>=240)){toast('这一张纸片的条目已满，可以再添加一个同类组件。');return;}
    mutate(()=>{
      if(action==='add-attribute')rows.push({id:M.uid('attr'),key:'NEW',name:'新属性',value:1});
      if(action==='add-skill')rows.push({id:M.uid('skill'),name:'新技能',value:0});
      if(action==='add-equipment')rows.push({id:M.uid('gear'),name:'新的随身物品',detail:'',quantity:1,weight:0,equipped:false,assetIndex:null});
      if(action==='add-background')rows.push({id:M.uid('story'),label:'新的故事片段',value:''});
      if(action.startsWith('add-')){const owner=ownerOf(module);if(Array.isArray(owner.parts)){const kind={attributes:'attribute',skills:'skill',equipment:'equipment',background:'story'}[owner.type];const record=M.createPart(kind,rows[rows.length-1].id);addRecordNear(owner,record,module);owner.parts.push(record);}}
      if(action.startsWith('remove-')&&index>=0&&index<rows.length)rows.splice(index,1);
    });
    if(action.startsWith('add-')){const paper=document.querySelector(`[data-module-id="${module.id}"]`);const inputs=paper?.querySelectorAll('[data-inline-editor]');inputs?.[inputs.length-1]?.focus({preventScroll:true});}
  }

  document.addEventListener('click',event=>{
    if(Date.now()<suppressClickUntil){event.preventDefault();return;}
    if(event.target.closest('input,textarea,select,summary'))return;
    if(!preview&&!event.target.closest('.paper-piece,button,a,input,textarea,select')&&(event.target.closest('.assembly')||event.target===document.body))clearPaperSelection();
    const cardButton=event.target.closest('[data-card-action]');
    if(cardButton&&!preview){const module=paperById(cardButton.closest('[data-module-id]')?.dataset.moduleId);if(!module)return;flushEdit();if(editingId!==module.id){editingId=null;settingsId=null;}selectedId=module.id;selectionVisible=true;const index=Number(cardButton.dataset.index);mutate(()=>{current.step=steps.findIndex(step=>step.type===module.type);if(cardButton.dataset.cardAction==='set-attribute'&&module.data.items[index])module.data.items[index].value=Number(cardButton.dataset.value);if(cardButton.dataset.cardAction==='toggle-equipment'&&module.data.items[index])module.data.items[index].equipped=!module.data.items[index].equipped;});return;}
    const formButton=event.target.closest('[data-form-action]');if(formButton){if(formButton.dataset.formAction!=='toggle-budget')formAction(formButton);return;}
    const button=event.target.closest('[data-action]');if(!button)return;
    const action=button.dataset.action,id=button.closest('[data-module-id]')?.dataset.moduleId;
    if(action==='layers'){
      const open=!document.body.classList.contains('layers-open');
      if(open&&editingId)finishPaperEditing();
      setLayersOpen(open);announce(open?'镂空面纸已揭开，下面是彩绘底纸。仍可拖动整片或整组。':'两层纸已合回原位。');return;
    }
    if(action==='group-papers'){groupSelection();return;}
    if(action==='ungroup-papers'){ungroupSelection();return;}
    if(action==='clear-selection'){clearPaperSelection();return;}
    if(action==='finish-inline'){finishPaperEditing();return;}
    if(action==='paper-settings'){flushEdit();selectedId=id;editingId=id;settingsId=settingsId===id?null:id;render();persist();return;}
    if(action==='open-base'){openBase();return;}
    if(action==='bind-all'){assembleAll();return;}
    if(action==='unbind-all'){detachAllPapers();return;}
    if(action==='mount-type'){const module=current.modules.find(item=>item.type===button.dataset.type&&!item.mounted);if(module)mutate(()=>module.mounted=true,'组件已贴回底卡。');else addModule(button.dataset.type,true);return;}
    if(action==='undo')undo();
    if(action==='add'){renderComponentBox();$('#component-dialog').showModal();}
    if(action==='add-type')addModule(button.dataset.type);
    if(action==='add-part')addAtomicPart(button.dataset.kind);
    if(action==='restore-part')restorePart(button.dataset.id);
    if(action==='close-dialog')button.closest('dialog').close();
    if(action==='step')goStep(Number(button.dataset.step));
    if(action==='previous-step')goStep(current.step-1);
    if(action==='next-step'){if(current.step===5)finish();else{const errors=stepErrors(steps[current.step].type);if(errors.length){toast(errors[0].message);renderInspector();}else goStep(current.step+1);}}
    if(action==='edit-module'||action==='select-module'){if(!preview)chooseModule(id,{edit:action==='edit-module'});}
    if(action==='tidy')mutate(()=>layoutTable(true),'已把纸片重新铺齐；可以继续自由摆放。');
    if(action==='fit'){flushEdit();clearPaperSelection();document.body.classList.toggle('desk-fit');button.textContent=document.body.classList.contains('desk-fit')?'原大纸面':'看全底卡';layoutTable();$('#paper-board').scrollIntoView({behavior:motion(),block:'start'});return;}
    if(action==='preview'){flushEdit();clearPaperSelection();preview=!preview;document.body.classList.toggle('card-preview',preview);button.textContent=preview?'返回组合编辑':'预览整卡';$('#assembly-caption').textContent=preview?'':'Shift 多选 · G 组合 / Shift+G 解组 · 拖四角缩放 · A / D 旋转 · 双击填写';layoutTable();$('#paper-board').scrollIntoView({behavior:motion(),block:'start'});}
    if(action==='library'){flushEdit();persist();renderLibrary();$('#library-dialog').showModal();}
    if(action==='new')createCharacter(false);
    if(action==='sample')createCharacter(true);
    if(action==='open-character'){const record=characters.find(item=>item.id===button.dataset.id);if(record)switchCharacter(record);}
    if(action==='clone-character'){const record=characters.find(item=>item.id===button.dataset.id);if(record){const duplicate=M.cloneCharacter(record);duplicate.status='draft';duplicate.step=0;switchCharacter(duplicate);toast('已复制为独立角色，原卡保持原样。');}}
    if(action==='finish')finish();
    if(action==='export')exportJSON();
    if(action==='print')window.print();
    if(action==='import')$('#import-file').click();
    if(action==='fix-error'){
      const error=M.validateCharacter(current).errors[Number(button.dataset.errorIndex)];
      if(error?.moduleId){
        const owner=current.modules.find(item=>item.id===error.moduleId);if(!owner)return;
        const index=Number(error.field?.match(/^(?:items|fields)\.(\d+)/)?.[1]),row=(owner.data.items||owner.data.fields||[])[index];
        const kind=row?{attributes:'attribute',skills:'skill',equipment:'equipment',background:'story'}[owner.type]:/^(mp|maxMp)$/.test(error.field)?'mp':/^(hp|maxHp)$/.test(error.field)?'hp':owner.type==='identity'?'identity-meta':null;
        let paper=papers().find(item=>ownerOf(item).id===owner.id&&(!row||item.rowId===row.id)&&(!kind||item.kind===kind));
        if(!paper){
          let record=owner.parts?.find(part=>(!row||part.rowId===row.id)&&(!kind||part.kind===kind));
          if(!record&&Array.isArray(owner.parts)&&owner.parts.length<240){record=M.createPart(kind||'collection',row?.id);addRecordNear(owner,record,null);owner.parts.push(record);}
          if(!record)record=owner.parts?.[0];
          if(record){record.hidden=false;selectedId=record.id;renderBoard();paper=paperById(record.id);}
        }
        if(paper){
          chooseModule(paper.id,{scroll:true,edit:true});
          const selector=`[data-module-id="${paper.id}"] [data-path="${CSS.escape('data.'+error.field)}"]`;
          let target=document.querySelector(selector);
          if(!target){settingsId=paper.id;renderBoard();target=document.querySelector(selector);}
          if(target){for(let ancestor=target.parentElement;ancestor;ancestor=ancestor.parentElement){if(ancestor.tagName==='DETAILS')ancestor.open=true;}target.focus({preventScroll:true});target.scrollIntoView({behavior:motion(),block:'center'});}
        }
      }else if(error)addModule('identity');
    }
  });
  document.addEventListener('dblclick',event=>{
    if(preview||event.target.closest('input,textarea,select'))return;
    if(document.body.classList.contains('layers-open')){
      const paper=event.target.closest('.atomic-piece');
      if(paper&&event.target.closest('.piece-content')){event.preventDefault();chooseModule(paper.dataset.moduleId,{edit:true});return;}
    }
    const field=event.target.closest('[data-inline-path]');if(!field)return;
    event.preventDefault();const id=field.closest('[data-module-id]').dataset.moduleId,path=field.dataset.inlinePath;
    chooseModule(id,{edit:true});document.querySelector(`[data-module-id="${id}"] [data-inline-editor][data-path="${CSS.escape(path)}"]`)?.focus({preventScroll:true});
  });
  document.addEventListener('toggle',event=>{if(event.target.closest?.('.paper-piece'))layoutTable();},true);
  document.addEventListener('focusin',event=>{if(event.target.matches('.paper-piece')&&!preview&&(!selectionVisible||selectedId!==event.target.dataset.moduleId))chooseModule(event.target.dataset.moduleId);if(event.target.matches('[data-path]')&&!editSession)editSession=clone(current);});
  document.addEventListener('input',event=>{if(event.target.matches('[data-path]'))writeField(event.target);});
  document.addEventListener('change',event=>{
    if(event.target.matches('[data-path]')){
      normalizeField(event.target);
      if(event.target.dataset.path==='data.rules.enabled'){
        const opened=[...document.querySelectorAll('.paper-settings details[open]')].map(item=>item.className);
        flushEdit();renderBoard();updateRuleFeedback();
        document.querySelectorAll('.inspector details').forEach(item=>{if(opened.includes(item.className))item.open=true;});
        document.querySelector('[data-path="data.rules.enabled"]')?.focus({preventScroll:true});
      }
    }
    if(event.target.matches('[data-form-action="toggle-budget"]'))formAction(event.target);
  });
  document.addEventListener('blur',event=>{if(event.target.matches('[data-path]')){normalizeField(event.target);flushEdit();}},true);
  document.addEventListener('keydown',event=>{
    if(event.isComposing||$('dialog[open]'))return;
    if(preview){if(event.key==='Escape')setLayersOpen(false);return;}
    const command=event.metaKey||event.ctrlKey;
    const rotation=!command&&!event.altKey&&(event.key.toLowerCase()==='a'||event.key.toLowerCase()==='d');
    // Pointer capture can leave keyboard focus in the inspector or on another paper.
    // Rotate the held paper in place; rendering it again would release the grip.
    if(resizeDrag){if(event.key==='Escape'){event.preventDefault();endResize({pointerId:resizeDrag.pointerId},true);}return;}
    if(event.target.closest('[data-resize]')&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();resizeWithKeyboard(event.key==='ArrowUp'||event.key==='ArrowRight'?1.05:1/1.05);return;}
    if(drag){if(rotation){event.preventDefault();rotateHeldPaper(event.key.toLowerCase()==='a'?-3:3);}return;}
    if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],.inspector'))return;
    if(command&&event.key.toLowerCase()==='z'&&!event.shiftKey&&!event.altKey){event.preventDefault();undo();return;}
    if(event.key==='Escape'){if(document.body.classList.contains('layers-open')){setLayersOpen(false);return;}clearPaperSelection();return;}
    if(!selectionVisible||!activeModule()||event.altKey)return;
    const focusedPaper=event.target.closest('.paper-piece');
    if(focusedPaper&&!selectionMembers().some(item=>item.id===focusedPaper.dataset.moduleId))return;
    if(event.key.toLowerCase()==='g'&&!command&&!event.repeat){event.preventDefault();if(event.shiftKey)ungroupSelection();else groupSelection();return;}
    if(rotation){event.preventDefault();rotateModule(selectedId,event.key.toLowerCase()==='a'?-3:3);return;}
    if(command&&event.key.toLowerCase()==='d'&&!event.shiftKey){event.preventDefault();if(!event.repeat)duplicateModule(selectedId);return;}
    if(!command&&!event.shiftKey&&(event.key==='Delete'||event.key==='Backspace')){event.preventDefault();if(!event.repeat)removeModule(selectedId);}
  });
  $('#import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try{if(file.size>33554432)throw new Error('文件超过 32 MB，请导入较小的角色卡。');const {character,warnings}=M.normalizeCharacter(await file.text());const imported=M.cloneCharacter(character);switchCharacter(imported);toast('已导入为独立角色，原有角色保留。');if(warnings.length)showNotice('角色已导入，部分内容已修正',warnings);}catch(error){showNotice('这份文件暂时无法导入',[error.message]);}finally{event.target.value='';}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){flushEdit();persist();}});

  // The paper itself moves, anchored to the exact point held by the pointer.
  let drag=null,resizeDrag=null,suppressClickUntil=0,tableFrame=0,lastTableWidth=0,lastPaperTap=null;
  const rotatePoint=(x,y,angle)=>{const r=angle*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
  function pointerPosition(state,angle,scale) {
    const rect=$('#paper-board').getBoundingClientRect(),grip=rotatePoint(state.grip.x*scale,state.grip.y*scale,angle);
    return {x:clamp(state.pointerX-rect.left-state.w/2-grip.x,0,Math.max(0,rect.width-state.w)),y:clamp(state.pointerY-rect.top-state.h/2-grip.y,0,rect.width*(state.module.kind?500:30))};
  }
  function canDockPaper(state) {
    if(!current.bindingEnabled||!bindingLayout)return false;
    const board=$('#paper-board').getBoundingClientRect(),frame=bindingLayout.frame;
    const x=state.pointerX-board.left,y=state.pointerY-board.top;
    return x>=frame.x-15&&x<=frame.x+frame.width+15&&y>=frame.y-15&&y<=frame.y+frame.height+15;
  }
  function heldPositions(state,angle,scale) {
    const primary=state.members.find(item=>item.id===state.id),position=pointerPosition(state,angle,scale),delta=angle-primary.angle;
    const boxes=state.members.map(item=>{
      const relative=rotatePoint((item.x+item.w/2-primary.x-primary.w/2)*scale,(item.y+item.h/2-primary.y-primary.h/2)*scale,delta);
      return {item,x:position.x+state.w/2+relative.x-item.w/2,y:position.y+state.h/2+relative.y-item.h/2,w:item.w,h:item.h,angle:item.angle+delta};
    });
    if(boxes.length>1){
      const visual=paperBounds(boxes.map(box=>({...box,x:box.x+box.w*(1-scale)/2,y:box.y+box.h*(1-scale)/2,w:box.w*scale,h:box.h*scale}))),width=$('#paper-board').clientWidth;
      const dx=visual.w<=width?clamp(0,-visual.x,width-visual.x-visual.w):Math.max(0,-visual.x),dy=Math.max(0,-visual.y);
      boxes.forEach(box=>{box.x+=dx;box.y+=dy;});constrainPaperBoxes(boxes);
    }
    return boxes;
  }
  function placeHeldPaper() {
    const boxes=heldPositions(drag,drag.angle,drag.scale),board=$('#paper-board');
    boxes.forEach(box=>box.item.source.style.transform=tableTransform(box.x,box.y,box.angle,drag.scale));
    const bounds=paperBounds(boxes),needed=bounds.y+bounds.h+100;if(needed>board.offsetHeight)board.style.height=needed+'px';
    if(bindingLayout){
      let guide=board.querySelector('.binding-drop-guide');
      if(!guide){guide=document.createElement('div');guide.className='binding-drop-guide';board.append(guide);}
      Object.assign(guide.style,{left:bounds.x+'px',top:bounds.y+'px',width:bounds.w+'px',height:bounds.h+'px',transform:'none'});
      guide.hidden=!canDockPaper(drag);guide.textContent=boxes.length>1?'松手，整组留在这里':'松手，留在这里';
    }
  }
  function animateHeldPaper(){
    if(!drag?.started)return;
    const reduced=motion()==='auto';
    drag.angle+=(drag.targetAngle-drag.angle)*.2;
    drag.targetAngle+=(drag.baseAngle-drag.targetAngle)*.07;
    drag.scale+=(1.025-drag.scale)*.22;
    if(reduced){drag.angle=drag.baseAngle;drag.scale=1;}
    if(drag.pointerY<65)window.scrollBy(0,-Math.min(12,(65-drag.pointerY)*.25));
    else if(drag.pointerY>innerHeight-95)window.scrollBy(0,Math.min(12,(drag.pointerY-innerHeight+95)*.25));
    placeHeldPaper();
    tableFrame=requestAnimationFrame(animateHeldPaper);
  }
  function liftHeldPaper() {
    if(drag.started)return;
    drag.started=true;selectedId=drag.id;selectedIds=new Set(drag.members.map(item=>item.id));selectionVisible=true;raisePapers(drag.members.map(item=>item.module));
    drag.members.forEach(item=>{item.source.style.zIndex=String(item.module.pose.z);item.source.classList.add('paper-lifted');item.source.setAttribute('aria-grabbed','true');});document.body.classList.add('is-dragging');syncPaperSelection();
    announce('纸片已拿起，可以自由摆放和叠压，按 A / D 旋转。');animateHeldPaper();
  }
  function rotateHeldPaper(amount) {
    const angle=angleForMembers(drag.members,drag.original.angle,drag.baseAngle+amount),delta=angle-drag.baseAngle;
    drag.baseAngle=angle;drag.rotated=true;
    drag.angle=angleForMembers(drag.members,drag.original.angle,drag.angle+delta);drag.targetAngle=angleForMembers(drag.members,drag.original.angle,drag.targetAngle+delta);
    liftHeldPaper();placeHeldPaper();announce('已转动手中的纸片，松开鼠标即可放下。');
  }
  function scaledMembers(items,original,box) {
    const scale=box.w/original.w;
    return items.map(item=>({item,x:box.x+(item.x-original.x)*scale,y:box.y+(item.y-original.y)*scale,w:item.w*scale,h:item.h*scale,angle:item.angle}));
  }
  function startResize(event,source,handle) {
    if(source.classList.contains('is-editing'))return;
    const module=paperById(source.dataset.moduleId);if(!module?.pose)return;
    flushEdit();event.preventDefault();const board=$('#paper-board').getBoundingClientRect(),members=captureMembers(module.id),groupBox=members.length>1?paperBounds(members):null;
    const w=groupBox?.w||source.offsetWidth,h=groupBox?.h||source.offsetHeight,angle=groupBox?0:module.pose.angle;
    const sx=handle.dataset.resize.includes('e')?1:-1,sy=handle.dataset.resize.includes('s')?1:-1,opposite=rotatePoint(-sx*w/2,-sy*h/2,angle);
    resizeDrag={id:module.id,module,source,handle,members,groupBox,pointerId:event.pointerId,snapshot:clone(current),w,h,sx,sy,angle,startX:event.clientX,startY:event.clientY,anchorX:board.left+(groupBox?.x??module.pose.x/100*board.width)+w/2+opposite.x,anchorY:board.top+(groupBox?.y??module.pose.y/100*board.width)+h/2+opposite.y,started:false};
    handle.setPointerCapture(event.pointerId);
  }
  function moveGroupResize(state,dx,dy) {
    const board=$('#paper-board').getBoundingClientRect(),ratio=1+(dx*state.sx*state.w+dy*state.sy*state.h)/(state.w*state.w+state.h*state.h);
    const minimum=Math.max(...state.members.map(item=>Math.min(1,board.width*.012/item.w)));
    let factor=clamp(ratio,minimum,Math.max(1,board.width*.95/state.w));
    const measure=scale=>{const w=state.w*scale,h=state.h*scale;return {x:state.anchorX-board.left-(state.sx>0?0:w),y:state.anchorY-board.top-(state.sy>0?0:h),w,h};};
    const inside=box=>box.x>=0&&box.y>=0&&box.x+box.w<=board.width;
    if(factor>1&&!inside(measure(factor))){let low=1,high=factor;for(let i=0;i<20;i++){const mid=(low+high)/2;if(inside(measure(mid)))low=mid;else high=mid;}factor=low;}
    state.position=measure(factor);state.positions=scaledMembers(state.members,state.groupBox,state.position);
    state.positions.forEach(box=>{box.item.source.style.width=box.w+'px';box.item.source.style.height=box.h+'px';box.item.source.style.transform=tableTransform(box.x,box.y,box.angle);});
    const needed=state.position.y+state.position.h+100;if(needed>$('#paper-board').offsetHeight)$('#paper-board').style.height=needed+'px';
    announce('正在等比例调整整组，纸片之间的位置保持不变。');
  }
  function moveResize(event) {
    const state=resizeDrag;if(!state||event.pointerId!==state.pointerId)return;
    const dx=event.clientX-state.startX,dy=event.clientY-state.startY;if(!state.started&&Math.hypot(dx,dy)<3)return;
    event.preventDefault();
    if(!state.started){state.started=true;selectedId=state.id;selectedIds=new Set(state.members.map(item=>item.id));selectionVisible=true;raisePapers(state.members.map(item=>item.module));syncPaperSelection();state.members.forEach(item=>item.source.classList.add('paper-resizing'));document.body.classList.add('is-resizing');}
    if(state.groupBox){moveGroupResize(state,dx,dy);return;}
    const local=rotatePoint(dx,dy,-state.angle),ratio=1+(local.x*state.sx*state.w+local.y*state.sy*state.h)/(state.w*state.w+state.h*state.h);
    const board=$('#paper-board').getBoundingClientRect(),minimum=Math.min(state.w,board.width*(state.module.kind ? .012 : .08));
    let w=clamp(state.w*ratio,minimum,Math.max(state.w,board.width*.95));
    const measure=width=>{
      state.source.style.width=width+'px';if((state.source.classList.contains('binding-primary')||state.source.classList.contains('atomic-piece')))state.source.style.height=state.h*width/state.w+'px';
      const h=state.source.offsetHeight,opposite=rotatePoint(-state.sx*width/2,-state.sy*h/2,state.angle);
      return {x:state.anchorX-board.left-width/2-opposite.x,y:state.anchorY-board.top-h/2-opposite.y,w:width,h};
    };
    const inside=box=>box.x>=0&&box.y>=0&&box.x+box.w<=board.width&&box.y<=board.width*(state.module.kind?500:30);
    let box=measure(w);
    // Stop at the edge of the tabletop instead of losing the opposite-corner anchor offscreen.
    if(w>state.w&&!inside(box)){
      let low=state.w,high=w;
      for(let i=0;i<20;i++){const mid=(low+high)/2;if(inside(measure(mid)))low=mid;else high=mid;}
      w=low;box=measure(w);
    }
    box.x=clamp(box.x,0,Math.max(0,board.width-w));box.y=clamp(box.y,0,board.width*(state.module.kind?500:30));
    state.position=box;state.source.style.transform=tableTransform(box.x,box.y,state.angle);
    const needed=box.y+box.h+100;if(needed>$('#paper-board').offsetHeight)$('#paper-board').style.height=needed+'px';
    announce('正在调整纸片大小，松手保留，Escape 取消。');
  }
  function endResize(event,cancelled=false) {
    const state=resizeDrag;if(!state||event.pointerId!==state.pointerId)return;
    if(state.handle.hasPointerCapture(event.pointerId))state.handle.releasePointerCapture(event.pointerId);
    state.members.forEach(item=>item.source.classList.remove('paper-resizing'));document.body.classList.remove('is-resizing');
    if(state.started){
      suppressClickUntil=Date.now()+350;
      if(cancelled){restoreMembers(state.members);}
      else{
        remember(state.snapshot);if(state.groupBox){state.positions.forEach(box=>setMemberPlacement(box.item,box,box.item.module.mounted));}else{const {x,y,w}=state.position,width=$('#paper-board').clientWidth;
        state.module.pose={...state.module.pose,x:x/width*100,y:y/width*100};state.module.paperWidth=w/width*100;
        if(current.bindingEnabled&&state.module.mounted)rememberCardPlacement(state.module,x,y,w,state.angle);}
        current.status='draft';current.step=steps.findIndex(step=>step.type===state.module.type);
      }
      resizeDrag=null;render();persist();focusPaper();announce(cancelled?'已恢复原来的大小。':'纸片大小和位置已保存。');
    }else resizeDrag=null;
  }
  function resizeWithKeyboard(factor) {
    const items=captureMembers();if(items.length>1){
      const box=paperBounds(items),width=$('#paper-board').clientWidth,minimum=Math.max(...items.map(item=>Math.min(1,width*.012/item.w))),maximum=Math.max(1,(width-box.x)/box.w);
      factor=clamp(factor,minimum,maximum);
      mutate(()=>scaledMembers(items,box,{...box,w:box.w*factor,h:box.h*factor}).forEach(next=>setMemberPlacement(next.item,next,next.item.module.mounted)));focusPaper();return;
    }
    const module=activeModule(),paper=document.querySelector(`[data-module-id="${selectedId}"]`);if(!module||!paper)return;
    mutate(()=>{const width=$('#paper-board').clientWidth,w=clamp(paper.offsetWidth*factor,Math.min(paper.offsetWidth,width*(module.kind ? .012 : .08)),Math.max(paper.offsetWidth,width*.95));module.paperWidth=w/width*100;if(module.mounted&&bindingLayout)rememberCardPlacement(module,module.pose.x/100*width,module.pose.y/100*width,w,module.pose.angle);});focusPaper();
  }
  document.addEventListener('pointerdown',event=>{
    const source=event.target.closest('.paper-piece')||(event.target.closest('[data-group-resize]')?document.querySelector(`[data-module-id="${selectedId}"]`):null);if(!source||event.button!==0||preview||drag||resizeDrag)return;
    if(event.shiftKey&&!event.target.closest('button,input,textarea,select,summary')){event.preventDefault();suppressClickUntil=Date.now()+350;chooseModule(source.dataset.moduleId,{additive:true});return;}
    const resizeHandle=event.target.closest('[data-resize]');if(resizeHandle){startResize(event,source,resizeHandle);return;}
    if(!event.target.closest('.piece-content')||event.target.closest('button,a,input,textarea,select,summary,.binding-popover,.atomic-popover')||source.classList.contains('is-editing'))return;
    flushEdit();event.preventDefault();
    const module=paperById(source.dataset.moduleId);if(!module?.pose)return;
    const board=$('#paper-board').getBoundingClientRect(),w=parseFloat(source.style.width)||source.offsetWidth,h=parseFloat(source.style.height)||source.offsetHeight;
    const x=module.pose.x/100*board.width,y=module.pose.y/100*board.width;
    const grip=rotatePoint(event.clientX-board.left-x-w/2,event.clientY-board.top-y-h/2,-module.pose.angle);
    drag={id:module.id,module,source,members:captureMembers(module.id),handle:source,pointerId:event.pointerId,fieldPath:event.target.closest('[data-inline-path]')?.dataset.inlinePath,original:clone(module.pose),originalMounted:module.mounted,originalCardPose:clone(module.cardPose??null),snapshot:clone(current),w,h,grip,startX:event.clientX,startY:event.clientY,pointerX:event.clientX,pointerY:event.clientY,lastX:event.clientX,lastTime:performance.now(),started:false,rotated:false,baseAngle:module.pose.angle,angle:module.pose.angle,targetAngle:module.pose.angle,scale:1};
    drag.handle.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove',event=>{
    if(resizeDrag){moveResize(event);return;}
    if(!drag||event.pointerId!==drag.pointerId)return;
    drag.pointerX=event.clientX;drag.pointerY=event.clientY;
    if(!drag.started&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<4)return;
    event.preventDefault();
    liftHeldPaper();
    const now=performance.now(),velocity=(event.clientX-drag.lastX)/Math.max(8,now-drag.lastTime);
    drag.targetAngle=angleForMembers(drag.members,drag.original.angle,drag.baseAngle+velocity*2.4);drag.lastX=event.clientX;drag.lastTime=now;
  },{passive:false});
  function endDrag(event,cancelled=false){
    if(!drag||event.pointerId!==drag.pointerId)return;const ended=drag;
    cancelAnimationFrame(tableFrame);
    ended.members.forEach(item=>{item.source.classList.remove('paper-lifted');item.source.removeAttribute('aria-grabbed');});document.body.classList.remove('is-dragging');
    if(ended.handle.hasPointerCapture(event.pointerId))ended.handle.releasePointerCapture(event.pointerId);
    if(ended.started){
      suppressClickUntil=Date.now()+350;
      const before=ended.source.style.transform;
      if(cancelled){restoreMembers(ended.members);}
      else{
        remember(ended.snapshot);
        const angle=angleForMembers(ended.members,ended.original.angle,ended.rotated||ended.members.length>1?ended.baseAngle:ended.baseAngle+(ended.pointerX-ended.startX)*.006),mounted=canDockPaper(ended);
        heldPositions(ended,angle,1).forEach(box=>setMemberPlacement(box.item,box,mounted));
        if(editingId!==ended.id){editingId=null;settingsId=null;}
        selectedId=ended.id;selectionVisible=true;current.step=steps.findIndex(step=>step.type===ended.module.type);current.status='draft';
      }
      drag=null;renderBoard();const settled=document.querySelector(`[data-module-id="${ended.id}"]`),after=settled.style.transform;
      if(motion()!=='auto'&&ended.members.length===1)settled.animate([{transform:before},{transform:after,offset:.78},{transform:after}],{duration:300,easing:'cubic-bezier(.2,.75,.25,1)'});
      syncPaperSelection();
      persist();renderNavigation();renderInspector();if(!cancelled)focusPaper();announce(cancelled?'纸片已回到原处。':ended.module.mounted?'组件已拼入整卡。':'纸片已经放下，桌面布局已保存。');
    }else if(!cancelled){
      const repeated=lastPaperTap?.id===ended.id&&Date.now()-lastPaperTap.time<550&&(document.body.classList.contains('layers-open')||ended.fieldPath&&lastPaperTap.path===ended.fieldPath);
      lastPaperTap={id:ended.id,path:ended.fieldPath,time:Date.now()};
      chooseModule(ended.id,{edit:!!repeated});
      if(repeated){suppressClickUntil=Date.now()+350;if(ended.fieldPath)document.querySelector(`[data-module-id="${ended.id}"] [data-inline-editor][data-path="${CSS.escape(ended.fieldPath)}"]`)?.focus({preventScroll:true});}
    }
    drag=null;updateGroupSelection();
  }
  document.addEventListener('pointerup',event=>{if(resizeDrag)endResize(event);else endDrag(event);});document.addEventListener('pointercancel',event=>{if(resizeDrag)endResize(event,true);else endDrag(event,true);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag)endDrag({pointerId:drag.pointerId},true);});
  new ResizeObserver(()=>{const width=$('#paper-board').clientWidth;if(width!==lastTableWidth&&!drag&&!resizeDrag){lastTableWidth=width;layoutTable();}}).observe($('#paper-board'));
  render();if(loadNotice)showNotice('本地记录读取提示',[loadNotice]);else persist();
})();
