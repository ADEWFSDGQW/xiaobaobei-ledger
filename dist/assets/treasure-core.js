(function (root) {
  'use strict';
  const KEY = 'mh_treasure_project_v1';
  const MODES = ['normal', 'advanced'];
  const SOURCES = ['direct', 'battle', 'clue', 'other'];
  const PRICE_MODES = ['fixed', 'custom', 'cash'];
  const FIXED_ITEMS = ['金刚石','定魂珠','夜光珠','龙鳞','避水珠','花豆'];
  const SHORT_BOOK_TYPES = ['剑','刀','扇','扇子','枪','枪矛','斧','斧钺','锤','鞭','鞭子','双剑','飘带','爪刺','环圈','魔棒','宝珠','巨剑','弓','弓箭','伞','灯笼','法杖','项链','腰带','鞋子','鞋','头盔','铠甲','衣服','帽子','女头','男头','男衣','女衣'];
  function rowPriceMode(row) {
    plain(row, '物品');
    if (row.priceMode !== undefined) {
      if (!PRICE_MODES.includes(row.priceMode) || (row.cash === true) !== (row.priceMode === 'cash')) throw new Error('物品价格分组不正确');
      return row.priceMode;
    }
    if (row.cash === true) return 'cash';
    const name = typeof row.name === 'string' ? row.name.replace(/\s+/g, '') : '';
    const category = typeof row.category === 'string' ? row.category.trim() : '';
    const kind = typeof row.kind === 'string' ? row.kind.trim() : '';
    const shortBook = name.match(/^([0-9]{1,3})级?(.+)书$/);
    const bookIron = ['书','铁','灵饰书','灵饰铁'].includes(kind)
      || (shortBook !== null && SHORT_BOOK_TYPES.includes(shortBook[2]))
      || /^(书|铁|制造指南书|制造书|打造书|百炼精铁|灵饰指南书|元灵晶石|灵饰书|灵饰铁)$/.test(category)
      || /制造指南书|制造书|打造书|百炼精铁|灵饰指南书|元灵晶石/.test(name)
      || /^(?:\d{1,3}级?)?(?:书|铁|灵饰书|灵饰铁)$/.test(name)
      || /^\d{1,3}级?(?:书|铁)$/.test(name);
    return bookIron || FIXED_ITEMS.includes(name) || /^(60|70|80)(?:级)?(?:武器|防具|装备)$/.test(name) ? 'fixed' : 'custom';
  }
  const EVENTS = {
    normal: ['放出妖怪', '放出妖王', '遭遇战斗', '瘴气', '藏宝室／箱子', '获得线索', '其他事件'],
    advanced: ['挖塌幼儿园', '放出妖王', '其他事件']
  };
  function plain(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + '格式不正确');
    return value;
  }
  function text(value, label, max, required = false) {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(label + '格式不正确');
    return value;
  }
  function number(value, label, max = 1e9, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) throw new Error(label + '格式不正确');
    return value;
  }
  function units(value, label = '金额') {
    number(value, label);
    const result = Math.round(value * 10000);
    if (!Number.isSafeInteger(result) || Math.abs(value - result / 10000) > 1e-8) throw new Error(label + '最多支持四位小数（万）');
    return result;
  }
  function add(a, b) {
    const n = a + b;
    if (!Number.isSafeInteger(n)) throw new Error('累计金额过大');
    return n;
  }
  function multiply(a, b) {
    const n = a * b;
    if (!Number.isSafeInteger(n)) throw new Error('金额或数量过大');
    return n;
  }
  function round(n) { return Math.round(n * 10000) / 10000; }
  function mode(value) { if (!MODES.includes(value)) throw new Error('藏宝图类型不正确'); return value; }
  function day(value) {
    const d = value === undefined ? new Date() : new Date(value);
    if (!Number.isFinite(d.getTime())) throw new Error('日期不正确');
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日期不正确');
    const parsed = new Date(value + 'T12:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('日期不正确');
  }
  function fresh(value = 'normal') {
    return { id: '', mode: mode(value), date: day(), role: '', map: '未分类', quantity: 0, unitCost: 0, extraCost: 0, minutes: 0, notes: '', rows: [], events: [] };
  }
  function empty() { return { version: 1, mode: 'normal', drafts: { normal: fresh('normal'), advanced: fresh('advanced') }, history: [], prices: {}, customItems: [] }; }
  function catalogs(value) {
    mode(value);
    const list = [];
    function item(id, name, category, cash = false) { list.push({ id, name, category, cash }); }
    if (value === 'normal') {
      ['金刚石', '定魂珠', '夜光珠', '龙鳞', '避水珠'].forEach((name, i) => item('five-' + i, name, '五宝'));
      item('low-book', '低级魔兽要诀', '低级兽诀');
      item('low-dan', '低级召唤兽内丹', '低级内丹');
      for (let level = 10; level <= 70; level += 10) {
        item('book-' + level, level + '级制造指南书', '制造指南书');
        item('iron-' + level, level + '级百炼精铁', '百炼精铁');
      }
      item('equip-low', '10～50级装备', '低级装备');
      for (const level of [60, 70]) for (const kind of ['武器', '防具']) item('equip-' + level + '-' + kind, level + '级' + kind, '环装');
      item('cash', '梦幻币', '现金', true);
    } else {
      item('high-book', '高级魔兽要诀', '高级兽诀');
      item('high-dan', '高级召唤兽内丹', '高级内丹');
      for (const level of [60, 70, 80]) for (const kind of ['武器', '防具']) item('equip-' + level + '-' + kind, level + '级' + kind, '环装');
      item('flower', '花豆', '花豆');
    }
    return list;
  }
  function checkRecord(record, draft = true) {
    plain(record, '挖图记录'); mode(record.mode);
    text(record.id, '记录编号', 200); validDate(record.date);
    text(record.role, '角色', 200); text(record.map, '地图', 100, true); text(record.notes, '备注', 2000);
    number(record.quantity, '藏宝图数量', 1e6, true);
    if (!draft && record.quantity < 1) throw new Error('请填写至少 1 张藏宝图');
    units(record.unitCost, '藏宝图单价'); units(record.extraCost, '其他成本');
    number(record.minutes, '耗时', 1e6);
    if (!Array.isArray(record.rows) || record.rows.length > 20000 || !Array.isArray(record.events) || record.events.length > 1000) throw new Error('物品或事件列表格式不正确');
    const ids = new Set();
    for (const row of record.rows) {
      plain(row, '物品'); text(row.id, '物品编号', 200, true);
      if (ids.has(row.id)) throw new Error('物品编号重复'); ids.add(row.id);
      text(row.name, '物品名称', 200, true); text(row.category, '物品分类', 100, true);
      if (!SOURCES.includes(row.source)) throw new Error('物品来源不正确');
      number(row.quantity, '物品数量', 1e6, true); if (row.quantity < 1) throw new Error('物品数量至少为 1');
      units(row.price, '物品单价');
      if (typeof row.realized !== 'boolean' || typeof row.cash !== 'boolean' || (row.cash && !row.realized)) throw new Error('物品到账状态不正确');
      if (row.priceMode !== undefined) rowPriceMode(row);
    }
    for (const event of record.events) {
      plain(event, '事件'); text(event.name, '事件名称', 200, true);
      number(event.count, '事件次数', 1e6, true); if (event.count < 1) throw new Error('事件次数至少为 1');
    }
    return record;
  }
  function totals(record) {
    checkRecord(record);
    const sums = { revenue: 0, actualRevenue: 0, direct: 0, battle: 0, clue: 0, other: 0, gold: 0, actualGold: 0 };
    let itemQuantity = 0, eventCount = 0;
    const cost = add(multiply(units(record.unitCost), record.quantity), units(record.extraCost));
    for (const row of record.rows) {
      const amount = multiply(units(row.price), row.quantity);
      sums.revenue = add(sums.revenue, amount); sums[row.source] = add(sums[row.source], amount);
      if (row.realized) sums.actualRevenue = add(sums.actualRevenue, amount);
      if (row.cash) { sums.gold = add(sums.gold, amount); if (row.realized) sums.actualGold = add(sums.actualGold, amount); }
      else itemQuantity = add(itemQuantity, row.quantity);
    }
    for (const event of record.events) eventCount = add(eventCount, event.count);
    const result = {};
    for (const key of Object.keys(sums)) result[key] = sums[key] / 10000;
    result.expense = result.cost = cost / 10000;
    result.item = (sums.revenue - sums.gold) / 10000;
    result.actualItem = (sums.actualRevenue - sums.actualGold) / 10000;
    result.unrealized = (sums.revenue - sums.actualRevenue) / 10000;
    result.profit = (sums.revenue - cost) / 10000;
    result.actualProfit = (sums.actualRevenue - cost) / 10000;
    result.quantity = record.quantity; result.itemQuantity = itemQuantity; result.eventCount = eventCount;
    result.perMap = record.quantity ? round(result.profit / record.quantity) : null;
    result.actualPerMap = record.quantity ? round(result.actualProfit / record.quantity) : null;
    result.perHour = record.minutes ? round(result.profit * 60 / record.minutes) : null;
    result.actualPerHour = record.minutes ? round(result.actualProfit * 60 / record.minutes) : null;
    return result;
  }
  function validate(record) { checkRecord(record, false); totals(record); return record; }
  // Prices and grouping are row snapshots. The fallback for pre-snapshot rows
  // deliberately depends on stable item names, never the shared price cache.
  function priceBreakdown(record) {
    const t = totals(record), result = {};
    for (const key of PRICE_MODES) result[key] = { quantity: 0, count: 0, revenue: 0, actualRevenue: 0, unrealized: 0, indexes: [] };
    const total = { quantity: 0, count: 0, revenue: 0, actualRevenue: 0, unrealized: 0 };
    record.rows.forEach((row,index) => {
      const group = result[rowPriceMode(row)], amount = multiply(units(row.price), row.quantity);
      group.quantity = add(group.quantity,row.quantity); group.count++; group.indexes.push(index);
      group.revenue = add(group.revenue,amount); if (row.realized) group.actualRevenue = add(group.actualRevenue,amount);
      total.quantity = add(total.quantity,row.quantity); total.count++;
      total.revenue = add(total.revenue,amount); if (row.realized) total.actualRevenue = add(total.actualRevenue,amount);
    });
    for (const group of [...Object.values(result),total]) {
      group.revenueUnits = group.revenue; group.actualRevenueUnits = group.actualRevenue;
      group.unrealizedUnits = group.revenue-group.actualRevenue;
      group.unrealized = group.unrealizedUnits/10000; group.revenue /= 10000; group.actualRevenue /= 10000;
    }
    return {...result,total,expense:t.expense,profit:t.profit,actualProfit:t.actualProfit};
  }
  function derive(history) {
    if (!Array.isArray(history) || history.length > 10000) throw new Error('挖图历史格式不正确');
    const days = {}, ids = new Set();
    for (const record of history) {
      validate(record); if (!record.id || ids.has(record.id)) throw new Error('挖图结算编号重复或缺失'); ids.add(record.id);
      const t = totals(record), d = days[record.date] || (days[record.date] = { revenue: 0, cost: 0, gold: 0, count: 0, quantity: 0, rows: [] });
      d.revenue = add(Math.round(d.revenue * 10000), Math.round(t.actualRevenue * 10000)) / 10000;
      d.cost = add(Math.round(d.cost * 10000), Math.round(t.expense * 10000)) / 10000;
      d.gold = add(Math.round(d.gold * 10000), Math.round(t.actualGold * 10000)) / 10000;
      d.count++; d.quantity = add(d.quantity, record.quantity);
      const label = (record.mode === 'normal' ? '普通图' : '高级图') + '·' + record.map + (record.role ? '·' + record.role : '');
      record.rows.filter(r => r.realized).forEach(r => d.rows.push({ id: record.id + ':reward:' + r.id, source: 'treasure', roundId: record.id, date: record.date, name: label + '·' + r.name + '×' + r.quantity, price: multiply(units(r.price), r.quantity) / 10000, category: r.cash ? '挖图金币' : '挖图物品', treasureSource: r.source }));
      d.rows.push({ id: record.id + ':cost', source: 'treasure', roundId: record.id, date: record.date, name: label + '·总成本（' + record.quantity + '张）', price: -t.expense, category: '挖图支出' });
    }
    return days;
  }
  function validateState(state) {
    plain(state, '挖图备份'); if (state.version !== 1) throw new Error('挖图备份版本不正确'); mode(state.mode);
    plain(state.drafts, '挖图草稿');
    for (const key of MODES) { checkRecord(state.drafts[key]); if (state.drafts[key].mode !== key) throw new Error('草稿类型不匹配'); totals(state.drafts[key]); }
    derive(state.history);
    plain(state.prices, '物品单价'); if (Object.keys(state.prices).length > 20000) throw new Error('物品单价过多');
    for (const [key, value] of Object.entries(state.prices)) { text(key, '价格标识', 500, true); units(value, '参考单价'); }
    if (!Array.isArray(state.customItems) || state.customItems.length > 5000) throw new Error('自定义物品格式不正确');
    const ids = new Set();
    for (const item of state.customItems) {
      plain(item, '自定义物品'); text(item.id, '自定义物品编号', 200, true);
      if (ids.has(item.id)) throw new Error('自定义物品编号重复'); ids.add(item.id);
      text(item.name, '自定义物品名称', 200, true); text(item.category, '自定义物品分类', 100, true);
      if (![...MODES, 'both'].includes(item.mode) || typeof item.cash !== 'boolean') throw new Error('自定义物品类型不正确');
    }
    return state;
  }
  function settle(state) {
    validateState(state);
    const draft = state.drafts[state.mode]; validate(draft);
    const record = JSON.parse(JSON.stringify({ ...draft, id: draft.id || 'treasure-' + Date.now() + '-' + Math.random().toString(36).slice(2) }));
    const index = state.history.findIndex(r => r.id === record.id);
    if (index < 0) { if (state.history.length >= 10000) throw new Error('历史记录过多，请先导出整理'); state.history.unshift(record); } else state.history[index] = record;
    state.drafts[state.mode] = fresh(state.mode);
    return record;
  }
  function mergeDaily(base, days, settings = {}) {
    const records = new Map(base.map(row => [row.date, row]));
    Object.keys(days).forEach(date => { if (!records.has(date)) records.set(date, { date, goldIncome: 0, itemIncome: 0, cardCost: 0, netIncome: 0, convertedIncome: 0 }); });
    return [...records.values()].map(row => {
      const original = row.treasureBase || { goldIncome: Number(row.goldIncome) || 0, itemIncome: Number(row.itemIncome) || 0, netIncome: Number(row.netIncome) || 0, convertedIncome: Number(row.convertedIncome) || 0 };
      const d = days[row.date] || { revenue: 0, cost: 0, gold: 0, count: 0, quantity: 0 };
      const factor = Number.isFinite(row.conversionFactor) ? row.conversionFactor : original.netIncome ? original.convertedIncome / original.netIncome : (Number(settings.ratio) || 0) / 3000 * (Number.isFinite(Number(settings.discount)) ? Number(settings.discount) : 95) / 100;
      return { ...row, treasureBase: { ...original }, treasureIncome: d.revenue, treasureCost: d.cost, treasureGold: d.gold, treasureCount: d.count, treasureQuantity: d.quantity,
        goldIncome: round(original.goldIncome + d.gold), itemIncome: round(original.itemIncome + d.revenue - d.gold), netIncome: round(original.netIncome + d.revenue - d.cost), convertedIncome: round(original.convertedIncome + (d.revenue - d.cost) * factor) };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }
  const api = { KEY, EVENTS, SOURCES, MODES, PRICE_MODES, catalogs, fresh, empty, totals, validate, validateState, settle, derive, mergeDaily, day, number, units, round, rowPriceMode, priceBreakdown };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.treasureCore = api;
})(typeof window === 'object' ? window : globalThis);
