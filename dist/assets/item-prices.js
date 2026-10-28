(function(root){
  'use strict';
  const KEY='mh_shared_item_prices_v1';
  const MAX_PRICE=1e9;
  const DEFAULT_FIXED=['金刚石','定魂珠','夜光珠','龙鳞','避水珠','花豆'];
  // Existing main-page built-in IDs are used only when legacy records omit a
  // name; no player records or transaction values are embedded here.
  const MAIN_FIXED=['60武器','70武器','80武器','60防具','70防具','80防具','金刚石','定魂珠','龙鳞','夜光珠','避水珠','特赦令牌','金柳露','超级金柳露','净瓶玉露','超级净瓶玉露','修炼果','精魄灵石','黑宝石','月亮石','舍利子','红玛瑙','太阳石','光芒石','星辉石','翡翠石','笛子','竖琴','唢呐','编钟','木鱼','琵琶','康乃馨','红玫瑰','百合','摇钱树树苗','法宝任务书','未激活的符石','符石卷轴','金银锦盒','藏宝图','强化石','储灵袋','玄天残卷','碧藕','海马','月华露','彩果','五色灵尘','仙露小丸子','玄灵珠'];
  const GENERIC_BEAST=new Set(['兽诀','兽决','魔兽要诀','低级兽诀','低级兽决','低兽诀','普通兽诀','低级魔兽要诀','高级兽诀','高级兽决','高兽诀','高级魔兽要诀']);
  const GENERIC_DAN=new Set(['内丹','召唤兽内丹','低级内丹','低级召唤兽内丹','高级内丹','高级召唤兽内丹']);
  const FIXED_MATERIAL_KEYS=new Set(['book','iron','accessory-book','accessory-iron']);
  const SHORT_BOOK_TYPES=new Set(['剑','刀','扇','扇子','枪','枪矛','斧','斧钺','锤','鞭','鞭子','双剑','飘带','爪刺','环圈','魔棒','宝珠','巨剑','弓','弓箭','伞','灯笼','法杖','项链','腰带','鞋子','鞋','头盔','铠甲','衣服','帽子','女头','男头','男衣','女衣']);
  const LEGACY_GENERIC_MATERIALS=new Set(['书','铁','灵饰书','灵饰铁']);
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  function validText(value,max=250){return typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u001f]/.test(value);}
  // Skill counts are explicit price tiers, not levels. Keep absent counts in
  // the legacy two-part key; never coerce imported strings into numeric tiers.
  function validSkillCount(value){return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=99;}
  function shortBookOf(name){const match=name.match(/^(\d{1,3})级?(.+)书$/);return match&&SHORT_BOOK_TYPES.has(match[2])?match:null;}
  function units(price){
    if(typeof price!=='number'||!Number.isFinite(price)||price<0||price>MAX_PRICE)throw new Error('参考价格须为有效非负数字，单位为万');
    const n=Math.round(price*10000);
    if(!Number.isSafeInteger(n)||Math.abs(n/10000-price)>Math.max(1e-12,Number.EPSILON*Math.max(1,price)*2))throw new Error('参考价格最多支持四位小数（万）');
    return n;
  }
  function alias(name){
    name=name.replace(/（/g,'(').replace(/）/g,')').trim();
    if(name==='玫瑰')return '红玫瑰';
    const equipment=name.match(/^(60|70|80)级?(武器|防具|装备)$/);
    if(equipment)return equipment[1]+(equipment[2]==='武器'?'武器':'防具');
    return name;
  }
  function levelOf(item,name){
    const named=name.match(/^(\d{1,3})级?/);
    const provided=item.level===undefined||item.level===null||item.level===''?null:Number(item.level);
    if(named&&provided!==null&&Number(named[1])!==provided)return null;
    const level=provided===null?(named?Number(named[1]):null):provided;
    return Number.isInteger(level)&&level>0&&level<=200?level:null;
  }
  function describeBare(value){
    const item=typeof value==='string'?{name:value}:value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const raw=typeof item.name==='string'?item.name.trim():'';
    const name=alias(raw),category=typeof item.category==='string'?item.category:'',kind=typeof item.kind==='string'?item.kind:'';
    const explicitFixed=item.type==='fixed'||item.priceMode==='fixed';
    const fixed=explicitFixed||DEFAULT_FIXED.includes(name)||/^(60|70|80)(武器|防具)$/.test(name);
    const output={key:'',name,priceMode:fixed?'fixed':'custom',shareable:false};
    if(item.cash===true||kind==='gold'||['现金','金币','梦幻币'].includes(category)||['现金','金币','梦幻币'].includes(name))return {...output,name:name||'梦幻币',priceMode:'cash'};
    if(kind==='cost'||item.type==='cost'||['成本','支出'].includes(category))return output;
    if(!validText(name))return output;
    const finish=(parts,display=name)=>({...output,key:JSON.stringify(parts),name:display,shareable:true});
    if(kind==='pet'||['召唤兽','场景召唤兽','宠物','pet'].includes(category)){
      if(['召唤兽','宠物','指定普通','指定变异','垃圾变异'].includes(name))return output;
      const count=item.skillCount;
      if(count!==undefined&&count!==null&&count!==''){
        if(!validSkillCount(count))return output;
        return {...finish(['pet',name,count],name+' · '+count+'技能'),priceMode:'custom'};
      }
      return {...finish(['pet',name]),priceMode:'custom'};
    }
    if(GENERIC_BEAST.has(name)||GENERIC_DAN.has(name)||['其他','其他物品','10～50级装备','10~50级装备','10-50级装备'].includes(name))return output;
    const beast=/兽诀|兽决|魔兽要诀/.test(category)||/^(?:高级|低级).+(?:兽诀|兽决|魔兽要诀)$/.test(name);
    if(beast){
      const high=/高级/.test(category)||/^高级/.test(name),skill=name.replace(/^(?:高级|低级)/,'').replace(/(?:魔兽要诀|兽诀|兽决)$/,'').trim();
      if(!validText(skill)||GENERIC_BEAST.has(skill))return output;
      return {...finish(['beast-book',high?'high':'low',skill],(high?'高级':'')+skill),priceMode:explicitFixed?'fixed':'custom'};
    }
    const dan=/内丹/.test(category)||/^(?:高级|低级).+内丹$/.test(name);
    if(dan){
      const high=/高级/.test(category)||/^高级/.test(name),specific=name.replace(/^(?:高级|低级)/,'').replace(/(?:召唤兽)?内丹$/,'').trim();
      if(!validText(specific)||GENERIC_DAN.has(specific))return output;
      return {...finish(['pet-dan',high?'high':'low',specific],(high?'高级':'')+specific),priceMode:explicitFixed?'fixed':'custom'};
    }
    const accessoryBook=kind==='灵饰书'||['灵饰书','灵饰指南书'].includes(category)||name==='灵饰书'||/^\d{1,3}级?灵饰书$/.test(name)||/灵饰指南书/.test(name+category);
    const accessoryIron=kind==='灵饰铁'||['灵饰铁','元灵晶石'].includes(category)||name==='灵饰铁'||/元灵晶石/.test(name+category);
    const concreteShortBook=shortBookOf(name);
    const book=kind==='书'||['书','制造指南书','制造书','打造书'].includes(category)||name==='书'||/制造指南书|制造书|打造书/.test(name)||/^\d{1,3}级?书$/.test(name)||concreteShortBook;
    const iron=kind==='铁'||['铁','百炼精铁'].includes(category)||name==='铁'||/百炼精铁/.test(name)||/^\d{1,3}级?铁$/.test(name);
    if(accessoryBook||accessoryIron||book||iron){
      const unresolved={...output,priceMode:'fixed'};
      const level=levelOf(item,name);if(level===null)return unresolved;
      if(iron||accessoryIron)return {...finish([accessoryIron?'accessory-iron':'iron',level],level+'级'+(accessoryIron?'元灵晶石':'百炼精铁')),priceMode:'fixed'};
      let type=typeof item.bookType==='string'?item.bookType.trim():name.replace(/^\d{1,3}级?/,'').replace(/^(?:灵饰指南书|制造指南书|制造书|打造书)[:：\s-]*/,'').replace(/(?:灵饰指南书|制造指南书|制造书|打造书|指南书|书)$/,'').trim();
      if(!validText(type,100)||['指南','制造','灵饰','制造指南书','制造书','打造书','灵饰指南书','书'].includes(type))return unresolved;
      return {...finish([accessoryBook?'accessory-book':'book',level,type],level+'级'+type+(accessoryBook?'灵饰指南书':'制造指南书')),priceMode:'fixed'};
    }
    if(/^(?:炼妖石|上古锻造图册|上古锻造图策|珍珠|附魔宝珠)$/.test(name)){
      const level=levelOf(item,name);return level===null?output:finish(['item',level+'级'+name.replace('图策','图册')],level+'级'+name.replace('图策','图册'));
    }
    // These materials' levels alter their price. Keep a supplied level or a
    // level already present in the name; never merge all grades into one key.
    const graded=name.match(/^(\d{1,3})级?(炼妖石|上古锻造图册|上古锻造图策|珍珠|附魔宝珠)$/);
    if(graded)return finish(['item',Number(graded[1])+'级'+graded[2].replace('图策','图册')],Number(graded[1])+'级'+graded[2].replace('图策','图册'));
    return finish(['item',name]);
  }
  function describe(value){
    const wrapped=value&&typeof value==='object'&&!Array.isArray(value)&&own(value,'item')&&value.item&&typeof value.item==='object';
    const d=describeBare(wrapped?value.item:value);
    if(wrapped&&((own(value,'key')&&value.key!==d.key)||(own(value,'name')&&value.name!==d.name)||(own(value,'priceMode')&&value.priceMode!==d.priceMode)))throw new Error('共享价格标识与物品描述不一致');
    return d;
  }
  function keyValid(key){
    if(!validText(key,700))return false;
    let parts;try{parts=JSON.parse(key);}catch(_){return false;}
    if(!Array.isArray(parts)||typeof parts[0]!=='string')return false;
    if(parts[0]==='item')return parts.length===2&&validText(parts[1]);
    if(parts[0]==='pet')return validText(parts[1])&&(parts.length===2||(parts.length===3&&validSkillCount(parts[2])));
    if(['beast-book','pet-dan'].includes(parts[0]))return parts.length===3&&['high','low'].includes(parts[1])&&validText(parts[2]);
    if(['book','accessory-book'].includes(parts[0]))return parts.length===3&&Number.isInteger(parts[1])&&parts[1]>0&&parts[1]<=200&&validText(parts[2],100);
    if(['iron','accessory-iron'].includes(parts[0]))return parts.length===2&&Number.isInteger(parts[1])&&parts[1]>0&&parts[1]<=200;
    return false;
  }
  function read(storage){
    const raw=storage.getItem(KEY);if(raw===null||raw===undefined)return {version:1,entries:{}};
    let state;try{state=JSON.parse(raw);}catch(_){throw new Error('共享价格数据损坏，未覆盖原数据');}
    if(!state||state.version!==1||!state.entries||typeof state.entries!=='object'||Array.isArray(state.entries)||Object.keys(state.entries).length>20000)throw new Error('共享价格数据格式不正确，未覆盖原数据');
    for(const [key,entry] of Object.entries(state.entries)){
      if(!keyValid(key)||!entry||entry.key!==key||!validText(entry.name,350)||!['fixed','custom'].includes(entry.priceMode)||!Number.isSafeInteger(entry.units)||entry.units<0||entry.units>MAX_PRICE*10000)throw new Error('共享价格条目损坏，未覆盖原数据');
      const d=describeBare(entryItem(entry)),valid=d.shareable&&d.key===key&&d.name===entry.name&&d.priceMode===entryPriceMode(entry);
      if(!valid&&!legacyMaterialEntry(entry,d))throw new Error('共享价格标识与元数据损坏，未覆盖原数据');
    }
    return state;
  }
  // Older v1 stores classified book/iron references as custom. Normalize only
  // the returned description; reading or same-value round-trips never rewrite
  // their stored metadata, prices, or any ledger history.
  function entryPriceMode(entry){return FIXED_MATERIAL_KEYS.has(JSON.parse(entry.key)[0])?'fixed':entry.priceMode;}
  function legacyMaterialEntry(entry,d){
    const parts=JSON.parse(entry.key);
    if(parts[0]!=='item'||parts.length!==2||entry.name!==parts[1])return false;
    if(shortBookOf(parts[1]))return d.shareable&&d.priceMode==='fixed'&&JSON.parse(d.key)[0]==='book';
    // These exact generic names were ordinary items before this classifier.
    // Preserve their bytes but hide them from sharing, never price a specific
    // manufacturing/accessory book using an unresolved old category price.
    return !d.shareable&&d.priceMode==='fixed'&&(LEGACY_GENERIC_MATERIALS.has(parts[1])||/^\d{1,3}级?灵饰书$/.test(parts[1]));
  }
  function lookupEntry(entries,key){
    if(own(entries,key))return entries[key];
    const parts=JSON.parse(key);
    if(parts[0]!=='book'||parts.length!==3||!SHORT_BOOK_TYPES.has(parts[2]))return null;
    // Canonical keys win. For multiple old spellings use a stable order shared
    // by get/has/list/seed/set, regardless of original object insertion order.
    const grades=[...new Set([String(parts[1]),String(parts[1]).padStart(2,'0'),String(parts[1]).padStart(3,'0')])];
    for(const grade of grades)for(const suffix of ['', '级']){
      const oldKey=JSON.stringify(['item',grade+suffix+parts[2]+'书']);
      if(own(entries,oldKey))return entries[oldKey];
    }
    return null;
  }
  function entryItem(entry){
    const parts=JSON.parse(entry.key),type=entryPriceMode(entry)==='fixed'?'fixed':'non-fixed';
    if(parts[0]==='pet')return {name:parts[1],kind:'pet',category:'召唤兽',type,...(parts.length===3?{skillCount:parts[2]}:{})};
    if(parts[0]==='beast-book')return {name:(parts[1]==='high'?'高级':'')+parts[2],category:parts[1]==='high'?'高级兽诀':'低级兽诀',type};
    if(parts[0]==='pet-dan')return {name:(parts[1]==='high'?'高级':'')+parts[2],category:parts[1]==='high'?'高级内丹':'低级内丹',type};
    if(parts[0]==='book'||parts[0]==='accessory-book')return {name:parts[2],kind:parts[0]==='book'?'书':'灵饰书',level:parts[1],type};
    if(parts[0]==='iron'||parts[0]==='accessory-iron')return {name:parts[0]==='iron'?'百炼精铁':'元灵晶石',kind:parts[0]==='iron'?'铁':'灵饰铁',level:parts[1],type};
    return {name:parts[1],type};
  }
  function visible(entry){
    const d=describeBare(entryItem(entry));
    return {...d,price:entry.units/10000,item:entryItem({...entry,key:d.key,name:d.name,priceMode:d.priceMode})};
  }
  function createStore(storage,notify=()=>{}){
    if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw new Error('共享价格存储不可用');
    function prepare(rows,skipUnshareable=false){
      if(!Array.isArray(rows)||rows.length>20000)throw new Error('共享价格批量数据不正确');
      const found=new Map();
      for(const row of rows){
        if(!row||typeof row!=='object')throw new Error('共享价格条目不正确');
        const value=units(row.price),d=describe(row.item);
        if(!d.shareable){if(skipUnshareable)continue;throw new Error('请填写具体物品名称及有效的等级、类型或召唤兽技能数，此项目不共用价格');}
        found.set(d.key,{key:d.key,name:d.name,priceMode:d.priceMode,units:value});
      }
      return [...found.values()];
    }
    function commit(entries,missingOnly){
      const state=read(storage),next={version:1,entries:{...state.entries}},changed=[];
      for(const entry of entries){
        const previous=lookupEntry(state.entries,entry.key);
        if(missingOnly&&(previous||entry.units===0))continue;
        if(previous&&previous.units===entry.units)continue;
        next.entries[entry.key]=entry;changed.push(entry.key);
      }
      if(changed.length){storage.setItem(KEY,JSON.stringify(next));try{notify({keys:changed});}catch(_){/* Persisted values remain valid if a view listener fails. */}}
      return entries.map(entry=>lookupEntry(next.entries,entry.key)).filter(Boolean).map(visible);
    }
    function get(item,fallback=0){const d=describe(item);if(!d.shareable)return units(fallback)/10000;const entry=lookupEntry(read(storage).entries,d.key);return entry?entry.units/10000:units(fallback)/10000;}
    const api={KEY,describe,get,has(item){const d=describe(item);return d.shareable&&!!lookupEntry(read(storage).entries,d.key);},set(item,price){return commit(prepare([{item,price}]),false)[0];},setMany(rows){return commit(prepare(rows),false);},list(){const state=read(storage),keys=new Set();for(const entry of Object.values(state.entries)){const d=describeBare(entryItem(entry));if(d.shareable)keys.add(d.key);}return [...keys].map(key=>visible(lookupEntry(state.entries,key))).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));},seed(rows){return commit(prepare(rows,true),true);},collectLegacy};
    return api;
  }
  function collectLegacy(storage){
    if(!storage||typeof storage.getItem!=='function')throw new Error('旧版存储不可用');
    const result=[],seen=new Set();
    const json=key=>{try{const raw=storage.getItem(key);return raw?JSON.parse(raw):null;}catch(_){return null;}};
    function offer(item,price,legacySource){
      try{if(units(price)===0)return;const d=describe(item);if(!d.shareable||seen.has(d.key))return;seen.add(d.key);result.push({item,price,legacySource});}catch(_){/* Invalid legacy values are not promoted or altered. */}
    }
    const main=json('mh_items');
    if(Array.isArray(main))for(const item of main){if(!item||typeof item!=='object')continue;const fallback=MAIN_FIXED[Number(item.id)-1];if(item.type!=='fixed'&&!(!item.type&&fallback))continue;offer({...item,name:typeof item.name==='string'?item.name:fallback,type:'fixed'},item.price,'mh_items');}
    const scene=json('mh_scene_project_v1');
    if(scene?.prices&&typeof scene.prices==='object'&&!Array.isArray(scene.prices))for(const [key,price] of Object.entries(scene.prices)){
      try{
        const parts=JSON.parse(key);if(!Array.isArray(parts))continue;
        const [kind,name,skillCount]=parts;
        if(kind==='pet'){
          if(parts.length!==2&&!(parts.length===3&&validSkillCount(skillCount)))continue;
          offer({kind,name,...(parts.length===3?{skillCount}:{})},price,'mh_scene_project_v1.prices');
        }else if(parts.length===2)offer({kind,name},price,'mh_scene_project_v1.prices');
      }catch(_){/* Invalid legacy tier keys are not promoted to the unknown tier. */}
    }
    const treasure=json('mh_treasure_project_v1');
    if(treasure?.prices&&typeof treasure.prices==='object'&&!Array.isArray(treasure.prices))for(const [key,price] of Object.entries(treasure.prices)){try{const [mode,name]=JSON.parse(key),custom=Array.isArray(treasure.customItems)?treasure.customItems.find(item=>item.name===name&&[mode,'both'].includes(item.mode)):null;offer(custom||{name},price,'mh_treasure_project_v1.prices');}catch(_){}}
    const ring=json('mh_ring_project_v1');
    if(ring?.prices&&typeof ring.prices==='object'&&!Array.isArray(ring.prices))for(const [name,price] of Object.entries(ring.prices))offer({name},typeof price==='number'?price/10000:NaN,'mh_ring_project_v1.prices');
    if(ring?.rewardPrices&&typeof ring.rewardPrices==='object'&&!Array.isArray(ring.rewardPrices))for(const [key,price] of Object.entries(ring.rewardPrices)){try{const [_mode,kind,name,level]=JSON.parse(key);offer({kind,name,level},typeof price==='number'?price/10000:NaN,'mh_ring_project_v1.rewardPrices');}catch(_){}}
    return result;
  }
  const pure={KEY,describe,createStore,collectLegacy,units};
  if(typeof module==='object'&&module.exports)module.exports=pure;
  else{
    let storage;try{storage=root.localStorage;}catch(_){storage={getItem(){throw new Error('无法读取共享价格存储');},setItem(){throw new Error('无法写入共享价格存储');}};}
    const notify=detail=>root.dispatchEvent(new CustomEvent('shared-prices-changed',{detail}));
    root.itemPrices={...createStore(storage,notify),createStore};
    root.addEventListener('storage',event=>{if(event.key===KEY||event.key===null)notify({keys:[],external:true});});
  }
})(typeof window==='object'?window:globalThis);
