(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const ink = (path, value, label, type = '', extra = '') => `<span data-inline-path="${esc(path)}" data-inline-label="${esc(label)}"${type ? ` data-inline-type="${type}"` : ''}${extra}>${esc(value)}</span>`;
  const slots = {identity:{x:22,y:68,w:340,h:545},attributes:{x:371,y:126,w:205,h:485},equipment:{x:43,y:631,w:316,h:207}};
  const palette = ['#cbb14c','#c59f58','#bb8154','#b06654','#a75358','#914453','#773c47'];
  const noise = (index, seed = 8) => { const n = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453; return n - Math.floor(n); };
  function roughRect(x,y,w,h,seed = 8,rough = 1.4) {
    const points=[];
    for(let side=0;side<4;side++) {
      const count=Math.max(5,Math.floor((side%2?h:w)/9));
      for(let i=0;i<=count;i++) {
        const t=i/count,off=(noise(i+side*101,seed)-.5)*rough*2;
        points.push(side===0?[x+t*w,y+off]:side===1?[x+w+off,y+t*h]:side===2?[x+(1-t)*w,y+h+off]:[x+off,y+(1-t)*h]);
      }
    }
    return 'M'+points.map(point=>point.map(v=>v.toFixed(2)).join(' ')).join(' L')+' Z';
  }
  const pos = (x,y,w,h,W,H) => `left:${x/W*100}%;top:${y/H*100}%;width:${w/W*100}%;height:${h/H*100}%`;
  const safeId = value => 'binding-'+Array.from(String(value||'card')).map(char=>char.codePointAt(0).toString(16)).join('-');
  function cutEdges(path, width = 1.2) {
    return `<path d="${path}" fill="none" stroke="#faf1db" stroke-width="${width+1}" transform="translate(.65,1.15)" opacity=".95"/><path d="${path}" fill="none" stroke="#8b7d61" stroke-width="${width+1.2}" transform="translate(-.7,-1.05)" opacity=".55"/><path d="${path}" fill="none" stroke="#4c4435" stroke-width="${width}" stroke-dasharray="81 .8 137 1.3 43 .5" opacity=".72"/>`;
  }
  function appendixHeight(module, width) {
    const data=module.data||{},n=(data.items||[]).length;
    let h=418;
    if(module.type==='attributes')h=Math.max(212,124+n*39);
    if(module.type==='skills')h=Math.max(190,88+n*66);
    if(module.type==='equipment')h=Math.max(200,83+Math.ceil(n/3)*136);
    if(module.type==='background')h=Math.max(285,132+(data.fields||[]).reduce((sum,f)=>sum+46+Math.max(1,Math.ceil(String(f.value||'').length/19))*23,0));
    return width/340*h;
  }
  function naturalSize(module) {
    if(module.kind&&window.WorkshopParts)return window.WorkshopParts.naturalSize(module);
    const size=slots[module.type];
    return size?{w:size.w,h:size.h}:{w:340,h:appendixHeight(module,340)};
  }
  function layout(character, width, {maxCardWidth=620} = {}) {
    width=Math.max(280,finite(width,800));
    const frameWidth=Math.min(maxCardWidth,width-32),scale=frameWidth/600;
    const frame={x:(width-frameWidth)/2,y:20,width:frameWidth,height:870*scale};
    const modules=character.modules||[],placed={},mapped={};
    const primaryIds=modules.filter(module=>!module.kind&&slots[module.type]).map(module=>module.id);
    const appendixIds=modules.filter(module=>!slots[module.type]&&module.mounted===true).map(module=>module.id);
    for(const [type,box] of Object.entries(slots))mapped[type]={x:frame.x+box.x*scale,y:frame.y+box.y*scale,w:box.w*scale,h:box.h*scale};
    const looseStart=frame.y+frame.height+45;
    const looseModules=modules.filter(module=>module.mounted===false);
    const looseWidth=width*.4575,looseGap=28;
    const looseHeightOf=module=>{const size=naturalSize(module);return looseWidth*size.h/size.w;};
    let looseHeight=0;
    for(let index=0;index<looseModules.length;index+=2) {
      looseHeight+=Math.max(looseHeightOf(looseModules[index]),looseModules[index+1]?looseHeightOf(looseModules[index+1]):0)+looseGap;
    }
    let bottom=looseModules.length?looseStart+looseHeight+20:frame.y+frame.height+38,rowY=bottom,rowH=0,column=0;
    const appendixWidth=Math.min(340,(frameWidth-22)/2),gap=22,defaultCounts={};
    modules.filter(module=>module.mounted===true).forEach(module=>{
      const size=naturalSize(module),pose=module.cardPose;
      if(pose&&typeof pose==='object') {
        const w=Math.max(1,finite(pose.width,size.w))*scale;
        placed[module.id]={x:frame.x+finite(pose.x)*scale,y:frame.y+finite(pose.y)*scale,w,h:w*size.h/size.w,angle:finite(pose.angle)};
        bottom=Math.max(bottom,placed[module.id].y+placed[module.id].h+25);
        return;
      }
      if(slots[module.type]) {
        const offset=(defaultCounts[module.type]||0)*14*scale;
        defaultCounts[module.type]=(defaultCounts[module.type]||0)+1;
        placed[module.id]={...mapped[module.type],x:mapped[module.type].x+offset,y:mapped[module.type].y+offset,angle:0};
        bottom=Math.max(bottom,placed[module.id].y+placed[module.id].h+25);
        return;
      }
      const full=module.width==='full'||module.type==='background';
      if(full&&column){rowY+=rowH+gap;column=0;rowH=0;}
      const w=full?frameWidth:appendixWidth,h=w*size.h/size.w;
      placed[module.id]={x:frame.x+(column?appendixWidth+gap:0),y:rowY,w,h,angle:0};
      if(full){rowY+=h+gap;rowH=0;column=0;} else if(column){rowY+=Math.max(rowH,h)+gap;rowH=0;column=0;}else{column=1;rowH=h;}
    });
    bottom=Math.max(bottom,rowY+rowH);
    return {frame,slots:mapped,referenceSlots:slots,placements:placed,primaryIds,appendixIds,looseStart,looseHeight,height:bottom+25};
  }
  function renderBase(character, geometry) {
    const id=safeId(character.id),outer=roughRect(8,5,581,854,8,1.5);
    const hasMounted=(character.modules||[]).some(module=>module.mounted===true);
    const threads=Array.from({length:148},(_,i)=>{
      const side=i%4,along=noise(i+13),x=side===0?8+along*581:side===1?589:side===2?589-along*581:8,y=side===0?5:side===1?5+along*854:side===2?859:859-along*854;
      return `<path d="M${x.toFixed(2)} ${y.toFixed(2)}l${side===1?2:side===3?-2:.7} ${side===0?-2:side===2?2:.6}" stroke="${i%3?'#eee4cc':'#b4a58a'}" stroke-width=".65" opacity=".58"/>`;
    }).join('');
    const hint=hasMounted?'':'<div class="binding-empty-hint">把纸片拖到这里，自由拼成你的角色卡</div>';
    return `<div class="binding-base" style="left:${geometry.frame.x}px;top:${geometry.frame.y}px;width:${geometry.frame.width}px;height:${geometry.frame.height}px" aria-label="整张纸雕角色卡底板"><svg viewBox="0 0 600 870" class="binding-paper-svg" aria-hidden="true"><defs><pattern id="${id}-fiber" width="600" height="870" patternUnits="userSpaceOnUse"><image href="assets/paper-fiber.png" width="600" height="870" preserveAspectRatio="xMidYMid slice"/></pattern><filter id="${id}-edge" x="-10%" y="-10%" width="125%" height="125%"><feDropShadow dx=".45" dy=".8" stdDeviation=".2" flood-color="#f3e9d0" flood-opacity=".95"/><feDropShadow dx=".85" dy="1.8" stdDeviation=".35" flood-color="#a3987d" flood-opacity=".75"/><feDropShadow dx="1.8" dy="3.2" stdDeviation="1.35" flood-color="#342d20" flood-opacity=".46"/></filter><radialGradient id="${id}-aged"><stop offset="70%" stop-color="#695b37" stop-opacity="0"/><stop offset="100%" stop-color="#695b37" stop-opacity=".1"/></radialGradient></defs><g filter="url(#${id}-edge)"><path d="${outer}" fill="#eaddba"/><path d="${outer}" fill="url(#${id}-fiber)"/><path d="${outer}" fill="#f5edd8" opacity=".34"/><path d="${outer}" fill="url(#${id}-aged)"/><path d="${outer}" fill="none" stroke="#b6aa8e" stroke-width="1.2" opacity=".5"/></g>${threads}</svg><div class="binding-tab"><span>角 色</span><em>Character</em></div><span class="binding-footer">A LITTLE PAPER ADVENTURE</span>${hint}</div>`;
  }
  function identity(module) {
    const data=module.data||{},portrait=data.portrait==='assets/chibi-cutout.png'?data.portrait:'assets/knight-cutout.png';
    const path='M20 102 L99 102 Q113 103 117 87 L327 85 L333 91 L332 485 L304 486 Q291 488 289 517 L20 517 L17 497 L19 123 Z';
    return `<div class="binding-module binding-module-identity"><div class="binding-character-name" style="${pos(20,0,310,34,340,545)}">${ink('data.name',data.name||'尚未署名的旅人','角色姓名')}</div><div class="binding-identity-meta" style="${pos(185,49,144,28,340,545)}">${ink('data.occupation',data.occupation||'写下职业','职业')}<i>·</i>${ink('data.age',data.age??'年龄','年龄','number')}<small>岁</small></div><div class="binding-level-disc" style="${pos(16,36,60,59,340,545)}">♢</div><div class="binding-level" style="${pos(85,44,96,43,340,545)}"><b>LV:</b>${ink('data.level',String(data.level??1).padStart(2,'0'),'等级','number')}</div><div class="binding-portrait-wash" style="${pos(20,89,312,429,340,545)}"></div><img class="binding-knight" src="${portrait}" alt="钢笔与彩铅绘制的红发骑士" style="${pos(25,95,298,416,340,545)}"><svg class="binding-cut-lines" viewBox="0 0 340 545" aria-hidden="true">${cutEdges(path,1.7)}<path d="M20 34Q171 38 330 33" stroke="#453b2e" stroke-width="1.5" fill="none" opacity=".7"/><path d="M56 124l-4 12l-10 3l9 5l2 12l6-12l11-3l-11-4Z M289 117l-6 16l16 5l6-17Z" fill="none" stroke="#87785a" stroke-width="2" opacity=".55"/></svg><div class="binding-stars" style="${pos(0,336,26,124,340,545)}" aria-hidden="true">★<br>★<br>★</div><details class="binding-appearance" style="${pos(37,521,279,20,340,545)}"><summary>人物手记 · 外貌</summary><div class="binding-popover">${ink('data.appearance',data.appearance||'写下初见时的模样','外貌描述','',' data-inline-multiline="true"')}</div></details></div>`;
  }
  function attrDetails(items,start) {
    return items.slice(start).map((item,i)=>{const n=start+i;return `<div class="binding-extra-row"><b>${ink(`data.items.${n}.key`,item.key||`A${n+1}`,'属性缩写')}</b>${ink(`data.items.${n}.name`,item.name||'属性名称','属性名称')}${ink(`data.items.${n}.value`,finite(item.value),'属性数值','number')}</div>`;}).join('');
  }
  function attributes(module) {
    const data=module.data||{},items=Array.isArray(data.items)?data.items:[],visible=items.slice(0,8),count=visible.length;
    const max=items.reduce((n,item)=>Math.max(n,finite(item.value)),7),step=count>6?25:33;
    const resource=(key,maxKey,label,y,color)=>{
      const current=finite(data[key],key==='hp'?85:43),capacity=finite(data[maxKey],100),percentage=capacity>0?Math.max(0,Math.min(100,current/capacity*100)):0;
      return `<div class="binding-resource" style="${pos(2,y,196,31,205,485)}"><b>${label}</b><div class="binding-resource-trough"><i data-live-art="${key}-fill" style="width:${percentage}%;background:${color}"></i><span>${ink('data.'+key,current,label+' 当前值','number')}<em>/</em>${ink('data.'+maxKey,capacity,label+' 上限','number')}</span></div></div>`;
    };
    const rows=visible.map((item,index)=>{
      const value=finite(item.value),filled=Math.ceil(Math.max(0,value)/max*7),y=103+index*step;
      return `<div class="binding-attribute-row" style="${pos(4,y,197,31,205,485)}"><div class="binding-attribute-label">${ink(`data.items.${index}.key`,item.key||`A${index+1}`,'属性缩写')}<small>${ink(`data.items.${index}.name`,item.name||'属性名称','属性名称')}</small></div><div class="binding-punched-dots" data-live-art="attribute-dots-${index}" aria-hidden="true">${Array.from({length:7},(_,i)=>`<i style="--pigment:${i<filled?palette[i]:'#d4c9aa'};transform:rotate(${noise(i+index)*30-15}deg)"></i>`).join('')}</div><b class="binding-attribute-number">${ink(`data.items.${index}.value`,value,'属性数值','number')}</b></div>`;
    }).join('');
    const radarCount=Math.max(3,count),cx=103,cy=392,radius=72;
    const radarColors=['#c58e8a','#b99e77','#c8c18c','#dbbf6a','#c9b17d','#b5b68e','#a7b2a4','#aa98b1'];
    const triangles=Array.from({length:radarCount},(_,i)=>{
      const slice=Math.PI*2/radarCount,a=-Math.PI/2+i*slice,b=a+slice;
      const path=`M${cx+Math.cos(a+slice/2)*5} ${cy+Math.sin(a+slice/2)*5} L${cx+Math.cos(a)*radius} ${cy+Math.sin(a)*radius} L${cx+Math.cos(b)*radius} ${cy+Math.sin(b)*radius} Z`;
      return `<path d="${path}" fill="${radarColors[i]}" opacity=".64"/>${cutEdges(path,1.15)}`;
    }).join('');
    const polygon=visible.length>2?'M'+visible.map((item,i)=>{const a=-Math.PI/2+i*Math.PI*2/count,r=Math.min(1,Math.max(0,finite(item.value))/max)*68;return `${cx+Math.cos(a)*r} ${cy+Math.sin(a)*r}`;}).join(' L')+' Z':'';
    const labels=visible.map((item,i)=>{const a=-Math.PI/2+i*Math.PI*2/count;return `<text x="${cx+Math.cos(a)*89}" y="${cy+Math.sin(a)*89+4}" text-anchor="middle">${esc(item.key||`A${i+1}`)}</text>`;}).join('');
    const overflow=items.length>8?`<details class="binding-extra binding-extra-attributes"><summary>其余 ${items.length-8} 项属性 ↗</summary><div class="binding-popover"><h4>属性续页</h4>${attrDetails(items,8)}</div></details>`:'';
    return `<div class="binding-module binding-module-attributes">${resource('hp','maxHp','HP',0,'#a54e64')}${resource('mp','maxMp','MP',40,'#6196a5')}${rows}${count?'':'<div class="binding-no-items">添加属性，打下第一排纸孔</div>'}<svg class="binding-radar" data-live-art="attribute-radar" viewBox="0 0 205 485" aria-label="属性雷达图">${triangles}${polygon?`<path d="${polygon}" fill="#b7615b26" stroke="#79654d" stroke-width="1.1" opacity=".75"/>`:''}<g>${labels}</g></svg>${overflow}</div>`;
  }
  function bag() {return '<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M27 27Q24 12 40 13Q56 13 54 28M24 27L58 28L63 65Q42 71 18 64ZM21 31Q40 42 59 32L57 46Q42 54 23 44ZM32 49L47 49L46 62L32 63Z" fill="#a98b5b44" stroke="#695641" stroke-width="1.5"/><path d="M28 29l1 35M53 30l1 35M38 38v12" fill="none" stroke="#695641" stroke-width="1.2"/></svg>';}
  function equipment(module) {
    const items=Array.isArray(module.data?.items)?module.data.items:[];
    const windows=Array.from({length:6},(_,index)=>{
      const item=items[index],x=11+(index%3)*105,y=11+Math.floor(index/3)*104,path=roughRect(x,y,75,76,index+13,1.1);
      const asset=item&&Number.isInteger(item.assetIndex)&&item.assetIndex>=0&&item.assetIndex<6?item.assetIndex:null;
      return `<div class="binding-gear-window${item?.equipped===false?' binding-stowed':''}" style="${pos(x,y,75,76,316,207)};--wash:${['#d9c48a','#b6c7c3','#bdc39e'][index%3]}">${item?(asset===null?bag():`<div class="binding-gear-sprite" style="--col:${asset%3};--row:${Math.floor(asset/3)}"></div>`):'<span class="binding-gear-empty">+</span>'}</div><svg class="binding-cut-lines" viewBox="0 0 316 207" aria-hidden="true">${cutEdges(path,1.5)}</svg>${item?`<div class="binding-gear-label" style="${pos(x-5,y+78,86,18,316,207)}">${ink(`data.items.${index}.name`,item.name||'未命名物品','装备名称')}<small>×${ink(`data.items.${index}.quantity`,finite(item.quantity,1),'装备数量','number')}</small></div>`:''}`;
    }).join('');
    const inventory=items.map((item,index)=>`<section class="binding-inventory-row"><h5>${ink(`data.items.${index}.name`,item.name||'未命名物品','装备名称')} <small>×${ink(`data.items.${index}.quantity`,finite(item.quantity,1),'装备数量','number')}</small></h5><p>${ink(`data.items.${index}.detail`,item.detail||'补充装备描述','装备描述','',' data-inline-multiline="true"')}</p><span class="binding-inventory-weight">${ink(`data.items.${index}.weight`,finite(item.weight),'装备重量','number')} kg</span></section>`).join('');
    return `<div class="binding-module binding-module-equipment">${windows}<details class="binding-extra binding-inventory"><summary>${items.length>6?`还有 ${items.length-6} 件 · `:''}行囊清单 ↗</summary><div class="binding-popover"><h4>行囊 · ${items.length} 件</h4>${inventory||'<p>行囊还是空的。</p>'}</div></details></div>`;
  }
  function renderModule(module) {return ({identity,attributes,equipment}[module.type]||(()=>''))(module);}
  window.WorkshopBinding=Object.freeze({layout,renderBase,renderModule,naturalSize,referenceSlots:slots});
})();
