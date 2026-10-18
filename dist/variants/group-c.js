(function () {
  const folioTitle = (n, title, note) => `<div class="c-folio-title"><span>${n}</span><h2>${title}</h2>${note ? `<small>${note}</small>` : ''}</div>`;
  const seal = (text) => `<span class="c-seal" aria-hidden="true">${text}</span>`;

  window.VARIANTS.push({
    id: 6,
    name: '秘术折页',
    en: 'THE ARCANA FOLIO',
    desc: '展开一份星象学手稿，在角色、天赋与记忆之间建立联系。',
    color: '#63536d',
    render(C, state) {
      return `<div class="variant variant-6">
        <header class="arcana-heading"><div><span class="arcana-edition">THE SOCIETY OF HIDDEN THINGS</span><h1>秘术折页<span>The Arcana Folio</span></h1></div>${seal('秘\n藏')}</header>
        <div class="arcana-fold">
          <aside class="arcana-wing arcana-left">
            ${folioTitle('I', '天赋之相', 'NATURE & POTENTIAL')}
            <p class="arcana-note">命运没有写定，<br>你仍能修改它的刻度。</p>
            <div class="arcana-stats">${C.stats()}</div>
            <div class="arcana-rule"><span>✧</span></div>
            <h3>身心的容器</h3>
            ${C.resources()}
          </aside>
          <section class="arcana-person">
            <div class="arcana-person-top"><span>INVESTIGATOR</span><span>NO. 027</span></div>
            <div class="arcana-figure">
              <div class="arcana-orbit" aria-hidden="true"><i></i><span class="orbit-n">✧</span><span class="orbit-e">☽</span><span class="orbit-s">✦</span><span class="orbit-w">☉</span></div>
              ${C.portrait('arcana-portrait')}
              <span class="arcana-figure-caption">The seeker of forgotten things</span>
            </div>
            <div class="arcana-identity">${C.identity()}</div>
            <div class="arcana-traits">${C.traits()}</div>
            <button type="button" class="arcana-roll" data-action="roll"><span>✧</span> 问一次命运 <small>掷 D100</small></button>
            <p class="arcana-quote">“每一个答案，都是下一扇门。”</p>
          </section>
          <aside class="arcana-wing arcana-right">
            ${folioTitle('II', '灵魂的注脚', 'MEMORIES & TIES')}
            <div class="arcana-story">${C.story()}</div>
            <details class="arcana-pocket" open><summary>随身秘藏<span>展开 / 收起</span></summary><div>${C.inventory()}</div></details>
            <div class="arcana-handnote">记住那个人的名字，<br>即使星辰已经遗忘。</div>
          </aside>
        </div>
        <section class="arcana-abilities">
          <div class="arcana-ability-title">${folioTitle('III', '已知的技艺', 'PRACTICE MAKES MAGIC')}<button type="button" data-action="modules">调整折页组件 +</button></div>
          ${C.skills()}
        </section>
        <footer class="arcana-footer"><span>以墨为证 · 以记忆为名</span><button type="button" data-action="export">保存这份手稿 ↗</button></footer>
      </div>`;
    }
  });

  window.VARIANTS.push({
    id: 7,
    name: '剪贴手账',
    en: 'A LIFE IN FRAGMENTS',
    desc: '把照片、票据与便笺摊开，让一个角色在生活碎片里慢慢成形。',
    color: '#71816e',
    render(C, state) {
      return `<div class="variant variant-7">
        <header class="scrap-header"><div><span>PERSONAL ARCHIVE · OCTOBER, 1926</span><h1>一些关于<span>${C.escape(state.name || '林雾')}</span>的事。</h1></div><button type="button" class="scrap-clip-button" data-action="modules">+ 添一张纸</button></header>
        <div class="scrap-desk">
          <section class="scrap-photo scrap-paper">
            <div class="scrap-tape" aria-hidden="true"></div>
            <div class="scrap-photo-window">${C.portrait('scrap-portrait')}<span class="scrap-photo-mark">WIND AT THE HARBOUR</span></div>
            <p class="scrap-photo-caption">出发那天，风很大。</p>
            <div class="scrap-identity">${C.identity()}</div>
            <div class="scrap-paperclip" aria-hidden="true"></div>
          </section>
          <section class="scrap-letter scrap-paper">
            <div class="scrap-letter-heading"><span>写给未来的自己</span><span>Dear stranger,</span></div>
            <div class="scrap-letter-body">${C.story()}</div>
            <p class="scrap-signature">愿我们都能找到答案。 <span>Lin</span></p>
          </section>
          <section class="scrap-ticket scrap-paper">
            <div class="scrap-ticket-top"><strong>ONE WAY</strong><span>只去，不回头</span></div>
            <h2>给旅途留些余力</h2>${C.resources()}
            <div class="scrap-ticket-bottom"><span>ARKHAM → UNKNOWN</span><div class="scrap-barcode" aria-hidden="true"></div><span>Nº 002719</span></div>
          </section>
          <section class="scrap-stat-note scrap-paper">
            <div class="scrap-tape" aria-hidden="true"></div><div class="scrap-note-title"><h2>我擅长什么？</h2><span>先记下来，再出发。</span></div>${C.stats()}
          </section>
          <section class="scrap-traits scrap-paper"><h2>别人眼中的我</h2>${C.traits()}<button type="button" data-action="favorite" class="scrap-heart">收藏这个瞬间 ♡</button></section>
          <section class="scrap-skill-sheet scrap-paper"><div class="scrap-skill-heading"><div><span>FIELD EXPERIENCE</span><h2>路上学会的本事</h2></div><button type="button" data-action="roll">试试手气 ↗</button></div>${C.skills()}</section>
          <section class="scrap-pocket scrap-paper"><h2>口袋里的小东西</h2><p>有些东西，舍不得丢。</p>${C.inventory()}<div class="scrap-pocket-stitch" aria-hidden="true"></div></section>
        </div>
        <footer class="scrap-footer"><span>生活不是一张表格，<br>但每一片都值得留下。</span><button type="button" data-action="export">把这一页带走 ↗</button></footer>
      </div>`;
    }
  });

  window.VARIANTS.push({
    id: 8,
    name: '航海日志',
    en: 'THE UNCHARTED JOURNAL',
    desc: '以航海簿的双页展开，将旅途记录与船员档案装订在一起。',
    color: '#355c6a',
    render(C, state) {
      return `<div class="variant variant-8">
        <header class="sea-masthead"><div class="sea-brand"><span class="sea-brand-mark" aria-hidden="true">✦</span><span>THE UNCHARTED<br>JOURNAL</span></div><div><h1>未知海域航行日志</h1><p>不必知道终点，先认得自己。</p></div><span class="sea-book-no">VOL.<b>08</b></span></header>
        <div class="sea-book">
          <section class="sea-left-page">
            <div class="sea-page-heading"><span>VOYAGE RECORD</span><span>01 / 航程记录</span></div>
            <div class="sea-map"><img src="assets/map.png" alt="手绘海岸与群岛航线图" /><div class="sea-map-wash"></div><div class="sea-map-compass" aria-hidden="true"><span>N</span><i></i><span>S</span></div><div class="sea-map-route" aria-hidden="true"></div><span class="sea-map-start">阿卡姆港</span><span class="sea-map-end">雾中群岛</span><span class="sea-map-label">MARE INCOGNITUM</span><span class="sea-map-scale">0 ━━━ 20 海里</span></div>
            <div class="sea-position"><span><small>出航港</small>阿卡姆</span><span><small>目的地</small>未被命名的岛</span><span><small>航向</small>东北 · NE</span></div>
            <div class="sea-log-entry"><span class="sea-day">DAY<br><b>01</b></span><div><h2>启程之前</h2><p>雾气还没散开。你把最后一件行李放上甲板，然后翻开这本日志。</p></div></div>
            <div class="sea-story">${C.story()}</div>
            <details class="sea-cargo" open><summary>船舱物品清单<span>展开 / 收起</span></summary>${C.inventory()}</details>
            <div class="sea-page-number">1 <span>第一章 · 离岸</span></div>
          </section>
          <section class="sea-right-page">
            <div class="sea-page-heading"><span>CREW MANIFEST</span><span>02 / 船员档案</span></div>
            <div class="sea-crew"><div class="sea-portrait">${C.portrait('sea-portrait-image')}<span>PASSENGER 027</span></div><div class="sea-identity">${C.identity()}<span class="sea-approved">准予登船</span></div></div>
            <div class="sea-traits">${C.traits()}</div>
            <div class="sea-attributes"><h2><span>Ⅰ</span> 船员能力</h2>${C.stats()}</div>
            <div class="sea-resources"><h2><span>Ⅱ</span> 当前状况</h2>${C.resources()}</div>
            <div class="sea-training"><div class="sea-training-heading"><h2><span>Ⅲ</span> 专业与经验</h2><button type="button" data-action="roll">航海检定 ↗</button></div>${C.skills()}</div>
            <div class="sea-page-number"><span>记于“晨星”号</span> 2</div>
          </section>
        </div>
        <footer class="sea-footer"><button type="button" data-action="modules">装订其他页签 +</button><span>愿你的每一次出发，都有故事。</span><button type="button" data-action="export">抄录航海日志 ↗</button></footer>
      </div>`;
    }
  });
})();
