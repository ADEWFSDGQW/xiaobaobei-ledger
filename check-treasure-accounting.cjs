'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('./dist/assets/treasure-core');
const ring=require('./dist/assets/ring-accounting');
const record={...core.fresh('normal'),id:'treasure-test',date:'2026-10-27',map:'傲来国',quantity:10,unitCost:2,extraCost:1,minutes:60,rows:[
  {id:'cash',name:'梦幻币',category:'金币',source:'direct',quantity:1,price:3,cash:true,realized:true},
  {id:'beast',name:'低级兽诀',category:'兽诀',source:'direct',quantity:1,price:50,cash:false,realized:false},
  {id:'five',name:'金刚石',category:'五宝',source:'direct',quantity:1,price:100,cash:false,realized:true},
  {id:'gem',name:'月亮石',category:'宝石',source:'battle',quantity:1,price:5,cash:false,realized:false}
]};
const state=core.empty();state.history=[record];core.validateState(state);
const scene={version:1,prices:{},draft:require('./dist/assets/scene-project').fresh(),history:[{id:'scene-test',date:'2026-10-27',scene:'东海湾',note:'',minutes:60,rows:[{kind:'pet',name:'大海龟',quantity:1,price:100},{kind:'gold',name:'金币',quantity:1,price:10},{kind:'cost',name:'其他费用',quantity:1,price:20}]}]};
const storage=new Map([[core.KEY,JSON.stringify(state)],['mh_scene_project_v1',JSON.stringify(scene)]]),events={};
let ringHistory=[{id:'ring-test',mode:'pet',endedAt:'2026-10-27T12:00:00+08:00',role:'',extra:0,costs:[],rewards:[{kind:'修炼果',name:'修炼果',quantity:1,price:80}]}];
const context={console,localStorage:{getItem:k=>storage.get(k)||null},addEventListener:(key,fn)=>(events[key]||(events[key]=[])).push(fn),document:{},treasureCore:core,ringAccounting:{day:d=>ring.derive(ringHistory)[d]||{revenue:0,cost:0,count:0,rows:[]},mergeDaily:(base,settings)=>ring.mergeDaily(base,ring.derive(ringHistory),settings)}};
context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/assets/scene-project.js','utf8'),context);
vm.runInContext(fs.readFileSync('dist/assets/treasure-accounting.js','utf8'),context);
const base=[{date:'2026-10-27',goldIncome:50,itemIncome:10,cardCost:5,netIncome:55,convertedIncome:55,conversionFactor:1}];
const accounting=context.ringAccounting;
let merged=accounting.mergeDaily(base,{ratio:3000,discount:100});
assert.equal(merged[0].netIncome,297);assert.equal(merged[0].goldIncome,63);assert.equal(merged[0].itemIncome,290);
assert.equal(merged[0].treasureIncome,103);assert.equal(merged[0].treasureCost,21);
const first=JSON.parse(JSON.stringify(merged));for(let i=0;i<5;i++)merged=accounting.mergeDaily(merged,{ratio:3000,discount:100});assert.deepEqual(JSON.parse(JSON.stringify(merged)),first);
assert.equal(accounting.day('2026-10-27').treasureQuantity,10);
assert.equal(accounting.day('2026-10-27').revenue,293);
assert.equal(accounting.day('2026-10-27').cost,51);
record.rows[1].realized=true;storage.set(core.KEY,JSON.stringify(state));events['ring-ledger-changed'].forEach(fn=>fn());
merged=accounting.mergeDaily(merged,{});assert.equal(merged[0].netIncome,347);
storage.set(core.KEY,JSON.stringify(core.empty()));events.storage.forEach(fn=>fn({key:core.KEY}));
merged=accounting.mergeDaily(merged,{});assert.equal(merged[0].netIncome,215);assert.equal(merged[0].goldIncome,60);
scene.history=[];storage.set('mh_scene_project_v1',JSON.stringify(scene));merged=accounting.mergeDaily(merged,{});assert.equal(merged[0].netIncome,125);
ringHistory=[];merged=accounting.mergeDaily(merged,{});assert.equal(merged[0].netIncome,55);assert.equal(merged[0].goldIncome,50);assert.equal(merged[0].itemIncome,10);
assert.equal(base[0].netIncome,55);
storage.set(core.KEY,'{bad');events['ring-ledger-changed'].forEach(fn=>fn());assert.throws(()=>accounting.day('2026-10-27'));
console.log('PASS: treasure + scene + ring + base ledger, cash/item split, unsold exclusion, sale edits, repeated merges, deletion and corruption detection.');
