(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const text=(value,fallback='')=>String(value??'').trim()||fallback;
  const ink=(path,value,label,type='',multiline=false)=>`<span data-inline-path="${esc(path)}" data-inline-label="${esc(label)}"${type?` data-inline-type="${type}"`:''}${multiline?' data-inline-multiline="true"':''}>${esc(value)}</span>`;
  const pos=(x,y,w,h,W,H)=>`left:${x/W*100}%;top:${y/H*100}%;width:${w/W*100}%;height:${h/H*100}%`;
  const colors=['#cbb14c','#c59f58','#bb8154','#b06654','#a75358','#914453','#773c47'];
  const noise=(i,seed=8)=>{const n=Math.sin(i*127.1+seed*311.7)*43758.5453;return n-Math.floor(n);};
  function rowFor(paper,field='items') {
    const rows=Array.isArray(paper.data?.[field])?paper.data[field]:[];
    const index=rows.findIndex(row=>row.id===paper.rowId);
    return {row:rows[index]||null,index,rows};
  }
  function naturalSize(paper) {
    if(paper.kind==='story') {
      const {row}=rowFor(paper,'fields');
      const lines=String(row?.value||'').split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/19)),0);
      return {w:284,h:Math.max(102,56+lines*23)};
    }
    return {...({ 'identity-meta':{w:340,h:90},portrait:{w:340,h:455},hp:{w:205,h:32},mp:{w:205,h:32},attribute:{w:205,h:33},radar:{w:205,h:180},equipment:{w:96,h:104},skill:{w:292,h:64},collection:{w:340,h:100} }[paper.kind]||{w:340,h:100})};
  }
  function roughRect(x,y,w,h,seed=8) {
    const points=[];
    for(let side=0;side<4;side++) {
      const count=Math.max(4,Math.floor((side%2?h:w)/12));
      for(let i=0;i<=count;i++){const t=i/count,off=(noise(i+side*101,seed)-.5)*1.6;points.push(side===0?[x+t*w,y+off]:side===1?[x+w+off,y+t*h]:side===2?[x+(1-t)*w,y+h+off]:[x+off,y+(1-t)*h]);}
    }
    return 'M'+points.map(point=>point.map(v=>v.toFixed(2)).join(' ')).join(' L')+' Z';
  }
  function cutEdges(path,weight=1.2) {
    return `<path d="${path}" fill="none" stroke="#fff2d4" stroke-width="${weight+1}" transform="translate(.6,1.1)" opacity=".95"/><path d="${path}" fill="none" stroke="#8b7d61" stroke-width="${weight+1.1}" transform="translate(-.6,-.9)" opacity=".55"/><path d="${path}" fill="none" stroke="#4c4435" stroke-width="${weight}" stroke-dasharray="81 .8 137 1.3 43 .5" opacity=".7"/>`;
  }
  let layerSerial=0;
  function cutSurface(w,h,holes,{seed=8,weight=1,artKey=''}={}) {
    const id=`paper-cut-${++layerSerial}`,outer=roughRect(0,0,w,h,seed);
    return `<svg class="paper-cut-surface"${artKey?` data-live-art="${artKey}"`:''} viewBox="0 0 ${w} ${h}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="${id}-fiber" width="600" height="600" patternUnits="userSpaceOnUse"><image href="assets/paper-fiber.png" width="600" height="600" preserveAspectRatio="xMidYMid slice"/></pattern><mask id="${id}-mask" maskUnits="userSpaceOnUse" x="-4" y="-4" width="${w+8}" height="${h+8}" style="mask-type:luminance"><path d="${outer}" fill="white"/>${holes.map(path=>`<path d="${path}" fill="black"/>`).join('')}</mask><linearGradient id="${id}-light" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff8e5" stop-opacity=".2"/><stop offset=".5" stop-color="#fff8e5" stop-opacity="0"/><stop offset="1" stop-color="#8d7b53" stop-opacity=".08"/></linearGradient></defs><g mask="url(#${id}-mask)"><path d="${outer}" fill="#ede3ca"/><path d="${outer}" fill="url(#${id}-fiber)"/><path d="${outer}" fill="url(#${id}-light)"/><path d="${outer}" fill="none" stroke="#b7a788" stroke-width=".8" opacity=".5"/></g><g class="paper-aperture-edges">${holes.map(path=>cutEdges(path,weight)).join('')}</g></svg>`;
  }
  function layeredPart(paper,w,h,holes,underlay,face='',options={}) {
    return {w,h,holes,weight:options.weight??1,underlay,face,surface:options};
  }
  function plainPart(paper,face) {
    return {...naturalSize(paper),holes:[],weight:0,underlay:'',face};
  }
  function punchedHole(x,y,r,seed) {
    return 'M'+Array.from({length:13},(_,i)=>{const angle=i*Math.PI*2/13,grain=(noise(i,seed)-.5)*.6;return `${(x+Math.cos(angle)*(r+grain)).toFixed(2)} ${(y+Math.sin(angle)*(r+grain)).toFixed(2)}`;}).join(' L')+' Z';
  }
  function identityMeta(paper) {
    const d=paper.data||{};
    return plainPart(paper,`<div class="atomic-character-name" style="${pos(14,2,312,34,340,90)}">${ink('data.name',text(d.name,'尚未署名的旅人'),'角色姓名')}</div><div class="atomic-level" style="${pos(15,38,126,37,340,90)}"><i>♢</i><b>LV:</b>${ink('data.level',String(d.level??1).padStart(2,'0'),'等级','number')}</div><div class="atomic-identity-meta" style="${pos(154,41,171,31,340,90)}">${ink('data.occupation',text(d.occupation,'写下职业'),'职业')}<i>·</i>${ink('data.age',d.age??'年龄','年龄','number')}<small>岁</small></div><details class="atomic-appearance" style="${pos(18,76,307,12,340,90)}"><summary>人物手记 · 外貌</summary><div class="atomic-popover">${ink('data.appearance',text(d.appearance,'写下初见时的模样'),'外貌描述','',true)}</div></details><svg class="atomic-cut-lines" viewBox="0 0 340 90" aria-hidden="true"><path d="M14 35Q172 38 326 34" fill="none" stroke="#6f5f42" stroke-width="1" opacity=".5"/></svg>`);
  }
  function portrait(paper) {
    const source=paper.data?.portrait==='assets/chibi-cutout.png'?'assets/chibi-cutout.png':'assets/knight-cutout.png';
    const path='M20 21 L99 21 Q113 22 117 6 L327 4 L333 10 L332 404 L304 405 Q291 407 289 436 L20 436 L17 416 L19 42 Z';
    const underlay=`<div class="atomic-portrait-wash" style="${pos(15,5,320,434,340,455)}"></div><img class="atomic-knight" src="${source}" alt="手绘冒险者立绘" style="${pos(25,14,298,416,340,455)}"><svg class="atomic-cut-lines" viewBox="0 0 340 455" aria-hidden="true"><path d="M56 43l-4 12l-10 3l9 5l2 12l6-12l11-3l-11-4Z M289 36l-6 16l16 5l6-17Z" fill="none" stroke="#87785a" stroke-width="2" opacity=".55"/></svg>`;
    const face=`<div class="atomic-stars" style="${pos(0,255,26,124,340,455)}" aria-hidden="true">★<br>★<br>★</div><span class="atomic-portrait-caption" style="${pos(43,440,260,12,340,455)}">a little paper adventurer</span>`;
    return layeredPart(paper,340,455,[path],underlay,face,{weight:1.7});
  }
  function resource(paper) {
    const key=paper.kind,maxKey=key==='hp'?'maxHp':'maxMp',label=key.toUpperCase(),d=paper.data||{};
    const value=num(d[key],key==='hp'?85:43),maximum=num(d[maxKey],100),percent=maximum>0?clamp(value/maximum*100,0,100):0;
    // The reading is printed on a tongue continuous with the lower paper edge,
    // so its ink has physical support when the entire face is lifted.
    const path='M54 7 L91 6.6 L132 7.3 L171 6.7 L198 7.1 L198.4 26 L160 25.8 L160.2 13 Q126 12.3 92 13 L91.8 26.2 L54 26 Z';
    const readingSize=Math.min(5.6,52/(String(value).length+String(maximum).length+1));
    const underlay=`<div class="atomic-resource-trough atomic-resource-pigment" style="${pos(52,5,148,23,205,32)}"><i data-live-art="${key}-fill" style="width:${percent}%;--pigment:${key==='hp'?'#a54e64':'#6196a5'}"></i></div>`;
    const face=`<b class="atomic-resource-label" style="${pos(6,0,44,32,205,32)}">${label}</b><div class="atomic-resource-trough atomic-resource-reading" style="${pos(94,13,64,13,205,32)}"><span style="font-size:${readingSize}cqw;line-height:1;gap:2px">${ink('data.'+key,value,label+' 当前值','number')}<em>/</em>${ink('data.'+maxKey,maximum,label+' 上限','number')}</span></div>`;
    return layeredPart(paper,205,32,[path],underlay,face,{seed:key==='hp'?13:17,weight:.7});
  }
  function attribute(paper) {
    const {row,index,rows}=rowFor(paper);if(!row)return collection(paper);
    const value=num(row.value),max=rows.reduce((n,item)=>Math.max(n,num(item.value)),7),filled=Math.ceil(Math.max(0,value)/max*7);
    const holes=Array.from({length:7},(_,i)=>punchedHole(73+i*15.7,16.5,4.7,index*11+i));
    const underlay=`<div class="atomic-punched-dots" data-live-art="attribute-dots-${esc(row.id)}" aria-hidden="true" style="${pos(66.5,10,107.2,13,205,33)}">${Array.from({length:7},(_,i)=>`<i style="--pigment:${i<filled?colors[i]:'#d4c9aa'};transform:rotate(${noise(i+index)*30-15}deg)"></i>`).join('')}</div>`;
    const face=`<div class="atomic-attribute-label" style="${pos(6,2,55,29,205,33)}">${ink(`data.items.${index}.key`,text(row.key,`A${index+1}`),'属性缩写')}<small>${ink(`data.items.${index}.name`,text(row.name,'属性名称'),'属性名称')}</small></div><b class="atomic-attribute-value" style="${pos(179,0,20,33,205,33)}">${ink(`data.items.${index}.value`,value,'属性数值','number')}</b>`;
    return layeredPart(paper,205,33,holes,underlay,face,{seed:index+29,weight:.2});
  }
  function radar(paper) {
    const items=Array.isArray(paper.data?.items)?paper.data.items:[],count=Math.max(3,items.length),cx=102.5,cy=90,radius=70,max=items.reduce((n,row)=>Math.max(n,num(row.value)),7);
    const pigments=['#c58e8a','#b99e77','#c8c18c','#dbbf6a','#c9b17d','#b5b68e','#a7b2a4','#aa98b1'],holes=[];
    const wedges=Array.from({length:count},(_,i)=>{
      const step=Math.PI*2/count,a=-Math.PI/2+i*step,b=a+step,inset=Math.min(.023,step*.08);
      holes.push(`M${cx+Math.cos(a+step/2)*6} ${cy+Math.sin(a+step/2)*6} L${cx+Math.cos(a+inset)*radius} ${cy+Math.sin(a+inset)*radius} L${cx+Math.cos(b-inset)*radius} ${cy+Math.sin(b-inset)*radius} Z`);
      const path=`M${cx} ${cy} L${cx+Math.cos(a)*74} ${cy+Math.sin(a)*74} L${cx+Math.cos(b)*74} ${cy+Math.sin(b)*74} Z`;
      return `<path d="${path}" fill="${pigments[i%pigments.length]}" opacity=".65"/>`;
    }).join('');
    const labels=items.map((row,i)=>{const a=-Math.PI/2+i*Math.PI*2/count;return `<text x="${cx+Math.cos(a)*86}" y="${cy+Math.sin(a)*84+3}" text-anchor="middle" font-size="${count>12?5:count>8?7:10}">${esc(text(row.key,row.name))}</text>`;}).join('');
    const polygon=items.length>2?'M'+items.map((row,i)=>{const a=-Math.PI/2+i*Math.PI*2/count,r=clamp(num(row.value)/max,0,1)*68;return `${cx+Math.cos(a)*r} ${cy+Math.sin(a)*r}`;}).join(' L')+' Z':'';
    const underlay=`<svg class="atomic-radar-svg" data-live-art="attribute-radar" viewBox="0 0 205 180" role="img" aria-label="${items.length} 项属性雷达图">${wedges}${polygon?`<path d="${polygon}" fill="#b7615b26" stroke="#79654d" stroke-width="1.1" opacity=".75"/>`:''}</svg>`;
    const face=`<svg class="atomic-radar-svg" data-live-art="attribute-radar-labels" viewBox="0 0 205 180" aria-hidden="true"><g>${labels}</g></svg>`;
    return layeredPart(paper,205,180,holes,underlay,face,{weight:count>8?.5:.85,artKey:'attribute-radar-face'});
  }
  function bag() {return '<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M27 27Q24 12 40 13Q56 13 54 28M24 27L58 28L63 65Q42 71 18 64ZM21 31Q40 42 59 32L57 46Q42 54 23 44ZM32 49L47 49L46 62L32 63Z" fill="#a98b5b44" stroke="#695641" stroke-width="1.5"/><path d="M28 29l1 35M53 30l1 35M38 38v12" fill="none" stroke="#695641" stroke-width="1.2"/></svg>';}
  function equipment(paper) {
    const {row,index}=rowFor(paper);if(!row)return collection(paper);
    const asset=Number.isInteger(row.assetIndex)&&row.assetIndex>=0&&row.assetIndex<6?row.assetIndex:null,equipped=row.equipped!==false;
    // Leave the top-left corner attached to both margins, supporting the whole
    // equipment toggle rather than printing its icon across the open window.
    const path='M26 5 L47 5.4 L68 4.7 L86 5 L86.4 28 L85.7 53 L86 78 L61 78.3 L36 77.7 L10 78 L9.7 53 L10 28 L26 28.2 Z';
    const underlay=`<div class="atomic-gear-wash${equipped?'':' atomic-gear-stowed'}" data-live-art="equipment-art-${esc(row.id)}" style="${pos(7,2,82,79,96,104)};--pigment:${['#d9c48a','#b6c7c3','#bdc39e'][index%3]}">${asset===null?bag():`<div class="atomic-gear-sprite" style="--col:${asset%3};--row:${Math.floor(asset/3)}"></div>`}</div>`;
    const face=`<div class="atomic-gear-name" style="${pos(5,80,86,13,96,104)}">${ink(`data.items.${index}.name`,text(row.name,'未命名物品'),'装备名称')}<small>×${ink(`data.items.${index}.quantity`,num(row.quantity,1),'装备数量','number')}</small></div><button type="button" class="atomic-equipment-toggle" data-card-action="toggle-equipment" data-index="${index}" aria-label="${equipped?'收起':'装备'}${esc(text(row.name,'物品'))}" aria-pressed="${equipped}" style="${pos(4,4,18,18,96,104)}">${equipped?'✦':'·'}</button><details class="atomic-gear-detail" style="${pos(10,94,76,10,96,104)}"><summary>物品手记</summary><div class="atomic-popover">${ink(`data.items.${index}.detail`,text(row.detail,'补充装备描述'),'装备描述','',true)}<small class="atomic-gear-weight">${ink(`data.items.${index}.weight`,num(row.weight),'装备重量','number')} kg</small></div></details>`;
    return layeredPart(paper,96,104,[path],underlay,face,{seed:index+8,weight:1.1});
  }
  function skill(paper) {
    const {row,index,rows}=rowFor(paper);if(!row)return collection(paper);
    const max=rows.reduce((n,item)=>Math.max(n,num(item.value)),100),value=num(row.value),percent=clamp(value/max*100,0,100),path=roughRect(8,29,276,12,index+19);
    const underlay=`<div class="atomic-skill-trough" style="${pos(6,27,280,16,292,64)}"><i data-live-art="skill-fill-${esc(row.id)}" style="width:${percent}%;--pigment:${['#b78667','#95a688','#9faaa8','#c0a264','#ad848b','#9696a3'][index%6]}"></i></div>`;
    const face=`<div class="atomic-skill-name" style="${pos(9,3,204,23,292,64)}">${ink(`data.items.${index}.name`,text(row.name,'未命名技能'),'技能名称')}</div><b class="atomic-skill-value" style="${pos(215,0,69,27,292,64)}">${ink(`data.items.${index}.value`,value,'技能数值','number')}</b><svg class="atomic-cut-lines" viewBox="0 0 292 64" aria-hidden="true">${Array.from({length:11},(_,i)=>`<path d="M${9+i*27.4} 45v${i%5===0?5:3}" stroke="#8c7957" stroke-width=".6"/>`).join('')}</svg>`;
    return layeredPart(paper,292,64,[path],underlay,face,{seed:index+19,weight:.6});
  }
  function story(paper) {
    const {row,index}=rowFor(paper,'fields');if(!row)return collection(paper);
    return plainPart(paper,`<div class="atomic-story-ink"><h4><small>${String(index+1).padStart(2,'0')}</small>${ink(`data.fields.${index}.label`,text(row.label,'一段往事'),'背景标题')}</h4><p>${ink(`data.fields.${index}.value`,text(row.value,'这一页，等你写下。'),'背景内容','',true)}</p></div>`);
  }
  function collection(paper) {
    const label={identity:'身份',attributes:'属性',skills:'技能',equipment:'装备',background:'背景'}[paper.type]||'纸片';
    return plainPart(paper,`<div class="atomic-collection-ink"><i aria-hidden="true">✧</i><span>${esc(text(paper.title,label))}</span><small>添上第一${paper.type==='equipment'?'件物品':'个条目'}，留下一笔冒险。</small></div>`);
  }
  const renderers={'identity-meta':identityMeta,portrait,hp:resource,mp:resource,attribute,radar,equipment,skill,story,collection};
  // A mounted component supplies only paint, ink and local aperture geometry.
  // The card composer owns the one continuous sheet and transforms these paths
  // from this natural coordinate box into card coordinates.
  function sheetPart(paper) {
    const part=paper&&renderers[paper.kind]?renderers[paper.kind](paper):plainPart(paper||{},'<div class="atomic-collection-ink">尚未识别的纸片</div>');
    return {w:part.w,h:part.h,holes:[...part.holes],weight:part.weight,underlay:part.underlay,face:part.face};
  }
  function render(paper) {
    if(!paper||!renderers[paper.kind])return '<div class="atomic-paper atomic-collection"><div class="atomic-collection-ink">尚未识别的纸片</div></div>';
    const part=renderers[paper.kind](paper),content=part.surface
      ?`<div class="paper-underlay">${part.underlay}</div><div class="paper-cut-face">${cutSurface(part.w,part.h,part.holes,part.surface)}${part.face}</div>`
      :part.face;
    return `<div class="atomic-paper atomic-${esc(paper.kind)}${['portrait','hp','mp','attribute','radar','equipment','skill'].includes(paper.kind)?' atomic-layered':''}" data-atomic-kind="${esc(paper.kind)}">${content}</div>`;
  }
  function splitRects(module,{primary=false}={}) {
    const d=module.data||{},items=Array.isArray(d.items)?d.items:[],fields=Array.isArray(d.fields)?d.fields:[],rects=[];
    const push=(kind,rowId,x,y,w,h)=>rects.push({kind,rowId:rowId??null,x,y,w,h});
    if(module.type==='identity') {
      if(primary){push('identity-meta',null,0,0,340,90);push('portrait',null,0,90,340,455);}
      else{push('identity-meta',null,15,8,310,310*90/340);push('portrait',null,22,104,184,184*455/340);}
    }
    if(module.type==='attributes') {
      if(primary) {
        push('hp',null,0,0,205,32);push('mp',null,0,40,205,32);
        const radarY=Math.max(305,103+Math.min(items.length,8)*35+8);
        items.forEach((row,index)=>push('attribute',row.id,0,index<8?103+index*35:radarY+196+(index-8)*41,205,33));
        push('radar',null,0,radarY,205,180);
        if(!items.length)push('collection',null,0,110,205,205*100/340);
      } else {
        push('hp',null,17,6,146,146*32/205);push('mp',null,177,6,146,146*32/205);
        items.forEach((row,index)=>push('attribute',row.id,28,73+index*39,205,33));
        const y=Math.max(180,94+items.length*39);push('radar',null,67,y,205,180);
        if(!items.length)push('collection',null,17,65,306,90);
      }
    }
    if(module.type==='equipment') {
      items.forEach((row,index)=>push('equipment',row.id,primary?(index%3)*105:21+(index%3)*100,primary?Math.floor(index/3)*104:64+Math.floor(index/3)*136,96,104));
      if(!items.length)push('collection',null,primary?0:17,primary?15:65,primary?316:306,primary?316*100/340:90);
    }
    if(module.type==='skills') {
      items.forEach((row,index)=>push('skill',row.id,24,58+index*66,292,64));
      if(!items.length)push('collection',null,17,65,306,90);
    }
    if(module.type==='background') {
      let y=84;
      fields.forEach(row=>{const size=naturalSize({kind:'story',rowId:row.id,data:d});push('story',row.id,28,y,size.w,size.h);y+=size.h+12;});
      if(!fields.length)push('collection',null,17,75,306,90);
    }
    return rects;
  }
  window.WorkshopParts=Object.freeze({render,sheetPart,naturalSize,splitRects});
})();
