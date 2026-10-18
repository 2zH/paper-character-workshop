/* Mounted parts supply paint and apertures; the card owns one continuous face. */
(() => {
  'use strict';
  const W=600,H=870,NS='http://www.w3.org/2000/svg',RIM={x:20,y:17,w:557,h:830};
  const states=new WeakMap();
  let serial=0;
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const round=value=>Math.round(value*100000)/100000;
  const noise=index=>{const value=Math.sin(index*127.1+8*311.7)*43758.5453;return value-Math.floor(value);};
  function outerPath() {
    const points=[];
    for(let side=0;side<4;side++) {
      const count=Math.ceil((side%2?854:581)/9);
      for(let i=0;i<=count;i++) {
        const t=i/count,off=(noise(i+side*101)-.5)*2.6;
        points.push(side===0?[8+t*581,5+off]:side===1?[589+off,5+t*854]:side===2?[589-t*581,859+off]:[8+off,859-t*854]);
      }
    }
    return 'M'+points.map(point=>point.map(round).join(' ')).join(' L')+' Z';
  }
  const OUTER=outerPath();
  // Inline transforms use the same center origin as the real draggable article.
  // Reading live styles (rather than saved poses) includes held spring and resize frames.
  function pose(frame,element,natural) {
    if(!frame||!natural||!(frame.width>0)||!(natural.w>0)||!(natural.h>0))return null;
    const style=element?.style||element||{},transform=String(style.transform||''),ratio=W/frame.width;
    const translation=transform.match(/translate(?:3d)?\(\s*([\d.e+-]+)px\s*,\s*([\d.e+-]+)px/i);
    const rotation=transform.match(/rotate\(\s*([\d.e+-]+)deg/i),scaling=transform.match(/scale\(\s*([\d.e+-]+)/i);
    const width=finite(parseFloat(style.width),natural.w/ratio)*ratio;
    const height=finite(parseFloat(style.height),width/ratio*natural.h/natural.w)*ratio;
    const x=(finite(translation?.[1],finite(parseFloat(style.left)))-finite(frame.x))*ratio;
    const y=(finite(translation?.[2],finite(parseFloat(style.top)))-finite(frame.y))*ratio;
    const angle=finite(rotation?.[1]),scale=finite(scaling?.[1],1),radians=angle*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
    const a=cos*scale*width/natural.w,b=sin*scale*width/natural.w,c=-sin*scale*height/natural.h,d=cos*scale*height/natural.h;
    const matrix=[a,b,c,d,x+width/2-a*natural.w/2-c*natural.h/2,y+height/2-b*natural.w/2-d*natural.h/2].map(round);
    return {matrix,css:`matrix(${matrix.join(',')})`,svg:`matrix(${matrix.join(' ')})`,x,y,width,height,angle,scale};
  }
  // These are visual mirrors. The original article remains the sole field/action owner.
  function sanitizeMarkup(markup) {
    return String(markup||'')
      .replace(/\s(?:data-[\w-]+|id|role|tabindex|contenteditable|autofocus|for|name|aria-[\w-]+|on[\w-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi,'')
      .replace(/<button\b/gi,'<span').replace(/<\/button>/gi,'</span>')
      .replace(/\s(?:type|disabled|checked|selected)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi,'')
      .replace(/<input\b[^>]*>|<textarea\b[^>]*>[\s\S]*?<\/textarea>|<select\b[^>]*>[\s\S]*?<\/select>/gi,'');
  }
  function bounds(transform,natural) {
    const [a,b,c,d,e,f]=transform.matrix,points=[[0,0],[natural.w,0],[natural.w,natural.h],[0,natural.h]].map(([x,y])=>[a*x+c*y+e,b*x+d*y+f]);
    return {left:Math.min(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),right:Math.max(...points.map(p=>p[0])),bottom:Math.max(...points.map(p=>p[1]))};
  }
  function matrixText(entry) {return entry.svg||`matrix(${(entry.matrix||[1,0,0,1,0,0]).join(' ')})`;}
  function holesMarkup(entry) {return (entry.holes||[]).map(path=>`<path d="${esc(path)}" fill="black"/>`).join('');}
  function edgesMarkup(entry) {
    const weight=finite(entry.weight,1);
    return (entry.holes||[]).map(path=>`<path d="${esc(path)}" fill="none" stroke="#fff3d8" stroke-width="${weight+1.6}" transform="translate(.65,1.1)" opacity=".95"/><path d="${esc(path)}" fill="none" stroke="#8b7b5c" stroke-width="${weight+1.1}" transform="translate(-.6,-.9)" opacity=".56"/><path d="${esc(path)}" fill="none" stroke="#594a35" stroke-width="${weight}" stroke-dasharray="81 .8 137 1.3 43 .5" opacity=".65"/>`).join('');
  }
  function surfaceMarkup(id='workshop-sheet',entries=[]) {
    return `<svg class="card-face-surface" viewBox="0 0 ${W} ${H}" aria-hidden="true" xmlns="${NS}"><defs><pattern id="${id}-fiber" width="600" height="870" patternUnits="userSpaceOnUse"><image href="assets/paper-fiber.png" width="600" height="870" preserveAspectRatio="xMidYMid slice"/></pattern><linearGradient id="${id}-light" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff9e9" stop-opacity=".22"/><stop offset=".55" stop-color="#fff8e5" stop-opacity=".04"/><stop offset="1" stop-color="#8d7b53" stop-opacity=".1"/></linearGradient><clipPath id="${id}-outline"><path d="${OUTER}"/></clipPath><clipPath id="${id}-rim"><rect x="${RIM.x}" y="${RIM.y}" width="${RIM.w}" height="${RIM.h}"/></clipPath><mask id="${id}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}" style="mask-type:luminance"><path class="sheet-outer-mask" d="${OUTER}" fill="white"/><g class="sheet-mask-windows" clip-path="url(#${id}-rim)">${entries.map(entry=>`<g transform="${matrixText(entry)}">${holesMarkup(entry)}</g>`).join('')}</g><g class="sheet-mask-bridges" clip-path="url(#${id}-rim)" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"></g></mask></defs><g class="sheet-paper-stock" mask="url(#${id}-mask)"><path d="${OUTER}" fill="#ede3ca"/><path d="${OUTER}" fill="url(#${id}-fiber)"/><path d="${OUTER}" fill="url(#${id}-light)"/><path d="${OUTER}" fill="none" stroke="#b7a788" stroke-width="1" opacity=".65"/></g><g class="sheet-cut-edges" clip-path="url(#${id}-rim)" mask="url(#${id}-mask)">${entries.map(entry=>`<g transform="${matrixText(entry)}">${edgesMarkup(entry)}</g>`).join('')}</g></svg>`;
  }
  function createState(board) {
    const id=`card-sheet-${++serial}`,root=document.createElement('div');
    root.className='card-sheet';root.setAttribute('aria-hidden','true');root.setAttribute('inert','');
    root.innerHTML=`<div class="card-underpaint"></div><div class="card-face-shell"><div class="card-face">${surfaceMarkup(id)}<div class="card-face-ink"><div class="binding-tab"><span>角 色</span><em>Character</em></div><span class="binding-footer">A LITTLE PAPER ADVENTURE</span><div class="binding-empty-hint sheet-empty-hint" hidden>把纸片拖到这里，自由拼成你的角色卡</div></div></div></div>`;
    const base=board.querySelector('.binding-base');if(base)base.after(root);else board.prepend(root);
    const state={id,root,records:new Map(),under:root.querySelector('.card-underpaint'),ink:root.querySelector('.card-face-ink'),hint:root.querySelector('.sheet-empty-hint'),windows:root.querySelector('.sheet-mask-windows'),edges:root.querySelector('.sheet-cut-edges'),bridges:root.querySelector('.sheet-mask-bridges'),geometryKey:'',clip:`url(#${id}-outline)`};
    state.under.style.clipPath=state.clip;state.ink.style.clipPath=state.clip;state.ink.style.mask=`url(#${id}-mask)`;state.ink.style.webkitMask=`url(#${id}-mask)`;
    states.set(board,state);return state;
  }
  function partNode(kind,className,markup) {
    const node=document.createElement('div');node.className=`atomic-paper atomic-${kind} atomic-layered ${className}`;
    node.innerHTML=markup;return node;
  }
  function makeRecord(state,paper,descriptor,key) {
    const art=partNode(paper.kind,'sheet-art-part',`<div class="paper-underlay">${sanitizeMarkup(descriptor.underlay)}</div>`);
    const ink=partNode(paper.kind,'sheet-ink-part',`<div class="paper-cut-face">${sanitizeMarkup(descriptor.face)}</div>`);
    const holes=document.createElementNS(NS,'g'),edges=document.createElementNS(NS,'g');
    holes.innerHTML=holesMarkup(descriptor);edges.innerHTML=edgesMarkup(descriptor);
    state.under.append(art);state.ink.append(ink);state.windows.append(holes);state.edges.append(edges);
    return {art,ink,holes,edges,descriptor,key,pose:null,paths:typeof Path2D==='undefined'?[]:(descriptor.holes||[]).map(path=>new Path2D(path))};
  }
  function removeRecord(record) {for(const name of ['art','ink','holes','edges'])record[name].remove();}

  // Only unusual overlaps can isolate a piece of the upper stock. A coarse
  // geometry mask finds those islands and joins each to the continuous sheet
  // by its shortest narrow rib; ordinary windows and radar spokes stay intact.
  // This mask contains no imagery, so canvas reads are origin-independent.
  function connectedRibs(state,records) {
    if(typeof Path2D==='undefined')return [];
    // Individual apertures are connected by construction. Only intersecting
    // component footprints can create new islands, so ordinary layouts avoid
    // raster work entirely while every transform still updates synchronously.
    const cutRecords=records.filter(record=>record.paths.length),boxes=cutRecords.map(record=>bounds(record.pose,record.descriptor));
    const overlaps=boxes.some((box,index)=>boxes.slice(index+1).some(other=>box.left<other.right&&box.right>other.left&&box.top<other.bottom&&box.bottom>other.top));
    if(!overlaps)return [];
    const step=2,cw=W/step,ch=H/step,total=cw*ch;
    if(!state.canvas) {state.canvas=document.createElement('canvas');state.canvas.width=cw;state.canvas.height=ch;state.context=state.canvas.getContext('2d',{willReadFrequently:true});}
    const ctx=state.context;if(!ctx)return [];
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,cw,ch);ctx.scale(1/step,1/step);ctx.fillStyle='#fff';ctx.fill(state.outerPath||(state.outerPath=new Path2D(OUTER)));
    ctx.save();ctx.beginPath();ctx.rect(RIM.x,RIM.y,RIM.w,RIM.h);ctx.clip();ctx.fillStyle='#000';
    for(const record of records) {
      ctx.save();ctx.transform(...record.pose.matrix);
      for(const path of record.paths)ctx.fill(path);
      ctx.restore();
    }
    ctx.restore();
    const data=ctx.getImageData(0,0,cw,ch).data;
    if(!state.buffers)state.buffers={paper:new Uint8Array(total),attached:new Uint8Array(total),visited:new Uint8Array(total),queue:new Int32Array(total),parent:new Int32Array(total),search:new Uint16Array(total)};
    const {paper,attached,visited,queue,parent,search}=state.buffers;attached.fill(0);visited.fill(0);search.fill(0);
    for(let i=0;i<total;i++)paper[i]=data[i*4]>110?1:0;
    const neighbors=(index,visit)=>{const x=index%cw;if(x)visit(index-1);if(x<cw-1)visit(index+1);if(index>=cw)visit(index-cw);if(index<total-cw)visit(index+cw);};
    function flood(start,marks,collect=false) {
      let head=0,tail=1;queue[0]=start;marks[start]=1;const found=[];
      while(head<tail){const point=queue[head++];if(collect)found.push(point);neighbors(point,next=>{if(paper[next]&&!marks[next]){marks[next]=1;queue[tail++]=next;}});}
      return found;
    }
    // The protected outer rim gives a stable root even when windows cross edges.
    let start=6*cw+8;while(start<total&&!paper[start])start++;if(start===total)return [];
    flood(start,attached);const ribs=[];let generation=0;
    for(let i=0;i<total;i++) {
      if(!paper[i]||attached[i]||visited[i])continue;
      const island=flood(i,visited,true);if(island.length<3)continue;
      generation++;let head=0,tail=0,target=-1;
      island.forEach(point=>{queue[tail++]=point;parent[point]=-1;search[point]=generation;});
      while(head<tail&&target<0) {
        const point=queue[head++];neighbors(point,next=>{
          if(target>=0||search[next]===generation)return;
          search[next]=generation;parent[next]=point;
          if(attached[next]){target=next;return;}
          queue[tail++]=next;
        });
      }
      if(target<0)continue;
      const route=[];for(let point=target;point>=0;point=parent[point]){route.push(point);paper[point]=1;}
      // Simplify collinear grid steps, keeping a small hand-cut elbow if needed.
      const corners=route.filter((point,index)=>index===0||index===route.length-1||point-route[index-1]!==route[index+1]-point);
      ribs.push('M'+corners.map(point=>`${(point%cw+.5)*step} ${(Math.floor(point/cw)+.5)*step}`).join(' L'));
      flood(i,attached);
    }
    return ribs;
  }
  function sync({board,frame,papers=[],editingId=null}={}) {
    if(!board)return;
    const articles=new Map(Array.from(board.querySelectorAll('.paper-piece[data-module-id]'),node=>[node.dataset.moduleId,node]));
    if(!frame||!(frame.width>0)||!window.WorkshopParts?.sheetPart) {
      states.get(board)?.root.remove();states.delete(board);board.classList.remove('has-unified-sheet');
      for(const article of articles.values())article.classList.remove('sheet-attached');return;
    }
    let state=states.get(board);if(!state||state.root.parentNode!==board)state=createState(board);
    board.classList.add('has-unified-sheet');state.root.style.transform=`translate(${frame.x}px,${frame.y}px) scale(${frame.width/W})`;
    const active=new Set(),ordered=[];
    for(const paper of papers) {
      const article=articles.get(paper.id);if(!article||!paper.mounted||!paper.kind)continue;
      const transform=pose(frame,article,window.WorkshopParts.naturalSize(paper));if(!transform)continue;
      const box=bounds(transform,window.WorkshopParts.naturalSize(paper));
      // Older layouts can mark overflow appendices as mounted. Keep those
      // visible on the table, without changing their saved placement or data.
      if(box.right<=0||box.bottom<=0||box.left>=W||box.top>=H)continue;
      const key=JSON.stringify([paper.kind,paper.rowId,paper.title,paper.data]);let record=state.records.get(paper.id);
      if(!record||record.key!==key) {
        const descriptor=window.WorkshopParts.sheetPart(paper);if(!descriptor){article.classList.remove('sheet-attached');continue;}
        if(record)removeRecord(record);record=makeRecord(state,paper,descriptor,key);state.records.set(paper.id,record);
      }
      article.classList.add('sheet-attached');
      record.pose=transform;record.z=finite(paper.pose?.z);active.add(paper.id);ordered.push(record);
      for(const node of [record.art,record.ink]) {node.style.width=record.descriptor.w+'px';node.style.height=record.descriptor.h+'px';node.style.transform=transform.css;node.style.zIndex=String(record.z);}
      record.ink.hidden=editingId===paper.id;record.holes.setAttribute('transform',transform.svg);record.edges.setAttribute('transform',transform.svg);
    }
    for(const [id,record] of state.records)if(!active.has(id)){removeRecord(record);state.records.delete(id);}
    for(const [id,article] of articles)if(!active.has(id))article.classList.remove('sheet-attached');
    state.hint.hidden=active.size>0;
    const geometryKey=ordered.map(record=>record.pose.svg+':'+record.descriptor.holes?.join('|')).join(';');
    if(geometryKey!==state.geometryKey) {
      state.geometryKey=geometryKey;
      const ribs=connectedRibs(state,ordered);state.bridges.innerHTML=ribs.map(path=>`<path d="${path}"/>`).join('');
    }
  }
  window.WorkshopSheet=Object.freeze({sync,pose,bounds,sanitizeMarkup,surfaceMarkup});
})();
