'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {KEY,describe,createStore,collectLegacy}=require('./dist/assets/item-prices.js');
function storage(initial={}){const map=new Map(Object.entries(initial));return {map,writes:0,getItem:key=>map.has(key)?map.get(key):null,setItem(key,value){this.writes++;map.set(key,value);}};}
const same=(a,b)=>assert.equal(describe(a).key,describe(b).key);
same({name:'60武器'},{name:'60级武器'});same({name:'60装备'},{name:'60防具'});same({name:'玫瑰'},{name:'红玫瑰'});
assert.equal(describe({name:'金刚石'}).priceMode,'fixed');assert.equal(describe({name:'花豆'}).priceMode,'fixed');assert.equal(describe({name:'60级装备'}).priceMode,'fixed');
assert.equal(describe({name:'金柳露',type:'fixed'}).priceMode,'fixed');assert.equal(describe({name:'金柳露'}).priceMode,'custom');
assert.notEqual(describe({name:'兔子怪',kind:'pet'}).key,describe({name:'兔子怪',kind:'item'}).key);
const pet=count=>({name:'持国巡守',kind:'pet',skillCount:count});
for(const count of [undefined,null,'']){assert.equal(describe(pet(count)).key,'["pet","持国巡守"]');assert.equal(describe(pet(count)).name,'持国巡守');}
for(const count of [0,3,4,99]){const d=describe(pet(count));assert.equal(d.key,JSON.stringify(['pet','持国巡守',count]));assert.equal(d.name,'持国巡守 · '+count+'技能');assert.equal(d.priceMode,'custom');assert.equal(d.shareable,true);}
same(pet(3),{name:'持国巡守',category:'召唤兽',skillCount:3});same(pet(4),{name:'持国巡守',category:'场景召唤兽',skillCount:4});
same(pet(3),{...pet(3),level:175});
const invalidCounts=['0','3',' 3 ','0.0','',-1,100,3.5,NaN,Infinity,-Infinity,true,false,[],{},'三'].filter(value=>value!=='');
for(const count of invalidCounts)assert.equal(describe(pet(count)).shareable,false,'Invalid typed skill count '+String(count));
const tierStorage=storage(),tierEvents=[],tiers=createStore(tierStorage,event=>tierEvents.push(event));
tiers.set(pet(undefined),180);tiers.set(pet(0),0);tiers.set(pet(3),300);tiers.set(pet(4),400);tiers.set(pet(99),9900);
assert.equal(tiers.get(pet(undefined),999),180);assert.equal(tiers.get(pet(null)),180);assert.equal(tiers.get(pet('')),180);
assert.equal(tiers.has(pet(0)),true);assert.equal(tiers.get(pet(0),999),0);assert.equal(tiers.get(pet(3)),300);assert.equal(tiers.get(pet(4)),400);assert.equal(tiers.get(pet(99)),9900);
assert.equal(tiers.has(pet(2)),false);assert.equal(tiers.get(pet(2),999),999,'Missing skill tier never falls back to an unknown tier');
const specificOnly=createStore(storage());specificOnly.set(pet(3),333);assert.equal(specificOnly.get(pet(undefined),999),999);assert.equal(specificOnly.has(pet(0)),false);
assert.equal(tiers.get({...pet(3),kind:'item'},999),999,'An item and pet with identical names stay separate');
for(const count of invalidCounts){const before=tierStorage.getItem(KEY),writes=tierStorage.writes,notifies=tierEvents.length;assert.throws(()=>tiers.setMany([{item:pet(3),price:1},{item:pet(count),price:2}]));assert.equal(tierStorage.getItem(KEY),before);assert.equal(tierStorage.writes,writes);assert.equal(tierEvents.length,notifies);assert.equal(tiers.get(pet(count),777),777);}
const tierList=tiers.list();assert.equal(tierList.length,5);
for(const entry of tierList){assert.equal(describe(entry).key,entry.key);assert.equal(describe(entry.item).key,entry.key);const parts=JSON.parse(entry.key);if(parts.length===3)assert.equal(entry.item.skillCount,parts[2]);else assert.equal(Object.hasOwn(entry.item,'skillCount'),false);}
const tierWrites=tierStorage.writes;tiers.setMany(tierList.map(entry=>({item:entry,price:entry.price})));assert.equal(tierStorage.writes,tierWrites);
const oldPetKey='["pet","持国巡守"]',oldPetStorage=storage({[KEY]:JSON.stringify({version:1,entries:{[oldPetKey]:{key:oldPetKey,name:'持国巡守',priceMode:'custom',units:1800000}}})}),oldPets=createStore(oldPetStorage);
assert.equal(oldPets.get(pet(undefined)),180);assert.equal(oldPets.get(pet(3),999),999);assert.equal(oldPetStorage.writes,0);oldPets.set(pet(3),333);assert.equal(oldPets.get(pet(undefined)),180);
assert.equal(createStore(tierStorage).get(pet(3)),300,'Reload reads three-part shared keys');
for(const parts of [['pet','持国巡守','3'],['pet','持国巡守',null],['pet','持国巡守',true],['pet','持国巡守',-1],['pet','持国巡守',100],['pet','持国巡守',3.5],['pet','持国巡守',3,'extra']]){
  const key=JSON.stringify(parts),corruptTier=storage({[KEY]:JSON.stringify({version:1,entries:{[key]:{key,name:'持国巡守 · 3技能',priceMode:'custom',units:1}}})}),corruptApi=createStore(corruptTier),before=corruptTier.getItem(KEY);assert.throws(()=>corruptApi.list(),/损坏/);assert.throws(()=>corruptApi.set(pet(4),4),/损坏/);assert.equal(corruptTier.getItem(KEY),before);assert.equal(corruptTier.writes,0);
}
const wrongTierKey='["pet","持国巡守",3]',wrongTierMetadata=storage({[KEY]:JSON.stringify({version:1,entries:{[wrongTierKey]:{key:wrongTierKey,name:'持国巡守 · 4技能',priceMode:'custom',units:1}}})});assert.throws(()=>createStore(wrongTierMetadata).list(),/元数据损坏/);
same({name:'剑',kind:'书',level:100},{name:'100级剑制造指南书'});
assert.notEqual(describe({name:'剑',kind:'书',level:100}).key,describe({name:'刀',kind:'书',level:100}).key);
assert.notEqual(describe({name:'剑',kind:'书',level:100}).key,describe({name:'剑',kind:'书',level:110}).key);
same({name:'百炼精铁',kind:'铁',level:100},{name:'100级百炼精铁'});
same({name:'100铁'},{name:'100级百炼精铁'});
assert.notEqual(describe({name:'100级百炼精铁'}).key,describe({name:'110级百炼精铁'}).key);
assert.notEqual(describe({name:'耳饰',kind:'灵饰书',level:100}).key,describe({name:'耳饰',kind:'书',level:100}).key);
const concreteMaterials=[{name:'剑',kind:'书',level:100},{name:'百炼精铁',kind:'铁',level:100},{name:'耳饰',kind:'灵饰书',level:80},{name:'元灵晶石',kind:'灵饰铁',level:80},{name:'100级剑制造指南书'},{name:'100铁'},{name:'剑',category:'制造书',level:100},{name:'耳饰',category:'灵饰书',level:80}];
for(const item of concreteMaterials){assert.equal(describe(item).priceMode,'fixed',JSON.stringify(item));assert.equal(describe(item).shareable,true);assert.equal(describe({...item,type:'non-fixed',priceMode:'custom'}).priceMode,'fixed','Book/iron categories are fixed even with old custom metadata');}
for(const [name,type,level] of [['60级剑书','剑',60],['60项链书','项链',60],['70级项链书','项链',70],['100刀书','刀',100],['100枪矛书','枪矛',100]]){const item={name,category:'自定义物品'};same(item,{name:type,kind:'书',level});assert.equal(describe(item).priceMode,'fixed');assert.equal(describe(item).shareable,true);}
for(const name of ['60任务书','60兽诀书','60级魔兽要诀书','60级偷袭兽诀书','60级虚构类别书']){assert.equal(describe({name,category:'自定义物品'}).priceMode,'custom',name);assert.notEqual(JSON.parse(describe({name}).key)[0],'book');}
assert.notEqual(describe({name:'60项链书'}).key,describe({name:'70级项链书'}).key);assert.notEqual(describe({name:'100刀书'}).key,describe({name:'100级剑书'}).key);
const unresolvedMaterials=[{name:'制造指南书'},{name:'百炼精铁'},{name:'灵饰指南书'},{name:'元灵晶石'},{name:'书'},{name:'铁'},{name:'灵饰书'},{name:'灵饰铁'},{name:'60书'},{name:'制造指南书',kind:'书',level:60},{name:'灵饰指南书',kind:'灵饰书',level:80},{name:'100级百炼精铁',level:110}];
for(const item of unresolvedMaterials){const d=describe(item);assert.equal(d.priceMode,'fixed',JSON.stringify(item));assert.equal(d.shareable,false,'An unresolved material never shares one generic price: '+JSON.stringify(item));assert.equal(d.key,'');}
for(const name of ['低级兽诀','高级魔兽要诀','低级内丹','高级召唤兽内丹','上古锻造图册'])assert.equal(describe({name}).priceMode,'custom','Material reclassification must not catch unrelated books: '+name);
const oldMaterialEntries=[
  {key:'["book",100,"剑"]',name:'100级剑制造指南书',priceMode:'custom',units:1111111},
  {key:'["book",100,"刀"]',name:'100级刀制造指南书',priceMode:'custom',units:2222222},
  {key:'["book",110,"剑"]',name:'110级剑制造指南书',priceMode:'custom',units:3333333},
  {key:'["iron",100]',name:'100级百炼精铁',priceMode:'custom',units:123456},
  {key:'["iron",110]',name:'110级百炼精铁',priceMode:'custom',units:0},
  {key:'["accessory-book",80,"耳饰"]',name:'80级耳饰灵饰指南书',priceMode:'custom',units:1234},
  {key:'["accessory-iron",80]',name:'80级元灵晶石',priceMode:'custom',units:987654},
  {key:'["pet","持国巡守",3]',name:'持国巡守 · 3技能',priceMode:'custom',units:3000000}
];
const oldMaterialsRaw=JSON.stringify({version:1,entries:Object.fromEntries(oldMaterialEntries.map(entry=>[entry.key,entry]))}),oldMaterialsLedger=JSON.stringify({draft:{rows:[{name:'剑',kind:'书',level:100,price:1,priceMode:'custom'}]},history:[{rows:[{name:'百炼精铁',level:100,price:2,priceMode:'custom'}]}]}),oldMaterialsStorage=storage({[KEY]:oldMaterialsRaw,mh_scene_project_v1:oldMaterialsLedger,mh_ring_project_v1:oldMaterialsLedger,mh_treasure_project_v1:oldMaterialsLedger,mh_records:'[{"price":3}]',mh_daily_income:'[{"itemIncome":4}]'}),oldMaterialsSnapshot=Object.fromEntries(oldMaterialsStorage.map),materialEvents=[],oldMaterialsApi=createStore(oldMaterialsStorage,event=>materialEvents.push(event));
const normalizedMaterials=oldMaterialsApi.list();assert.equal(normalizedMaterials.length,8);assert.equal(oldMaterialsStorage.writes,0);assert.equal(oldMaterialsStorage.getItem(KEY),oldMaterialsRaw);
for(const entry of normalizedMaterials){const original=oldMaterialEntries.find(value=>value.key===entry.key);assert.equal(entry.price,original.units/10000);assert.equal(describe(entry).key,entry.key);assert.equal(oldMaterialsApi.get(entry.item),entry.price);assert.equal(entry.priceMode,JSON.parse(entry.key)[0]==='pet'?'custom':'fixed');assert.equal(entry.item.type,entry.priceMode==='fixed'?'fixed':'non-fixed');}
oldMaterialsApi.setMany(normalizedMaterials.map(entry=>({item:entry,price:entry.price})));oldMaterialsApi.seed([{item:{name:'剑',kind:'书',level:100},price:999},{item:{name:'制造指南书'},price:10}]);
for(const entry of normalizedMaterials){const returned=oldMaterialsApi.set(entry.item,entry.price);assert.equal(returned.priceMode,entry.priceMode);}
assert.equal(oldMaterialsStorage.getItem(KEY),oldMaterialsRaw,'Reading/listing/same-price writes preserve the exact legacy v1 bytes');assert.equal(oldMaterialsStorage.writes,0);assert.equal(materialEvents.length,0);
assert.throws(()=>oldMaterialsApi.setMany([{item:{name:'剑',kind:'书',level:100},price:999},{item:{name:'制造指南书'},price:10}]));assert.equal(oldMaterialsStorage.getItem(KEY),oldMaterialsRaw);
oldMaterialsApi.set({name:'剑',kind:'书',level:100},444.4444);assert.equal(oldMaterialsStorage.writes,1);assert.equal(materialEvents.length,1);const afterMaterialEdit=JSON.parse(oldMaterialsStorage.getItem(KEY));assert.equal(afterMaterialEdit.entries['["book",100,"剑"]'].priceMode,'fixed');assert.equal(afterMaterialEdit.entries['["book",100,"剑"]'].units,4444444);for(const entry of oldMaterialEntries.filter(entry=>entry.key!=='["book",100,"剑"]'))assert.deepEqual(afterMaterialEdit.entries[entry.key],entry);
for(const key of Object.keys(oldMaterialsSnapshot).filter(key=>key!==KEY))assert.equal(oldMaterialsStorage.getItem(key),oldMaterialsSnapshot[key]);
const wrongOldBook={...oldMaterialEntries[0],name:'100级刀制造指南书'},wrongOldBookStorage=storage({[KEY]:JSON.stringify({version:1,entries:{[wrongOldBook.key]:wrongOldBook}})});assert.throws(()=>createStore(wrongOldBookStorage).list(),/元数据损坏/);assert.equal(wrongOldBookStorage.writes,0);
function oldItemEntry(name,units){const key=JSON.stringify(['item',name]);return {key,name,priceMode:'custom',units};}
function sharedRaw(entries){return JSON.stringify({version:1,entries:Object.fromEntries(entries.map(entry=>[entry.key,entry]))});}
const aliasEntries=[oldItemEntry('60项链书',0),oldItemEntry('100刀书',990000),...['书','铁','灵饰书','灵饰铁','60灵饰书','70级灵饰书'].map((name,index)=>oldItemEntry(name,10000+index))],aliasRaw=sharedRaw(aliasEntries),aliasStorage=storage({[KEY]:aliasRaw,mh_treasure_project_v1:oldMaterialsLedger,mh_ring_project_v1:oldMaterialsLedger,mh_scene_project_v1:oldMaterialsLedger,mh_records:'[{"price":5}]',mh_daily_income:'[{"itemIncome":6}]'}),aliasSnapshot=Object.fromEntries(aliasStorage.map),aliasEvents=[],aliasApi=createStore(aliasStorage,event=>aliasEvents.push(event));
assert.equal(aliasApi.has({name:'60级项链书'}),true);assert.equal(aliasApi.get({name:'项链',kind:'书',level:60},999),0);assert.equal(aliasApi.get({name:'100级刀制造指南书'}),99);assert.equal(aliasApi.get({name:'项链',kind:'书',level:70},777),777);
for(const name of ['书','铁','灵饰书','灵饰铁','60灵饰书','70级灵饰书']){assert.equal(describe({name}).priceMode,'fixed');assert.equal(describe({name}).shareable,false);assert.equal(aliasApi.has({name}),false);assert.equal(aliasApi.get({name},777),777,'A legacy generic price must never become a shared reference');}
const aliasList=aliasApi.list();assert.equal(aliasList.length,2);assert.equal(new Set(aliasList.map(entry=>entry.key)).size,2);for(const entry of aliasList){assert.equal(entry.priceMode,'fixed');assert.equal(JSON.parse(entry.key)[0],'book');assert.equal(describe(entry).key,entry.key);assert.equal(aliasApi.get(entry.item),entry.price);}
aliasApi.seed([{item:{name:'60项链书'},price:999},{item:{name:'100刀书'},price:999},{item:{name:'书'},price:99}]);aliasApi.setMany(aliasList.map(entry=>({item:entry,price:entry.price})));assert.equal(aliasApi.set({name:'60级项链书'},0).key,'["book",60,"项链"]');assert.equal(aliasStorage.getItem(KEY),aliasRaw);assert.equal(aliasStorage.writes,0);assert.equal(aliasEvents.length,0);
assert.throws(()=>aliasApi.setMany([{item:{name:'60项链书'},price:999},{item:{name:'书'},price:99}]));assert.equal(aliasStorage.getItem(KEY),aliasRaw);assert.equal(aliasStorage.writes,0);
aliasApi.set({name:'60项链书'},12.3456);assert.equal(aliasStorage.writes,1);assert.equal(aliasEvents.length,1);assert.equal(aliasApi.get({name:'60级项链书'}),12.3456);assert.equal(aliasApi.list().length,2);const afterAliasEdit=JSON.parse(aliasStorage.getItem(KEY));assert.deepEqual(afterAliasEdit.entries['["book",60,"项链"]'],{key:'["book",60,"项链"]',name:'60级项链制造指南书',priceMode:'fixed',units:123456});for(const entry of aliasEntries)assert.deepEqual(afterAliasEdit.entries[entry.key],entry);for(const key of Object.keys(aliasSnapshot).filter(key=>key!==KEY))assert.equal(aliasStorage.getItem(key),aliasSnapshot[key]);
const canonicalConflict={key:'["book",60,"项链"]',name:'60级项链制造指南书',priceMode:'custom',units:0},conflictingAlias=oldItemEntry('60项链书',990000);
for(const entries of [[conflictingAlias,canonicalConflict],[canonicalConflict,conflictingAlias]]){
  const source=sharedRaw(entries),data=storage({[KEY]:source}),store=createStore(data);assert.equal(store.get({name:'60项链书'},777),0);assert.equal(store.has({name:'项链',kind:'书',level:60}),true);assert.equal(store.list().length,1);assert.equal(store.list()[0].price,0);store.seed([{item:{name:'60项链书'},price:555}]);store.setMany(store.list().map(entry=>({item:entry,price:entry.price})));assert.equal(data.getItem(KEY),source);assert.equal(data.writes,0);store.set({name:'60级项链书'},22);assert.equal(store.get({name:'项链',kind:'书',level:60}),22);assert.equal(store.list().length,1);assert.deepEqual(JSON.parse(data.getItem(KEY)).entries[conflictingAlias.key],conflictingAlias);
}
const alternateAliases=storage({[KEY]:sharedRaw([oldItemEntry('060项链书',420000),oldItemEntry('60级项链书',430000),oldItemEntry('60项链书',0)])}),alternateApi=createStore(alternateAliases);assert.equal(alternateApi.get({name:'60项链书'},777),0);assert.equal(alternateApi.list().length,1);assert.equal(alternateApi.list()[0].price,0);assert.equal(alternateAliases.writes,0);
const paddedAliasApi=createStore(storage({[KEY]:sharedRaw([oldItemEntry('060项链书',420000)])}));assert.equal(paddedAliasApi.get({name:'项链',kind:'书',level:60}),42);assert.equal(paddedAliasApi.list()[0].price,42);
for(const entry of [oldItemEntry('60书',1),oldItemEntry('制造指南书',1),oldItemEntry('100级剑制造指南书',1),oldItemEntry('高级魔兽要诀',1),{...oldItemEntry('60项链书',1),name:'70项链书'},{...oldItemEntry('灵饰书',1),name:'书'},{...oldItemEntry('60灵饰书',1),name:'70灵饰书'}]){const source=sharedRaw([entry]),data=storage({[KEY]:source}),store=createStore(data);assert.throws(()=>store.list(),/损坏/);assert.throws(()=>store.set({name:'金刚石'},10),/损坏/);assert.equal(data.getItem(KEY),source);assert.equal(data.writes,0);}
const unrelatedBookApi=createStore(storage({[KEY]:sharedRaw([oldItemEntry('60任务书',10000)])}));assert.equal(unrelatedBookApi.list()[0].priceMode,'custom');assert.equal(unrelatedBookApi.get({name:'60任务书'}),1);
same({name:'高级偷袭',category:'高级兽诀'},{name:'偷袭',category:'高级兽诀'});
assert.notEqual(describe({name:'偷袭',category:'低级兽诀'}).key,describe({name:'偷袭',category:'高级兽诀'}).key);
same({name:'迅敏',category:'低级内丹'},{name:'低级迅敏内丹',category:'低级内丹'});
for(const item of [{name:'梦幻币'},{name:'实际金币',kind:'gold'},{name:'点卡',kind:'cost'},{name:'低级兽诀'},{name:'高级魔兽要诀'},{name:'高级召唤兽内丹'},{name:'炼妖石'},{name:'10～50级装备'},{name:'60书'},{name:'制造指南书',kind:'书',level:60},{name:'百炼精铁'}])assert.equal(describe(item).shareable,false,JSON.stringify(item));
assert.equal(describe({name:'115级炼妖石'}).shareable,true);
same({name:'炼妖石',level:115},{name:'115级炼妖石'});
assert.equal(describe({name:'100级百炼精铁',kind:'铁',level:110}).shareable,false);
const s=storage(),events=[];const api=createStore(s,e=>events.push(e));
assert.equal(api.get({name:'金刚石'},123),123);api.set({name:'金刚石'},150.1234);assert.equal(api.get({name:'金刚石'}),150.1234);
api.set({name:'60装备'},20);assert.equal(api.get({name:'60防具'}),20);const writes=s.writes,eventCount=events.length;api.set({name:'60级防具'},20);assert.equal(s.writes,writes);assert.equal(events.length,eventCount);
api.set({name:'金刚石'},0);assert.equal(api.get({name:'金刚石'},999),0);api.seed([{item:{name:'金刚石'},price:99},{item:{name:'龙鳞'},price:0},{item:{name:'定魂珠'},price:170}]);assert.equal(api.get({name:'金刚石'},999),0);assert.equal(api.get({name:'龙鳞'},999),999);assert.equal(api.get({name:'定魂珠'}),170);
assert.equal(api.has({name:'金刚石'}),true);assert.equal(api.has({name:'龙鳞'}),false);
for(const bad of [-1,Infinity,NaN,0.00001,0.000000001,'2',null]){const before=s.getItem(KEY);assert.throws(()=>api.setMany([{item:{name:'金刚石'},price:10},{item:{name:'龙鳞'},price:bad}]));assert.equal(s.getItem(KEY),before);}
assert.throws(()=>api.set({name:'低级兽诀'},10));
const recursive=storage();let recursiveApi,notifications=0;recursiveApi=createStore(recursive,()=>{notifications++;recursiveApi.set({name:'红玫瑰'},21);});recursiveApi.set({name:'玫瑰'},21);assert.equal(recursive.writes,1);assert.equal(notifications,1);
const broken=storage({[KEY]:'{broken'}),brokenApi=createStore(broken);assert.throws(()=>brokenApi.set({name:'金刚石'},3),/损坏/);assert.equal(broken.getItem(KEY),'{broken');assert.equal(broken.writes,0);
const polluted=storage({[KEY]:JSON.stringify({version:1,entries:{constructor:{key:'constructor',name:'x',priceMode:'fixed',units:1}}})});assert.throws(()=>createStore(polluted).list());
const valid=JSON.parse(s.getItem(KEY));valid.entries['["item","evil"]']={key:'["item","evil"]',name:'evil',priceMode:'cash',units:1};const invalid=storage({[KEY]:JSON.stringify(valid)});assert.throws(()=>createStore(invalid).seed([]));
const legacy=storage({
  mh_items:JSON.stringify([{id:7,name:'金刚石',type:'fixed',price:150},{id:13,price:3},{name:'低级兽诀',type:'non-fixed',price:8},{name:'龙鳞',type:'fixed',price:0}]),
  mh_scene_project_v1:JSON.stringify({prices:{'["item","金刚石"]':140,'["pet","持国巡守"]':180,'["item","龙鳞"]':1.5},draft:{unchanged:'draft'},history:[{unchanged:'history'}]}),
  mh_treasure_project_v1:JSON.stringify({prices:{'["normal","金刚石","direct"]':130,'["normal","龙鳞","direct"]':1,'["normal","夜光珠","direct"]':10,'["normal","低级兽诀","direct"]':3},history:[{untouched:true}]}),
  mh_ring_project_v1:JSON.stringify({prices:{'金刚石':1000000,'玫瑰':210000,'60装备':210000},rewardPrices:{'["pet","铁","百炼精铁","100"]':123456,'["human","书","剑","100"]':1000000,'["human","书","制造指南书","100"]':50000},history:[{stays:true}]})
});
const snapshot=Object.fromEntries(legacy.map),migration=collectLegacy(legacy);assert.equal(legacy.writes,0);assert.deepEqual(Object.fromEntries(legacy.map),snapshot);
const shared=createStore(legacy);shared.seed(migration);assert.equal(shared.get({name:'金刚石'}),150);assert.equal(shared.get({name:'金柳露'}),3);assert.equal(shared.get({name:'龙鳞'}),1.5);assert.equal(shared.get({name:'夜光珠'}),10);assert.equal(shared.get({name:'持国巡守',kind:'pet'}),180);assert.equal(shared.get({name:'红玫瑰'}),21);assert.equal(shared.get({name:'60防具'}),21);assert.equal(shared.get({name:'百炼精铁',kind:'铁',level:100}),12.3456);assert.equal(shared.get({name:'剑',kind:'书',level:100}),100);
for(const key of Object.keys(snapshot))assert.equal(legacy.getItem(key),snapshot[key]);
shared.set({name:'金刚石'},0);shared.seed(collectLegacy(legacy));assert.equal(shared.get({name:'金刚石'},99),0);
assert.equal(collectLegacy(storage({mh_items:'bad json'})).length,0);
const tierLegacy=storage({mh_scene_project_v1:JSON.stringify({prices:{'["pet","持国巡守"]':180,'["pet","持国巡守",0]':5,'["pet","持国巡守",3]':300,'["pet","持国巡守",4]':400,'["pet","持国巡守","5"]':500,'["pet","持国巡守",null]':999,'["pet","持国巡守",100]':1000,'["pet","持国巡守",3.5]':350,'["pet","持国巡守",7]':0,'["item","60级武器"]':20},draft:{rows:[{...pet(8),price:888}]},history:[{rows:[{...pet(9),price:999}]}]}),mh_records:JSON.stringify([{...pet(10),price:1000}]),mh_daily_income:'[{"netIncome":1}]'});
const tierLegacySnapshot=Object.fromEntries(tierLegacy.map),tierMigration=collectLegacy(tierLegacy);assert.deepEqual(Object.fromEntries(tierLegacy.map),tierLegacySnapshot);assert.equal(tierLegacy.writes,0);
assert.equal(tierMigration.length,5);const migratedTiers=createStore(tierLegacy);migratedTiers.seed(tierMigration);assert.equal(migratedTiers.get(pet(undefined)),180);assert.equal(migratedTiers.get(pet(0)),5);assert.equal(migratedTiers.get(pet(3)),300);assert.equal(migratedTiers.get(pet(4)),400);assert.equal(migratedTiers.get({name:'60武器'}),20);
for(const count of [5,7,8,9,10])assert.equal(migratedTiers.has(pet(count)),false,'No invalid, zero seed, draft or history inference for '+count);
for(const key of Object.keys(tierLegacySnapshot))assert.equal(tierLegacy.getItem(key),tierLegacySnapshot[key]);
migratedTiers.set(pet(0),0);migratedTiers.seed(collectLegacy(tierLegacy));assert.equal(migratedTiers.get(pet(0),999),0);assert.equal(migratedTiers.get(pet(undefined)),180);
const ledger=JSON.stringify({draft:{rows:[{price:1}]},history:[{rows:[{price:2}]}]});const noLedger=storage({mh_treasure_project_v1:ledger});createStore(noLedger).set({name:'金刚石'},999);assert.equal(noLedger.getItem('mh_treasure_project_v1'),ledger);
const roundTrip=shared.list();for(const entry of roundTrip){assert.equal(describe(entry).key,entry.key);assert.equal(describe(entry.item).key,entry.key);}const oldCount=legacy.writes;shared.setMany(roundTrip.map(entry=>({item:entry,price:entry.price})));assert.equal(legacy.writes,oldCount);
const poisoned=JSON.parse(JSON.stringify(roundTrip[0]));poisoned.key='constructor';assert.throws(()=>shared.setMany([{item:poisoned,price:5}]),/不一致/);
const browserStorage=storage({[KEY]:oldMaterialsRaw}),listeners={},dispatched=[];const context={localStorage:browserStorage,dispatchEvent:e=>dispatched.push(e),addEventListener:(name,cb)=>listeners[name]=cb,CustomEvent:function(name,options){this.type=name;this.detail=options.detail;}};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('./dist/assets/item-prices.js','utf8'),context);
assert.equal(context.itemPrices.get({name:'100级剑制造指南书'}),111.1111);assert.equal(context.itemPrices.list().find(entry=>entry.key==='["book",100,"剑"]').priceMode,'fixed');assert.equal(browserStorage.getItem(KEY),oldMaterialsRaw);assert.equal(browserStorage.writes,0);assert.equal(dispatched.length,0);
context.itemPrices.set({name:'花豆'},0);assert.equal(dispatched[0].type,'shared-prices-changed');assert.equal(context.itemPrices.get({name:'花豆'},5),0);listeners.storage({key:KEY});assert.equal(dispatched[1].detail.external,true);
context.itemPrices.set(pet(0),0);context.itemPrices.set(pet(3),333);assert.equal(context.itemPrices.get(pet(0),999),0);assert.equal(context.itemPrices.get(pet(3)),333);assert.equal(context.itemPrices.get(pet(undefined),999),999);assert.equal(context.itemPrices.list().find(entry=>entry.item.skillCount===3).name,'持国巡守 · 3技能');
const aliasBrowserStorage=storage({[KEY]:aliasRaw}),aliasBrowserContext={localStorage:aliasBrowserStorage,dispatchEvent(){},addEventListener(){},CustomEvent:function(name,options){this.type=name;this.detail=options.detail;}};aliasBrowserContext.window=aliasBrowserContext;vm.createContext(aliasBrowserContext);vm.runInContext(fs.readFileSync('./dist/assets/item-prices.js','utf8'),aliasBrowserContext);assert.equal(aliasBrowserContext.itemPrices.list().length,2);assert.equal(aliasBrowserContext.itemPrices.get({name:'60项链书'},999),0);assert.equal(aliasBrowserContext.itemPrices.get({name:'书'},999),999);assert.equal(aliasBrowserStorage.getItem(KEY),aliasRaw);assert.equal(aliasBrowserStorage.writes,0);
console.log('PASS: shared price aliases, fixed/custom/cash, typed skills/pets, independent pet skill-count tiers (unknown/0/3/4/99), legacy two-part and strict three-part keys, tier list round-trips, fixed graded book/iron categories with read-only legacy custom compatibility, explicit zero, atomic batches, no recursive notifications, corruption protection, legacy priority/units and no ledger mutation.');
