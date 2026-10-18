(() => {
  'use strict';
  const M = window.WorkshopModel, Forms = window.WorkshopForms, Cards = window.WorkshopCards, Binding = window.WorkshopBinding;
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
  let editingId = null, settingsId = null, bindingLayout = null;
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
  const activeModule = () => current.modules.find(item => item.id === selectedId);
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
    current=previous; if(!current.modules.some(item=>item.id===selectedId))selectedId=current.modules[0]?.id;
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
    $('#module-count').textContent=`${current.modules.length} 张纸片 · ${new Set(current.modules.map(item=>item.type)).size} 类组件`;
    $('#journey-progress').textContent=`${String(current.step+1).padStart(2,'0')} / 06 · ${steps[current.step].name}`;
    $('#journey-hint').textContent=current.step===5?validation.valid?'检查通过，可以装订保存。':`还有 ${validation.errors.length} 处需要填写或调整。`:'布局与填写内容会自动保存在此浏览器。';
    $('#previous-step').disabled=current.step===0;
    $('#next-step').textContent=current.step===5?'完成并保存 ✓':`下一步：${steps[current.step+1].name} →`;
    $('#next-step').disabled=current.step===5&&!validation.valid;
    $('#undo-button').disabled=undoStack.length===0;
    $('#unbind-button').hidden=!current.bindingEnabled;
    $('#assembly-caption').textContent=current.bindingEnabled?'双击文字就地填写 · Delete 拆出组件 · 拖回留白处重新拼合':'双击文字就地填写 · 抓起时 A / D 旋转 · ⌘D / Ctrl+D 复制 · Delete 拆下';
  }
  function pieceHTML(module) {
    const selected=selectionVisible&&module.id===selectedId;
    const mounted=!!(current.bindingEnabled&&module.mounted),primary=mounted&&bindingLayout?.primaryIds?.includes(module.id);
    const content=primary?Binding.renderModule(module):Cards.render(module,{selected,stepActive:module.type===steps[current.step].type});
    const footer=primary?'<div class="paper-edit-footer"><span>直接在纸面上填写</span><button data-action="paper-settings">条目与规则</button><button data-action="finish-inline">完成填写 ✓</button></div>':'';
    return `<article class="paper-piece ${selected?'selected':''} ${editingId===module.id?'is-editing':''} ${primary?'binding-primary':''}" data-mounted="${mounted}" data-module-id="${module.id}" data-width="${module.width}" tabindex="0" role="group" aria-label="${esc(module.title)}纸雕组件" aria-describedby="assembly-caption" aria-keyshortcuts="A D Meta+d Control+d Delete Backspace">
      <button class="piece-edit-button" data-action="edit-module" aria-label="填写${esc(module.title)}组件" title="填写" tabindex="${selected?0:-1}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15.5 4.5 4 4M4 20l4.8-1.1L20 7.7a2.8 2.8 0 0 0-4-4L4.9 15zM5 15l4 4"/></svg></button>
      <div class="piece-content" data-action="select-module">${content}${footer}</div>${editingId===module.id?'<div class="paper-rule-feedback" role="status" aria-live="polite"></div>':''}${settingsId===module.id?`<section class="paper-settings inspector" aria-label="${esc(module.title)}条目与规则">${Forms.render(module)}<button data-action="paper-settings">收起这页设置</button></section>`:''}
    </article>`;
  }
  function syncPaperSelection() {
    document.querySelectorAll('.paper-piece').forEach(el=>{
      const selected=selectionVisible&&el.dataset.moduleId===selectedId;
      el.classList.toggle('selected',selected);el.querySelector('.piece-edit-button').tabIndex=selected?0:-1;const module=current.modules.find(item=>item.id===el.dataset.moduleId);if(module?.pose)el.style.zIndex=String(editingId===module.id?10001:module.pose.z);
    });
  }
  function clearPaperSelection() { selectionVisible=false;syncPaperSelection();if(document.activeElement?.closest('.paper-piece'))document.activeElement.blur();if(editingId){flushEdit();editingId=null;settingsId=null;renderBoard();persist();} }
  function focusPaper() { document.querySelector(`[data-module-id="${selectedId}"]`)?.focus({preventScroll:true}); }
  function renderBoard() {
    const opened=new Map([...document.querySelectorAll('.paper-piece')].map(paper=>[paper.dataset.moduleId,[...paper.querySelectorAll('details[open]')].map(detail=>detail.className)]));
    bindingLayout=current.bindingEnabled?Binding.layout(current,$('#paper-board').clientWidth,{maxCardWidth:preview?Math.min(620,Math.max(340,(innerHeight-120)*600/870)):620}):null;
    $('#paper-board').classList.toggle('has-binding',!!bindingLayout);
    $('#paper-board').innerHTML=(bindingLayout?Binding.renderBase(current,bindingLayout):'')+(current.modules.length?current.modules.map(pieceHTML).join(''):`<div class="empty-board"><h2>桌上，还是一片空白。</h2><p>从组件匣拿出身份、属性或故事，开始组合你的角色。</p><button data-action="add" class="button-cream">＋ 添加第一张组件</button></div>`);
    activatePaperInputs();document.querySelectorAll('.paper-piece details').forEach(detail=>{if(opened.get(detail.closest('.paper-piece').dataset.moduleId)?.includes(detail.className))detail.open=true;});layoutTable();updateRuleFeedback();
  }
  function reviewHTML() {
    const validation=M.validateCharacter(current);
    return `<small class="kicker">THE FINAL BINDING</small><h2>把冒险装订起来。</h2><p class="guide-copy">组件可以自由取舍。保留的组件会检查姓名、数值和配点；故事内容可以留待冒险继续。</p><div class="review-list">${steps.slice(0,5).map(step=>{
      const list=current.modules.filter(item=>item.type===step.type),errors=stepErrors(step.type);
      const rules=list.filter(item=>item.data.rules?.enabled).length;
      return `<div class="review-item ${errors.length?'warning':''}"><span>${errors.length?'!':list.length?'✓':'—'}</span><div><b>${step.name}</b><small>${errors.length?`${errors.length} 处待调整`:list.length?`${list.length} 张组件，已检查${rules?' · '+rules+' 组规则通过':''}`:'未装入这类组件'}</small></div></div>`;
    }).join('')}</div>${validation.errors.length?`<div class="validation-errors">${validation.errors.map((error,index)=>`<button data-action="fix-error" data-error-index="${index}">${esc(error.message)} ↗</button>`).join('')}</div>`:''}<button data-action="finish" class="finish-button" ${validation.valid?'':'disabled'}>完成并保存这张角色卡 ✓</button><p class="review-note">自由填写与规则校验可以并用。已开启的规则会检查自定义总额、上下限及整数要求；不会自动改写你的数值。</p>${validation.warnings.length?`<details><summary>${validation.warnings.length} 条可选补充</summary><p class="review-note">${validation.warnings.map(esc).join('<br>')}</p></details>`:''}`;
  }
  function renderInspector() {
    $('.review-inspector').hidden=current.step!==5;
    $('#inspector-content').innerHTML=current.step===5?reviewHTML():'';
    updateRuleFeedback();
  }
  function render() { renderNavigation(); renderBoard(); renderInspector(); }
  function chooseModule(id,{scroll=false,edit=false}={}) {
    flushEdit(); selectedId=id; selectionVisible=true; const module=activeModule(); if(!module)return;
    current.step=steps.findIndex(step=>step.type===module.type);
    if(module.pose)module.pose.z=frontZ();
    const changed=editingId&&editingId!==id;
    if(changed){editingId=null;settingsId=null;}
    if(edit)editingId=id;
    renderNavigation();if(edit||changed)renderBoard();else syncPaperSelection();renderInspector();persist();
    if(scroll) document.querySelector(`[data-module-id="${id}"]`)?.scrollIntoView({behavior:motion(),block:'start'});
    if(edit)document.querySelector(`[data-module-id="${id}"] [data-inline-editor]`)?.focus({preventScroll:true});else focusPaper();
  }
  function goStep(index) {
    flushEdit();editingId=null;settingsId=null;selectionVisible=false; current.step=Math.max(0,Math.min(5,index));
    selectedId=current.modules.find(item=>item.type===steps[current.step].type)?.id;
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
  function frontZ() { return Math.min(10000,Math.max(0,...current.modules.map(module=>module.pose?.z||0))+1); }
  function tableTransform(x,y,angle,scale=1) { return `translate3d(${x}px,${y}px,0) rotate(${angle}deg) scale(${scale})`; }
  function layoutTable(arrange=false) {
    const board=$('#paper-board'),width=board.clientWidth;
    if(!width||!current.modules.length){board.style.height='auto';return;}
    bindingLayout=current.bindingEnabled?Binding.layout(current,width,{maxCardWidth:preview?Math.min(620,Math.max(340,(innerHeight-120)*600/870)):620}):null;
    if(bindingLayout){const base=board.querySelector('.binding-base');if(base)base.outerHTML=Binding.renderBase(current,bindingLayout);}
    const pad=width*.025,gap=width*.035,half=(width-pad*2-gap)/2;
    const looseStart=bindingLayout?bindingLayout.frame.y+bindingLayout.frame.height+45:pad;
    let y=looseStart,rowHeight=0,column=0,bottom=bindingLayout?.height||0;
    const initial=current.modules.every(module=>!module.pose);
    current.modules.forEach((module,index)=>{
      const el=board.querySelector(`[data-module-id="${module.id}"]`);if(!el)return;
      const placement=bindingLayout?.placements?.[module.id];
      if(module.mounted&&placement){
        el.style.width=placement.w+'px';
        el.style.height=el.classList.contains('binding-primary')?placement.h+'px':'';
        module.pose={x:placement.x/width*100,y:placement.y/width*100,angle:0,z:module.pose?.z||index+1};
        el.style.transform=tableTransform(placement.x,placement.y,0);el.style.zIndex=String(editingId===module.id?10001:module.pose.z);
        bottom=Math.max(bottom,placement.y+Math.max(placement.h,el.offsetHeight));return;
      }
      el.style.height='';
      const full=module.width==='full',w=full?width-pad*2:half;
      el.style.width=w+'px';
      const height=el.offsetHeight;
      if(arrange||initial){
        if(full&&column){y+=rowHeight+gap;column=0;rowHeight=0;}
        const x=column?pad+half+gap:pad;
        module.pose={x:x/width*100,y:y/width*100,angle:arrange?0:[-.7,.65,-.45,.8,-.35][index%5],z:index+1};
        if(full){y+=height+gap;column=0;rowHeight=0;}
        else{rowHeight=Math.max(rowHeight,height);column++;if(column===2){y+=rowHeight+gap;column=0;rowHeight=0;}}
      }else if(!module.pose){module.pose={x:2.5,y:(bottom+gap)/width*100,angle:.7,z:frontZ()};}
      module.pose.x=clamp(module.pose.x,0,Math.max(0,(width-w)/width*100));
      module.pose.y=clamp(module.pose.y,0,3000);
      const x=module.pose.x/100*width,top=module.pose.y/100*width;
      el.style.transform=tableTransform(x,top,module.pose.angle);
      el.style.zIndex=String(editingId===module.id?10001:module.pose.z);
      bottom=Math.max(bottom,top+height);
    });
    board.style.height=Math.ceil(bottom+Math.max(100,width*.16))+'px';
    board.style.setProperty('--print-board-height',board.style.height);
    board.querySelectorAll('.paper-piece').forEach(el=>{el.style.setProperty('--print-piece-width',el.style.width);el.style.setProperty('--print-piece-height',el.style.height||'auto');el.style.setProperty('--print-piece-transform',el.style.transform);});
  }
  function assembleAll() {
    editingId=null;settingsId=null;clearPaperSelection();
    mutate(()=>{current.bindingEnabled=true;current.modules.forEach(module=>module.mounted=true);},'已拼成一张整卡。技能与故事接在附页，双击纸面即可填写。');
    $('#paper-board').scrollIntoView({behavior:motion(),block:'start'});
  }
  function loosePose() {
    const width=$('#paper-board').clientWidth;
    return {x:3,y:((bindingLayout?bindingLayout.frame.y+bindingLayout.frame.height:0)+45)/width*100,angle:-2,z:frontZ()};
  }
  function detachModule(module) { module.mounted=false;module.pose=loosePose(); }
  function rotateModule(id,amount) {
    mutate(()=>{const module=current.modules.find(item=>item.id===id);if(!module?.pose)return;if(current.bindingEnabled&&module.mounted)detachModule(module);module.pose.angle=clamp(module.pose.angle+amount,-15,15);module.pose.z=frontZ();selectedId=id;current.step=steps.findIndex(step=>step.type===module.type);});
    focusPaper();announce('已转动纸片。');
  }
  function duplicateModule(id) {
    const index=current.modules.findIndex(item=>item.id===id);if(index<0)return;
    if(current.modules.length>=30){toast('一张角色卡最多放 30 个组件。');return;}
    mutate(()=>{const module=M.cloneModule(current.modules[index]);module.title+=' · 副本';if(current.bindingEnabled)module.pose=loosePose();else if(module.pose)module.pose={...module.pose,x:module.pose.x+3,y:module.pose.y+4,angle:clamp(module.pose.angle+1,-15,15),z:frontZ()};current.modules.splice(index+1,0,module);selectedId=module.id;selectionVisible=true;editingId=null;settingsId=null;current.step=steps.findIndex(step=>step.type===module.type);},'复制了一张独立纸片。');
    focusPaper();
  }
  function removeModule(id) {
    const index=current.modules.findIndex(item=>item.id===id);if(index<0)return;
    if(current.bindingEnabled&&current.modules[index].mounted){mutate(()=>{detachModule(current.modules[index]);editingId=null;settingsId=null;},'已从底卡拆出，内容仍保留。拖回对应留白处可以重新拼合。');focusPaper();return;}
    mutate(()=>{current.modules.splice(index,1);selectedId=current.modules.find(item=>item.type===steps[current.step].type)?.id;selectionVisible=false;},'组件已拆下；⌘Z / Ctrl+Z 可以恢复。');
  }
  function finish() {
    flushEdit(); const validation=M.validateCharacter(current);
    if(!validation.valid){goStep(5);toast('先调整检查页列出的项目，再装订角色。');return;}
    current.status='complete'; current.step=5; render(); const saved=persist();
    $('#finish-title').textContent=`${characterName(current)}，准备出发。`;
    $('#finish-copy').textContent=saved?`${current.modules.length} 张纸雕组件已经收好。布局、规则、数值、装备与故事均已保存在此浏览器。`:`${current.modules.length} 张组件检查通过。浏览器未能保存，请立即导出 JSON；关闭页面前保留备份。`;
    $('#finish-dialog').showModal();
  }
  function exportJSON() {
    flushEdit(); const data=M.exportCharacter(current);
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`${characterName(current).replace(/[\\/:*?"<>|]/g,'_')}-纸雕角色.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('角色与组件布局已导出。');
  }
  function showNotice(title,lines) { $('#notice-title').textContent=title;$('#notice-content').innerHTML=`<div class="notice-lines">${lines.map(esc).join('<br>')}</div>`;$('#notice-dialog').showModal(); }
  function renderLibrary() {
    $('#character-library').innerHTML=[...characters].reverse().map(record=>`<div class="character-record"><div class="record-icon">${record.status==='complete'?'✧':'✎'}</div><div><b>${esc(characterName(record))}</b><small>${record.status==='complete'?'已装订':'草稿'} · ${record.modules.length} 张纸片 · ${new Date(record.updatedAt).toLocaleDateString('zh-CN')}</small></div><div class="record-actions"><button data-action="open-character" data-id="${record.id}">${record.id===current.id?'正在编辑':'打开'}</button><button data-action="clone-character" data-id="${record.id}">复制</button></div></div>`).join('');
  }
  function switchCharacter(record) { flushEdit();persist();current=record;editingId=null;settingsId=null;selectionVisible=false;selectedId=current.modules.find(item=>item.type===steps[current.step].type)?.id||current.modules[0]?.id;undoStack=[];preview=false;document.body.classList.remove('card-preview');$('#preview-button').textContent='预览整卡';render();persist();$('#library-dialog').close();window.scrollTo({top:0,behavior:motion()}); }
  function createCharacter(sample) { switchCharacter(M.createCharacter({sample}));toast(sample?'已放入一份独立的骑士示例。':'新的空白角色已经铺开。'); }

  function getPath(root,path){return path.split('.').reduce((value,key)=>value?.[key],root);}
  function setPath(root,path,value){const parts=path.split('.');if(parts.some(key=>['__proto__','constructor','prototype'].includes(key)))return;const leaf=parts.pop();const parent=parts.reduce((object,key)=>object?.[key],root);if(parent)parent[leaf]=value;}
  function activatePaperInputs() {
    if(!editingId||preview)return;
    const paper=document.querySelector(`[data-module-id="${editingId}"]`),module=current.modules.find(item=>item.id===editingId);
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
    const paper=document.querySelector(`[data-module-id="${module.id}"]`);if(!paper)return;
    const template=document.createElement('template');
    template.innerHTML=paper.classList.contains('binding-primary')?Binding.renderModule(module):Cards.render(module);
    paper.querySelectorAll('.piece-underpainting,[data-live-art]').forEach(node=>{
      const selector=node.dataset.liveArt?`[data-live-art="${CSS.escape(node.dataset.liveArt)}"]`:'.piece-underpainting';
      const replacement=template.content.querySelector(selector);if(replacement)node.replaceWith(replacement);
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
  function fieldModule(input) { const id=input.closest('[data-module-id]')?.dataset.moduleId;return id?current.modules.find(module=>module.id===id):activeModule(); }
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
    const errors=M.validateCharacter(current).errors.filter(error=>error.moduleId===module.id);
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
    if(action.startsWith('add-')&&rows.length>=limits[module.type]){toast('这一张纸片的条目已满，可以再添加一个同类组件。');return;}
    mutate(()=>{
      if(action==='add-attribute')rows.push({id:M.uid('attr'),key:'NEW',name:'新属性',value:1});
      if(action==='add-skill')rows.push({id:M.uid('skill'),name:'新技能',value:0});
      if(action==='add-equipment')rows.push({id:M.uid('gear'),name:'新的随身物品',detail:'',quantity:1,weight:0,equipped:false,assetIndex:null});
      if(action==='add-background')rows.push({id:M.uid('story'),label:'新的故事片段',value:''});
      if(action.startsWith('remove-')&&index>=0&&index<rows.length)rows.splice(index,1);
    });
    if(action.startsWith('add-')){const paper=document.querySelector(`[data-module-id="${module.id}"]`);const inputs=paper?.querySelectorAll('[data-inline-editor]');inputs?.[inputs.length-1]?.focus({preventScroll:true});}
  }

  document.addEventListener('click',event=>{
    if(Date.now()<suppressClickUntil){event.preventDefault();return;}
    if(event.target.closest('input,textarea,select,summary'))return;
    if(!preview&&!event.target.closest('.paper-piece,button,a,input,textarea,select')&&(event.target.closest('.assembly')||event.target===document.body))clearPaperSelection();
    const cardButton=event.target.closest('[data-card-action]');
    if(cardButton&&!preview){const module=current.modules.find(item=>item.id===cardButton.closest('[data-module-id]')?.dataset.moduleId);if(!module)return;flushEdit();if(editingId!==module.id){editingId=null;settingsId=null;}selectedId=module.id;selectionVisible=true;const index=Number(cardButton.dataset.index);mutate(()=>{current.step=steps.findIndex(step=>step.type===module.type);if(cardButton.dataset.cardAction==='set-attribute'&&module.data.items[index])module.data.items[index].value=Number(cardButton.dataset.value);if(cardButton.dataset.cardAction==='toggle-equipment'&&module.data.items[index])module.data.items[index].equipped=!module.data.items[index].equipped;});return;}
    const formButton=event.target.closest('[data-form-action]');if(formButton){if(formButton.dataset.formAction!=='toggle-budget')formAction(formButton);return;}
    const button=event.target.closest('[data-action]');if(!button)return;
    const action=button.dataset.action,id=button.closest('[data-module-id]')?.dataset.moduleId;
    if(action==='finish-inline'){finishPaperEditing();return;}
    if(action==='paper-settings'){flushEdit();selectedId=id;editingId=id;settingsId=settingsId===id?null:id;render();persist();return;}
    if(action==='bind-all'){assembleAll();return;}
    if(action==='unbind-all'){editingId=null;settingsId=null;mutate(()=>{current.bindingEnabled=false;current.modules.forEach(module=>{module.mounted=false;module.pose=null;});},'已拆回独立纸片，填写内容和规则保留。');return;}
    if(action==='mount-type'){const module=current.modules.find(item=>item.type===button.dataset.type&&!item.mounted);if(module)mutate(()=>module.mounted=true,'组件已贴回底卡。');else addModule(button.dataset.type,true);return;}
    if(action==='undo')undo();
    if(action==='add')$('#component-dialog').showModal();
    if(action==='add-type')addModule(button.dataset.type);
    if(action==='close-dialog')button.closest('dialog').close();
    if(action==='step')goStep(Number(button.dataset.step));
    if(action==='previous-step')goStep(current.step-1);
    if(action==='next-step'){if(current.step===5)finish();else{const errors=stepErrors(steps[current.step].type);if(errors.length){toast(errors[0].message);renderInspector();}else goStep(current.step+1);}}
    if(action==='edit-module'||action==='select-module'){if(!preview)chooseModule(id,{edit:action==='edit-module'});}
    if(action==='tidy')mutate(()=>layoutTable(true),'已把纸片重新铺齐；可以继续自由摆放。');
    if(action==='preview'){flushEdit();clearPaperSelection();preview=!preview;document.body.classList.toggle('card-preview',preview);button.textContent=preview?'返回组合编辑':'预览整卡';$('#assembly-caption').textContent=preview?'':'拖动纸面摆放 · 选中或抓起时 A / D 旋转 · ⌘D / Ctrl+D 复制 · Delete 拆下';layoutTable();$('#paper-board').scrollIntoView({behavior:motion(),block:'start'});}
    if(action==='library'){flushEdit();persist();renderLibrary();$('#library-dialog').showModal();}
    if(action==='new')createCharacter(false);
    if(action==='sample')createCharacter(true);
    if(action==='open-character'){const record=characters.find(item=>item.id===button.dataset.id);if(record)switchCharacter(record);}
    if(action==='clone-character'){const record=characters.find(item=>item.id===button.dataset.id);if(record){const duplicate=M.cloneCharacter(record);duplicate.status='draft';duplicate.step=0;switchCharacter(duplicate);toast('已复制为独立角色，原卡保持原样。');}}
    if(action==='finish')finish();
    if(action==='export')exportJSON();
    if(action==='print')window.print();
    if(action==='import')$('#import-file').click();
    if(action==='fix-error'){const error=M.validateCharacter(current).errors[Number(button.dataset.errorIndex)];if(error?.moduleId){chooseModule(error.moduleId,{scroll:true,edit:true});const path='data.'+error.field;const target=document.querySelector(`[data-path="${CSS.escape(path)}"]`);if(target){for(let ancestor=target.parentElement;ancestor;ancestor=ancestor.parentElement){if(ancestor.tagName==='DETAILS')ancestor.open=true;}target.focus({preventScroll:true});}}else if(error)addModule('identity');}
  });
  document.addEventListener('dblclick',event=>{
    if(preview||event.target.closest('input,textarea,select'))return;
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
    if(event.isComposing||$('dialog[open]')||preview)return;
    const command=event.metaKey||event.ctrlKey;
    const rotation=!command&&!event.altKey&&(event.key.toLowerCase()==='a'||event.key.toLowerCase()==='d');
    // Pointer capture can leave keyboard focus in the inspector or on another paper.
    // Rotate the held paper in place; rendering it again would release the grip.
    if(drag){if(rotation){event.preventDefault();rotateHeldPaper(event.key.toLowerCase()==='a'?-3:3);}return;}
    if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],.inspector'))return;
    if(command&&event.key.toLowerCase()==='z'&&!event.shiftKey&&!event.altKey){event.preventDefault();undo();return;}
    if(event.key==='Escape'){clearPaperSelection();return;}
    if(!selectionVisible||!activeModule()||event.altKey)return;
    const focusedPaper=event.target.closest('.paper-piece');
    if(focusedPaper&&focusedPaper.dataset.moduleId!==selectedId)return;
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
  let drag=null,suppressClickUntil=0,tableFrame=0,lastTableWidth=0,lastPaperTap=null;
  const rotatePoint=(x,y,angle)=>{const r=angle*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
  function pointerPosition(state,angle,scale) {
    const rect=$('#paper-board').getBoundingClientRect(),grip=rotatePoint(state.grip.x*scale,state.grip.y*scale,angle);
    return {x:clamp(state.pointerX-rect.left-state.w/2-grip.x,0,Math.max(0,rect.width-state.w)),y:clamp(state.pointerY-rect.top-state.h/2-grip.y,0,rect.width*30)};
  }
  function canDockPaper(state) {
    if(!current.bindingEnabled||!bindingLayout)return false;
    const board=$('#paper-board').getBoundingClientRect(),frame=bindingLayout.frame;
    const x=state.pointerX-board.left,y=state.pointerY-board.top;
    return x>=frame.x-15&&x<=frame.x+frame.width+15&&y>=frame.y-15&&y<=frame.y+frame.height+15;
  }
  function placeHeldPaper() {
    const position=pointerPosition(drag,drag.angle,drag.scale);
    drag.source.style.transform=tableTransform(position.x,position.y,drag.angle,drag.scale);
    const board=$('#paper-board'),needed=position.y+drag.h+100;
    if(needed>board.offsetHeight)board.style.height=needed+'px';
    if(bindingLayout){
      let guide=board.querySelector('.binding-drop-guide');
      if(!guide){guide=document.createElement('div');guide.className='binding-drop-guide';board.append(guide);}
      const slot=bindingLayout.slots[drag.module.type]||{x:bindingLayout.frame.x,y:bindingLayout.frame.y+bindingLayout.frame.height-80,w:bindingLayout.frame.width,h:80};
      Object.assign(guide.style,{left:slot.x+'px',top:slot.y+'px',width:slot.w+'px',height:slot.h+'px'});
      guide.hidden=!canDockPaper(drag);guide.textContent='松手，将'+M.TITLES[drag.module.type]+'拼入整卡';
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
    drag.started=true;drag.module.pose.z=frontZ();drag.source.style.zIndex=String(drag.module.pose.z);
    drag.source.classList.add('paper-lifted');drag.source.setAttribute('aria-grabbed','true');document.body.classList.add('is-dragging');
    announce('纸片已拿起，可以自由摆放和叠压，按 A / D 旋转。');animateHeldPaper();
  }
  function rotateHeldPaper(amount) {
    const angle=clamp(drag.baseAngle+amount,-15,15),delta=angle-drag.baseAngle;
    drag.baseAngle=angle;drag.rotated=true;
    drag.angle=clamp(drag.angle+delta,-15,15);drag.targetAngle=clamp(drag.targetAngle+delta,-15,15);
    liftHeldPaper();placeHeldPaper();announce('已转动手中的纸片，松开鼠标即可放下。');
  }
  document.addEventListener('pointerdown',event=>{
    const source=event.target.closest('.paper-piece');if(!source||event.button!==0||preview)return;
    if(!event.target.closest('.piece-content')||event.target.closest('button,a,input,textarea,select,summary,.binding-popover')||source.classList.contains('is-editing'))return;
    flushEdit();event.preventDefault();
    const module=current.modules.find(item=>item.id===source.dataset.moduleId);if(!module?.pose)return;
    const board=$('#paper-board').getBoundingClientRect(),w=source.offsetWidth,h=source.offsetHeight;
    const x=module.pose.x/100*board.width,y=module.pose.y/100*board.width;
    const grip=rotatePoint(event.clientX-board.left-x-w/2,event.clientY-board.top-y-h/2,-module.pose.angle);
    drag={id:module.id,module,source,handle:source,pointerId:event.pointerId,fieldPath:event.target.closest('[data-inline-path]')?.dataset.inlinePath,original:clone(module.pose),originalMounted:module.mounted,snapshot:clone(current),w,h,grip,startX:event.clientX,startY:event.clientY,pointerX:event.clientX,pointerY:event.clientY,lastX:event.clientX,lastTime:performance.now(),started:false,rotated:false,baseAngle:module.pose.angle,angle:module.pose.angle,targetAngle:module.pose.angle,scale:1};
    drag.handle.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    drag.pointerX=event.clientX;drag.pointerY=event.clientY;
    if(!drag.started&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<4)return;
    event.preventDefault();
    liftHeldPaper();
    const now=performance.now(),velocity=(event.clientX-drag.lastX)/Math.max(8,now-drag.lastTime);
    drag.targetAngle=clamp(drag.baseAngle+velocity*2.4,-15,15);drag.lastX=event.clientX;drag.lastTime=now;
  },{passive:false});
  function endDrag(event,cancelled=false){
    if(!drag||event.pointerId!==drag.pointerId)return;const ended=drag;
    cancelAnimationFrame(tableFrame);
    ended.source.classList.remove('paper-lifted');ended.source.removeAttribute('aria-grabbed');document.body.classList.remove('is-dragging');
    if(ended.handle.hasPointerCapture(event.pointerId))ended.handle.releasePointerCapture(event.pointerId);
    if(ended.started){
      suppressClickUntil=Date.now()+350;
      const before=ended.source.style.transform;
      if(cancelled){ended.module.pose=ended.original;ended.module.mounted=ended.originalMounted;}
      else{
        remember(ended.snapshot);
        const angle=ended.rotated?ended.baseAngle:clamp(ended.baseAngle+(ended.pointerX-ended.startX)*.006,-15,15),position=pointerPosition(ended,angle,1),width=$('#paper-board').clientWidth;
        ended.module.pose={x:position.x/width*100,y:position.y/width*100,angle,z:ended.module.pose.z};
        ended.module.mounted=canDockPaper(ended);
        if(editingId!==ended.id){editingId=null;settingsId=null;}
        selectedId=ended.id;selectionVisible=true;current.step=steps.findIndex(step=>step.type===ended.module.type);current.status='draft';
      }
      drag=null;renderBoard();const settled=document.querySelector(`[data-module-id="${ended.id}"]`),after=settled.style.transform;
      if(motion()!=='auto')settled.animate([{transform:before},{transform:after,offset:.78},{transform:after}],{duration:300,easing:'cubic-bezier(.2,.75,.25,1)'});
      syncPaperSelection();
      persist();renderNavigation();renderInspector();if(!cancelled)focusPaper();announce(cancelled?'纸片已回到原处。':ended.module.mounted?'组件已拼入整卡。':'纸片已经放下，桌面布局已保存。');
    }else if(!cancelled){
      const repeated=ended.fieldPath&&lastPaperTap?.id===ended.id&&lastPaperTap.path===ended.fieldPath&&Date.now()-lastPaperTap.time<550;
      lastPaperTap={id:ended.id,path:ended.fieldPath,time:Date.now()};
      chooseModule(ended.id,{edit:!!repeated});
      if(repeated){suppressClickUntil=Date.now()+350;document.querySelector(`[data-module-id="${ended.id}"] [data-inline-editor][data-path="${CSS.escape(ended.fieldPath)}"]`)?.focus({preventScroll:true});}
    }
    drag=null;
  }
  document.addEventListener('pointerup',event=>endDrag(event));document.addEventListener('pointercancel',event=>endDrag(event,true));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag)endDrag({pointerId:drag.pointerId},true);});
  new ResizeObserver(()=>{const width=$('#paper-board').clientWidth;if(width!==lastTableWidth&&!drag){lastTableWidth=width;layoutTable();}}).observe($('#paper-board'));
  $('#component-options').innerHTML=M.TYPES.map(type=>`<button class="component-option" data-action="add-type" data-type="${type}"><span>${symbols[type]}</span><b>${M.TITLES[type]}</b><small>${libraryDescriptions[type]}</small></button>`).join('');
  render();if(loadNotice)showNotice('本地记录读取提示',[loadNotice]);else persist();
})();
