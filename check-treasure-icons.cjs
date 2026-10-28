'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const icons=require('./dist/assets/treasure-icons.js');
const core=require('./dist/assets/treasure-core.js');
const ring=require('./dist/assets/ring-project.js');
const iconRoot=path.resolve(__dirname,'dist/icons');
function check(item,expectedKind){
  const result=icons.resolve(item);
  assert(result&&typeof result.src==='string'&&typeof result.label==='string');
  assert(['asset','generic','fallback'].includes(result.kind));
  if(expectedKind)assert.equal(result.kind,expectedKind,JSON.stringify(item));
  assert.match(result.src,/^\.\/icons\/[\w\u4e00-\u9fff/.-]+\.(?:png|PNG|jpe?g|gif|webp|svg)$/);
  assert(!result.src.includes('..'));assert(!result.src.includes(':'));assert(!result.src.includes('\\'));
  const target=path.resolve(__dirname,'dist',result.src);
  assert(target.startsWith(iconRoot+path.sep));assert(fs.existsSync(target),result.src);
  if(result.src.endsWith('.svg')){
    const s=fs.readFileSync(target,'utf8');
    assert(s.startsWith('<svg '));assert.match(s,/<title>/);assert(!/<script|foreignObject|\bon\w+\s*=|(?:href|src)\s*=|url\(/i.test(s),'SVG contains active/external content');
    assert.equal(result.kind,'generic');assert.match(result.label,/示意图/);
  }
  return result;
}
const defaultItems=[...core.catalogs('normal'),...core.catalogs('advanced')];assert.equal(defaultItems.length,36);
defaultItems.forEach(item=>{const result=check(item);assert.notEqual(result.kind,'fallback',item.name);});
assert.equal(check({name:'偷袭',category:'低级兽诀'},'asset').src,'./icons/低级兽诀.png');
assert.equal(check({name:'高级神佑复生',category:'高级兽诀'},'asset').src,'./icons/高级魔兽要诀.png');
assert.equal(check({name:'迅敏',category:'低级内丹'},'asset').src,'./icons/召唤兽内丹.png');
assert.equal(check({name:'生死诀',category:'高级内丹'},'asset').src,'./icons/高级召唤兽内丹.png');
assert.equal(check({name:'玫瑰'},'asset').src,'./icons/红玫瑰.png');
assert.equal(check({name:'60装备'},'asset').src,'./icons/60防具.png');
assert.equal(check({name:'115级炼妖石'},'asset').src,'./icons/炼妖石.png');
assert.equal(check({name:'普通图·傲来国·金刚石×1'},'asset').src,'./icons/金刚石.png');
assert.equal(check({name:'东海湾·60武器×2'},'asset').src,'./icons/60武器.png');
check({name:'普通图·傲来国·未知自定义×2'},'fallback');
assert.equal(check({name:'剑',kind:'书',level:100},'asset').src,'./icons/treasure/zhizao-zhinanshu.jpg');
assert.equal(check({name:'百炼精铁',kind:'铁',level:100},'asset').src,'./icons/treasure/bailian-jingtie.jpg');
for(const name of ['制造指南书','60级制造指南书','60制造指南书','60书','60级书','制造书60级','普通图·傲来国·60书×1'])assert.equal(check({name},'asset').src,'./icons/treasure/zhizao-zhinanshu.jpg');
for(const name of ['百炼精铁','60级百炼精铁','60百炼精铁','60铁','60级铁','百炼精铁60级','普通图·傲来国·60铁×1'])assert.equal(check({name},'asset').src,'./icons/treasure/bailian-jingtie.jpg');
assert.equal(check({name:'上古锻造图册'},'asset').src,'./icons/上古锻造图册.png');
assert.equal(check({name:'高级魔兽要诀',kind:'书'},'asset').src,'./icons/高级魔兽要诀.png');
assert.equal(check({name:'偷袭',category:'低级兽诀',kind:'书'},'asset').src,'./icons/低级兽诀.png');
assert.equal(check({name:'耳饰',kind:'灵饰书'},'asset').src,'./icons/灵饰指南书.png');
assert.equal(check({name:'元灵晶石',kind:'灵饰铁'},'asset').src,'./icons/元灵晶石.png');
for(const name of ['找人','一级家具','二级家具','三药／烹饪','钵','箫','牡丹','垃圾变异','指定变异','指定普通'])check({name},'generic');
for(const name of ['唢呐','笛子','琵琶','竖琴','木鱼','编钟','玫瑰','百合','康乃馨','修炼果'])check({name},'asset');
for(const [name] of ring.ITEMS)assert.notEqual(check({name}).kind,'fallback',name);
for(const kinds of Object.values(ring.REWARDS))for(const kind of kinds)assert.notEqual(check({name:kind,kind,level:100}).kind,'fallback',kind);
check({name:'持国巡守',category:'召唤兽',kind:'pet'},'asset');
check({name:'未知自定义召唤兽',category:'召唤兽',kind:'pet'},'generic');
const sceneData=require('./dist/assets/scene-data.js');
const sceneNames=['无名鬼城','青丘','银华境','须弥东界','鬼市','五行山'];
const scenePets=sceneData.pets.filter(p=>p.scenes.some(s=>sceneNames.includes(s)));
assert.equal(scenePets.length,55);
for(const pet of scenePets){
  const result=check({id:pet.id,name:pet.name,kind:'pet'},'asset');
  assert(result.src.startsWith('./icons/scene-pets/'));
  assert.equal(check({name:pet.name,category:'召唤兽'},'asset').src,result.src);
  assert.equal(check({name:'青丘·'+pet.name+'×2',category:'场景召唤兽'},'asset').src,result.src);
  for(const suffix of ['（3技能）','（0技能）','(3技能)','(0技能)']){
    const combined=check({name:'须弥东界·'+pet.name+suffix+'×2',category:'场景召唤兽'},'asset');
    assert.equal(combined.src,result.src,pet.name+suffix);
    assert.equal(combined.petId,pet.id,pet.name+suffix);
  }
}
// Parentheses identifying actual forms must remain intact even when a final
// skill annotation is removed. Ordinary/unknown annotations are not aliases.
for(const [name,id] of [['无常鬼差（白）','2397'],['无常鬼差(黑)','2409'],['司辰侍者（未来）','12039'],['司辰侍者(过去)','12071'],['五行山神（金）','12061'],['天狗（人形）','12079']]){
  const base=check({name,kind:'pet'},'asset');assert.equal(base.petId,id);
  assert.equal(check({name:'场景·'+name+'（3技能）×2',category:'场景召唤兽'},'asset').petId,id);
}
assert.notEqual(check({name:'司辰侍者（过去）（3技能）',kind:'pet'},'asset').src,check({name:'司辰侍者（未来）（3技能）',kind:'pet'},'asset').src);
for(const name of ['毗舍童子（普通）','毗舍童子（普通）（3技能）','毗舍童子（未知技能）','毗舍童子（技能未知）','毗舍童子（-1技能）','毗舍童子（3.5技能）','毗舍童子（100技能）','毗舍童子（03技能）','毗舍童子（3技能)','毗舍童子(3技能）','毗舍童子（3技能）任意后缀','司辰侍者（未知）','无常鬼差','未知自定义召唤兽（3技能）','未知·任意字符串（0技能）×2','../../evil.svg（3技能）','https://evil/x.png（3技能）','__proto__（3技能）','constructor（0技能）','<img src=x>（3技能）'])check({name,kind:'pet'},'generic');
// Missing skill metadata preserves the original identity; non-pet item names
// never gain an unrelated alias by carrying a skill-looking suffix.
assert.equal(check({name:'须弥东界·毗舍童子×2',category:'场景召唤兽'},'asset').petId,'2243');
check({name:'金刚石（3技能）'},'fallback');
check({name:'点卡',category:'成本',kind:'cost'},'generic');
check({name:'战斗金币',category:'金币',kind:'gold'},'generic');
for(const value of [undefined,null,{},'金刚石',{name:'未知自定义'},{name:'../../evil.svg'},{name:'https://evil/x.png'},{name:'__proto__'},{name:'constructor'},{name:'<img src=x>'}])check(value,'fallback');
const context={};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('./dist/assets/scene-pet-icons.js','utf8'),context);vm.runInContext(fs.readFileSync('./dist/assets/treasure-icons.js','utf8'),context);
assert.equal(context.treasureIcons,context.itemIcons);assert.equal(context.itemIcons.resolve({name:'金刚石'}).kind,'asset');
assert.equal(context.itemIcons.resolve({name:'持国巡守',kind:'pet'}).kind,'asset');
assert.equal(context.itemIcons.resolve({name:'须弥东界·毗舍童子（3技能）×2',category:'场景召唤兽'}).petId,'2243');
assert.equal(context.itemIcons.resolve({name:'鬼市·无常鬼差（黑）（0技能）×2',category:'场景召唤兽'}).petId,'2409');
assert.equal(context.itemIcons.resolve({name:'五行山·司辰侍者（未来）（3技能）×2',category:'场景召唤兽'}).petId,'12039');
assert.equal(context.itemIcons.resolve({name:'未知召唤兽（3技能）',kind:'pet'}).kind,'generic');
const manifest=JSON.parse(fs.readFileSync('./dist/icons/treasure/manifest.json','utf8'));assert.equal(manifest.reused.length,79);assert.equal(manifest.generic.length,12);assert.equal(manifest.downloaded.length,2);
for(const image of manifest.downloaded){const bytes=fs.readFileSync(path.join(__dirname,'dist',image.src));assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),image.sha256);assert.equal(image.modified,false);assert.match(image.sourcePage,/games\.sina\.com\.cn/);assert.equal(image.kind,'asset');}
console.log('PASS: 36 treasure defaults, ring costs/rewards, 55 scene pet identities with 3/0-skill ledger annotations, preserved form parentheses, unknown/malformed-name safeguards, scene gold/cost types, specific-skill aliases, safe local paths, inert SVGs, fallback and browser aliases.');
