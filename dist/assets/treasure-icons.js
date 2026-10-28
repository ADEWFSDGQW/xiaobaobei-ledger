(function(root){
  'use strict';
  const files=Object.freeze({"60武器":"./icons/60武器.png","60防具":"./icons/60防具.png","70武器":"./icons/70武器.png","70防具":"./icons/70防具.png","80武器":"./icons/80武器.png","80防具":"./icons/80防具.png","feicui":"./icons/feicui.PNG","guangmang":"./icons/guangmang.png","heibao":"./icons/heibao.png","hongbaoshi":"./icons/hongbaoshi.png","hongmanao":"./icons/hongmanao.png","huangbaoshi":"./icons/huangbaoshi.png","lanbaoshi":"./icons/lanbaoshi.png","lvbaoshi":"./icons/lvbaoshi.png","sheli":"./icons/sheli.png","shenmi":"./icons/shenmi.png","taiyang":"./icons/taiyang.png","yueliang":"./icons/yueliang.png","上古锻造图册":"./icons/上古锻造图册.png","九转金丹":"./icons/九转金丹.png","五色灵尘":"./icons/五色灵尘.png","仙露小丸子":"./icons/仙露小丸子.png","低级兽诀":"./icons/低级兽诀.png","修炼果":"./icons/修炼果.png","储灵袋":"./icons/储灵袋.png","元灵晶石":"./icons/元灵晶石.png","光芒石":"./icons/光芒石.png","其他":"./icons/其他.png","净瓶玉露":"./icons/净瓶玉露.png","变身卡":"./icons/变身卡.png","召唤兽内丹":"./icons/召唤兽内丹.png","唢呐":"./icons/唢呐.png","夜光珠":"./icons/夜光珠.png","太阳石":"./icons/太阳石.png","如意丹":"./icons/如意丹.png","定魂珠":"./icons/定魂珠.png","康乃馨":"./icons/康乃馨.png","强化石":"./icons/强化石.png","归墟之证":"./icons/归墟之证.png","彩果":"./icons/彩果.png","摇钱树树苗":"./icons/摇钱树树苗.png","星辉石":"./icons/星辉石.png","月亮石":"./icons/月亮石.png","月华露":"./icons/月华露.png","木鱼":"./icons/木鱼.png","未激活的符石":"./icons/未激活的符石.png","残卷":"./icons/残卷.png","法宝任务书":"./icons/法宝任务书.png","海马":"./icons/海马.png","灵饰指南书":"./icons/灵饰指南书.png","炼妖石":"./icons/炼妖石.png","特赦令牌":"./icons/特赦令牌.png","玄天残卷":"./icons/玄天残卷.png","玄灵珠":"./icons/玄灵珠.png","珍珠":"./icons/珍珠.png","琵琶":"./icons/琵琶.png","百合":"./icons/百合.png","碧藕":"./icons/碧藕.png","竖琴":"./icons/竖琴.png","笛子":"./icons/笛子.png","符石卷轴":"./icons/符石卷轴.png","精魄灵石":"./icons/精魄灵石.png","红玛瑙":"./icons/红玛瑙.png","红玫瑰":"./icons/红玫瑰.png","编钟":"./icons/编钟.png","翡翠石":"./icons/翡翠石.png","舍利子":"./icons/舍利子.png","藏宝图":"./icons/藏宝图.png","超级净瓶玉露":"./icons/超级净瓶玉露.png","超级金柳露":"./icons/超级金柳露.png","避水珠":"./icons/避水珠.png","金刚石":"./icons/金刚石.png","金柳露":"./icons/金柳露.png","金银锦盒":"./icons/金银锦盒.png","附魔宝珠":"./icons/附魔宝珠.png","高级召唤兽内丹":"./icons/高级召唤兽内丹.png","高级魔兽要诀":"./icons/高级魔兽要诀.png","黑宝石":"./icons/黑宝石.png","龙鳞":"./icons/龙鳞.png","制造指南书":"./icons/treasure/zhizao-zhinanshu.jpg","百炼精铁":"./icons/treasure/bailian-jingtie.jpg"});
  const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
  const asset=(key,label)=>({src:files[key],kind:'asset',label:label||key});
  const generic=(file,label)=>({src:'./icons/treasure/'+file,kind:'generic',label:label+'（通用示意图）'});
  function resolve(value){
    const item=value&&typeof value==='object'?value:{};
    const rawName=typeof item.name==='string'?item.name.trim():'';
    // Ledger display names may carry a source/map prefix and quantity suffix.
    // Only the resulting name is matched against the fixed local whitelist.
    const name=rawName.split('·').pop().replace(/×\s*[0-9]+(?:\.[0-9]+)?\s*$/,'').trim();
    const category=typeof item.category==='string'?item.category.trim():'';
    const kind=typeof item.kind==='string'?item.kind:'';
    if(kind==='pet'||category==='召唤兽'||category==='场景召唤兽'||category==='pet'){
      // Only our appended numeric skill-count annotation is presentation data.
      // Native form/state parentheses (black/white, past/future, etc.) belong to
      // the whitelisted pet identity and must never be removed generically.
      const petName=name.replace(/(?:（(?:0|[1-9][0-9]?)技能）|\((?:0|[1-9][0-9]?)技能\))$/,'').trim();
      const petIcons=typeof module==='object'&&module.exports?require('./scene-pet-icons.js'):root.scenePetIcons;
      return petIcons?.resolve({...item,name:petName})||generic('pet.svg','召唤兽');
    }
    if(kind==='cost'||category==='成本'||category==='cost')return generic('cost.svg','成本');
    if(item.cash===true||kind==='gold'||['现金','金币','梦幻币'].includes(category)||['梦幻币','金币','现金'].includes(name))return generic('coins.svg','梦幻币');
    if(kind==='灵饰书')return asset('灵饰指南书');
    if(kind==='灵饰铁')return asset('元灵晶石');
    if(kind==='修炼果')return asset('修炼果');
    if(kind==='战魄'||name==='战魄')return generic('battle-token.svg','战魄');
    if(own(files,name))return asset(name);
    const graded=name.match(/^\d{1,3}级(.+)$/);
    if(graded&&own(files,graded[1]))return asset(graded[1]);
    if(name==='玫瑰')return asset('红玫瑰');
    if(/高级.*(?:兽诀|兽决|要诀)/.test(category)||/高级.*(?:兽诀|兽决|要诀)/.test(name))return asset('高级魔兽要诀');
    if(/低级.*(?:兽诀|兽决|要诀)/.test(category)||/低级.*(?:兽诀|兽决|要诀)/.test(name))return asset('低级兽诀');
    if(/高级.*内丹/.test(category)||/高级.*内丹/.test(name))return asset('高级召唤兽内丹');
    if(/低级.*内丹/.test(category)||/低级.*内丹/.test(name)||category==='召唤兽内丹')return asset('召唤兽内丹');
    // Precise item/reward aliases only; beast books and ancient plans above
    // keep their own pictures instead of being caught by a broad "book" rule.
    if(kind==='书'||['制造指南书','制造书'].includes(category)||/^(?:\d{1,3}级?)?(?:制造指南书|制造书|打造书|书)$/.test(name)||/^(?:制造指南书|制造书|打造书)\d{1,3}级?$/.test(name))return asset('制造指南书');
    if(kind==='铁'||category==='百炼精铁'||/^(?:\d{1,3}级?)?(?:百炼精铁|铁)$/.test(name)||/^百炼精铁\d{1,3}级?$/.test(name))return asset('百炼精铁');
    if(name==='花豆'||category==='花豆')return generic('beans.svg','花豆');
    const equip=name.match(/^(60|70|80)级?(武器|防具|装备)$/);
    if(equip)return asset(equip[1]+(equip[2]==='武器'?'武器':'防具'));
    if(category==='低级装备'||/10[～~至-]50级装备/.test(name)||category==='装备')return generic('equipment.svg','装备');
    if(name==='找人'||category==='person')return generic('person.svg','找人');
    if(/家具/.test(name)||category==='furniture')return generic('furniture.svg','家具');
    if(/三药|烹饪|药品/.test(name)||category==='potion')return generic('potion.svg','药品烹饪');
    if(name==='牡丹'||category==='flower')return generic('flower.svg','花卉');
    if(name==='钵')return generic('bowl.svg','钵');
    if(name==='箫')return generic('flute.svg','箫');
    if(['垃圾变异','指定变异','指定普通'].includes(name))return generic('pet.svg','召唤兽');
    return {src:files['其他'],kind:'fallback',label:'其他物品（通用图）'};
  }
  const api={resolve};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.treasureIcons=api;root.itemIcons=api;}
})(typeof window==='object'?window:globalThis);
