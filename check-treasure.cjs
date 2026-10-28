'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('./dist/assets/treasure-core.js');
const clone = v => JSON.parse(JSON.stringify(v));
function row(id, price, quantity = 1, realized = false, source = 'direct', cash = false) { return { id, name: id, category: cash ? '现金' : '物品', source, quantity, price, realized, cash }; }
function record(overrides = {}) { return { ...core.fresh(), date: '2026-10-27', map: '五庄观', quantity: 20, unitCost: 2.5, extraCost: 1, minutes: 60, ...overrides }; }
const normal = core.catalogs('normal'), advanced = core.catalogs('advanced');
for (const name of ['金刚石','定魂珠','夜光珠','龙鳞','避水珠','低级魔兽要诀','低级召唤兽内丹','60级武器','70级防具','梦幻币']) assert(normal.some(item => item.name === name), name);
for (let level = 10; level <= 70; level += 10) for (const name of [level + '级制造指南书', level + '级百炼精铁']) assert(normal.some(item => item.name === name), name);
for (const name of ['高级魔兽要诀','高级召唤兽内丹','80级武器','80级防具','花豆']) assert(advanced.some(item => item.name === name), name);
assert(!advanced.some(item => item.name === '梦幻币'));
normal[0].name = '修改不污染内置清单'; assert.equal(core.catalogs('normal')[0].name, '金刚石');
assert.throws(() => core.catalogs('mobile'));
assert.equal(core.validateState(core.empty()).version, 1);
assert.throws(() => core.validate(core.fresh()), /至少/);

const sample = record({ role: '角色1', rows: [row('现金', 5, 1, true, 'direct', true), row('金刚石', 150), row('战斗奖励', 2.3456, 2, true, 'battle'), row('线索箱奖励', 300, 1, true, 'clue'), row('其他估值', 0.0001, 1, false, 'other')], events: [{ name: '放出妖王', count: 2 }, { name: '瘴气', count: 1 }] });
const t = core.totals(sample);
assert.equal(t.expense, 51);
assert.equal(t.cost, 51);
assert.equal(t.revenue, 459.6913);
assert.equal(t.actualRevenue, 309.6912);
assert.equal(t.unrealized, 150.0001);
assert.equal(t.gold, 5);
assert.equal(t.actualGold, 5);
assert.equal(t.item, 454.6913);
assert.equal(t.actualItem, 304.6912);
assert.equal(t.profit, 408.6913);
assert.equal(t.actualProfit, 258.6912);
assert.equal(t.direct, 155); assert.equal(t.battle, 4.6912); assert.equal(t.clue, 300); assert.equal(t.other, 0.0001);
assert.equal(t.eventCount, 3); assert.equal(t.itemQuantity, 5);
assert.equal(t.perMap, 20.4346); assert.equal(t.perHour, 408.6913);
assert.equal(core.totals(core.fresh()).perMap, null); assert.equal(core.totals(core.fresh()).perHour, null);
const exact = record({ unitCost: 0.1, quantity: 3, extraCost: 0.2, rows: [row('a', 0.1, 3, true), row('b', 0.2, 7, true)] });
assert.equal(core.totals(exact).expense, 0.5); assert.equal(core.totals(exact).actualRevenue, 1.7); assert.equal(core.totals(exact).actualProfit, 1.2);

const state = core.empty(); state.drafts.normal = clone(sample);
const advancedBefore = clone(state.drafts.advanced), saved = core.settle(state);
assert.equal(state.history.length, 1); assert.equal(state.drafts.normal.quantity, 0); assert.deepEqual(state.drafts.advanced, advancedBefore);
assert(saved.id); core.validateState(state);
const daily = core.derive(state.history)['2026-10-27'];
assert.equal(daily.revenue, 309.6912); assert.equal(daily.cost, 51); assert.equal(daily.gold, 5); assert.equal(daily.count, 1); assert.equal(daily.quantity, 20);
assert.equal(daily.rows.length, 4); assert(!daily.rows.some(r => r.name.includes('金刚石')));
assert(daily.rows.every(r => r.source === 'treasure'));
assert.equal(daily.rows.reduce((sum, r) => Math.round((sum + r.price) * 10000) / 10000, 0), 258.6912);

const base = [{ date: '2026-10-27', goldIncome: 50, itemIncome: 10, cardCost: 5, netIncome: 55, convertedIncome: 55, conversionFactor: 1 }], baseCopy = clone(base);
const merged = core.mergeDaily(base, core.derive(state.history), {});
assert.equal(merged[0].goldIncome, 55); assert.equal(merged[0].itemIncome, 314.6912); assert.equal(merged[0].netIncome, 313.6912); assert.equal(merged[0].convertedIncome, 313.6912);
assert.equal(merged[0].treasureQuantity, 20); assert.equal(merged[0].cardCost, 5);
assert.deepEqual(merged[0].treasureBase, { goldIncome: 50, itemIncome: 10, netIncome: 55, convertedIncome: 55 });
assert.deepEqual(core.mergeDaily(merged, core.derive(state.history), {}), merged, 'Repeated merge is idempotent');
assert.deepEqual(base, baseCopy, 'Do not mutate the original ledger');
assert.equal(core.mergeDaily(merged, {}, {})[0].netIncome, 55, 'Deleting histories removes their merged contribution');
assert.equal(core.mergeDaily(merged, {}, {})[0].goldIncome, 50);

state.drafts.normal = clone(saved); state.drafts.normal.rows[1].realized = true;
core.settle(state); assert.equal(state.history.length, 1); assert.equal(state.history[0].id, saved.id);
assert.equal(core.derive(state.history)['2026-10-27'].revenue, 459.6912);
const edited = core.mergeDaily(merged, core.derive(state.history), {});
assert.equal(edited[0].netIncome, 463.6912);
assert.equal(edited[0].treasureCount, 1);
state.prices.newPrice = 999; assert.equal(core.totals(state.history[0]).revenue, t.revenue, 'Changing remembered prices must not rewrite history');

state.mode = 'advanced'; state.drafts.advanced = record({ mode: 'advanced', quantity: 5, unitCost: 300, extraCost: 0, minutes: 0, rows: [], events: [{ name: '挖塌幼儿园', count: 5 }] });
core.settle(state); assert.equal(state.history.length, 2); assert.equal(core.totals(state.history[0]).profit, -1500);
assert.equal(core.derive(state.history)['2026-10-27'].quantity, 25);
assert.equal(core.derive(state.history)['2026-10-27'].cost, 1551);
const newDay = { ...clone(saved), id: 'another-date', date: '2026-10-28' };
assert.equal(core.mergeDaily([], core.derive([newDay]), { ratio: 3000, discount: 0 })[0].convertedIncome, 0, 'Explicit zero discount is preserved');

const malformed = [
  r => r.quantity = -1, r => r.quantity = 0.5, r => r.quantity = 1e6 + 1,
  r => r.unitCost = Infinity, r => r.unitCost = -1, r => r.unitCost = 0.00001, r => r.extraCost = '2',
  r => r.date = '2026-02-30', r => r.date = 'not a date', r => r.mode = 'mobile',
  r => r.minutes = NaN, r => r.map = '', r => r.role = 'x'.repeat(201), r => r.notes = 'x'.repeat(2001),
  r => r.rows[0].quantity = 1.5, r => r.rows[0].quantity = 0,
  r => r.rows[0].price = NaN, r => r.rows[0].price = -1, r => r.rows[0].price = 0.00001,
  r => r.rows[0].source = 'unknown', r => r.rows[0].cash = true,
  r => r.rows[0].realized = 'true', r => r.rows[0].id = '', r => r.rows.push(clone(r.rows[0])),
  r => r.events = [{ name: '妖王', count: 0 }], r => r.events = [{ name: '妖王', count: 1.1 }],
  r => r.rows = {}, r => r.events = {}, r => r.rows[0].name = ''
];
for (const corrupt of malformed) { const r = record({ rows: [row('item', 1)] }); corrupt(r); assert.throws(() => core.totals(r)); }
assert.throws(() => core.totals(record({ quantity: 1e6, unitCost: 1e9 })), /过大/);
assert.throws(() => core.totals(record({ rows: [row('huge', 1e9, 1e6)] })), /过大/);
assert.throws(() => core.derive([saved, saved]), /重复/);
assert.throws(() => core.derive([{ ...saved, id: '' }]), /编号/);
assert.throws(() => core.validateState({ ...core.empty(), version: 2 }));
assert.throws(() => core.validateState({ ...core.empty(), drafts: { normal: core.fresh(), advanced: core.fresh() } }), /不匹配/);
assert.throws(() => core.validateState({ ...core.empty(), prices: { broken: -1 } }));
assert.throws(() => core.validateState({ ...core.empty(), customItems: [{ id: 'a', name: '', category: '自定义', mode: 'normal', cash: false }] }));
const custom = { id: 'mine', name: '具体技能兽诀', category: '自定义', mode: 'both', cash: false };
core.validateState({ ...core.empty(), customItems: [custom] });
assert.throws(() => core.validateState({ ...core.empty(), customItems: [custom, custom] }), /重复/);
const failSettle = core.empty(), failBefore = JSON.stringify(failSettle); assert.throws(() => core.settle(failSettle)); assert.equal(JSON.stringify(failSettle), failBefore);

const context = { console }; context.window = context; vm.createContext(context);
vm.runInContext(fs.readFileSync('./dist/assets/treasure-core.js', 'utf8'), context);
assert.equal(context.treasureCore.KEY, core.KEY); assert.equal(context.treasureCore.catalogs('advanced').length, advanced.length);
console.log('PASS: treasure catalogs, actual-vs-estimated income, cash/source/event distinction, exact costs, drafts, edits, ledger idempotence/deletion, zero results, strict backups and browser exports.');
