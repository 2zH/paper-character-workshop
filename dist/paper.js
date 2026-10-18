(()=>{'use strict';
const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const presets=[
 {id:1,name:'原片纸雕',en:'PAPER CUTOUT',desc:'沿用原片的竖卡结构。\n人物窗、属性孔、装备格，\n都透出下方的彩绘底稿。',shape:'original',stats:6,seed:8,tone:'',tab:'角色',stamp:'Character',accent:'#98534e'},
 {id:2,name:'八属性调查卡',en:'EIGHT ATTRIBUTES',desc:'把八项属性嵌入纸孔。\n身份与背景藏在卡背，\n保留一整张纸的紧凑。',shape:'original',stats:8,seed:15,tone:'',tab:'调查员',stamp:'Investigator',accent:'#6c7359'},
 {id:3,name:'盾形人物窗',en:'SHIELD WINDOW',desc:'人物像被收进一枚盾徽。\n斜切边角与窄纸筋，\n让力量落在纸的厚度里。',shape:'shield',stats:6,seed:33,tone:'sepia(.08)',tab:'勇者',stamp:'The brave',accent:'#866741'},
 {id:4,name:'森林拱窗',en:'WOODLAND ARCH',desc:'一扇手切的小拱窗，\n留着藤蔓与铅笔的痕迹。\n颜色从背后的纸里生长。',shape:'arch',stats:8,seed:41,tone:'sepia(.08) hue-rotate(9deg)',tab:'旅人',stamp:'Wanderer',accent:'#62754e'},
 {id:5,name:'星图纸筋',en:'FOLDED STARMAP',desc:'星盘被切成六块小窗。\n纸筋交会的地方，\n藏着还未写出的命运。',shape:'bevel',stats:6,seed:55,tone:'saturate(.75)',tab:'命运',stamp:'Fate & fortune',accent:'#796078',radar:'star'},
 {id:6,name:'远行票根',en:'TRAVELLER’S STUB',desc:'剪角、齿孔与旧票签，\n把角色写成一张通行证。\n每道折痕都通向远方。',shape:'ticket',stats:8,seed:68,tone:'sepia(.15)',tab:'通行证',stamp:'A wayfarer',accent:'#9d6643'},
 {id:7,name:'彩铅涂记',en:'COLOURED PENCILS',desc:'保留未涂匀的颜色，\n和稍微走偏的墨线。\n像小时候亲手画的一页。',shape:'original',stats:6,seed:73,tone:'saturate(1.15)',tab:'冒险',stamp:'My adventure',accent:'#a05361',crayon:true},
 {id:8,name:'圆拱徽章',en:'ROUND PORTRAIT',desc:'人物嵌进圆拱徽章，\n外围留下宽厚的旧纸。\n小窗里是随身的故事。',shape:'oval',stats:6,seed:81,tone:'sepia(.12) saturate(.8)',tab:'档案',stamp:'A little legend',accent:'#5d7a83'},
 {id:9,name:'夜色旧卷',en:'THE NIGHT FOLIO',desc:'墨迹更深，纸色更旧。\n微弱的红与蓝，\n仍从镂空处透出来。',shape:'gothic',stats:8,seed:91,tone:'sepia(.25) brightness(.88)',tab:'秘录',stamp:'After the dusk',accent:'#855050'},
 {id:10,name:'行囊装订页',en:'STITCHED RECORD',desc:'左侧一排手工装订孔，\n人物窗与装备窗各自成片。\n把每一块冒险装订在一起。',shape:'stitched',stats:8,seed:102,tone:'sepia(.05)',tab:'行囊',stamp:'Bits of a journey',accent:'#727444'}
];
const fantasy=[['STR','力量'],['CON','体质'],['DEF','防御'],['SPD','速度'],['INT','智识'],['LUC','幸运']];const coc=[['STR','力量'],['CON','体质'],['SIZ','体型'],['DEX','敏捷'],['APP','外貌'],['POW','意志'],['INT','智力'],['EDU','教育']];
let state={name:'P.P. Adventure.',level:1,hp:85,mp:43,stats:{STR:5,CON:7,DEF:4,SPD:3,INT:4,LUC:5,SIZ:4,DEX:5,APP:4,POW:6,EDU:6},gear:[true,true,true,true,true,true],stars:3,age:27,occupation:'古物学者',backstory:'父亲留下的旧地图上，有一座不在任何书里出现的小镇。',significantPeople:'父亲，一位失踪的地图绘制者',favorites:[]};try{state={...state,...JSON.parse(localStorage.getItem('papercut-adventure-v2')||'{}')}}catch{}
state.age=wholeNumber(state.age,15,99);Object.keys(state.stats).forEach(k=>state.stats[k]=wholeNumber(state.stats[k],1,7));
state.skills=state.skills||[{name:'侦查',value:65},{name:'图书馆使用',value:70},{name:'历史',value:60},{name:'聆听',value:45},{name:'话术',value:40},{name:'急救',value:35}];
state.traits=state.traits||'好奇心旺盛，过目不忘';state.appearance=state.appearance||'红发、旧披巾与一面刻着划痕的盾';
let selected=Math.max(1,Math.min(10,Math.trunc(Number(new URLSearchParams(location.search).get('v')))||1)),lifted=false;let timer;
function save(){try{localStorage.setItem('papercut-adventure-v2',JSON.stringify(state))}catch{}}function message(text){$('#live-message').textContent=text;$('#live-message').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('#live-message').classList.remove('show'),2300)}
function noise(i,seed){let n=Math.sin(i*127.1+seed*311.7)*43758.5453;return n-Math.floor(n)}
function roughRect(x,y,w,h,seed,rough=1.4){let pts=[];for(let k=0;k<4;k++){let len=k%2?h:w;let n=Math.max(5,Math.floor(len/9));for(let i=0;i<=n;i++){let t=i/n,off=(noise(i+k*101,seed)-.5)*rough*2;pts.push(k===0?[x+t*w,y+off]:k===1?[x+w+off,y+t*h]:k===2?[x+(1-t)*w,y+h+off]:[x+off,y+(1-t)*h]);}}return 'M'+pts.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' L')+' Z'}
function starPath(x,y,r,n=5,inner=.48,turn=-Math.PI/2){return 'M'+Array.from({length:n*2},(_,i)=>{let a=turn+i*Math.PI/n,rr=i%2?r*inner:r;return `${(x+Math.cos(a)*rr).toFixed(2)},${(y+Math.sin(a)*rr).toFixed(2)}`}).join(' L')+' Z'}
function portraitPath(shape){if(shape==='shield')return 'M45 163 Q199 137 353 164 L347 468 Q336 542 197 591 Q63 542 49 466 Z';if(shape==='arch')return 'M44 583 L44 287 Q42 150 198 150 Q355 152 355 285 L353 584 Z';if(shape==='oval')return 'M199 150 C28 151 30 309 43 415 C49 533 103 584 197 587 C290 583 348 530 351 414 C363 305 371 150 199 150 Z';if(shape==='gothic')return 'M47 585 L47 273 Q53 216 199 145 Q344 211 352 273 L352 585 Z';if(shape==='bevel')return 'M68 158 L327 158 L355 186 L354 557 L328 586 L68 586 L42 557 L42 187 Z';if(shape==='ticket')return 'M56 157 L339 157 L353 173 L353 294 Q337 299 353 312 L352 564 L331 584 L66 585 L46 565 L46 312 Q62 299 46 289 L45 178 Z';if(shape==='stitched')return roughRect(58,165,292,415,22,2.6);return 'M42 170 L121 170 Q135 171 139 155 L349 153 L355 159 L354 553 L326 554 Q313 556 311 585 L42 585 L39 565 L41 191 Z'}
function geometry(p){let attrs=p.stats===8?coc:fantasy;let rowY=p.stats===8?226:237,step=p.stats===8?26:33;let holes=[];let portrait=portraitPath(p.shape);holes.push(portrait);holes.push(roughRect(426,137,143,20,p.seed));holes.push(roughRect(426,176,143,20,p.seed+1));holes.push('M94 131 A27 27 0 1 1 40 131 A27 27 0 1 1 94 131Z');attrs.forEach(([key],r)=>{for(let i=0;i<7;i++){let x=444+i*18.8+(noise(i+r,p.seed)-.5)*1.2,y=rowY+r*step+(noise(i+r+10,p.seed)-.5)*1.5;holes.push(punchedHole(x,y,p.seed+r*31+i*7))}});let gear=[{x:54,y:642},{x:159,y:642},{x:264,y:642},{x:54,y:746},{x:159,y:746},{x:264,y:746}];gear.forEach((r,i)=>holes.push(roughRect(r.x,r.y,75,76,p.seed+i+5,1.5)));holes.push(roughRect(389,642,168,180,p.seed+10,1.7));let triangles=[];let center={x:473,y:520};for(let i=0;i<attrs.length;i++){let slice=Math.PI*2/attrs.length,a=-Math.PI/2+i*slice,b=a+slice;let path=`M${center.x+Math.cos(a+slice/2)*7} ${center.y+Math.sin(a+slice/2)*7} L${center.x+Math.cos(a)*77} ${center.y+Math.sin(a)*77} L${center.x+Math.cos(b)*77} ${center.y+Math.sin(b)*77} Z`;triangles.push(path);holes.push(path)}if(p.shape==='stitched'){for(let i=0;i<14;i++)holes.push(`M25 ${80+i*52}a4 4 0 1 1 -8 0a4 4 0 1 1 8 0Z`)}return{attrs,rowY,step,holes,portrait,gear,triangles,center}}
function fiberEdge(seed) {
  const threads = [];
  for (let side = 0; side < 4; side++) {
    const length = side % 2 ? 854 : 581;
    for (let i = 0; i < Math.floor(length / 12); i++) {
      if (noise(i + side * 83, seed) < .35) continue;
      const along = (i + noise(i + 27, seed)) * 12;
      const x = side === 0 ? 8 + along : side === 1 ? 589 : side === 2 ? 589 - along : 8;
      const y = side === 0 ? 5 : side === 1 ? 5 + along : side === 2 ? 859 : 859 - along;
      const reach = 1 + noise(i + 8, seed) * 2.4;
      const dx = side === 1 ? reach : side === 3 ? -reach : (noise(i + 44, seed) - .5) * 2;
      const dy = side === 0 ? -reach : side === 2 ? reach : (noise(i + 64, seed) - .5) * 2;
      threads.push(`<path d="M${x.toFixed(2)} ${y.toFixed(2)}l${dx.toFixed(2)} ${dy.toFixed(2)}" stroke="${i % 3 ? '#eee4cc' : '#b4a58a'}" stroke-width="${i % 3 ? .7 : .45}" opacity=".58"/>`);
    }
  }
  return threads.join('');
}
function punchedHole(x, y, seed) {
  const rx = 5.4 + noise(3, seed) * .7;
  const ry = 5.1 + noise(9, seed) * .7;
  const points = Array.from({length: 11}, (_, i) => {
    const a = i * Math.PI * 2 / 11;
    const grain = (noise(i, seed) - .5) * .55;
    return `${(x + Math.cos(a) * (rx + grain)).toFixed(2)} ${(y + Math.sin(a) * (ry + grain)).toFixed(2)}`;
  });
  return 'M' + points.join(' L') + ' Z';
}
function frameSvg(p, g) {
  const outer = roughRect(8, 5, 581, 854, p.seed, 1.5);
  const ink = '#38352c';
  const isDot = i => i > 3 && i < 4 + g.attrs.length * 7;
  const edgeFaces = g.holes.map((d, i) => `<path d="${d}" fill="none" stroke="#f9efd6" stroke-width="${isDot(i) ? .8 : 1.6}" transform="translate(.55,.8)" opacity=".8"/><path d="${d}" fill="none" stroke="#76684f" stroke-width="${isDot(i) ? .65 : .85}" transform="translate(-.5,-.45)" opacity=".48"/>`).join('');
  const marks = g.holes.map((d, i) => {
    const dot = isDot(i);
    const weight = dot ? .6 : i > 4 + g.attrs.length * 7 + 6 ? 1.25 : 1.9;
    return `<path d="${d}" pathLength="1000" fill="none" stroke="${ink}" stroke-width="${weight}" stroke-dasharray="${dot ? 'none' : '161 1.2 83 1.5 212 .8 59 .9'}" opacity="${dot ? .27 : .76}" transform="translate(-.9,-.7)"/>${dot ? '' : `<path d="${d}" pathLength="1000" fill="none" stroke="${ink}" stroke-width=".65" stroke-dasharray="31 47 16 69 7 103" stroke-dashoffset="${i * 17}" opacity=".42" transform="translate(.6,-1.2)"/>`}`;
  }).join('');
  const statLabels = g.attrs.map(([key], i) => `<text x="384" y="${g.rowY + i * g.step + 6}" font-size="${p.stats === 8 ? 20 : 23}" transform="rotate(${noise(i, p.seed) * 3 - 1.5},400,${g.rowY + i * g.step})">${key}</text>`).join('');
  const radarLabels = g.attrs.map(([t], i) => {
    const a = -Math.PI / 2 + i * Math.PI * 2 / g.attrs.length;
    return `<text x="${g.center.x + Math.cos(a) * 94}" y="${g.center.y + Math.sin(a) * 94 + 4}" font-size="14" text-anchor="middle">${t}</text>`;
  }).join('');
  const stitches = p.shape === 'stitched' ? Array.from({length: 13}, (_, i) => `<path d="M12 ${80 + i * 52} Q-9 ${103 + i * 52} 12 ${132 + i * 52}" fill="none" stroke="#6b5140" stroke-width="2.5"/><path d="M11 ${80 + i * 52} Q-8 ${103 + i * 52} 11 ${132 + i * 52}" fill="none" stroke="#b8a58b" stroke-width=".65"/>`).join('') : '';
  const grass = p.shape === 'arch' ? '<path d="M50 560 Q30 460 46 355 M45 424q-29-7-22-29q23 5 22 29 M44 474q26-7 26-29q-24 5-26 29 M347 358q34-40 20-67" fill="none" stroke="#586047" stroke-width="2"/>' : '';
  return `<svg class="cutout-svg" viewBox="0 0 600 870" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <pattern id="fibers" width="600" height="870" patternUnits="userSpaceOnUse"><image href="assets/paper-fiber.png" width="600" height="870" preserveAspectRatio="xMidYMid slice"/></pattern>
      <mask id="paper-mask"><path d="${outer}" fill="white"/>${g.holes.map(d => `<path d="${d}" fill="black"/>`).join('')}</mask>
      <filter id="paper-thickness" x="-15%" y="-10%" width="130%" height="125%">
        <feDropShadow dx=".45" dy=".8" stdDeviation=".2" flood-color="#f3e9d0" flood-opacity=".95"/>
        <feDropShadow dx=".85" dy="1.8" stdDeviation=".35" flood-color="#a3987d" flood-opacity=".75"/>
        <feDropShadow dx="1.8" dy="3.2" stdDeviation="1.35" flood-color="#342d20" flood-opacity=".46"/>
      </filter>
      <filter id="inkgrain"><feTurbulence type="fractalNoise" baseFrequency=".11 .07" numOctaves="3" seed="3" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.15" xChannelSelector="R" yChannelSelector="G"/></filter>
      <radialGradient id="aged-edge"><stop offset="74%" stop-color="#695b37" stop-opacity="0"/><stop offset="100%" stop-color="#695b37" stop-opacity=".12"/></radialGradient>
      <radialGradient id="paper-light" data-paper-light-gradient cx="34%" cy="25%" r="76%"><stop stop-color="#fff9e7" stop-opacity=".9"/><stop offset="1" stop-color="#fff9e7" stop-opacity="0"/></radialGradient>
      <linearGradient id="paper-bend" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffdf0" stop-opacity=".18"/><stop offset=".44" stop-color="#fffdf0" stop-opacity="0"/><stop offset="1" stop-color="#7e704d" stop-opacity=".045"/></linearGradient>
    </defs>
    <g filter="url(#paper-thickness)"><g mask="url(#paper-mask)">
      <path d="${outer}" fill="#eaddba"/><path d="${outer}" fill="url(#fibers)"/>
      <path d="${outer}" fill="#f5edd8" opacity=".34"/>
      <path d="${outer}" fill="url(#aged-edge)"/>
      <path d="${outer}" fill="url(#paper-bend)"/>
      <path d="${outer}" class="paper-sheen" data-paper-sheen fill="url(#paper-light)" style="opacity:var(--paper-light-strength,.055)"/>
      <path d="${outer}" fill="none" stroke="#b6aa8e" stroke-width="1.5" opacity=".42"/>
    </g></g>
    <g class="paper-cut-faces">${edgeFaces}</g><g fill="none">${fiberEdge(p.seed)}</g>
    <g filter="url(#inkgrain)">${marks}<g fill="${ink}" font-family="'Bradley Hand','Noteworthy','Kaiti SC',cursive">
      ${statLabels}<text x="374" y="158" font-size="35">HP</text><text x="374" y="198" font-size="35">MP</text><text x="108" y="146" font-family="Georgia,serif" font-size="39" font-weight="bold">LV:</text>${radarLabels}
    </g>
    <path d="M131 106 Q296 111 465 106 M471 107l83 1 M44 613L125 616M129 615l12-3M149 615l31 2M189 615l17-9l17 9l-17 5l-17-5M234 617l26-2M268 616l74-2" stroke="${ink}" fill="none" stroke-width="2.1" opacity=".85"/>
    <path d="M46 607l7 8l-8 8l-7-8Z M338 607l9 7l-8 7l-7-7Z" fill="${ink}"/>
    <path d="M527 76q-20-22-41-5l-9 16l21 12l29-3q15-10 0-20M488 78l3 6M500 78l2 6M477 75l-11-8l-4 5l13 10M521 91q-9-11 2-15q17 0 13 17" fill="none" stroke="${ink}" stroke-width="1.6"/>${grass}${stitches}</g>
  </svg>`;
}

function dotColors(i){return ['#d0b744','#c79c54','#b47553','#ad5257','#a03d4c','#8c3a45','#6b343a'][i]}
function underlay(p,g){let attrs=g.attrs.map(([key],r)=>Array.from({length:7},(_,i)=>`<i class="attribute-pigment" data-pigment="${key}-${i+1}" style="left:${(438+i*18.8)/6}%;top:${(g.rowY+r*g.step-7)/8.7}%;background:${state.stats[key]>i?dotColors(i):'#d4c4a0'}"></i>`).join('')).join('');let radarColors=p.crayon?['#d58899','#93b0b8','#b3c08c','#d5b352','#e7c785','#aab179']:['#c58e8a','#b99e77','#c8c18c','#dbbf6a','#c9b17d','#b5b68e'];let radar=`<svg class="radar-colors" viewBox="0 0 600 870" aria-hidden="true">${g.triangles.map((d,i)=>`<path d="${d}" fill="${radarColors[i%radarColors.length]}" opacity=".65"/>`).join('')}<path d="${'M'+g.attrs.map(([k],i)=>{let a=-Math.PI/2+i*Math.PI*2/g.attrs.length,r=Number(state.stats[k])/7*74;return `${g.center.x+Math.cos(a)*r} ${g.center.y+Math.sin(a)*r}`}).join(' L')+' Z'}" fill="#b7615b33" stroke="#846e5b" stroke-width="1.4"/></svg>`;return `<div class="backing-paper"></div><div class="underpainting" style="filter:${p.tone||'none'}"><div class="portrait-wash"></div><img class="knight-main" src="assets/knight-cutout.png" alt="钢笔与彩铅绘制的红发剑盾骑士"><div class="pencil-sketch sketch-a">✧</div><div class="pencil-sketch sketch-b">⌑</div><div class="level-disc">♢</div><div class="paint-trough hp-trough"><span style="width:${state.hp}%" data-meter="hp"></span></div><div class="paint-trough mp-trough"><span style="width:${state.mp}%" data-meter="mp"></span></div>${attrs}${radar}${g.gear.map((pos,i)=>`<div class="equipment-drawing ${state.gear[i]?'':'unequipped'}" data-equipment="${i}" style="left:${(pos.x-3)/6}%;top:${(pos.y-3)/8.7}%;--col:${i%3};--row:${Math.floor(i/3)}"><div class="gear-sprite"></div></div>`).join('')}<div class="tiny-portrait"><img src="assets/chibi-cutout.png" alt="同一角色的小幅剪影"></div><span class="tiny-number">NO. 0${p.id}</span></div>`}
function hitLayer(p,g){return `<div class="card-ink"><div class="character-tab"><span>${p.tab}</span><em>${p.stamp}</em></div><div class="blank-paper-label"></div><input class="card-name" data-field="name" aria-label="角色姓名" value="${esc(state.name)}" maxlength="22"><button class="level-value" data-action="level" aria-label="提升角色等级">${String(state.level).padStart(2,'0')}</button><div class="star-column">${Array.from({length:5},(_,i)=>`<button data-action="star" data-value="${5-i}" aria-label="设置${5-i}颗成长星" class="${5-i<=state.stars?'painted':''}">${5-i<=state.stars?'★':'☆'}</button>`).join('')}</div><input type="range" min="0" max="100" value="${state.hp}" class="paper-range hp-range" data-resource="hp" aria-label="生命 HP"><input type="range" min="0" max="100" value="${state.mp}" class="paper-range mp-range" data-resource="mp" aria-label="魔法 MP">${g.attrs.map(([key,label],r)=>Array.from({length:7},(_,i)=>`<button class="hole-hit" data-action="attribute" data-attribute="${key}" data-value="${i+1}" aria-label="${label} ${i+1}格" aria-pressed="${state.stats[key]===i+1}" style="left:${(434+i*18.8)/6}%;top:${(g.rowY+r*g.step-11)/8.7}%"></button>`).join('')).join('')}${g.gear.map((pos,i)=>`<button class="gear-hit" data-action="gear" data-gear="${i}" aria-label="${state.gear[i]?'收起':'装备'}${['短剑','盾牌','头盔','胸甲','腰包','靴子'][i]}" aria-pressed="${state.gear[i]}" style="left:${pos.x/6}%;top:${pos.y/8.7}%"></button>`).join('')}<button class="avatar-hit" data-action="edit" aria-label="填写角色背景"></button><span class="card-footer">${p.id===2?'CHARACTER SHEET · 08 ATTRIBUTES':'A LITTLE PAPER ADVENTURE'}</span></div>`}
function cardFocus() {
  const active=document.activeElement;
  if(!active || !active.closest('#paper-card,#study-tray')) return null;
  const attrs=['data-action','data-attribute','data-value','data-gear','data-id','data-field','data-resource'];
  const selector=attrs.filter(key=>active.hasAttribute(key)).map(key=>`[${key}="${CSS.escape(active.getAttribute(key))}"]`).join('');
  return selector || null;
}
function wholeNumber(value,min,max){return Math.max(min,Math.min(max,Math.trunc(Number(value))||min))}
function render(){const focus=cardFocus();let p=presets[selected-1],g=geometry(p);$('#paper-card').innerHTML=underlay(p,g)+`<div class="cut-layer" style="--accent:${p.accent};--paper-tone:${p.tone||'brightness(1)'};filter:${p.tone||'none'}">${frameSvg(p,g)}${hitLayer(p,g)}</div>`;$('#paper-card').classList.toggle('lifted',lifted);$('#paper-card').dataset.variant=selected;$('#study-index').textContent=`STUDY ${String(selected).padStart(2,'0')} / ${p.en}`;$('#study-title').textContent=p.name;$('#study-description').innerHTML=p.desc.split('\n').map(esc).join('<br>');$('#study-counter').textContent=String(selected).padStart(2,'0')+' / 10';$('#study-tray').innerHTML=presets.map(x=>`<button class="study-swatch ${x.id===selected?'active':''}" data-action="variant" data-id="${x.id}" aria-label="${String(x.id).padStart(2,'0')} ${x.name}" ${x.id===selected?'aria-current="page"':''}><span class="swatch-paper" style="--swatch:${x.accent}"><i></i><b>${String(x.id).padStart(2,'0')}</b></span><span>${x.name}</span></button>`).join('');$('#favorite').textContent=state.favorites.includes(selected)?'★':'☆';document.title=p.name+' · 纸上冒险';if(focus)$(focus)?.focus({preventScroll:true});}
function select(id){selected=id;let u=new URL(location.href);u.searchParams.set('v',id);history.replaceState(null,'',u);render()}
function edit(){let p=presets[selected-1],attrs=p.stats===8?coc:fantasy;$('#editor-content').innerHTML=`<div class="editor-identity"><label>姓名<input data-field="name" value="${esc(state.name)}"></label><label>年龄<input type="number" data-field="age" min="15" max="99" value="${state.age}"></label><label>职业<select data-field="occupation">${['古物学者','冒险骑士','私家侦探','旅行记者'].map(x=>`<option ${state.occupation===x?'selected':''}>${x}</option>`).join('')}</select></label></div><section><h3>属性纸孔 <small>每项 1–7 格</small></h3><div class="editor-stats">${attrs.map(([key,label])=>`<label>${label}<span>${key}</span><input type="number" data-stat="${key}" value="${state.stats[key]}" min="1" max="7"></label>`).join('')}</div></section><label>为什么踏上冒险？<textarea rows="3" data-field="backstory">${esc(state.backstory)}</textarea></label><label>重要之人<input data-field="significantPeople" value="${esc(state.significantPeople)}"></label><details class="editor-fold"><summary>技艺与特征 <span>展开填写</span></summary><div class="editor-skill-grid">${state.skills.map((skill,i)=>`<label>${esc(skill.name)}<input type="number" min="0" max="99" data-skill-index="${i}" value="${skill.value}" aria-label="${esc(skill.name)}技能值"><small>${Math.floor(skill.value/2)} / ${Math.floor(skill.value/5)}</small></label>`).join('')}</div><label>特征<input data-field="traits" value="${esc(state.traits)}"></label><label>外貌<input data-field="appearance" value="${esc(state.appearance)}"></label></details><details class="editor-fold"><summary>背景组件 <span>展开填写</span></summary>${[['ideology','信念'],['meaningfulLocation','重要地点'],['treasuredPossession','宝贵之物']].map(([key,label])=>`<label>${label}<input data-field="${key}" value="${esc(state[key])}"></label>`).join('')}</details><p class="editor-footnote">此处演示模板组件与纸孔视图。属性按格表示，尚未接入正式规则计算与角色库。</p>`;$('#editor').showModal()}
document.addEventListener('click',e=>{let b=e.target.closest('[data-action]');if(!b)return;let a=b.dataset.action;if(a==='variant')select(Number(b.dataset.id));if(a==='previous')select((selected+8)%10+1);if(a==='next')select(selected%10+1);if(a==='zoom'){let zoomed=document.body.classList.toggle('inspect-paper');b.textContent=zoomed?'看全卡':'看细节';b.setAttribute('aria-pressed',zoomed)}if(a==='layers'){lifted=!lifted;$('#paper-card').classList.toggle('lifted',lifted);b.setAttribute('aria-pressed',lifted);b.textContent=lifted?'盖回纸面':'揭开纸面'}if(a==='edit')edit();if(a==='reference')$('#reference').showModal();if(a==='close'){b.closest('dialog').close();save()}if(a==='attribute'){let key=b.dataset.attribute;state.stats[key]=Number(b.dataset.value);render();save();message(`${(presets[selected-1].stats===8?coc:fantasy).find(x=>x[0]===key)?.[1]} · ${state.stats[key]} 格`)}if(a==='gear'){let i=Number(b.dataset.gear);state.gear[i]=!state.gear[i];render();save();message(`${['短剑','盾牌','头盔','胸甲','腰包','靴子'][i]}${state.gear[i]?'已装备':'已收起'}`)}if(a==='level'){state.level=state.level%20+1;render();save();message(`等级提升至 ${state.level}`)}if(a==='star'){state.stars=Number(b.dataset.value);render();save()}if(a==='favorite'){state.favorites=state.favorites.includes(selected)?state.favorites.filter(x=>x!==selected):[...state.favorites,selected];render();save();message(state.favorites.includes(selected)?'已收藏这个纸雕方向':'已取消收藏')}if(a==='export'){let blob=new Blob([JSON.stringify({variant:selected,...state},null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),link=document.createElement('a');link.href=u;link.download='paper-character.json';link.click();setTimeout(()=>URL.revokeObjectURL(u),1000);message('角色数据已保存')}});
document.addEventListener('input',e=>{let el=e.target;if(el.dataset.resource){let k=el.dataset.resource;state[k]=Number(el.value);$(`[data-meter="${k}"]`).style.width=state[k]+'%';save()}if(el.dataset.field){state[el.dataset.field]=el.dataset.field==='age'?wholeNumber(el.value,15,99):el.value;save()}if(el.dataset.skillIndex!==undefined){let skill=state.skills[Number(el.dataset.skillIndex)];skill.value=wholeNumber(el.value,0,99);el.parentElement.querySelector('small').textContent=`${Math.floor(skill.value/2)} / ${Math.floor(skill.value/5)}`;save()}if(el.dataset.stat){state.stats[el.dataset.stat]=wholeNumber(el.value,1,7);save()}});
function syncNumberInput(e){
  const el=e.target;
  if(el.dataset.stat) el.value=state.stats[el.dataset.stat];
  if(el.dataset.skillIndex!==undefined) el.value=state.skills[Number(el.dataset.skillIndex)].value;
  if(el.dataset.field==='age') el.value=state.age;
}
document.addEventListener('change',syncNumberInput);
document.addEventListener('blur',syncNumberInput,true);
document.addEventListener('keydown',e=>{if($('dialog[open]'))return;if(e.key==='ArrowRight'&&!e.target.matches('input,textarea,select'))select(selected%10+1);if(e.key==='ArrowLeft'&&!e.target.matches('input,textarea,select'))select((selected+8)%10+1)});
$$('dialog').forEach(d=>d.addEventListener('close',()=>render()));
render();
})();
