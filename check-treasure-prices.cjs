'use strict';
const assert=require('node:assert/strict');
const core=require('./dist/assets/treasure-core');
const priceApi=require('./dist/assets/item-prices');
const row=(id,name,price,quantity=1,extra={})=>({id,name,category:'物品',source:'direct',quantity,price,realized:false,cash:false,...extra});
const record={...core.fresh('normal'),id:'price-test',quantity:10,unitCost:2,extraCost:3,rows:[
  row('fixed','金刚石',10,2,{priceMode:'fixed',realized:true}),
  row('custom','偷袭',7,1,{category:'低级兽诀',priceMode:'custom'}),
  row('cash','梦幻币',0.1234,1,{cash:true,realized:true,priceMode:'cash'})
]};
const original=JSON.stringify(record),parts=core.priceBreakdown(record),total=core.totals(record);
assert.equal(parts.fixed.quantity,2);assert.equal(parts.fixed.revenue,20);assert.equal(parts.fixed.actualRevenue,20);
assert.equal(parts.custom.quantity,1);assert.equal(parts.custom.revenue,7);assert.equal(parts.custom.actualRevenue,0);assert.equal(parts.custom.unrealized,7);
assert.equal(parts.cash.revenue,0.1234);assert.equal(parts.cash.actualRevenue,0.1234);
assert.equal(parts.total.revenue,total.revenue);assert.equal(parts.total.actualRevenue,total.actualRevenue);assert.equal(parts.expense,total.expense);assert.equal(parts.actualProfit,total.actualProfit);
assert.equal(parts.fixed.revenueUnits+parts.custom.revenueUnits+parts.cash.revenueUnits,parts.total.revenueUnits);
assert.equal(parts.fixed.actualRevenueUnits+parts.custom.actualRevenueUnits+parts.cash.actualRevenueUnits,parts.total.actualRevenueUnits);
assert.equal(parts.total.unrealizedUnits,parts.custom.unrealizedUnits);
assert.deepEqual(parts.fixed.indexes,[0]);assert.deepEqual(parts.custom.indexes,[1]);assert.deepEqual(parts.cash.indexes,[2]);
assert.equal(JSON.stringify(record),original,'Pure breakdown must not mutate snapshots');
const legacy={...core.fresh('normal'),quantity:1,rows:[row('a','60级防具',0.0001,3),row('b','低级魔兽要诀',0.0001,2),row('c','花豆',0.0001),row('d','梦幻币',0.0001,1,{cash:true,realized:true})]};
const before=JSON.stringify(legacy),legacyParts=core.priceBreakdown(legacy);
assert.equal(legacyParts.fixed.revenue,0.0004);assert.equal(legacyParts.custom.revenue,0.0002);assert.equal(legacyParts.cash.revenue,0.0001);assert.equal(legacyParts.total.revenue,0.0007);
assert.equal(JSON.stringify(legacy),before,'Compatibility classification must not add fields or change prices');
for(const name of ['金刚石','定魂珠','夜光珠','龙鳞','避水珠','花豆','60武器','70级装备','80防具'])assert.equal(core.rowPriceMode({name,cash:false}),'fixed',name);
for(const name of ['低级魔兽要诀','高级魔兽要诀','低级召唤兽内丹','高级召唤兽内丹','10～50级装备','自定义物品'])assert.equal(core.rowPriceMode({name,cash:false}),'custom',name);
const bookIronCases=[
  {name:'60级制造指南书'},{name:'70级百炼精铁'},{name:'制造指南书'},{name:'百炼精铁'},
  {name:'100级耳饰灵饰指南书'},{name:'100级元灵晶石'},{name:'灵饰书'},{name:'灵饰铁'},
  {name:'60书'},{name:'70铁'},{name:'书'},{name:'铁'},
  {name:'60级剑书'},{name:'60项链书'},{name:'70级项链书'},{name:'100刀书'},
  {name:'自填类型',category:'书'},{name:'自填材料',category:'铁'},
  {name:'60剑书',category:'制造指南书'},{name:'自填书型',category:'制造书'},
  {name:'自填精铁',category:'百炼精铁'},{name:'自填耳饰',category:'灵饰指南书'},{name:'自填晶石',category:'元灵晶石'},
  {name:'剑',kind:'书',level:60},{name:'精铁',kind:'铁',level:60},
  {name:'耳饰',kind:'灵饰书',level:100},{name:'晶石',kind:'灵饰铁',level:100}
];
for(const item of bookIronCases){assert.equal(core.rowPriceMode({...item,cash:false}),'fixed',JSON.stringify(item));assert.equal(priceApi.describe(item).priceMode,'fixed','Shared/core classification agrees for '+JSON.stringify(item));}
for(const name of ['60任务书','60兽诀书'])assert.equal(core.rowPriceMode({name,category:'自定义物品',cash:false}),'custom','Non-equipment book name must not be forced into manufacturing category');
assert.equal(core.rowPriceMode({name:'60项链书',cash:false,priceMode:'custom'}),'custom','Short-name recognition preserves explicit historical snapshots');
const catalogCounts=mode=>core.catalogs(mode).reduce((groups,item)=>{groups[core.rowPriceMode(item)]++;return groups;},{fixed:0,custom:0,cash:0});
assert.deepEqual(catalogCounts('normal'),{fixed:23,custom:3,cash:1});
assert.deepEqual(catalogCounts('advanced'),{fixed:7,custom:2,cash:0});
assert.equal(core.catalogs('normal').filter(item=>/制造指南书|百炼精铁/.test(item.category)).length,14);
assert.equal(core.rowPriceMode({name:'60级制造指南书',cash:false,priceMode:'custom'}),'custom','Existing explicit custom snapshot wins over new default');
assert.equal(core.rowPriceMode({name:'60级百炼精铁',cash:false,priceMode:'custom'}),'custom');
const oldBookRows={...core.fresh(),quantity:2,unitCost:3,rows:[row('book-old','60级制造指南书',3.1234,2),row('iron-old','60级百炼精铁',0.0001,3,{realized:true})]};
const explicitCustom=JSON.parse(JSON.stringify(oldBookRows));explicitCustom.rows.forEach(item=>item.priceMode='custom');
const oldBookJSON=JSON.stringify(oldBookRows),explicitJSON=JSON.stringify(explicitCustom),bookTotals=core.totals(oldBookRows);
assert.deepEqual(core.totals(explicitCustom),bookTotals,'Classification change never changes any amount');
assert.deepEqual([core.priceBreakdown(oldBookRows).fixed.revenue,core.priceBreakdown(explicitCustom).custom.revenue],[6.2471,6.2471]);
assert.equal(JSON.stringify(oldBookRows),oldBookJSON);assert.equal(JSON.stringify(explicitCustom),explicitJSON);
const bookImport=core.empty();bookImport.drafts.normal=oldBookRows;bookImport.history=[{...explicitCustom,id:'old-custom-book'}];
core.validateState(JSON.parse(JSON.stringify(bookImport)));
assert.equal(core.priceBreakdown(bookImport.history[0]).custom.revenue,6.2471);
assert.equal(core.rowPriceMode({name:'金刚石',cash:false,priceMode:'custom'}),'custom');
assert.equal(core.rowPriceMode({name:'偷袭',cash:false,priceMode:'fixed'}),'fixed');
for(const bad of ['other',null,123])assert.throws(()=>core.totals({...record,rows:[{...record.rows[0],priceMode:bad}]}),/分组/);
assert.throws(()=>core.totals({...record,rows:[{...record.rows[0],priceMode:'cash'}]}),/分组/);
assert.throws(()=>core.totals({...record,rows:[{...record.rows[2],priceMode:'custom'}]}),/分组/);
const state=core.empty();state.drafts.normal=legacy;state.history=[record];core.validateState(state);
const imported=core.validateState(JSON.parse(JSON.stringify(state)));assert.deepEqual(core.priceBreakdown(imported.history[0]),parts);assert.deepEqual(core.priceBreakdown(imported.drafts.normal),legacyParts);
const tiny={...core.fresh(),quantity:1,rows:[row('tiny-a','金刚石',0.1),row('tiny-b','偷袭',0.2)]};
const exact=core.priceBreakdown(tiny);assert.equal(exact.total.revenue,0.3);assert.equal(exact.total.revenueUnits,3000);
assert.equal(exact.fixed.revenueUnits+exact.custom.revenueUnits+exact.cash.revenueUnits,3000);
const noRows=core.priceBreakdown(core.fresh());assert.equal(noRows.total.quantity,0);assert.equal(noRows.total.revenueUnits,0);
const invalidImport=JSON.parse(JSON.stringify(state));invalidImport.history[0].rows[0].priceMode='invalid';assert.throws(()=>core.validateState(invalidImport),/分组/);
const settled=core.empty();settled.drafts.normal=JSON.parse(original);core.settle(settled);
assert.deepEqual(core.priceBreakdown(settled.history[0]),parts);assert.equal(settled.history[0].rows[0].priceMode,'fixed');
settled.drafts.normal=JSON.parse(JSON.stringify(settled.history[0]));settled.drafts.normal.rows[0].name='重新命名物品';core.settle(settled);
assert.equal(settled.history.length,1);assert.equal(core.priceBreakdown(settled.history[0]).fixed.revenue,20,'Renamed historical snapshot must not silently change group');
const storage=new Map(),shared=priceApi.createStore({getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)});
shared.set({name:'金刚石'},100);assert.equal(shared.get({name:'金刚石'}),100);assert.equal(core.priceBreakdown(record).fixed.revenue,20);
shared.set({name:'金刚石'},200);assert.equal(core.priceBreakdown(record).fixed.revenue,20);assert.equal(record.rows[0].price,10);
shared.set({name:'偷袭',category:'低级兽诀'},30);assert.equal(shared.get({name:'偷袭',category:'低级兽诀'}),30);assert.equal(record.rows[1].price,7);
shared.set({name:'剑',kind:'书',level:60},10);shared.set({name:'刀',kind:'书',level:60},20);shared.set({name:'剑',kind:'书',level:70},30);
assert.deepEqual([shared.get({name:'剑',kind:'书',level:60}),shared.get({name:'刀',kind:'书',level:60}),shared.get({name:'剑',kind:'书',level:70})],[10,20,30],'Fixed book reference keeps equipment type and level tiers independent');
shared.set({name:'百炼精铁',kind:'铁',level:60},1);shared.set({name:'百炼精铁',kind:'铁',level:70},2);
assert.deepEqual([shared.get({name:'百炼精铁',kind:'铁',level:60}),shared.get({name:'百炼精铁',kind:'铁',level:70})],[1,2]);
for(const [short,typed] of [['60级剑书',{kind:'书',name:'剑',level:60}],['60项链书',{kind:'书',name:'项链',level:60}],['70级项链书',{kind:'书',name:'项链',level:70}],['100刀书',{kind:'书',name:'刀',level:100}]])assert.equal(priceApi.describe({name:short}).key,priceApi.describe(typed).key,'Short manufacturing-book name shares only its precise type and grade');
assert.equal(priceApi.describe({name:'60书'}).shareable,false);assert.equal(priceApi.describe({name:'60级制造指南书'}).shareable,false);
assert.deepEqual(core.totals(oldBookRows),bookTotals);assert.equal(JSON.stringify(oldBookRows),oldBookJSON);
assert.throws(()=>shared.set({name:'低级魔兽要诀',category:'低级兽诀'},100),/具体/);
assert.throws(()=>shared.set({name:'低级召唤兽内丹',category:'低级内丹'},100),/具体/);
assert.equal(JSON.stringify(record),original);
console.log('PASS: fixed/custom/cash integer-precision breakdown, legacy/import compatibility, immutable row snapshots, shared-reference changes and generic-skill safeguards.');
