(function () {
  const esc = (C, value) => C.escape(String(value ?? ''));
  const field = (C, state, key, label, extra = '') => `<label class="gd-field"><span>${label}</span><input data-field="${key}" value="${esc(C, state[key])}" ${extra}></label>`;
  const corner = '<span class="gd-corner gd-corner-a"></span><span class="gd-corner gd-corner-b"></span>';
  window.VARIANTS.push({
    id: 2, name: '口袋档案', en: 'THE POCKET PASSPORT', color: '#7b835a',
    desc: '把角色装进一本旅行证：贴照片、填短字段，再把冒险需要的票券收进口袋。',
    render(C, state) {
      return `<div class="variant variant-2">
        <div class="passport-table-label"><span>FIELD NOTES / VOL. 02</span><span>随身携带，沿途增补。</span></div>
        <div class="passport-open">
          <section class="passport-left">
            <div class="passport-cover-mark"><span>✳</span><small>THE SOCIETY OF<br>CURIOUS TRAVELLERS</small></div>
            <div class="passport-title"><span>旅 人 通 行 证</span><h2>Somewhere<br>to begin.</h2><p>每一个故事，都从你开始。</p></div>
            <div class="passport-photo">${corner}${C.portrait('passport-person')}<span class="passport-photo-note">照相馆 · 阿卡姆</span></div>
            <div class="passport-signature"><span>HOLDER’S SIGNATURE</span><strong>${esc(C, state.name)}</strong></div>
            <div class="passport-stamp">准予出发<br><b>1926</b><small>ARKHAM · MASS.</small></div>
          </section>
          <section class="passport-right">
            <div class="passport-page-head"><b>身份登记</b><span>NO. 026—1018</span></div>
            <div class="passport-id-fields">${field(C,state,'name','姓名 / NAME')}${field(C,state,'occupation','身份 / OCCUPATION')}${field(C,state,'age','年龄 / AGE','type="number" min="15" max="90"')}<label class="gd-field"><span>目的地 / DESTINATION</span><strong>阿卡姆，未知之地</strong></label></div>
            <div class="passport-rule"><span>个人特征</span><i></i><span>01 / 04</span></div>
            ${C.traits()}
            <div class="passport-attributes"><div class="passport-small-head"><span>能力登记</span><em>What you carry within.</em></div>${C.compactStats()}</div>
            <div class="passport-resource-strip">${C.resources()}</div>
            <p class="passport-bottom-note">如拾获本证，请寄回密斯卡托尼克大学。<br>此证不保证持有人平安归来。</p>
            <div class="passport-page-no">— 02 —</div>
          </section>
        </div>
        <div class="passport-bottom-grid">
          <section class="passport-ticket">
            <div class="passport-ticket-notch"></div><div class="passport-ticket-top"><span>ONE WAY TICKET</span><b>单程旅途</b><span>✦</span></div>
            <div class="passport-ticket-route"><b>日常</b><span>·····················➜</span><b>未知</b></div>
            <div class="passport-ticket-footer"><span>随身行李 · 3 件</span><span>登车前请检查</span></div>
            ${C.inventory()}
          </section>
          <section class="passport-pocket">
            <div class="passport-pocket-tab">旅途附件</div>
            <details open><summary>01 <b>擅长的事</b><span>SKILLS ↗</span></summary><div class="passport-fold-content">${C.skills()}</div></details>
            <details><summary>02 <b>未寄出的信</b><span>STORY ↗</span></summary><div class="passport-fold-content">${C.story()}</div></details>
            <div class="passport-pocket-actions"><button data-action="roll" class="gd-text-button">掷一枚启程骰 ↗</button><button data-action="export" class="gd-text-button">收好这本旅人证 ↓</button></div>
          </section>
        </div>
      </div>`;
    }
  });

  window.VARIANTS.push({
    id: 9, name: '夜行调查', en: 'AFTER HOURS ARCHIVE', color: '#9b7654',
    desc: '深夜书桌上的一宗未结案卷：暖纸页、物证与线索，把角色信息串成待解的故事。',
    render(C, state) {
      return `<div class="variant variant-9">
        <div class="noir-desk-head"><span class="noir-lamp-dot"></span><span>阿卡姆私人调查事务所</span><span>23:47 / STILL AWAKE</span></div>
        <div class="noir-document-stack">
          <div class="noir-folder-tab">PERSONNEL / 009</div>
          <article class="noir-document">
            <header class="noir-case-header"><div><span class="noir-kicker">密斯卡托尼克 · 机密档案</span><h2>夜色之中，<br><em>谁在叩门？</em></h2></div><div class="noir-case-mark">CASE<br><b>009</b><span>尚未结案</span></div></header>
            <div class="noir-identity-row"><div class="noir-id-col"><div class="noir-handwriting">The investigator.</div>${C.identity()}<p class="noir-id-note">“我记得那条街。只是，地图上从未有过它。”</p></div><div class="noir-polaroid">${C.portrait('noir-person')}<span>${esc(C,state.name)} · 最后记录于河岸街</span><i class="noir-paperclip"></i></div></div>
            <div class="noir-evidence-rule"><span>01</span><b>调查员状态</b><i></i><small>FIELD CONDITION</small></div>
            <div class="noir-stats">${C.compactStats()}${C.resources()}</div>
            <div class="noir-evidence-rule"><span>02</span><b>已知能力</b><i></i><small>WHAT WE KNOW</small></div>
            <div class="noir-skills">${C.skills()}</div>
            <footer class="noir-document-footer"><span>仅供持档人查阅</span><span>ARKHAM RECORDS / 1926</span><b>01</b></footer>
          </article>
          <aside class="noir-evidence-rail">
            <section class="noir-map-evidence"><div class="noir-pin"></div><span class="noir-evidence-number">物证 A—01</span><div class="noir-map-window"><img src="assets/map.png" alt="调查地点的手绘地图"><span class="noir-map-circle"></span></div><div class="noir-map-caption"><strong>那间旧书店</strong><p>第三次经过，门仍然开着。</p></div></section>
            <section class="noir-note"><span class="noir-note-label">TO MYSELF</span><p>别相信灯下<br>没有影子的人。</p><span class="noir-note-underline"></span><small>—— 昨夜的字迹</small></section>
            <section class="noir-evidence-bag"><span class="noir-evidence-number">物证 B—03</span><h3>随身物品</h3>${C.inventory()}<div class="noir-bag-seal">EVIDENCE / DO NOT DISCARD</div></section>
          </aside>
        </div>
        <section class="noir-testimony"><div class="noir-testimony-heading"><span>03 / 本人陈述</span><h3>在一切发生之前</h3><p>有些记忆，最好写在纸上。</p></div><div class="noir-testimony-fields">${C.story()}</div></section>
        <div class="noir-desk-actions"><button data-action="roll" data-skill="侦查" data-value="65">掷骰 · 检查下一条线索 <span>↗</span></button><button data-action="export">封存本卷 ↓</button></div>
      </div>`;
    }
  });

  window.VARIANTS.push({
    id: 10, name: '组件拼装台', en: 'THE CHARACTER ATELIER', color: '#be6546',
    desc: '把身份、属性、技能当作纸片模块：选择、排序，即时拼成你自己的角色卡。',
    render(C, state) {
      const definitions = {
        identity:{ title:'身份名片', en:'IDENTITY', mark:'Aa', content:()=>C.identity(), note:'每段冒险的起点' },
        stats:{ title:'能力属性', en:'ATTRIBUTES', mark:'08', content:()=>C.compactStats(), note:'力量与聪慧的分配' },
        resources:{ title:'生命与理智', en:'CONDITION', mark:'♡', content:()=>C.resources(), note:'旅途中的消耗与恢复' },
        skills:{ title:'技能清单', en:'SKILLS', mark:'✓', content:()=>C.skills(), note:'你擅长解决什么' },
        story:{ title:'背景故事', en:'STORY', mark:'¶', content:()=>C.story(), note:'把名字变成一个人' },
        inventory:{ title:'随身行囊', en:'INVENTORY', mark:'⌑', content:()=>C.inventory(), note:'值得随身带走的东西' },
      };
      const order = Array.isArray(state.moduleOrder) ? state.moduleOrder.filter(key=>definitions[key]) : Object.keys(definitions);
      Object.keys(definitions).forEach(key=>{if(!order.includes(key)) order.push(key);});
      const enabled = key => {
        const source = state.enabledModules ?? state.modules;
        return Array.isArray(source) ? source.includes(key) : source && typeof source==='object' ? source[key] !== false : true;
      };
      const visible = order.filter(enabled);
      return `<div class="variant variant-10">
        <header class="atelier-heading"><div><span class="atelier-kicker">CHARACTER ATELIER / NO. 10</span><h2>一个角色，<br><em>由你拼成。</em></h2></div><div class="atelier-heading-note"><span>✳</span><p>像在桌上摆放纸片一样，<br>搭一张适合你的角色卡。</p></div></header>
        <div class="atelier-workspace">
          <aside class="atelier-library"><div class="atelier-library-head"><h3>组件抽屉</h3><span>06 PIECES</span></div><p class="atelier-library-tip">挑选内容，再调整它们的位置。</p><div class="atelier-module-library">${Object.entries(definitions).map(([key,def])=>`<button class="atelier-module-choice ${enabled(key)?'is-included':''}" data-action="modules" data-module="${key}"><span class="atelier-module-symbol">${def.mark}</span><span><strong>${def.title}</strong><small>${def.note}</small></span><i>${enabled(key)?'✓':'+'}</i></button>`).join('')}</div><button class="atelier-add-module" data-action="modules"><b>＋</b> 编辑卡片组件</button><div class="atelier-desk-note"><span>小提示</span><p>用纸片右上角的箭头排序。<br>输入内容会跟着模块一起移动。</p><i>make it yours.</i></div><div class="atelier-materials"><span>纸张</span><i></i><strong>自然白 · 120g</strong></div></aside>
          <section class="atelier-preview"><div class="atelier-preview-toolbar"><span><i></i> 实时拼装</span><span>${visible.length} 个组件</span><button data-action="export">导出角色卡 ↗</button></div><div class="atelier-preview-sheet"><div class="atelier-sheet-header"><span>✳ 人物档案</span><b>${esc(C,state.name)}</b><small>YOUR NEXT ADVENTURE</small></div><div class="atelier-assembled-modules">${visible.map((key,index)=>{const def=definitions[key];return `<section class="atelier-assembled-module atelier-module-${key}" data-module="${key}"><header><span class="atelier-drag-handle" aria-hidden="true">⠿</span><div><span class="atelier-block-number">${String(index+1).padStart(2,'0')}</span><h3>${def.title}</h3></div><div class="atelier-order-controls"><button data-action="move-module" data-module="${key}" data-direction="up" aria-label="上移${def.title}" ${index===0?'disabled':''}>↑</button><button data-action="move-module" data-module="${key}" data-direction="down" aria-label="下移${def.title}" ${index===visible.length-1?'disabled':''}>↓</button></div></header><div class="atelier-module-content">${def.content()}</div></section>`;}).join('')}</div>${visible.length?'':`<div class="atelier-empty"><span>＋</span><p>从左侧抽屉挑选第一张纸片。</p><button data-action="modules">打开组件抽屉</button></div>`}<div class="atelier-sheet-footer"><span>MADE BY YOU</span><span>每一片，都有故事。</span><span>— 01 —</span></div></div></section>
        </div>
      </div>`;
    }
  });
})();
