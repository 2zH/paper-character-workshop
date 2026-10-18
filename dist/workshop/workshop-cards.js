(() => {
  'use strict';

  const WIDTH = 340;
  const PAPER = 'assets/paper-fiber.png';
  const KNIGHT = 'assets/knight-cutout.png';
  const CHIBI = 'assets/chibi-cutout.png';
  const ATTRIBUTE_COLORS = ['#cbb14c', '#c59f58', '#bb8154', '#b06654', '#a75358', '#914453', '#773c47'];
  const SKILL_COLORS = ['#b78667', '#95a688', '#9faaa8', '#c0a264', '#ad848b', '#9696a3'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const number = (value, fallback = 0, min = 0, max = 100) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback));
  const integer = (value, fallback = 0, min = 0, max = 100) => Math.round(number(value, fallback, min, max));
  const freeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const text = (value, fallback = '') => String(value ?? '').trim() || fallback;
  const toId = value => Array.from(String(value ?? 'paper')).map(char => char.codePointAt(0).toString(16)).join('-');
  const position = (x, y, w, h, height) => `left:${x / WIDTH * 100}%;top:${y / height * 100}%;width:${w / WIDTH * 100}%;height:${h / height * 100}%`;
  const seedOf = value => Array.from(String(value ?? 'paper')).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 19);
  const noise = (index, seed) => {
    const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };

  function numericInk(value, width = 61, height = 26) {
    const label = String(value);
    const fitted = label.length > 6 ? ` textLength="${width - 2}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<svg class="piece-numeric-ink" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}"><text x="${width - 1}" y="${height * .69}" text-anchor="end"${fitted}>${esc(label)}</text></svg>`;
  }

  function roughRect(x, y, width, height, seed, roughness = .72) {
    const points = [];
    for (let side = 0; side < 4; side++) {
      const count = Math.max(4, Math.floor((side % 2 ? height : width) / 10));
      for (let index = 0; index <= count; index++) {
        const t = index / count;
        const deviation = (noise(index + side * 101, seed) - .5) * roughness * 2;
        points.push(side === 0 ? [x + t * width, y + deviation] : side === 1 ? [x + width + deviation, y + t * height] : side === 2 ? [x + (1 - t) * width, y + height + deviation] : [x + deviation, y + (1 - t) * height]);
      }
    }
    return `M${points.map(point => point.map(value => value.toFixed(2)).join(' ')).join(' L')} Z`;
  }

  function punch(x, y, radius, seed) {
    return `M${Array.from({length: 12}, (_, index) => {
      const angle = index * Math.PI / 6;
      const grain = (noise(index, seed) - .5) * .7;
      return `${(x + Math.cos(angle) * (radius + grain)).toFixed(2)} ${(y + Math.sin(angle) * (radius * .94 + grain)).toFixed(2)}`;
    }).join(' L')} Z`;
  }

  function frame(module, height, holes = [], decoration = '', suffix = '') {
    const prefix = `piece-${toId(module.id)}-${suffix}`;
    const seed = seedOf(module.id);
    const outer = roughRect(4, 4, WIDTH - 8, height - 10, seed, 1.12);
    const edges = holes.map((path, index) => `<path d="${path}" fill="none" stroke="#faf1db" stroke-width="1.2" transform="translate(.4,.7)" opacity=".9"/><path d="${path}" fill="none" stroke="#84745b" stroke-width=".8" transform="translate(-.4,-.3)" opacity=".6"/><path d="${path}" fill="none" stroke="#4b4437" stroke-width="${index > 14 ? .6 : .95}" stroke-dasharray="83 .7 141 1.2 43 .5" opacity=".7"/>`).join('');
    const fibers = Array.from({length: 28}, (_, index) => {
      const side = index % 4;
      const along = noise(index + 41, seed);
      const x = side === 0 ? 4 + along * 332 : side === 1 ? 336 : side === 2 ? 336 - along * 332 : 4;
      const y = side === 0 ? 4 : side === 1 ? 4 + along * (height - 10) : side === 2 ? height - 6 : 4 + along * (height - 10);
      return `<path d="M${x.toFixed(2)} ${y.toFixed(2)}l${side === 1 ? '1.6' : side === 3 ? '-1.6' : '.7'} ${side === 0 ? '-1.6' : side === 2 ? '1.6' : '.6'}" stroke="#e5dac1" stroke-width=".55" opacity=".7"/>`;
    }).join('');
    return `<svg class="piece-top-sheet" viewBox="0 0 ${WIDTH} ${height}" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="${prefix}-fiber" width="${WIDTH}" height="${WIDTH}" patternUnits="userSpaceOnUse"><image href="${PAPER}" width="${WIDTH}" height="${WIDTH}" preserveAspectRatio="xMidYMid slice"/></pattern><mask id="${prefix}-mask"><path d="${outer}" fill="white"/>${holes.map(path => `<path d="${path}" fill="black"/>`).join('')}</mask><filter id="${prefix}-edge" x="-10%" y="-10%" width="125%" height="125%"><feDropShadow dx=".4" dy=".8" stdDeviation=".15" flood-color="#f4e9cd" flood-opacity=".95"/><feDropShadow dx=".5" dy="1.5" stdDeviation=".3" flood-color="#9e8b68" flood-opacity=".65"/><feDropShadow dx="1.3" dy="2.5" stdDeviation="1" flood-color="#3d2e1c" flood-opacity=".29"/></filter><linearGradient id="${prefix}-light" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffaf0" stop-opacity=".14"/><stop offset=".55" stop-color="#fffaf0" stop-opacity="0"/><stop offset="1" stop-color="#a3916c" stop-opacity=".08"/></linearGradient></defs><g filter="url(#${prefix}-edge)"><g mask="url(#${prefix}-mask)"><path d="${outer}" fill="#eee4cc"/><path d="${outer}" fill="url(#${prefix}-fiber)"/><path d="${outer}" fill="#f9f2de" opacity=".3"/><path d="${outer}" fill="url(#${prefix}-light)"/><path d="${outer}" fill="none" stroke="#ab9b7e" stroke-width=".7" opacity=".4"/></g></g>${edges}${fibers}<g fill="none" stroke="#61543f" stroke-width=".9" opacity=".63">${decoration}</g></svg>`;
  }

  function base(module, height, type, underpainting, paper, ink, options) {
    return `<div class="piece-render piece-${type}${options.selected ? ' piece-is-selected' : ''}${options.stepActive ? ' piece-step-active' : ''}" style="--piece-ratio:${WIDTH}/${height};--piece-height:${height}" data-paper-kind="${esc(type)}"><div class="piece-backing"></div><div class="piece-underpainting">${underpainting}</div>${paper}<div class="piece-ink">${ink}</div></div>`;
  }

  function identity(module, options) {
    const data = module.data || {};
    const height = 418;
    const seed = seedOf(module.id);
    const portrait = data.portrait === CHIBI ? CHIBI : KNIGHT;
    const windowPath = 'M25 115 L70 115 Q79 115 81 105 L201 105 L205 110 L205 336 L190 337 Q181 337 180 349 L25 350 L23 337 Z';
    const badge = punch(266, 114, 23, seed);
    const detail = text(data.appearance, '把初见时的模样，写在这里。');
    const under = `<div class="piece-portrait-wash" style="${position(22, 104, 184, 250, height)}"></div><img class="piece-portrait" src="${portrait}" alt="手绘红发剑盾骑士" style="${position(28, 106, 172, 240, height)}"><div class="piece-level-paint" style="${position(242, 91, 49, 49, height)}">♢</div>`;
    const decoration = '<path d="M26 81 Q153 82 310 80 M27 368L108 370 M114 370l4-4l4 4l-4 4Z M128 370l180-1 M224 157l84 1 M223 224l86-1 M224 287l85 2"/><path d="M40 130l-3 8l-7 1l7 4l2 8l3-8l7-3l-7-2Z M187 130l-2 5l-5 2l5 1l2 6l2-6l4-1l-4-2Z" opacity=".42"/>';
    const ink = `<div class="piece-eyebrow" style="${position(27, 22, 200, 16, height)}">CHARACTER / 身份</div><div class="piece-character-name" title="${esc(data.name)}" style="${position(26, 44, 282, 34, height)}">${esc(text(data.name, '尚未署名的旅人'))}</div><div class="piece-level-label" style="${position(229, 144, 80, 25, height)}">LV. <b>${String(integer(data.level, 1, 1, 99)).padStart(2, '0')}</b></div><div class="piece-identity-detail" style="${position(223, 180, 88, 44, height)}"><small>年 龄</small><span>${data.age !== null && data.age !== undefined && data.age !== '' ? `${esc(integer(data.age, 0, 0, 999))} 岁` : '待填写'}</span></div><div class="piece-identity-detail" style="${position(223, 242, 88, 72, height)}"><small>职 业</small><span title="${esc(data.occupation)}">${esc(text(data.occupation, '尚未选择'))}</span></div><div class="piece-portrait-caption" style="${position(36, 351, 158, 15, height)}">a little paper adventurer</div><div class="piece-appearance" title="${esc(detail)}" style="${position(29, 382, 281, 24, height)}">${esc(detail)}</div>`;
    return base(module, height, 'identity', under, frame(module, height, [windowPath, badge], decoration), ink, options);
  }

  function attributes(module, options) {
    const data = module.data || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const height = Math.max(212, 124 + items.length * 39);
    const seed = seedOf(module.id);
    const scaleMax = items.reduce((maximum, item) => Math.max(maximum, freeNumber(item.value)), 7);
    const holes = [];
    let under = '';
    let rows = '';
    items.forEach((item, index) => {
      const value = freeNumber(item.value);
      const filled = Math.ceil(Math.max(0, value) / scaleMax * 7);
      const y = 86 + index * 39;
      let controls = '';
      for (let dot = 0; dot < 7; dot++) {
        const x = 133 + dot * 18;
        const setValue = Number(((dot + 1) / 7 * scaleMax).toFixed(2));
        holes.push(punch(x, y, 5.15, seed + index * 31 + dot));
        under += `<i class="piece-dot-paint" style="${position(x - 7, y - 7, 14, 14, height)};--piece-pigment:${dot < filled ? ATTRIBUTE_COLORS[dot] : '#d8ceb5'}"></i>`;
        controls += `<button type="button" class="piece-dot-hit" data-card-action="set-attribute" data-index="${index}" data-value="${setValue}" aria-label="${esc(text(item.name, item.key))} 设为${setValue}" aria-pressed="${value === setValue}" style="${position(x - 9, y - 13, 18, 26, height)}"></button>`;
      }
      rows += `<div class="piece-attribute-label" style="${position(28, y - 13, 91, 28, height)}"><b>${esc(text(item.key, `A${index + 1}`))}</b><span>${esc(item.name)}</span></div>${controls}<span class="piece-attribute-value" title="${esc(value)}" style="${position(254, y - 13, 61, 26, height)}">${numericInk(value)}</span>`;
    });
    const tailY = height - 53;
    const decoration = `<path d="M27 54q135 2 282-1 M29 ${tailY - 8}l280 1"/><path d="M30 ${tailY + 8}l5-6l6 6l-6 7Z M45 ${tailY + 8}l26-1 M273 ${tailY + 8}l29 1"/>`;
    const ink = `<div class="piece-eyebrow" style="${position(28, 23, 250, 20, height)}">ATTRIBUTES / 属性</div>${rows}${items.length ? '' : `<p class="piece-empty" style="${position(30, 85, 280, 45, height)}">添加一项属性，打下第一排纸孔。</p>`}<div class="piece-attribute-total" style="${position(61, tailY - 3, 222, 22, height)}">${items.length} 项属性${data.rules?.enabled ? '<span class="piece-rules-note"> · 规则已启用</span>' : ''}</div><p class="piece-footnote" style="${position(30, height - 25, 280, 15, height)}">纸孔为相对刻度 · 数字为实际值</p>`;
    return base(module, height, 'attributes', under, frame(module, height, holes, decoration), ink, options);
  }

  function skills(module, options) {
    const data = module.data || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const height = Math.max(190, 88 + items.length * 66);
    const seed = seedOf(module.id);
    const scaleMax = items.reduce((maximum, item) => Math.max(maximum, freeNumber(item.value)), 100);
    const holes = [];
    let under = '';
    let rows = '';
    let ticks = '';
    items.forEach((item, index) => {
      const value = freeNumber(item.value);
      const fillPercent = Math.max(0, value) / scaleMax * 100;
      const y = 75 + index * 66;
      holes.push(roughRect(29, y + 13, 279, 11, seed + index, .65));
      under += `<div class="piece-skill-paint" style="${position(27, y + 11, 284, 16, height)};--piece-pigment:${SKILL_COLORS[index % SKILL_COLORS.length]}"><span style="width:${fillPercent}%"></span></div>`;
      ticks += Array.from({length: 11}, (_, tick) => `<path d="M${30 + tick * 27.7} ${y + 27}v${tick % 5 === 0 ? 4 : 2}" opacity="${tick % 5 === 0 ? '.8' : '.5'}"/>`).join('');
      rows += `<span class="piece-skill-name" title="${esc(item.name)}" style="${position(30, y - 12, 190, 22, height)}">${esc(text(item.name, '未命名技能'))}</span><span class="piece-skill-value" title="${esc(value)}" style="${position(223, y - 17, 86, 30, height)}">${numericInk(value, 86, 30)}</span>`;
    });
    const decoration = `<path d="M27 52q145 2 283-1"/>${ticks}`;
    const ink = `<div class="piece-eyebrow" style="${position(28, 23, 220, 18, height)}">SKILLS / 技能</div><span class="piece-corner-note" style="${position(231, 24, 77, 17, height)}">${items.length} 项技能</span>${rows}${items.length ? '' : `<p class="piece-empty" style="${position(30, 85, 280, 50, height)}">每一条纸带，记着一项本领。<br>从右侧添加第一项技能。</p>`}<span class="piece-footnote" style="${position(30, height - 22, 280, 14, height)}">自由数值 · 色带为相对刻度${data.rules?.enabled ? '<span class="piece-rules-note"> · 规则已启用</span>' : ''}</span>`;
    return base(module, height, 'skills', under, frame(module, height, holes, decoration), ink, options);
  }

  function bagDrawing() {
    return '<svg class="piece-bag-drawing" viewBox="0 0 80 80" aria-hidden="true"><path d="M27 27Q24 12 40 13Q56 13 54 28M24 27L58 28L63 65Q42 71 18 64Z" fill="#a98b5b33" stroke="#695641" stroke-width="1.6"/><path d="M21 31Q40 42 59 32L57 46Q42 54 23 44ZM32 49L47 49L46 62L32 63Z" fill="#c1a46e44" stroke="#695641" stroke-width="1.2"/><path d="M28 29l1 35M53 30l1 35M38 38v12M36 39h5v7h-5Z" fill="none" stroke="#695641" stroke-width="1.3"/><path d="M18 66l43 1M27 24q11-12 24 1" fill="none" stroke="#695641" stroke-width=".55" opacity=".5"/></svg>';
  }

  function equipment(module, options) {
    const data = module.data || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const rowCount = Math.ceil(items.length / 3);
    const height = Math.max(200, 83 + rowCount * 136);
    const seed = seedOf(module.id);
    const holes = [];
    let under = '';
    let tiles = '';
    items.forEach((item, index) => {
      const x = 25 + index % 3 * 100;
      const y = 68 + Math.floor(index / 3) * 136;
      const equipped = item.equipped !== false;
      const asset = Number.isInteger(item.assetIndex) && item.assetIndex >= 0 && item.assetIndex < 6 ? item.assetIndex : null;
      holes.push(roughRect(x, y, 88, 83, seed + index, 1.0));
      const image = asset === null ? bagDrawing() : `<div class="piece-gear-sprite" style="--piece-col:${asset % 3};--piece-row:${Math.floor(asset / 3)}"></div>`;
      under += `<div class="piece-equipment-paint${equipped ? '' : ' piece-equipment-stowed'}" style="${position(x - 1, y - 1, 90, 85, height)};--piece-pigment:${['#d9c48a', '#b6c7c3', '#bdc39e'][index % 3]}">${image}</div>`;
      tiles += `<button class="piece-equipment-hit" type="button" data-card-action="toggle-equipment" data-index="${index}" aria-label="${equipped ? '收起' : '装备'}${esc(text(item.name, '物品'))}" aria-pressed="${equipped}" title="${esc(text(item.detail, item.name))}" style="${position(x - 3, y - 3, 94, 123, height)}"><span class="piece-equipment-status">${equipped ? '✦' : '·'}</span><span class="piece-equipment-name">${esc(text(item.name, '未命名物品'))}</span><span class="piece-equipment-quantity">× ${esc(number(item.quantity, 1, 0, 9999))}<i>${equipped ? '随身' : '收起'}</i></span></button>`;
    });
    const totalWeight = items.reduce((sum, item) => sum + number(item.weight, 0, 0, 9999) * number(item.quantity, 1, 0, 9999), 0);
    const decoration = '<path d="M27 51l282 1 M137 33l4-5l6 5l-6 5Z"/>';
    const ink = `<div class="piece-eyebrow" style="${position(28, 23, 210, 20, height)}">GEAR / 装备</div><span class="piece-corner-note" style="${position(224, 24, 87, 18, height)}">${Number(totalWeight.toFixed(1))} kg</span>${tiles}${items.length ? '' : `<p class="piece-empty" style="${position(30, 85, 280, 50, height)}">空着的行囊，等你装入第一件物品。</p>`}<span class="piece-footnote" style="${position(30, height - 23, 280, 14, height)}">轻触物品，在随身与收起之间切换</span>`;
    return base(module, height, 'equipment', under, frame(module, height, holes, decoration), ink, options);
  }

  function background(module, options) {
    const data = module.data || {};
    const fields = Array.isArray(data.fields) ? data.fields : [];
    const estimatedHeight = Math.max(285, 132 + fields.reduce((sum, field) => sum + 46 + Math.max(1, Math.ceil(text(field.value).length / 19)) * 23, 0));
    const lines = fields.map((field, index) => `<section class="piece-story-field"><h4><small>${String(index + 1).padStart(2, '0')}</small>${esc(text(field.label, '一段往事'))}</h4><p${text(field.value) ? '' : ' class="piece-unwritten"'}>${esc(text(field.value, '这一页，等你写下。'))}</p></section>`).join('');
    const decoration = `<path d="M28 62q143 2 280 0 M23 17v${estimatedHeight - 34}" stroke-dasharray="1 4" opacity=".45"/><path d="M283 22l3 9l9 1l-8 5l2 9l-8-5l-8 6l3-10l-8-5l10-1Z" stroke-width="1.05"/>`;
    const bindingHoles = [90, 143, 196].filter(y => y < estimatedHeight - 35).map((y, index) => punch(13, y, 2.8, seedOf(module.id) + index));
    const paper = frame(module, estimatedHeight, bindingHoles, decoration);
    return `<div class="piece-render piece-background${options.selected ? ' piece-is-selected' : ''}${options.stepActive ? ' piece-step-active' : ''}" data-paper-kind="background"><div class="piece-backing"></div>${paper}<div class="piece-story-ink"><div class="piece-story-heading"><span class="piece-eyebrow">STORIES / 背景</span><span class="piece-story-small">我的来处</span></div>${lines || '<p class="piece-empty piece-story-empty">你从哪里来，又将走向哪里？<br>添加一个背景条目，留下第一笔。</p>'}<div class="piece-story-signature"><span>to be continued</span><i>✧</i></div></div></div>`;
  }

  const renderers = {identity, attributes, skills, equipment, background};
  function render(module, {selected = false, stepActive = false} = {}) {
    if (!module || !renderers[module.type]) return '<div class="piece-unsupported">未知纸片组件</div>';
    return renderers[module.type](module, {selected, stepActive});
  }

  window.WorkshopCards = Object.freeze({render});
})();
