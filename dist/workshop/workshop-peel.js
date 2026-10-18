/* A corner grip bends the one shared face; it never edits character or layout state. */
(() => {
  'use strict';
  const W=600,H=870,states=new WeakMap(),corners=['tl','tr','bl','br'];
  const names={tl:'左上',tr:'右上',bl:'左下',br:'右下'};
  const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,Number(value)||0));
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  let active=null,serial=0;

  function geometry(corner,amount,width=W,height=H) {
    corner=corners.includes(corner)?corner:'tr';amount=clamp(amount);width=Math.max(1,finite(width,W));height=Math.max(1,finite(height,H));
    const length=Math.hypot(width,height),normal={x:(corner.endsWith('r')?1:-1)*width/length,y:(corner.startsWith('b')?1:-1)*height/length};
    const projections=[0,width*normal.x,height*normal.y,width*normal.x+height*normal.y],min=Math.min(...projections),max=Math.max(...projections);
    const depth=(max-min)*.72*amount,angle=amount>0?.98+1.27*Math.sqrt(amount):0;
    return {corner,amount,width,height,normal,min,max,front:max-depth,radius:angle?depth/angle:0,angle};
  }
  function bendPoint(point,fold) {
    const x=finite(point.x),y=finite(point.y),q=x*fold.normal.x+y*fold.normal.y;
    if(q<=fold.front||!fold.radius)return {x,y,z:0};
    const angle=(q-fold.front)/fold.radius,along=fold.front+fold.radius*Math.sin(angle),shift=along-q;
    return {x:x+fold.normal.x*shift,y:y+fold.normal.y*shift,z:fold.radius*(1-Math.cos(angle))};
  }
  // A tangent plane for each narrow strip. Adjacent strips overlap by less than
  // a paper pixel, keeping the textured stock and every aperture continuous.
  function stripTransform(q,fold) {
    const nx=fold.normal.x,ny=fold.normal.y;
    if(q<=fold.front||!fold.radius)return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    const angle=(q-fold.front)/fold.radius,c=Math.cos(angle),s=Math.sin(angle),shift=fold.front+fold.radius*s-q*c,z=fold.radius*(1-c)-q*s;
    return [1+(c-1)*nx*nx,(c-1)*nx*ny,s*nx,0,(c-1)*nx*ny,1+(c-1)*ny*ny,s*ny,0,-s*nx,-s*ny,c,0,nx*shift,ny*shift,z,1];
  }
  function clipBand(low,high,fold) {
    let polygon=[{x:0,y:0},{x:fold.width,y:0},{x:fold.width,y:fold.height},{x:0,y:fold.height}];
    const dot=point=>point.x*fold.normal.x+point.y*fold.normal.y;
    for(const [limit,sign] of [[low,1],[high,-1]]) {
      const input=polygon;polygon=[];if(!input.length)break;
      for(let index=0;index<input.length;index++) {
        const a=input[index],b=input[(index+1)%input.length],da=(dot(a)-limit)*sign,db=(dot(b)-limit)*sign;
        if(da>=-1e-7)polygon.push(a);
        if((da>=0)!==(db>=0)) {const t=da/(da-db);polygon.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
      }
    }
    return polygon;
  }
  function springStep(state,target,dt,frequency=12) {
    const position=finite(state.position),velocity=finite(state.velocity),time=clamp(dt,0,.25),omega=Math.max(1,finite(frequency,12)),goal=clamp(target),delta=position-goal,c=velocity+omega*delta,decay=Math.exp(-omega*time);
    const next=goal+(delta+c*time)*decay;
    return {position:clamp(next),velocity:next<0||next>1?0:(velocity-omega*c*time)*decay};
  }
  function remapReferences(value,ids) {
    const lookup=id=>ids instanceof Map?ids.get(id):ids[id];
    return String(value).replace(/url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g,(all,quote,id)=>lookup(id)?`url(#${lookup(id)})`:all).replace(/^#([\w:.-]+)$/,(all,id)=>lookup(id)?`#${lookup(id)}`:all);
  }
  function cloneFace(source,prefix) {
    const clone=source.cloneNode(true),ids=new Map();
    const nodes=[clone,...clone.querySelectorAll('*')];
    for(const node of nodes)if(node.id){ids.set(node.id,`${prefix}-${node.id}`);node.id=ids.get(node.id);}
    for(const node of nodes)for(const attribute of Array.from(node.attributes||[])) {
      if(attribute.name==='id')continue;
      const value=remapReferences(attribute.value,ids);if(value!==attribute.value)node.setAttribute(attribute.name,value);
    }
    clone.classList.add('corner-peel-copy');clone.setAttribute('aria-hidden','true');clone.setAttribute('inert','');
    return clone;
  }
  function pullAmount(dx,dy,corner) {
    const base=geometry(corner,1),inward=-(dx*base.normal.x+dy*base.normal.y),side=Math.abs(dx*base.normal.y-dy*base.normal.x);
    const distance=Math.max(0,inward)+Math.max(0,-inward)*.32+side*.28;
    if(distance<.35)return 0;
    let low=0,high=1;
    for(let i=0;i<16;i++) {
      const amount=(low+high)/2,fold=geometry(corner,amount),depth=fold.max-fold.front;
      const shift=depth-fold.radius*Math.sin(fold.angle),z=fold.radius*(1-Math.cos(fold.angle)),half=(fold.max-fold.min)/2;
      const reach=half-(half-shift)*1700/(1700-z);
      if(reach<distance)low=amount;else high=amount;
    }
    return (low+high)/2;
  }
  const reduced=()=>typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const round=value=>Math.round(value*100000)/100000;
  const polygonCSS=points=>points.length>=3?`polygon(${points.map(point=>`${round(point.x)}px ${round(point.y)}px`).join(',')})`:'polygon(0 0,0 0,0 0)';

  function createState(board) {
    const overlay=document.createElement('div');overlay.className='corner-peel-controls';overlay.setAttribute('aria-label','揭开整张面纸');
    for(const corner of corners) {
      const button=document.createElement('button');button.type='button';button.className='corner-peel-grip';button.dataset.corner=corner;
      button.setAttribute('aria-label',`抓住${names[corner]}纸角揭开面纸，松手落回`);button.title=`捏住${names[corner]}纸角，慢慢揭开；松手落回`;
      button.innerHTML='<span class="corner-peel-curl" aria-hidden="true"></span><span class="corner-peel-cue" aria-hidden="true">捏住纸角 · 松手落回</span>';
      overlay.append(button);
      button.addEventListener('pointerdown',event=>begin(event,state,corner));
      button.addEventListener('lostpointercapture',event=>{if(active?.button===button&&active.held&&active.pointerId===event.pointerId)release();});
      button.addEventListener('keydown',event=>{
        if(!['Enter',' '].includes(event.key)||event.repeat)return;
        event.preventDefault();event.stopPropagation();
        if(begin(null,state,corner,button)) {active.target=.38;active.keyboard=true;if(reduced()){active.position=active.target;active.velocity=0;paint(active);}}
      });
      button.addEventListener('keyup',event=>{if(active?.button===button&&active.keyboard&&['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();release();}});
      button.addEventListener('blur',()=>{if(active?.button===button&&active.keyboard)release();});
    }
    board.append(overlay);
    const state={board,overlay,frame:null,enabled:false,source:null,onStart:null,onEnd:null};states.set(board,state);return state;
  }
  function buildMesh(gesture) {
    const {state,source}=gesture,root=source.closest('.card-sheet'),shell=source.parentNode;
    const mesh=document.createElement('div');mesh.className='corner-peel-mesh';mesh.setAttribute('aria-hidden','true');mesh.setAttribute('inert','');
    const cast=document.createElement('div');cast.className='corner-peel-cast';cast.setAttribute('aria-hidden','true');cast.setAttribute('inert','');
    // One SVG resource bank supplies the stock and all aperture definitions to
    // every strip. Only the HTML ink is mirrored per strip: duplicating hundreds
    // of SVG window paths 23 times made the first held frame unnecessarily heavy.
    const prefix=`corner-peel-shared-${++serial}`,template=cloneFace(source,prefix),surface=template.querySelector('.card-face-surface');
    const resources=document.createElement('div');resources.className='corner-peel-resources';resources.setAttribute('aria-hidden','true');resources.setAttribute('inert','');
    const surfaceId=`${prefix}-surface`;if(surface){surface.id=surfaceId;resources.append(surface);}
    const count=window.innerWidth<640?16:22,bands=[];
    const surfaceUse=`<svg class="card-face-surface" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><use href="#${surfaceId}"/></svg>`;
    for(let index=0;index<=count;index++) {
      const band=document.createElement('div');band.className='corner-peel-band';
      const clip=document.createElement('div');clip.className='corner-peel-band-clip';
      const copy=template.cloneNode(true),holder=document.createElement('div');holder.innerHTML=surfaceUse;copy.prepend(holder.firstElementChild);
      clip.append(copy);band.append(clip);mesh.append(band);
      let shadow=null,shadowClip=null;
      if(index>0&&surface) {
        shadow=document.createElement('div');shadow.className='corner-peel-shadow-band';shadowClip=document.createElement('div');shadowClip.className='corner-peel-shadow-clip';
        shadowClip.innerHTML=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><use href="#${surfaceId}"/></svg>`;shadow.append(shadowClip);cast.append(shadow);
      }
      bands.push({band,clip,shadow,shadowClip});
    }
    root.append(resources,cast);shell.append(mesh);gesture.mesh=mesh;gesture.cast=cast;gesture.resources=resources;gesture.bands=bands;gesture.root=root;
    // The permanent underpaint also uses the stable outline outside the bending
    // surface during the gesture, then regains its original reference on release.
    const under=root.querySelector('.card-underpaint');
    if(under?.style.clipPath) {
      const ids=new Map(Array.from(source.querySelectorAll('[id]'),node=>[node.id,`${prefix}-${node.id}`]));
      gesture.under=under;gesture.underClip=under.style.clipPath;under.style.clipPath=remapReferences(gesture.underClip,ids);
    }
    gesture.scale=finite(root.getBoundingClientRect?.().width,0)/W||state.frame.width/W;
    root.classList.add('is-corner-peeling');state.board.classList.add('is-corner-peeling');document.body.classList.add('is-corner-peeling');
    state.overlay.classList.add('is-active');gesture.button.classList.add('is-held');
    gesture.button.setAttribute('aria-pressed','true');
  }
  function begin(event,state,corner,keyboardButton=null) {
    if(!state.enabled||active?.held||event&&(event.button!==0||event.isPrimary===false))return false;
    if(event){event.preventDefault();event.stopImmediatePropagation();}
    cancel({immediate:true});
    // Close the button-operated pose before snapshotting the same face. This
    // callback intentionally runs before a gesture exists, so parent cleanup is safe.
    state.onStart?.();
    const source=state.board.querySelector('.card-sheet .card-face-shell > .card-face');if(!source)return false;
    const button=keyboardButton||event.currentTarget;
    const gesture={state,source,button,corner,pointerId:event?.pointerId??null,startX:event?.clientX??0,startY:event?.clientY??0,position:0,velocity:0,target:0,held:true,keyboard:false,raf:0,lastTime:0,mesh:null,bands:null,root:null};
    active=gesture;buildMesh(gesture);paint(gesture);
    if(event)try{button.setPointerCapture(event.pointerId);}catch{}
    gesture.raf=window.requestAnimationFrame(tick);return true;
  }
  function paint(gesture) {
    if(gesture.lastPaint!==undefined&&Math.abs(gesture.position-gesture.lastPaint)<.000005)return;
    gesture.lastPaint=gesture.position;
    const fold=geometry(gesture.corner,gesture.position),count=gesture.bands.length-1,depth=fold.max-fold.front,step=depth/count;
    gesture.root.style.setProperty('--corner-peel-amount',String(gesture.position));
    for(let index=0;index<gesture.bands.length;index++) {
      const {band,clip,shadow,shadowClip}=gesture.bands[index],low=index===0?fold.min-1:fold.front+(index-1)*step-.45,high=index===0?fold.front+.45:fold.front+index*step+.45,q=index===0?fold.min:(low+high)/2;
      const matrix=stripTransform(q,fold),angle=index===0||!fold.radius?0:(q-fold.front)/fold.radius;
      const polygon=polygonCSS(clipBand(low,high,fold));clip.style.clipPath=polygon;
      if(shadow) {
        shadowClip.style.clipPath=polygon;
        const shadowMatrix=[matrix[0]+matrix[2]*.20,matrix[1]+matrix[2]*.32,matrix[4]+matrix[6]*.20,matrix[5]+matrix[6]*.32,matrix[12]+matrix[14]*.20,matrix[13]+matrix[14]*.32];
        shadow.style.transform=`matrix(${shadowMatrix.map(round).join(',')})`;shadow.style.visibility=depth<.05?'hidden':'visible';
      }
      band.style.transform=`matrix3d(${matrix.map(round).join(',')})`;
      // The back is unprinted paper. A continuous light falloff makes the bend
      // legible without turning the stock into glossy plastic.
      band.classList.toggle('shows-paper-back',Math.cos(angle)<-.035);
      band.style.setProperty('--corner-band-light',String(round(1-Math.sin(angle)*.18-Math.max(0,-Math.cos(angle))*.09)));
      band.style.visibility=index>0&&depth<.05?'hidden':'visible';
    }
  }
  function tick(time) {
    const gesture=active;if(!gesture)return;
    const dt=gesture.lastTime?Math.min((time-gesture.lastTime)/1000,.05):1/60;gesture.lastTime=time;
    const next=springStep(gesture,gesture.held?gesture.target:0,dt,gesture.held?25:10.8);gesture.position=next.position;gesture.velocity=next.velocity;paint(gesture);
    if(!gesture.held&&gesture.position<.001&&Math.abs(gesture.velocity)<.015){finish(gesture);return;}
    gesture.raf=window.requestAnimationFrame(tick);
  }
  function release() {
    const gesture=active;if(!gesture)return;
    gesture.held=false;gesture.target=0;gesture.velocity=Math.min(0,gesture.velocity);gesture.button.classList.remove('is-held');
    if(gesture.pointerId!==null)try{if(gesture.button.hasPointerCapture(gesture.pointerId))gesture.button.releasePointerCapture(gesture.pointerId);}catch{}
    if(reduced())finish(gesture);
  }
  function finish(gesture) {
    if(!gesture)return;if(gesture.raf)window.cancelAnimationFrame(gesture.raf);
    if(gesture.under)gesture.under.style.clipPath=gesture.underClip;
    gesture.mesh?.remove();gesture.cast?.remove();gesture.resources?.remove();gesture.root?.classList.remove('is-corner-peeling');gesture.root?.style.removeProperty('--corner-peel-amount');
    gesture.state.board.classList.remove('is-corner-peeling');gesture.state.overlay.classList.remove('is-active');gesture.button.classList.remove('is-held');gesture.button.removeAttribute('aria-pressed');
    document.body.classList.remove('is-corner-peeling');if(active===gesture)active=null;
    if(gesture.pointerId!==null)try{if(gesture.button.hasPointerCapture(gesture.pointerId))gesture.button.releasePointerCapture(gesture.pointerId);}catch{}
    gesture.state.onEnd?.();
  }
  function cancel({immediate=false}={}) {if(!active)return;if(immediate)finish(active);else release();}
  function sync({board,frame,enabled=true,onStart,onEnd}={}) {
    if(!board)return;let state=states.get(board);
    if(state?.overlay.parentNode!==board){if(active?.state===state)cancel({immediate:true});state=null;}
    if(!state)state=createState(board);
    const nextFrame=frame&&frame.width>0?{x:finite(frame.x),y:finite(frame.y),width:finite(frame.width),height:finite(frame.height)}:null;
    const source=board.querySelector('.card-sheet .card-face-shell > .card-face');
    const moved=JSON.stringify(state.frame)!==JSON.stringify(nextFrame);
    if(active?.state===state&&(moved||source!==active.source||!enabled||!nextFrame))cancel({immediate:true});
    state.frame=nextFrame;state.source=source;state.enabled=Boolean(enabled&&source&&nextFrame);state.onStart=onStart;state.onEnd=onEnd;
    state.overlay.hidden=!state.enabled;
    for(const button of state.overlay.querySelectorAll('button'))button.disabled=!state.enabled;
    if(nextFrame) {
      state.overlay.style.transform=`translate(${nextFrame.x}px,${nextFrame.y}px) scale(${nextFrame.width/W})`;
      const visibleScale=finite(source?.closest('.card-sheet')?.getBoundingClientRect?.().width,0)/W||nextFrame.width/W;
      state.overlay.style.setProperty('--corner-hit-size',`${Math.max(44,44/visibleScale)}px`);
    }
  }
  window.addEventListener('pointermove',event=>{
    const gesture=active;if(!gesture?.held||gesture.keyboard||event.pointerId!==gesture.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();
    const scale=gesture.scale||gesture.state.frame.width/W;
    gesture.target=pullAmount((event.clientX-gesture.startX)/scale,(event.clientY-gesture.startY)/scale,gesture.corner);
    if(reduced()){gesture.position=gesture.target;gesture.velocity=0;paint(gesture);}
  },{capture:true,passive:false});
  window.addEventListener('pointerup',event=>{if(active?.held&&event.pointerId===active.pointerId){event.preventDefault();event.stopImmediatePropagation();release();}},{capture:true,passive:false});
  window.addEventListener('pointercancel',event=>{if(active?.pointerId===event.pointerId){event.stopImmediatePropagation();cancel({immediate:true});}},{capture:true});
  window.addEventListener('keydown',event=>{
    if(!active)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();return;}
    // A held paper corner is a preview gesture, never an edit/rotate/undo target.
    if(!['Tab','Shift','Control','Alt','Meta'].includes(event.key)){if([' ','Enter'].includes(event.key))event.preventDefault();event.stopImmediatePropagation();}
  },{capture:true});
  window.addEventListener('blur',()=>cancel({immediate:true}));
  window.addEventListener('beforeprint',()=>cancel({immediate:true}));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel({immediate:true});});
  window.WorkshopPeel=Object.freeze({sync,cancel,isActive:()=>Boolean(active),geometry,bendPoint,stripTransform,clipBand,springStep,remapReferences,cloneFace,pullAmount});
})();
