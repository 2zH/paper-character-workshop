(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WorkshopModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TYPES = ['identity', 'attributes', 'skills', 'equipment', 'background'];
  var TITLES = { identity: '身份', attributes: '属性', skills: '技能', equipment: '装备', background: '背景' };
  var PART_KINDS = { identity: ['identity-meta', 'portrait', 'collection'], attributes: ['hp', 'mp', 'attribute', 'radar', 'collection'], equipment: ['equipment', 'collection'], skills: ['skill', 'collection'], background: ['story', 'collection'] };
  var PART_TITLES = { 'identity-meta': '身份信息', portrait: '人物立绘', hp: '生命', mp: '魔力', attribute: '属性', radar: '属性雷达', equipment: '装备', skill: '技能', story: '故事', collection: '空白纸片' };
  var ROW_PARTS = ['attribute', 'equipment', 'skill', 'story'];
  var ATTRS = [['STR', '力量', 5], ['CON', '体质', 5], ['DEF', '防御', 4], ['SPD', '速度', 5], ['INT', '智识', 4], ['LUC', '幸运', 5]];
  var SKILLS = [['剑术', 60], ['观察', 50], ['生存', 40], ['交涉', 30], ['潜行', 30], ['学识', 30]];
  var GEAR = [['短剑', '熟悉的单手剑', 1.5], ['盾牌', '绘有旧家徽的木盾', 2], ['头盔', '边缘略有磨损', 1], ['胸甲', '旅行用轻甲', 4], ['腰包', '装着零钱与小物件', 0.5], ['靴子', '适合长途步行', 1]];
  var FIELDS = ['入局缘由', '重要之人', '信念', '重要地点', '宝贵之物'];
  var FIELD_SAMPLES = ['沿着旧地图，寻找失踪导师最后停留的城镇。', '导师伊芙，教会我辨认遗迹与人的善意。', '任何渺小的选择，都值得认真对待。', '灰枝村外，第一次学会握剑的草坡。', '一枚边角磨圆的铜制指南针。'];
  var PORTRAITS = ['assets/knight-cutout.png', 'assets/chibi-cutout.png'];
  var sequence = 0;

  function uid(prefix) {
    var uuid = typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID() : Date.now().toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    return (prefix || 'p') + '-' + uuid;
  }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function now() { return new Date().toISOString(); }
  function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }

  function createModule(type) {
    if (TYPES.indexOf(type) < 0) throw new Error('未知的纸雕组件类型。');
    var data;
    if (type === 'identity') data = { name: '林恩 · 灰枝', age: 27, occupation: '遗迹巡游者', appearance: '赤发、旧铠甲，披着一件补过的橄榄色斗篷。', level: 1, portrait: PORTRAITS[0] };
    if (type === 'attributes') data = { hp: 85, maxHp: 100, mp: 43, maxMp: 100, budget: null, rules: { enabled: false, min: null, max: null, integer: false }, items: ATTRS.map(function (a) { return { id: uid('attr'), key: a[0], name: a[1], value: a[2] }; }) };
    if (type === 'skills') data = { budget: null, rules: { enabled: false, min: null, max: null, integer: false }, items: SKILLS.map(function (a) { return { id: uid('skill'), name: a[0], value: a[1] }; }) };
    if (type === 'equipment') data = { items: GEAR.map(function (a, i) { return { id: uid('gear'), name: a[0], detail: a[1], quantity: 1, weight: a[2], equipped: true, assetIndex: i }; }) };
    if (type === 'background') data = { fields: FIELDS.map(function (label, i) { return { id: uid('story'), label: label, value: FIELD_SAMPLES[i] }; }) };
    return { id: uid('module'), type: type, title: TITLES[type], width: type === 'background' ? 'full' : 'half', pose: null, cardPose: null, paperWidth: null, mounted: false, parts: null, data: data };
  }

  function createPart(kind, rowId) {
    if (!Object.prototype.hasOwnProperty.call(PART_TITLES, kind)) throw new Error('未知的原子纸片类型。');
    return { id: uid('part'), kind: kind, rowId: typeof rowId === 'string' ? rowId : null, groupId: null, title: '', width: 'half', pose: null, cardPose: null, paperWidth: null, mounted: false, hidden: false };
  }

  function getPapers(character) {
    var papers = [];
    (character && Array.isArray(character.modules) ? character.modules : []).forEach(function (owner) {
      if (!Array.isArray(owner.parts)) { papers.push(owner); return; }
      owner.parts.forEach(function (part) {
        if (part.hidden) return;
        var view = {};
        Object.defineProperties(view, {
          id: { enumerable: true, get: function () { return part.id; } },
          type: { enumerable: true, get: function () { return owner.type; } },
          kind: { enumerable: true, get: function () { return part.kind; } },
          rowId: { enumerable: true, get: function () { return part.rowId; } },
          parentId: { enumerable: true, get: function () { return owner.id; } },
          owner: { get: function () { return owner; } },
          record: { get: function () { return part; } },
          data: { enumerable: true, get: function () { return owner.data; } },
          title: { enumerable: true, get: function () {
            if (typeof part.title === 'string' && part.title.trim()) return part.title;
            var rows = owner.data && (part.kind === 'story' ? owner.data.fields : owner.data.items);
            var row = part.rowId && Array.isArray(rows) ? rows.find(function (item) { return item.id === part.rowId; }) : null;
            return row && (row.name || row.label) || (part.kind === 'collection' ? owner.title || TITLES[owner.type] : PART_TITLES[part.kind]) || '纸片';
          }, set: function (value) { part.title = value; } }
        });
        ['width', 'pose', 'cardPose', 'paperWidth', 'mounted', 'hidden', 'groupId'].forEach(function (key) {
          Object.defineProperty(view, key, { enumerable: true, get: function () { return part[key]; }, set: function (value) { part[key] = value; } });
        });
        papers.push(view);
      });
    });
    return papers;
  }

  function createCharacter(options) {
    options = options || {};
    var sample = options.sample !== false;
    var timestamp = now();
    var character = { schemaVersion: 1, id: uid('character'), name: sample ? '林恩 · 灰枝' : '', createdAt: timestamp, updatedAt: timestamp, step: 0, status: 'draft', bindingEnabled: false, modules: TYPES.map(createModule) };
    if (!sample) {
      Object.assign(character.modules[0].data, { name: '', age: null, occupation: '', appearance: '' });
      character.modules[1].data.items.forEach(function (row) { row.value = 0; });
      character.modules[1].data.hp = character.modules[1].data.mp = 0;
      character.modules[2].data.items.forEach(function (row) { row.value = 0; });
      character.modules[3].data.items = [];
      character.modules[4].data.fields.forEach(function (row) { row.value = ''; });
    }
    return normalizeCharacter(character).character;
  }

  function cloneModuleWithGroups(item, groupIds) {
    var result = copy(item);
    result.id = uid('module');
    result.mounted = false;
    var rowIds = new Map();
    ['items', 'fields'].forEach(function (key) { if (result.data && Array.isArray(result.data[key])) result.data[key].forEach(function (row) { var previous = row.id; row.id = uid('row'); rowIds.set(previous, row.id); }); });
    if (Array.isArray(result.parts)) result.parts.forEach(function (part) {
      part.id = uid('part');
      if (part.rowId !== null && part.rowId !== undefined) part.rowId = rowIds.get(part.rowId) || null;
      if (typeof part.groupId === 'string' && part.groupId) { if (!groupIds.has(part.groupId)) groupIds.set(part.groupId, uid('group')); part.groupId = groupIds.get(part.groupId); }
      else part.groupId = null;
      part.mounted = false;
    });
    return result;
  }
  function cloneModule(item) { return cloneModuleWithGroups(item, new Map()); }
  function cloneCharacter(character) {
    var result = copy(character);
    result.id = uid('character');
    result.createdAt = result.updatedAt = now();
    var groupIds = new Map();
    result.modules = result.modules.map(function (item) { var duplicate = cloneModuleWithGroups(item, groupIds); duplicate.mounted = item.mounted === true; if (Array.isArray(duplicate.parts)) duplicate.parts.forEach(function (part, index) { part.mounted = item.parts[index].mounted === true; }); return duplicate; });
    return result;
  }

  /** Accept plain data or a JSON string. Whitelist fields, preserve array order, and report every repair. */
  function normalizeCharacter(input) {
    if (typeof input === 'string') {
      if (input.length > 33554432 || new TextEncoder().encode(input).byteLength > 33554432) throw new Error('文件超过 32 MB，请导入较小的角色卡。');
      try { input = JSON.parse(input); } catch (e) { throw new Error('无法读取 JSON，请选择纸雕工坊导出的角色卡。'); }
    }
    if (!plain(input)) throw new Error('角色卡必须是一个 JSON 对象。');
    if (input.schemaVersion !== 1) throw new Error('不支持此角色卡版本；当前支持 schemaVersion 1。');
    if (!Array.isArray(input.modules)) throw new Error('角色卡缺少组件列表。');
    var warnings = [];
    var usedIds = new Set();
    function warn(label, note) { warnings.push(label + '：' + note); }
    function text(value, fallback, max, label) {
      if (typeof value !== 'string') {
        if (value !== undefined && value !== null) warn(label, '非文本内容已替换。');
        return fallback;
      }
      var cleaned = value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<\/?[a-z][^>]*>/gi, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
      if (cleaned !== value) warn(label, '已移除标签、控制字符或首尾空格。');
      if (cleaned.length > max) { cleaned = cleaned.slice(0, max); warn(label, '已截取前 ' + max + ' 个字符。'); }
      return cleaned;
    }
    function num(value, fallback, min, max, integer, label, nullable) {
      if (value === null && nullable) return null;
      var number = value;
      if (typeof number === 'string' && number.trim() !== '') number = Number(number);
      if (typeof number !== 'number' || !Number.isFinite(number)) {
        if (value !== undefined) warn(label, '无效数值已替换为 ' + (fallback === null ? '空值' : fallback) + '。');
        return fallback;
      }
      var fixed = Math.max(min, Math.min(max, integer ? Math.round(number) : Math.round(number * 100) / 100));
      if (fixed !== value) warn(label, '已修正为 ' + fixed + '。');
      return fixed;
    }
    function freeNumber(value, label) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        var parsed = Number(value);
        if (Number.isFinite(parsed)) { warn(label, '文本数值已转为数字 ' + parsed + '。'); return parsed; }
      }
      warn(label, '无效数值已替换为 0。');
      return 0;
    }
    function optionalNumber(value, label) {
      if (value === null || value === undefined) return null;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        var parsed = Number(value);
        if (Number.isFinite(parsed)) { warn(label, '文本数值已转为数字 ' + parsed + '。'); return parsed; }
      }
      warn(label, '无效数值已清空。');
      return null;
    }
    function poseNumber(value, fallback, min, max, integer, label) {
      var parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
        warn(label, '无效数值已替换为 ' + fallback + '。');
        return fallback;
      }
      var fixed = Math.max(min, Math.min(max, integer ? Math.round(parsed) : parsed));
      if (fixed !== value) warn(label, '已修正为 ' + fixed + '。');
      return fixed;
    }
    function pose(value, label, maximumY) {
      if (value === null || value === undefined) return null;
      if (!plain(value)) { warn(label, '无效位置已清空，将自动铺排。'); return null; }
      return {
        x: poseNumber(value.x, 0, 0, 100, false, label + '横坐标'),
        y: poseNumber(value.y, 0, 0, maximumY === undefined ? 3000 : maximumY, false, label + '纵坐标'),
        angle: poseNumber(value.angle, 0, -15, 15, false, label + '旋转角'),
        z: poseNumber(value.z, 1, 1, 10000, true, label + '叠放层级')
      };
    }
    function cardPose(value, label, minimumWidth, maximumY) {
      if (value === null || value === undefined) return null;
      if (!plain(value)) { warn(label, '无效底卡位置已清空。'); return null; }
      return {
        x: poseNumber(value.x, 0, -600, 1200, false, label + '横坐标'),
        y: poseNumber(value.y, 0, -870, maximumY === undefined ? 2600 : maximumY, false, label + '纵坐标'),
        width: poseNumber(value.width, 240, minimumWidth === undefined ? 40 : minimumWidth, 2400, false, label + '宽度'),
        angle: poseNumber(value.angle, 0, -15, 15, false, label + '旋转角')
      };
    }
    function paperWidth(value, label, minimumWidth) {
      var width = optionalNumber(value, label);
      return width === null ? null : poseNumber(width, 1, minimumWidth === undefined ? 1 : minimumWidth, 400, false, label);
    }
    function id(value, prefix, label) {
      if (typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value) && !usedIds.has(value)) { usedIds.add(value); return value; }
      var fixed = uid(prefix);
      usedIds.add(fixed);
      warn(label, '缺失、重复或不合法的 ID 已重新生成。');
      return fixed;
    }
    function groupId(value, label) {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value)) return value;
      warn(label, '无效组合标识已清空。');
      return null;
    }
    function rows(value, max, label) {
      if (!Array.isArray(value)) { warn(label, '无效列表已替换为空列表。'); return []; }
      if (value.length > max) warn(label, '最多保留前 ' + max + ' 项。');
      return value.slice(0, max).filter(function (row, index) { if (plain(row)) return true; warn(label + '第 ' + (index + 1) + ' 项', '已移除无效条目。'); return false; });
    }
    function date(value, fallback, label) {
      if (typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
      warn(label, '无效日期已替换。');
      return fallback;
    }
    var timestamp = now();
    var character = {
      schemaVersion: 1,
      id: id(input.id, 'character', '角色卡'),
      name: text(input.name, '', 120, '角色卡名称'),
      createdAt: date(input.createdAt, timestamp, '创建时间'),
      updatedAt: date(input.updatedAt, timestamp, '更新时间'),
      step: num(input.step, 0, 0, 5, true, '当前步骤'),
      status: input.status === 'complete' ? 'complete' : 'draft',
      bindingEnabled: input.bindingEnabled === true,
      modules: []
    };
    if (input.bindingEnabled !== undefined && typeof input.bindingEnabled !== 'boolean') warn('装订模式', '无效开关已设为关闭。');
    if (input.status !== undefined && input.status !== 'complete' && input.status !== 'draft') warn('状态', '未知状态已改为草稿。');
    if (input.modules.length > 30) warn('组件列表', '最多保留前 30 个组件。');
    input.modules.slice(0, 30).forEach(function (item, index) {
      var label = '组件 ' + (index + 1);
      if (!plain(item) || TYPES.indexOf(item.type) < 0) { warn(label, '已跳过未知或无效组件。'); return; }
      var d = plain(item.data) ? item.data : {};
      var rowIds = new Map();
      function rememberRow(original, normalized) { if (typeof original.id === 'string' && !rowIds.has(original.id)) rowIds.set(original.id, normalized.id); return normalized; }
      if (!plain(item.data)) warn(label, '无效内容已替换为空白内容。');
      var result = { id: id(item.id, 'module', label), type: item.type, title: text(item.title, TITLES[item.type], 80, label + '标题'), width: item.width === 'full' ? 'full' : 'half', pose: pose(item.pose, label + '纸桌位置'), cardPose: cardPose(item.cardPose, label + '底卡位置'), paperWidth: paperWidth(item.paperWidth, label + '散片宽度'), mounted: item.mounted === true, parts: null, data: {} };
      if (item.mounted !== undefined && typeof item.mounted !== 'boolean') warn(label + '装订状态', '无效状态已改为散放。');
      if (item.width !== 'full' && item.width !== 'half') warn(label, '无效宽度已改为半幅。');
      if (item.type === 'identity') {
        result.data = { name: text(d.name, '', 120, label + '姓名'), age: num(d.age, null, 0, 999, true, label + '年龄', true), occupation: text(d.occupation, '', 120, label + '职业'), appearance: text(d.appearance, '', 2000, label + '外貌'), level: num(d.level, 1, 1, 99, true, label + '等级'), portrait: PORTRAITS.indexOf(d.portrait) >= 0 ? d.portrait : PORTRAITS[0] };
        if (d.portrait !== undefined && PORTRAITS.indexOf(d.portrait) < 0) warn(label + '人物图', '已改为内置人物插画。');
      }
      if (item.type === 'attributes' || item.type === 'skills') {
        var isAttr = item.type === 'attributes';
        var budget = optionalNumber(d.budget, label + '点数总额');
        var sourceRules = plain(d.rules) ? d.rules : null;
        var rules = { enabled: sourceRules ? sourceRules.enabled === true : budget !== null, min: sourceRules ? optionalNumber(sourceRules.min, label + '最小值') : null, max: sourceRules ? optionalNumber(sourceRules.max, label + '最大值') : null, integer: sourceRules ? sourceRules.integer === true : false };
        if (!sourceRules && budget !== null) warn(label + '规则', '已保留旧点数总额，并启用规则校验；原有数值保持不变。');
        if (d.rules !== undefined && !sourceRules) warn(label + '规则', '无效规则配置已重建。');
        if (sourceRules && sourceRules.enabled !== undefined && typeof sourceRules.enabled !== 'boolean') warn(label + '规则开关', '无效开关已设为关闭。');
        if (sourceRules && sourceRules.integer !== undefined && typeof sourceRules.integer !== 'boolean') warn(label + '整数限制', '无效开关已设为关闭。');
        result.data = { budget: budget, rules: rules, items: rows(d.items, isAttr ? 24 : 60, label + '条目').map(function (row, i) {
          var rowLabel = label + '第 ' + (i + 1) + ' 项';
          var output = { id: id(row.id, 'row', rowLabel), name: text(row.name, '', 80, rowLabel + '名称'), value: freeNumber(row.value, rowLabel + '数值') };
          if (isAttr) output.key = text(row.key, '', 20, rowLabel + '缩写');
          return rememberRow(row, output);
        }) };
        if (isAttr) {
          result.data.hp = d.hp === undefined ? 85 : freeNumber(d.hp, label + '生命值');
          result.data.maxHp = d.maxHp === undefined ? 100 : freeNumber(d.maxHp, label + '生命上限');
          result.data.mp = d.mp === undefined ? 43 : freeNumber(d.mp, label + '魔力值');
          result.data.maxMp = d.maxMp === undefined ? 100 : freeNumber(d.maxMp, label + '魔力上限');
        }
      }
      if (item.type === 'equipment') {
        result.data = { items: rows(d.items, 80, label + '装备').map(function (row, i) {
          var rowLabel = label + '第 ' + (i + 1) + ' 件装备';
          var assetIndex = typeof row.assetIndex === 'number' && Number.isInteger(row.assetIndex) && row.assetIndex >= 0 && row.assetIndex <= 5 ? row.assetIndex : null;
          if (row.assetIndex !== undefined && row.assetIndex !== null && assetIndex === null) warn(rowLabel + '插画', '未知插画编号已移除。');
          if (row.equipped !== undefined && typeof row.equipped !== 'boolean') warn(rowLabel + '装备状态', '无效状态已改为未装备。');
          return rememberRow(row, { id: id(row.id, 'gear', rowLabel), name: text(row.name, '', 120, rowLabel + '名称'), detail: text(row.detail, '', 2000, rowLabel + '描述'), quantity: num(row.quantity, 1, 0, 9999, true, rowLabel + '数量'), weight: num(row.weight, 0, 0, 9999, false, rowLabel + '重量'), equipped: row.equipped === true, assetIndex: assetIndex });
        }) };
      }
      if (item.type === 'background') {
        result.data = { fields: rows(d.fields, 40, label + '背景').map(function (row, i) {
          var rowLabel = label + '第 ' + (i + 1) + ' 条背景';
          return rememberRow(row, { id: id(row.id, 'story', rowLabel), label: text(row.label, '', 120, rowLabel + '名称'), value: text(row.value, '', 8000, rowLabel + '内容') });
        }) };
      }
      if (item.parts !== undefined && item.parts !== null) {
        if (!Array.isArray(item.parts)) warn(label + '原子纸片', '无效列表已清空，保留原组件显示。');
        else {
          if (item.parts.length > 240) warn(label + '原子纸片', '最多保留前 240 张纸片。');
          result.parts = [];
          item.parts.slice(0, 240).forEach(function (part, partIndex) {
            var partLabel = label + '纸片 ' + (partIndex + 1);
            if (!plain(part) || PART_KINDS[item.type].indexOf(part.kind) < 0) { warn(partLabel, '已移除与组件不匹配的纸片类型。'); return; }
            var rowId = null;
            if (ROW_PARTS.indexOf(part.kind) >= 0) {
              rowId = typeof part.rowId === 'string' ? rowIds.get(part.rowId) : null;
              if (!rowId) { warn(partLabel, '已移除引用不存在条目的纸片。'); return; }
            } else if (part.rowId !== undefined && part.rowId !== null) warn(partLabel, '此纸片不引用单个条目，已清空条目引用。');
            if (part.width !== undefined && part.width !== 'half' && part.width !== 'full') warn(partLabel, '无效宽度已改为半幅。');
            if (part.mounted !== undefined && typeof part.mounted !== 'boolean') warn(partLabel, '无效装订状态已改为散放。');
            if (part.hidden !== undefined && typeof part.hidden !== 'boolean') warn(partLabel, '无效隐藏状态已改为显示。');
            result.parts.push({ id: id(part.id, 'part', partLabel), kind: part.kind, rowId: rowId, groupId: groupId(part.groupId, partLabel + '组合'), title: text(part.title, '', 80, partLabel + '标题'), width: part.width === 'full' ? 'full' : 'half', pose: pose(part.pose, partLabel + '纸桌位置', 50000), cardPose: cardPose(part.cardPose, partLabel + '底卡位置', Number.MIN_VALUE, 50000), paperWidth: paperWidth(part.paperWidth, partLabel + '散片宽度', Number.MIN_VALUE), mounted: part.mounted === true, hidden: part.hidden === true });
          });
        }
      }
      character.modules.push(result);
    });
    if (character.status === 'complete' && !validateCharacter(character).valid) {
      character.status = 'draft';
      warn('完成状态', '角色卡仍有必填项或配点需要调整，已改为草稿。');
    }
    return { character: character, warnings: warnings };
  }

  function getTotals(item) {
    if (!item || !item.data) return { total: 0, budget: null, remaining: null, count: 0 };
    var rows = Array.isArray(item.data.items) ? item.data.items : [];
    var total = rows.reduce(function (sum, row) { return sum + (typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : 0); }, 0);
    var budget = typeof item.data.budget === 'number' && Number.isFinite(item.data.budget) ? item.data.budget : null;
    return { total: total, budget: budget, remaining: budget === null ? null : budget - total, count: rows.length };
  }

  /** Validate current live edits without repairing them. Removed component types stay optional. */
  function validateCharacter(character) {
    var errors = [];
    var warnings = [];
    var modules = character && Array.isArray(character.modules) ? character.modules : [];
    function error(item, field, message) { errors.push({ moduleId: item ? item.id : null, field: field, message: message }); }
    function blank(value) { return typeof value !== 'string' || !value.trim(); }
    function integer(value, min, max) { return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max; }
    var identities = modules.filter(function (item) { return item.type === 'identity'; });
    if (!identities.length) error(null, 'identity', '请添加一个身份组件，并填写角色姓名。');
    modules.forEach(function (item) {
      var d = item.data || {};
      var label = item.title || TITLES[item.type] || '组件';
      if (item.type === 'identity') {
        if (blank(d.name)) error(item, 'name', '请填写角色姓名。');
        if (d.age !== null && !integer(d.age, 0, 999)) error(item, 'age', '年龄应为空，或 0–999 的整数。');
        if (!integer(d.level, 1, 99)) error(item, 'level', '等级应为 1–99 的整数。');
        if (blank(d.occupation)) warnings.push(label + '尚未填写职业。');
      }
      if (item.type === 'attributes' || item.type === 'skills') {
        var isAttr = item.type === 'attributes';
        var rows = Array.isArray(d.items) ? d.items : [];
        var rules = plain(d.rules) ? d.rules : { enabled: d.budget !== null && d.budget !== undefined, min: null, max: null, integer: false };
        if (isAttr) ['hp', 'maxHp', 'mp', 'maxMp'].forEach(function (key) { if (d[key] !== undefined && (typeof d[key] !== 'number' || !Number.isFinite(d[key]))) error(item, key, '请填写有效的有限数值；可以使用小数或负数。'); });
        rows.forEach(function (row, i) {
          if (blank(row.name)) error(item, 'items.' + i + '.name', '第 ' + (i + 1) + ' 项' + (isAttr ? '属性' : '技能') + '缺少名称。');
          if (typeof row.value !== 'number' || !Number.isFinite(row.value)) error(item, 'items.' + i + '.value', '请填写有效的有限数值；可以使用小数或负数。');
          else if (rules.enabled) {
            if (typeof rules.min === 'number' && Number.isFinite(rules.min) && row.value < rules.min) error(item, 'items.' + i + '.value', (row.name || '第 ' + (i + 1) + ' 项') + '不能低于 ' + rules.min + '。');
            if (typeof rules.max === 'number' && Number.isFinite(rules.max) && row.value > rules.max) error(item, 'items.' + i + '.value', (row.name || '第 ' + (i + 1) + ' 项') + '不能高于 ' + rules.max + '。');
            if (rules.integer === true && !Number.isInteger(row.value)) error(item, 'items.' + i + '.value', (row.name || '第 ' + (i + 1) + ' 项') + '需要填写整数。');
          }
        });
        if (rules.enabled) {
          ['min', 'max'].forEach(function (key) { if (rules[key] !== null && rules[key] !== undefined && (typeof rules[key] !== 'number' || !Number.isFinite(rules[key]))) error(item, 'rules.' + key, key === 'min' ? '最小值应为空或有效有限数值。' : '最大值应为空或有效有限数值。'); });
          if (typeof rules.min === 'number' && typeof rules.max === 'number' && rules.min > rules.max) error(item, 'rules.min', '最小值不能大于最大值。');
          if (d.budget !== null && d.budget !== undefined) {
            if (typeof d.budget !== 'number' || !Number.isFinite(d.budget)) error(item, 'budget', '点数总额应为空或有效有限数值。');
            else {
              var totalValue = getTotals(item).total;
              var tolerance = Math.max(1, Math.abs(totalValue), Math.abs(d.budget)) * 1e-9;
              if (!Number.isFinite(totalValue) || Math.abs(totalValue - d.budget) > tolerance) error(item, 'budget', label + '当前合计 ' + totalValue + '，规则要求总额为 ' + d.budget + '。');
            }
          }
        }
        if (!rows.length) warnings.push(label + '目前没有条目。');
      }
      if (item.type === 'equipment') {
        (Array.isArray(d.items) ? d.items : []).forEach(function (row, i) {
          if (blank(row.name)) error(item, 'items.' + i + '.name', '第 ' + (i + 1) + ' 件装备缺少名称。');
          if (!integer(row.quantity, 0, 9999)) error(item, 'items.' + i + '.quantity', '装备数量应为 0–9999 的整数。');
          if (typeof row.weight !== 'number' || !Number.isFinite(row.weight) || row.weight < 0 || row.weight > 9999) error(item, 'items.' + i + '.weight', '装备重量应为 0–9999 的数值。');
        });
      }
      if (item.type === 'background') {
        (Array.isArray(d.fields) ? d.fields : []).forEach(function (row, i) {
          if (blank(row.label)) error(item, 'fields.' + i + '.label', '第 ' + (i + 1) + ' 条背景缺少名称。');
          if (blank(row.value)) warnings.push(label + '「' + (row.label || '未命名条目') + '」尚未填写。');
        });
      }
    });
    var failed = new Set(errors.map(function (entry) { return entry.moduleId; }));
    var total = modules.length + (identities.length ? 0 : 1);
    var completed = modules.filter(function (item) { return !failed.has(item.id); }).length;
    return { errors: errors, warnings: warnings, valid: errors.length === 0, completion: { completed: completed, total: total, percent: Math.round(completed / Math.max(total, 1) * 100) } };
  }

  function exportCharacter(character) {
    var normalized = normalizeCharacter(character).character;
    normalized.updatedAt = now();
    var namedIdentity = normalized.modules.find(function (item) { return item.type === 'identity' && item.data.name.trim(); });
    normalized.name = namedIdentity ? namedIdentity.data.name : normalized.name;
    return normalized;
  }

  return Object.freeze({ SCHEMA_VERSION: 1, TYPES: TYPES.slice(), TITLES: Object.assign({}, TITLES), uid: uid, createCharacter: createCharacter, createModule: createModule, createPart: createPart, getPapers: getPapers, cloneCharacter: cloneCharacter, cloneModule: cloneModule, normalizeCharacter: normalizeCharacter, validateCharacter: validateCharacter, getTotals: getTotals, exportCharacter: exportCharacter });
});
