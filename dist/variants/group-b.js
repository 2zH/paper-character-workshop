/* Three paper-adventure compositions; shared controls are delegated by app.js. */
(function () {
  const leaf = '<span class="b-specimen" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>';
  window.VARIANTS.push({
    id: 3,
    name: '森林采集簿',
    en: 'THE HERBARIUM',
    desc: '把观察、天赋与随身物，收进一本染着草木气息的野外手记。',
    color: '#657449',
    render(C, state) {
      return `<div class="variant variant-3">
        <div class="b-herb-top"><span>THE TRAVELLER’S HERBARIUM</span><span>野外手记 · 秋</span></div>
        <div class="b-herb-book">
          <section class="b-herb-left">
            <div class="b-herb-chapter"><span>FIELD NOTES</span><span>No. 03</span></div>
            <h1>森林采集簿<span>在路上，认识自己。</span></h1>
            <div class="b-herb-portrait">${C.portrait('herb-portrait')}<div class="b-pressed-flower">${leaf}<span>银叶蕨<br><i>来自迷雾森林</i></span></div></div>
            <div class="b-herb-name"><span>这本手记属于</span><strong>${C.escape(state.name)}</strong><i>一个仍在寻找的人</i></div>
            <div class="b-herb-identity">${C.identity()}</div>
            <details class="b-herb-observation"><summary>观察笔记 <span>展开故事</span></summary>${C.story()}</details>
          </section>
          <section class="b-herb-right">
            <div class="b-herb-ribbon" aria-hidden="true">HERBARIUM</div>
            <header class="b-herb-heading"><span>第一张标本 · 天赋</span><h2>生长的方向</h2><p>每一种天赋，都有它发芽的时节。</p></header>
            <div class="b-herb-stats">${C.stats()}</div>
            <div class="b-herb-traits"><div class="b-herb-caption">性情观察</div>${C.traits()}</div>
            <div class="b-herb-resources"><div class="b-herb-caption">今日状态</div>${C.resources()}</div>
            <div class="b-herb-skills"><details open><summary>第二张标本 · 旅人的技艺</summary>${C.skills()}</details></div>
            <footer class="b-herb-footer"><span>愿你总能找到回家的路。</span><button type="button" data-action="export" class="b-herb-save">收好这本手记 ↗</button></footer>
          </section>
        </div>
        <div class="b-herb-bottom">${C.inventory()}<span class="b-herb-page">散步的人，并不总是迷路。<br><b>— 03 —</b></span></div>
      </div>`;
    }
  });
  window.VARIANTS.push({
    id: 4,
    name: '旅途地图',
    en: 'A MAP OF BECOMING',
    desc: '沿着四座驿站，把身份、天赋、技艺与故事连接成自己的旅程。',
    color: '#6e817b',
    render(C, state) {
      return `<div class="variant variant-4">
        <header class="b-map-header"><div><span>THE ROAD IS YOUR STORY</span><h1>下一站，成为你。</h1><p>展开地图，为即将出发的旅人写下第一笔。</p></div><div class="b-map-pass"><span>旅人通行证</span><strong>${C.escape(state.name)}</strong><small>迷雾森林 → 月光港</small></div></header>
        <div class="b-map-workspace">
          <section class="b-map-sheet" aria-label="车卡旅程地图">
            <div class="b-map-image" aria-hidden="true"></div>
            <div class="b-map-title">The Mistlands<i>旅途始于一张白纸</i></div>
            <div class="b-map-compass" aria-hidden="true"><span>N</span><i></i><b>W &nbsp; ✧ &nbsp; E</b><span>S</span></div>
            <div class="b-map-route" aria-hidden="true"><i></i><i></i><i></i></div>
            <button type="button" class="b-map-node b-node-identity" data-action="journey" data-step="identity" aria-pressed="true"><span>01</span><strong>启程之地</strong><small>我是谁</small></button>
            <button type="button" class="b-map-node b-node-stats" data-action="journey" data-step="stats" aria-pressed="false"><span>02</span><strong>风语山丘</strong><small>我的天赋</small></button>
            <button type="button" class="b-map-node b-node-skills" data-action="journey" data-step="skills" aria-pressed="false"><span>03</span><strong>旅人工会</strong><small>我的技艺</small></button>
            <button type="button" class="b-map-node b-node-story" data-action="journey" data-step="story" aria-pressed="false"><span>04</span><strong>月光港</strong><small>我的故事</small></button>
            <div class="b-map-scale"><span></span><small>0 &nbsp; &nbsp; 10 &nbsp; &nbsp; 20 里</small></div>
            <div class="b-map-note">点亮地图上的驿站，<br>收集你的冒险轮廓。</div>
          </section>
          <aside class="b-map-panel">
            <div class="b-map-panel-top"><span>TRAVELLER’S LOG</span><span>旅程手札</span></div>
            <div data-journey-panel="identity"><header class="b-map-panel-heading"><small>第一站 / 启程之地</small><h2>给旅人一个名字</h2><p>在故事开始之前，先留下你的模样。</p></header><div class="b-map-identity-portrait">${C.portrait('map-portrait')}</div>${C.identity()}${C.traits()}<button type="button" class="b-map-next" data-action="journey" data-step="stats">走向风语山丘 <span>→</span></button></div>
            <div data-journey-panel="stats" hidden><header class="b-map-panel-heading"><small>第二站 / 风语山丘</small><h2>风记得你的天赋</h2><p>你将凭借什么，走过未知的路？</p></header>${C.stats()}${C.resources()}<button type="button" class="b-map-next" data-action="journey" data-step="skills">拜访旅人工会 <span>→</span></button></div>
            <div data-journey-panel="skills" hidden><header class="b-map-panel-heading"><small>第三站 / 旅人工会</small><h2>把本领装进行囊</h2><p>有些技艺来自书本，有些来自旅途。</p></header>${C.skills()}${C.inventory()}<button type="button" class="b-map-next" data-action="journey" data-step="story">前往月光港 <span>→</span></button></div>
            <div data-journey-panel="story" hidden><header class="b-map-panel-heading"><small>第四站 / 月光港</small><h2>你的故事，由此启航</h2><p>那些牵挂的人与事，会陪你走得更远。</p></header>${C.story()}<button type="button" class="b-map-next" data-action="export">带着故事出发 <span>↗</span></button></div>
          </aside>
        </div>
        <footer class="b-map-footer"><span>每一个选择，都是地图上新的足迹。</span><button type="button" data-action="modules">整理我的旅程组件 ↗</button></footer>
      </div>`;
    }
  });
  window.VARIANTS.push({
    id: 5,
    name: '工会登记册',
    en: 'THE GUILD REGISTER',
    desc: '证件、数值和职业技能整齐归档，在红色印章下签下冒险者的名字。',
    color: '#a34f3e',
    render(C, state) {
      return `<div class="variant variant-5">
        <div class="b-guild-tabs"><span class="active">个人登记</span><button type="button" data-action="modules">附件与组件</button><span>档案编号 1924—027</span></div>
        <article class="b-guild-document">
          <header class="b-guild-header"><div class="b-guild-mark" aria-hidden="true">G<span>旅人工会</span></div><div><span>THE TRAVELLERS’ GUILD</span><h1>冒险者登记档案</h1><p>个人信息及职业能力登记表</p></div><div class="b-guild-stamp">登记受理<br><b>APPROVED</b><small>东境旅人工会</small></div></header>
          <div class="b-guild-line"><span>登记类别：独立调查员</span><span>所属地区：阿卡姆</span><span>登记日期：1924.10.18</span></div>
          <section class="b-guild-person"><div class="b-guild-photo">${C.portrait('guild-portrait')}<span>持证人肖像</span></div><div class="b-guild-details"><h2><span>甲</span> 身份资料 <small>PERSONAL PARTICULARS</small></h2>${C.identity()}<div class="b-guild-traits">${C.traits()}</div></div><div class="b-guild-permit"><span>持证人签名</span><strong>${C.escape(state.name)}</strong><i>本人确认以上信息属实</i><button type="button" data-action="export">领取冒险者证件 ↗</button></div></section>
          <section class="b-guild-stat-section"><h2><span>乙</span> 基础能力评估 <small>ABILITY ASSESSMENT</small></h2><div class="b-guild-stats">${C.stats()}</div></section>
          <div class="b-guild-lower"><section class="b-guild-skills"><h2><span>丙</span> 职业技能登记 <small>PROFESSIONAL SKILLS</small></h2>${C.skills()}</section><section class="b-guild-status"><h2><span>丁</span> 健康与随身物 <small>CONDITION & EFFECTS</small></h2>${C.resources()}${C.inventory()}</section></div>
          <details class="b-guild-addendum"><summary>戊　个人经历及关系人附页 <span>展开填写 +</span></summary>${C.story()}</details>
          <footer class="b-guild-footer"><span>请妥善保管本档案。愿你的下一次出发，平安归来。</span><span>登记员：<i>Margaret</i></span><b>01 / 01</b></footer>
        </article>
      </div>`;
    }
  });
})();
