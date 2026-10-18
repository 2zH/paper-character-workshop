(() => {
  'use strict';
  const M = window.WorkshopModel, Forms = window.WorkshopForms, Cards = window.WorkshopCards;
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
  }
  function pieceHTML(module) {
    const selected=selectionVisible&&module.id===selectedId;
    return `<article class="paper-piece ${selected?'selected':''}" data-module-id="${module.id}" data-width="${module.width}" tabindex="0" role="group" aria-label="${esc(module.title)}纸雕组件" aria-describedby="assembly-caption" aria-keyshortcuts="ArrowLeft ArrowRight Meta+d Control+d Delete Backspace">
      <button class="piece-edit-button" data-action="edit-module" aria-label="填写${esc(module.title)}组件" title="填写" tabindex="${selected?0:-1}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15.5 4.5 4 4M4 20l4.8-1.1L20 7.7a2.8 2.8 0 0 0-4-4L4.9 15zM5 15l4 4"/></svg></button>
      <div class="piece-content" data-action="select-module">${Cards.render(module,{selected,stepActive:module.type===steps[current.step].type})}</div>
    </article>`;
  }
  function syncPaperSelection() {
    document.querySelectorAll('.paper-piece').forEach(el=>{
      const selected=selectionVisible&&el.dataset.moduleId===selectedId;
      el.classList.toggle('selected',selected);el.querySelector('.piece-edit-button').tabIndex=selected?0:-1;
    });
  }
  function clearPaperSelection() { selectionVisible=false;syncPaperSelection();if(document.activeElement?.closest('.paper-piece'))document.activeElement.blur(); }
  function focusPaper() { document.querySelector(`[data-module-id="${selectedId}"]`)?.focus({preventScroll:true}); }
  function renderBoard() {
    $('#paper-board').innerHTML=current.modules.length?current.modules.map(pieceHTML).join(''):`<div class="empty-board"><h2>桌上，还是一片空白。</h2><p>从组件匣拿出身份、属性或故事，开始组合你的角色。</p><button data-action="add" class="button-cream">＋ 添加第一张组件</button></div>`;
    layoutTable();
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
    if(current.step===5) { $('#inspector-content').innerHTML=reviewHTML(); return; }
    const module=activeModule();
    $('#inspector-content').innerHTML=module?`<small class="kicker">${steps[current.step].en} · STEP ${String(current.step+1).padStart(2,'0')}</small>${Forms.render(module)}<p class="remove-note">选中纸片后：← → 旋转，⌘D / Ctrl+D 复制，Delete / Backspace 拆下。⌘Z / Ctrl+Z 可撤销；输入时不会触发纸片操作。</p>`:`<small class="kicker">${steps[current.step].en}</small><h2>还没有${steps[current.step].name}纸片。</h2><div class="empty-inspector"><p>你可以添加这一类组件，也可以继续下一步，按自己的需要组合。</p><button data-action="add-type" data-type="${steps[current.step].type}">＋ 添加${steps[current.step].name}组件</button></div>`;
    updateRuleFeedback();
  }
  function render() { renderNavigation(); renderBoard(); renderInspector(); }
  function chooseModule(id,{scroll=false,edit=false}={}) {
    flushEdit(); selectedId=id; selectionVisible=true; const module=activeModule(); if(!module)return;
    current.step=steps.findIndex(step=>step.type===module.type);
    if(module.pose)module.pose.z=frontZ();
    renderNavigation(); renderBoard(); renderInspector(); persist();
    if(scroll) document.querySelector(`[data-module-id="${id}"]`)?.scrollIntoView({behavior:motion(),block:'start'});
    if(edit){if(innerWidth<761)$('.inspector').scrollIntoView({behavior:motion(),block:'start'});$('.inspector [data-path]')?.focus({preventScroll:true});}else focusPaper();
  }
  function goStep(index) {
    flushEdit(); selectionVisible=false; current.step=Math.max(0,Math.min(5,index));
    selectedId=current.modules.find(item=>item.type===steps[current.step].type)?.id;
    render(); persist();
    if(current.step<5&&selectedId)document.querySelector(`[data-module-id="${selectedId}"]`)?.scrollIntoView({behavior:motion(),block:'start'});
    else if(innerWidth<761)$('.inspector').scrollIntoView({behavior:motion(),block:'start'});
  }
  function addModule(type) {
    if(current.modules.length>=30){toast('一张角色卡最多放 30 个组件。');return;}
    mutate(()=>{const module=M.createModule(type);const index=current.modules.findIndex(item=>item.id===selectedId);current.modules.splice(index<0?current.modules.length:index+1,0,module);selectedId=module.id;current.step=steps.findIndex(step=>step.type===type);},'已添上一张纸雕组件。');
    $('#component-dialog').close(); chooseModule(selectedId,{scroll:true});
  }
  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  function frontZ() { return Math.min(10000,Math.max(0,...current.modules.map(module=>module.pose?.z||0))+1); }
  function tableTransform(x,y,angle,scale=1) { return `translate3d(${x}px,${y}px,0) rotate(${angle}deg) scale(${scale})`; }
  function layoutTable(arrange=false) {
    const board=$('#paper-board'),width=board.clientWidth;
    if(!width||!current.modules.length){board.style.height='auto';return;}
    const pad=width*.025,gap=width*.035,half=(width-pad*2-gap)/2;
    let y=pad,rowHeight=0,column=0,bottom=0;
    const initial=current.modules.every(module=>!module.pose);
    current.modules.forEach((module,index)=>{
      const el=board.querySelector(`[data-module-id="${module.id}"]`);if(!el)return;
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
      el.style.zIndex=String(module.pose.z);
      bottom=Math.max(bottom,top+height);
    });
    board.style.height=Math.ceil(bottom+Math.max(100,width*.16))+'px';
  }
  function rotateModule(id,amount) {
    mutate(()=>{const module=current.modules.find(item=>item.id===id);if(!module?.pose)return;module.pose.angle=clamp(module.pose.angle+amount,-15,15);module.pose.z=frontZ();selectedId=id;current.step=steps.findIndex(step=>step.type===module.type);});
    focusPaper();announce('已转动纸片。');
  }
  function duplicateModule(id) {
    const index=current.modules.findIndex(item=>item.id===id);if(index<0)return;
    if(current.modules.length>=30){toast('一张角色卡最多放 30 个组件。');return;}
    mutate(()=>{const module=M.cloneModule(current.modules[index]);module.title+=' · 副本';if(module.pose)module.pose={...module.pose,x:module.pose.x+3,y:module.pose.y+4,angle:clamp(module.pose.angle+1,-15,15),z:frontZ()};current.modules.splice(index+1,0,module);selectedId=module.id;selectionVisible=true;current.step=steps.findIndex(step=>step.type===module.type);},'复制了一张独立纸片。');
    focusPaper();
  }
  function removeModule(id) {
    const index=current.modules.findIndex(item=>item.id===id);if(index<0)return;
    mutate(()=>{current.modules.splice(index,1);selectedId=current.modules.find(item=>item.type===steps[current.step].type)?.id;selectionVisible=false;},'组件已拆下；⌘Z / Ctrl+Z 可以恢复。');
  }
  function finish() {
    flushEdit(); const validation=M.validateCharacter(current);
    if(!validation.valid){goStep(5);toast('先调整右侧列出的项目，再装订角色。');return;}
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
  function switchCharacter(record) { flushEdit();persist();current=record;selectionVisible=false;selectedId=current.modules.find(item=>item.type===steps[current.step].type)?.id||current.modules[0]?.id;undoStack=[];preview=false;document.body.classList.remove('card-preview');$('#preview-button').textContent='预览整卡';render();persist();$('#library-dialog').close();window.scrollTo({top:0,behavior:motion()}); }
  function createCharacter(sample) { switchCharacter(M.createCharacter({sample}));toast(sample?'已放入一份独立的骑士示例。':'新的空白角色已经铺开。'); }

  function getPath(root,path){return path.split('.').reduce((value,key)=>value?.[key],root);}
  function setPath(root,path,value){const parts=path.split('.');if(parts.some(key=>['__proto__','constructor','prototype'].includes(key)))return;const leaf=parts.pop();const parent=parts.reduce((object,key)=>object?.[key],root);if(parent)parent[leaf]=value;}
  function numberFromInput(input) {
    if(input.value===''&&(input.hasAttribute('data-nullable')||input.dataset.path==='data.age'))return null;
    let value=Number(input.value);if(!Number.isFinite(value))value=0;
    if(input.hasAttribute('min'))value=Math.max(Number(input.min),value);
    if(input.hasAttribute('max'))value=Math.min(Number(input.max),value);
    if(input.step!=='any')value=Number(input.step)<1?Math.round(value*100)/100:Math.round(value);
    return value;
  }
  function writeField(input) {
    const module=activeModule();if(!module)return;
    const value=input.type==='checkbox'?input.checked:input.type==='number'?numberFromInput(input):input.value;
    setPath(module,input.dataset.path,value);current.status='draft';renderBoard();renderNavigation();updateLiveTotals(module);scheduleSave();
  }
  function updateRuleFeedback() {
    const module=activeModule();if(!module)return;
    const errors=M.validateCharacter(current).errors.filter(error=>error.moduleId===module.id);
    const feedback=$('.editor-rule-feedback');
    if(feedback)feedback.innerHTML=module.data.rules?.enabled?(errors.length?errors.map(error=>`<p class="rule-error">${esc(error.message)}</p>`).join(''):'<p class="rule-pass">✓ 当前数值通过本组件规则。</p>'):'<p class="rule-neutral">当前为自由填写，未启用规则约束。</p>';
    document.querySelectorAll('.inspector [data-path]').forEach(input=>{const invalid=errors.some(error=>'data.'+error.field===input.dataset.path);if(invalid)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');});
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
    if(!input.matches('[data-path]')||!activeModule())return;
    const path=input.dataset.path,module=activeModule();
    if(input.type==='number'){
      const value=numberFromInput(input);
      setPath(module,path,value);input.value=value??'';
    }
    persist();updateLiveTotals(module);
  }
  function formAction(button) {
    const module=activeModule();if(!module)return;
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
    if(action.startsWith('add-'))$('.inspector').scrollTo({top:$('.inspector').scrollHeight,behavior:motion()});
  }

  document.addEventListener('click',event=>{
    if(Date.now()<suppressClickUntil){event.preventDefault();return;}
    if(!preview&&!event.target.closest('.paper-piece,button,a,input,textarea,select')&&(event.target.closest('.assembly')||event.target===document.body))clearPaperSelection();
    const cardButton=event.target.closest('[data-card-action]');
    if(cardButton&&!preview){const module=current.modules.find(item=>item.id===cardButton.closest('[data-module-id]')?.dataset.moduleId);if(!module)return;selectedId=module.id;selectionVisible=true;const index=Number(cardButton.dataset.index);mutate(()=>{current.step=steps.findIndex(step=>step.type===module.type);if(cardButton.dataset.cardAction==='set-attribute'&&module.data.items[index])module.data.items[index].value=Number(cardButton.dataset.value);if(cardButton.dataset.cardAction==='toggle-equipment'&&module.data.items[index])module.data.items[index].equipped=!module.data.items[index].equipped;});return;}
    const formButton=event.target.closest('[data-form-action]');if(formButton){if(formButton.dataset.formAction!=='toggle-budget')formAction(formButton);return;}
    const button=event.target.closest('[data-action]');if(!button)return;
    const action=button.dataset.action,id=button.closest('[data-module-id]')?.dataset.moduleId;
    if(action==='undo')undo();
    if(action==='add')$('#component-dialog').showModal();
    if(action==='add-type')addModule(button.dataset.type);
    if(action==='close-dialog')button.closest('dialog').close();
    if(action==='step')goStep(Number(button.dataset.step));
    if(action==='previous-step')goStep(current.step-1);
    if(action==='next-step'){if(current.step===5)finish();else{const errors=stepErrors(steps[current.step].type);if(errors.length){toast(errors[0].message);renderInspector();}else goStep(current.step+1);}}
    if(action==='edit-module'||action==='select-module'){if(!preview)chooseModule(id,{edit:action==='edit-module'});}
    if(action==='tidy')mutate(()=>layoutTable(true),'已把纸片重新铺齐；可以继续自由摆放。');
    if(action==='preview'){flushEdit();clearPaperSelection();preview=!preview;document.body.classList.toggle('card-preview',preview);button.textContent=preview?'返回组合编辑':'预览整卡';$('#assembly-caption').textContent=preview?'':'拖动纸面摆放 · 选中后 ← → 旋转 · ⌘D / Ctrl+D 复制 · Delete 拆下';layoutTable();}
    if(action==='library'){flushEdit();persist();renderLibrary();$('#library-dialog').showModal();}
    if(action==='new')createCharacter(false);
    if(action==='sample')createCharacter(true);
    if(action==='open-character'){const record=characters.find(item=>item.id===button.dataset.id);if(record)switchCharacter(record);}
    if(action==='clone-character'){const record=characters.find(item=>item.id===button.dataset.id);if(record){const duplicate=M.cloneCharacter(record);duplicate.status='draft';duplicate.step=0;switchCharacter(duplicate);toast('已复制为独立角色，原卡保持原样。');}}
    if(action==='finish')finish();
    if(action==='export')exportJSON();
    if(action==='print')window.print();
    if(action==='import')$('#import-file').click();
    if(action==='fix-error'){const error=M.validateCharacter(current).errors[Number(button.dataset.errorIndex)];if(error?.moduleId){chooseModule(error.moduleId,{scroll:true});const path='data.'+error.field;const target=document.querySelector(`[data-path="${CSS.escape(path)}"]`);if(target){for(let ancestor=target.parentElement;ancestor;ancestor=ancestor.parentElement){if(ancestor.tagName==='DETAILS')ancestor.open=true;}target.focus({preventScroll:true});}}else if(error)addModule('identity');}
  });
  document.addEventListener('focusin',event=>{if(event.target.matches('.paper-piece')&&!preview&&(!selectionVisible||selectedId!==event.target.dataset.moduleId))chooseModule(event.target.dataset.moduleId);if(event.target.matches('[data-path]')&&!editSession)editSession=clone(current);});
  document.addEventListener('input',event=>{if(event.target.matches('[data-path]'))writeField(event.target);});
  document.addEventListener('change',event=>{
    if(event.target.matches('[data-path]')){
      normalizeField(event.target);
      if(event.target.dataset.path==='data.rules.enabled'){
        const opened=[...document.querySelectorAll('.inspector details[open]')].map(item=>item.className);
        flushEdit();renderInspector();
        document.querySelectorAll('.inspector details').forEach(item=>{if(opened.includes(item.className))item.open=true;});
        document.querySelector('[data-path="data.rules.enabled"]')?.focus({preventScroll:true});
      }
    }
    if(event.target.matches('[data-form-action="toggle-budget"]'))formAction(event.target);
  });
  document.addEventListener('blur',event=>{if(event.target.matches('[data-path]')){normalizeField(event.target);flushEdit();}},true);
  document.addEventListener('keydown',event=>{
    if(event.isComposing||event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],.inspector')||$('dialog[open]')||preview||drag)return;
    const command=event.metaKey||event.ctrlKey;
    if(command&&event.key.toLowerCase()==='z'&&!event.shiftKey&&!event.altKey){event.preventDefault();undo();return;}
    if(event.key==='Escape'){clearPaperSelection();return;}
    if(!selectionVisible||!activeModule()||event.altKey)return;
    const focusedPaper=event.target.closest('.paper-piece');
    if(focusedPaper&&focusedPaper.dataset.moduleId!==selectedId)return;
    if(!command&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();rotateModule(selectedId,event.key==='ArrowLeft'?-3:3);return;}
    if(command&&event.key.toLowerCase()==='d'&&!event.shiftKey){event.preventDefault();if(!event.repeat)duplicateModule(selectedId);return;}
    if(!command&&!event.shiftKey&&(event.key==='Delete'||event.key==='Backspace')){event.preventDefault();if(!event.repeat)removeModule(selectedId);}
  });
  $('#import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try{if(file.size>33554432)throw new Error('文件超过 32 MB，请导入较小的角色卡。');const {character,warnings}=M.normalizeCharacter(await file.text());const imported=M.cloneCharacter(character);switchCharacter(imported);toast('已导入为独立角色，原有角色保留。');if(warnings.length)showNotice('角色已导入，部分内容已修正',warnings);}catch(error){showNotice('这份文件暂时无法导入',[error.message]);}finally{event.target.value='';}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){flushEdit();persist();}});

  // The paper itself moves, anchored to the exact point held by the pointer.
  let drag=null,suppressClickUntil=0,tableFrame=0,lastTableWidth=0;
  const rotatePoint=(x,y,angle)=>{const r=angle*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
  function pointerPosition(state,angle,scale) {
    const rect=$('#paper-board').getBoundingClientRect(),grip=rotatePoint(state.grip.x*scale,state.grip.y*scale,angle);
    return {x:clamp(state.pointerX-rect.left-state.w/2-grip.x,0,Math.max(0,rect.width-state.w)),y:clamp(state.pointerY-rect.top-state.h/2-grip.y,0,rect.width*30)};
  }
  function animateHeldPaper(){
    if(!drag?.started)return;
    const reduced=motion()==='auto';
    drag.angle+=(drag.targetAngle-drag.angle)*.2;
    drag.targetAngle+=(drag.original.angle-drag.targetAngle)*.07;
    drag.scale+=(1.025-drag.scale)*.22;
    if(reduced){drag.angle=drag.original.angle;drag.scale=1;}
    if(drag.pointerY<65)window.scrollBy(0,-Math.min(12,(65-drag.pointerY)*.25));
    else if(drag.pointerY>innerHeight-95)window.scrollBy(0,Math.min(12,(drag.pointerY-innerHeight+95)*.25));
    const position=pointerPosition(drag,drag.angle,drag.scale);
    drag.source.style.transform=tableTransform(position.x,position.y,drag.angle,drag.scale);
    const board=$('#paper-board'),needed=position.y+drag.h+100;
    if(needed>board.offsetHeight)board.style.height=needed+'px';
    tableFrame=requestAnimationFrame(animateHeldPaper);
  }
  document.addEventListener('pointerdown',event=>{
    const source=event.target.closest('.paper-piece');if(!source||event.button!==0||preview)return;
    if(!event.target.closest('.piece-content')||event.target.closest('button,a,input,textarea,select'))return;
    flushEdit();event.preventDefault();
    const module=current.modules.find(item=>item.id===source.dataset.moduleId);if(!module?.pose)return;
    const board=$('#paper-board').getBoundingClientRect(),w=source.offsetWidth,h=source.offsetHeight;
    const x=module.pose.x/100*board.width,y=module.pose.y/100*board.width;
    const grip=rotatePoint(event.clientX-board.left-x-w/2,event.clientY-board.top-y-h/2,-module.pose.angle);
    drag={id:module.id,module,source,handle:source,pointerId:event.pointerId,original:clone(module.pose),snapshot:clone(current),w,h,grip,startX:event.clientX,startY:event.clientY,pointerX:event.clientX,pointerY:event.clientY,lastX:event.clientX,lastTime:performance.now(),started:false,angle:module.pose.angle,targetAngle:module.pose.angle,scale:1};
    drag.handle.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    drag.pointerX=event.clientX;drag.pointerY=event.clientY;
    if(!drag.started&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<4)return;
    event.preventDefault();
    if(!drag.started){
      drag.started=true;drag.module.pose.z=frontZ();drag.source.style.zIndex=String(drag.module.pose.z);
      drag.source.classList.add('paper-lifted');drag.source.setAttribute('aria-grabbed','true');document.body.classList.add('is-dragging');
      announce('纸片已拿起，可以自由摆放和叠压。');animateHeldPaper();
    }
    const now=performance.now(),velocity=(event.clientX-drag.lastX)/Math.max(8,now-drag.lastTime);
    drag.targetAngle=clamp(drag.original.angle+velocity*2.4,-12,12);drag.lastX=event.clientX;drag.lastTime=now;
  },{passive:false});
  function endDrag(event,cancelled=false){
    if(!drag||event.pointerId!==drag.pointerId)return;const ended=drag;
    cancelAnimationFrame(tableFrame);
    ended.source.classList.remove('paper-lifted');ended.source.removeAttribute('aria-grabbed');document.body.classList.remove('is-dragging');
    if(ended.handle.hasPointerCapture(event.pointerId))ended.handle.releasePointerCapture(event.pointerId);
    if(ended.started){
      suppressClickUntil=Date.now()+350;
      const before=ended.source.style.transform;
      if(cancelled)ended.module.pose=ended.original;
      else{
        remember(ended.snapshot);
        const angle=clamp(ended.original.angle+(ended.pointerX-ended.startX)*.006,-15,15),position=pointerPosition(ended,angle,1),width=$('#paper-board').clientWidth;
        ended.module.pose={x:position.x/width*100,y:position.y/width*100,angle,z:ended.module.pose.z};
        selectedId=ended.id;selectionVisible=true;current.step=steps.findIndex(step=>step.type===ended.module.type);current.status='draft';
      }
      layoutTable();const after=ended.source.style.transform;
      if(motion()!=='auto')ended.source.animate([{transform:before},{transform:after,offset:.78},{transform:after}],{duration:300,easing:'cubic-bezier(.2,.75,.25,1)'});
      syncPaperSelection();
      persist();renderNavigation();renderInspector();if(!cancelled)focusPaper();announce(cancelled?'纸片已回到原处。':'纸片已经放下，桌面布局已保存。');
    }else if(!cancelled)chooseModule(ended.id);
    drag=null;
  }
  document.addEventListener('pointerup',event=>endDrag(event));document.addEventListener('pointercancel',event=>endDrag(event,true));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag)endDrag({pointerId:drag.pointerId},true);});
  new ResizeObserver(()=>{const width=$('#paper-board').clientWidth;if(width!==lastTableWidth&&!drag){lastTableWidth=width;layoutTable();}}).observe($('#paper-board'));
  $('#component-options').innerHTML=M.TYPES.map(type=>`<button class="component-option" data-action="add-type" data-type="${type}"><span>${symbols[type]}</span><b>${M.TITLES[type]}</b><small>${libraryDescriptions[type]}</small></button>`).join('');
  render();if(loadNotice)showNotice('本地记录读取提示',[loadNotice]);else persist();
})();
