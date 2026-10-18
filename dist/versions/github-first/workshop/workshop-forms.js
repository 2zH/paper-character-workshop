(function () {
  'use strict';

  const escape = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const itemsOf = (value) => Array.isArray(value) ? value : [];
  const format = (value) => Number.isInteger(value) ? String(value) : value.toFixed(1);

  function input(label, path, value, options = {}) {
    const type = options.type || 'text';
    const rules = type === 'number'
      ? options.freeNumber
        ? ' step="any" inputmode="decimal"'
        : ` min="${options.min ?? 0}" max="${options.max ?? 9999}" step="${options.step ?? 1}" inputmode="${options.step && options.step < 1 ? 'decimal' : 'numeric'}"`
      : ` maxlength="${options.maxlength || 80}"`;
    return `<label class="field-label${options.className ? ` ${escape(options.className)}` : ''}"><span>${escape(label)}${options.required ? ' <span class="field-required" aria-hidden="true">*</span>' : ''}</span><input class="field-input" type="${type}" data-path="${escape(path)}" value="${escape(value)}"${rules}${options.required ? ' required aria-required="true"' : ''}${options.disabled ? ' disabled' : ''}${options.nullable ? ' data-nullable' : ''}${options.placeholder ? ` placeholder="${escape(options.placeholder)}"` : ''}${options.helpId ? ` aria-describedby="${escape(options.helpId)}"` : ''}></label>`;
  }

  function textarea(label, path, value, options = {}) {
    return `<label class="field-label field-wide"><span>${escape(label)}</span><textarea class="field-textarea" data-path="${escape(path)}" rows="${options.rows || 4}" maxlength="${options.maxlength || 2000}"${options.placeholder ? ` placeholder="${escape(options.placeholder)}"` : ''}>${escape(value)}</textarea></label>`;
  }

  function action(label, name, index, options = {}) {
    return `<button class="${options.remove ? 'form-remove' : 'form-add'}" type="button" data-form-action="${escape(name)}"${index == null ? '' : ` data-index="${index}"`}${options.aria ? ` aria-label="${escape(options.aria)}"` : ''}>${escape(label)}</button>`;
  }

  function empty(text) {
    return `<p class="editor-empty">${escape(text)}</p>`;
  }

  function ruleSettings(module, id) {
    const data = module.data;
    const rules = data.rules && typeof data.rules === 'object' ? data.rules : {};
    const enabled = rules.enabled === true;
    const total = itemsOf(data.items).reduce((result, item) => result + finite(item.value), 0);
    const hasBudget = data.budget != null && data.budget !== '';
    const remaining = hasBudget ? finite(data.budget) - total : null;
    const status = hasBudget
      ? `合计 ${total} / ${data.budget} · ${remaining < 0 ? `超出 ${-remaining}` : `剩余 ${remaining}`}`
      : `合计 ${total} · 总额不限`;
    const limits = `最小值 ${rules.min == null || rules.min === '' ? '不限' : rules.min} · 最大值 ${rules.max == null || rules.max === '' ? '不限' : rules.max} · ${rules.integer ? '仅允许整数' : '允许小数'}`;
    const state = hasBudget && remaining < 0 ? 'over' : hasBudget && remaining === 0 ? 'complete' : 'remaining';
    const numberOptions = { type: 'number', freeNumber: true, nullable: true, disabled: !enabled, placeholder: '留空表示不限' };
    return `<details class="editor-rules"><summary>规则校验 · ${enabled ? '已开启' : '未开启'}</summary><div class="editor-rule-controls"><label class="field-check"><input type="checkbox" data-path="data.rules.enabled"${enabled ? ' checked' : ''}><span>启用本组件规则校验</span></label><p class="field-hint" id="${id}-rules-help">填写值不会被自动截断；开启后在检查装订时校验。</p><div class="form-grid">${input('总额 · 留空不限', 'data.budget', data.budget, numberOptions)}${input('最小值 · 留空不限', 'data.rules.min', rules.min, numberOptions)}${input('最大值 · 留空不限', 'data.rules.max', rules.max, numberOptions)}</div><label class="field-check"><input type="checkbox" data-path="data.rules.integer"${rules.integer ? ' checked' : ''}${enabled ? '' : ' disabled'}><span>只允许整数</span></label>${enabled ? `<p class="editor-budget-status" data-budget-state="${state}" role="status" aria-live="polite">${escape(status)}<br>${escape(limits)}</p>` : ''}<div class="editor-rule-feedback" role="status" aria-live="polite"></div></div></details>`;
  }

  function identity(module, id) {
    const data = module.data;
    return `<p class="editor-intro">从姓名开始，写下角色的第一印象。</p><div class="form-grid">${input('角色姓名', 'data.name', data.name, { required: true, maxlength: 60, className: 'field-wide', placeholder: '这张角色卡属于谁？', helpId: `${id}-name-help` })}<p class="field-hint field-wide" id="${id}-name-help">姓名是完成角色卡的必填项。</p>${input('年龄', 'data.age', data.age, { type: 'number', min: 0, max: 999 })}${input('等级', 'data.level', data.level, { type: 'number', min: 1, max: 99 })}${input('职业 / 身份', 'data.occupation', data.occupation, { maxlength: 80, className: 'field-wide', placeholder: '例如：古物学者、流浪骑士' })}${textarea('外貌与第一印象', 'data.appearance', data.appearance, { rows: 4, maxlength: 1200, placeholder: '衣着、神态，或一处让人记住的细节。' })}</div>`;
  }

  function attributes(module) {
    const items = itemsOf(module.data.items);
    return `<p class="editor-intro">默认自由填写；完整数字会保留，纸孔仅作相对刻度参考。</p><div class="editor-items">${items.length ? items.map((item, index) => `<fieldset class="editor-item editor-attribute"><legend class="editor-item-legend">属性 ${index + 1}</legend><div class="form-row">${input('缩写', `data.items.${index}.key`, item.key, { maxlength: 16, className: 'field-short' })}${input('属性名称', `data.items.${index}.name`, item.name, { maxlength: 40 })}</div><div class="form-row form-item-footer">${input('属性值', `data.items.${index}.value`, item.value, { type: 'number', freeNumber: true })}${action('移除', 'remove-attribute', index, { remove: true, aria: `移除属性 ${item.name || index + 1}` })}</div></fieldset>`).join('') : empty('还没有属性。添加一项，让纸卡开始生长。')}</div>${action('＋ 添加属性', 'add-attribute')}`;
  }

  function skills(module) {
    const items = itemsOf(module.data.items);
    return `<p class="editor-intro">默认自由填写技能数值；可在下方选择规则校验。</p><div class="editor-items">${items.length ? items.map((item, index) => `<fieldset class="editor-item editor-skill"><legend class="editor-item-legend">技能 ${index + 1}</legend><div class="form-row">${input('技能名称', `data.items.${index}.name`, item.name, { maxlength: 60 })}${input('技能值', `data.items.${index}.value`, item.value, { type: 'number', freeNumber: true })}</div><div class="form-row form-item-footer">${action('移除', 'remove-skill', index, { remove: true, aria: `移除技能 ${item.name || index + 1}` })}</div></fieldset>`).join('') : empty('还没有技能。写下角色最拿手的本领。')}</div>${action('＋ 添加技能', 'add-skill')}`;
  }

  function equipment(module) {
    const items = itemsOf(module.data.items);
    const weight = items.reduce((total, item) => total + finite(item.quantity) * finite(item.weight), 0);
    const count = items.reduce((total, item) => total + finite(item.quantity), 0);
    return `<p class="editor-intro">记录随身物品，勾选正在使用的装备。</p><p class="editor-summary" role="status" aria-live="polite">共 ${format(count)} 件 · 总重 ${format(weight)} kg</p><div class="editor-items">${items.length ? items.map((item, index) => `<fieldset class="editor-item editor-equipment"><legend class="editor-item-legend">装备 ${index + 1}</legend>${input('装备名称', `data.items.${index}.name`, item.name, { maxlength: 80 })}<div class="form-row">${input('数量', `data.items.${index}.quantity`, item.quantity, { type: 'number', min: 0, max: 999 })}${input('单件重量 · kg', `data.items.${index}.weight`, item.weight, { type: 'number', min: 0, max: 9999, step: 0.1 })}</div>${textarea('物品说明', `data.items.${index}.detail`, item.detail, { rows: 2, maxlength: 700, placeholder: '用途、来历，或附带的特殊效果。' })}<div class="form-row form-item-footer"><label class="field-check"><input type="checkbox" data-path="data.items.${index}.equipped"${item.equipped ? ' checked' : ''}><span>已装配</span></label>${action('移除', 'remove-equipment', index, { remove: true, aria: `移除装备 ${item.name || index + 1}` })}</div></fieldset>`).join('') : empty('行囊还是空的。添加第一件随身物品。')}</div>${action('＋ 添加装备', 'add-equipment')}`;
  }

  function background(module) {
    const fields = itemsOf(module.data.fields);
    return `<p class="editor-intro">把来历、牵挂与心愿写成故事片段。</p><div class="editor-items">${fields.length ? fields.map((field, index) => `<fieldset class="editor-item editor-background"><legend class="editor-item-legend">故事片段 ${index + 1}</legend>${input('片段标题', `data.fields.${index}.label`, field.label, { maxlength: 60, placeholder: '例如：重要之人、秘密、入局缘由' })}${textarea('故事内容', `data.fields.${index}.value`, field.value, { rows: 5, maxlength: 2400, placeholder: '写几句足以让故事开始的话。' })}<div class="form-row form-item-footer">${action('移除片段', 'remove-background', index, { remove: true, aria: `移除故事片段 ${field.label || index + 1}` })}</div></fieldset>`).join('') : empty('还没有故事片段。留一笔来历，也留一点未知。')}</div>${action('＋ 添加背景片段', 'add-background')}`;
  }

  function render(module) {
    if (!module || typeof module !== 'object') return '<div class="editor-empty">选择桌面上的纸雕组件，开始编辑。</div>';
    const safeModule = { ...module, data: module.data && typeof module.data === 'object' ? module.data : {} };
    const id = `editor-${String(module.id || 'module').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const headings = { identity: '填写身份', attributes: '分配属性', skills: '填写技能', equipment: '整理装备', background: '写下背景' };
    const renderers = { identity, attributes, skills, equipment, background };
    const knownType = Object.prototype.hasOwnProperty.call(renderers, module.type);
    const body = knownType ? renderers[module.type](safeModule, id) : empty('这个组件暂时没有可编辑字段。');
    return `<div class="editor-module" data-editor-type="${escape(module.type)}"><header class="editor-module-heading"><h2 class="editor-heading">${escape(knownType ? headings[module.type] : '编辑纸片')}</h2></header><div class="editor-section">${body}</div>${module.type === 'attributes' || module.type === 'skills' ? ruleSettings(safeModule, id) : ''}<details class="editor-settings"><summary>组件设置 · 标题与宽度</summary><div class="form-grid editor-module-settings">${input('组件标题', 'title', module.title, { maxlength: 60, className: 'field-wide' })}<label class="field-label field-wide"><span>纸片宽度</span><select class="field-select" data-path="width"><option value="half"${module.width === 'full' ? '' : ' selected'}>半宽 · 与其他纸片并排</option><option value="full"${module.width === 'full' ? ' selected' : ''}>整宽 · 独占一行</option></select></label></div></details></div>`;
  }

  window.WorkshopForms = Object.freeze({ render });
})();
