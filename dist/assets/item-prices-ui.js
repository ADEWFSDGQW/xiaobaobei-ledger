(function(root){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let bridge,baseline=new Map(),initialized=false,dialog,rows=[],previousFocus;
  function api(){if(!root.itemPrices)throw Error('共享价格组件未加载');return root.itemPrices;}
  function warn(error){console.error('共享价格：'+error.message);root.alert('共享价格未修改：'+error.message);}
  function init(){if(initialized)return;const p=api();p.seed(p.collectLegacy(localStorage));initialized=true;}
  function mainSnapshot(){return bridge?bridge.snapshot():[];}
  function snapshotMap(items){return new Map(items.map(item=>[String(item.id),{price:item.price,key:api().describe(item).key}]));}
  function applyMain(){
    if(!bridge)return;const p=api(),items=mainSnapshot(),updates=[];
    for(const item of items){if(p.describe(item).shareable&&p.has(item)){const price=p.get(item);if(item.price!==price)updates.push({id:item.id,price});}}
    bridge.apply(updates);baseline=snapshotMap(mainSnapshot());
  }
  function attachMain(value){try{bridge=value;init();applyMain();}catch(error){baseline=snapshotMap(mainSnapshot());warn(error);}}
  function syncMain(items){
    try{init();const changes=[];
      for(const item of items){const prior=baseline.get(String(item.id)),d=api().describe(item);if(d.shareable&&((prior&&(prior.key!==d.key||prior.price!==item.price))||(!prior&&item.price!==undefined)))changes.push({item,price:item.price===undefined?0:Number(item.price)});}
      baseline=snapshotMap(items);if(changes.length)api().setMany(changes);
    }catch(error){warn(error);}
  }
  function catalog(){
    const p=api(),map=new Map();
    const offer=(item,fallback=0)=>{const d=p.describe(item);if(!d.shareable)return;const old=map.get(d.key);if(!old||item.type==='fixed')map.set(d.key,{...d,item,price:p.get(item,Number.isFinite(fallback)?fallback:0),configured:p.has(item)});};
    for(const row of root.ringProject?.priceCatalog?.()||[])offer(row.item,row.price);
    for(const mode of ['normal','advanced'])for(const item of root.treasureCore?.catalogs(mode)||[])offer(item);
    for(const name of ['60武器','60防具','70武器','70防具','80武器','80防具'])offer({name});
    for(const pet of root.sceneData?.pets||[])if(pet.scenes.some(s=>['无名鬼城','青丘','银华境','须弥东界','鬼市','五行山'].includes(s)))offer({name:pet.name,kind:'pet'});
    for(const row of p.collectLegacy(localStorage))offer(row.item,row.price);
    for(const item of mainSnapshot())offer(item,Number(item.price)||0);
    for(const entry of p.list()){if(!map.has(entry.key))offer(entry.item||entry);}
    return [...map.values()].sort((a,b)=>(a.priceMode==='fixed'?0:1)-(b.priceMode==='fixed'?0:1)||a.name.localeCompare(b.name,'zh-CN'));
  }
  function picture(row){
    const icon=root.itemIcons?.resolve(row.item);if(!icon?.src)return '';
    const box=value=>Array.isArray(value)&&value.length===4&&value.every(n=>Number.isFinite(n)&&n>=0&&n<=100)?value.map(n=>n+'%').join(' '):'';
    const view=box(icon.viewBox),clip=box(icon.viewClip),style=(view?'object-view-box:inset('+view+');':'')+(clip?'clip-path:inset('+clip+');':'');
    return `<img src="${esc(icon.src)}" alt="" loading="lazy" style="${esc(style)}">`;
  }
  function render(){
    rows=catalog();
    dialog.innerHTML=`<form method="dialog" class="shared-prices-head"><h2>共用物品价格</h2><button aria-label="关闭价格设置" value="close">关闭</button></form><p>五开、跑环、场景、挖图共用。金额单位：万。保存后只影响后续录入，已有明细和历史账目不变。</p><label class="shared-prices-search">筛选物品 <input type="search" data-shared-search placeholder="输入名称，如 60武器、金刚石"></label><form data-shared-save><div class="shared-prices-scroll"><table><thead><tr><th>物品</th><th>计价方式</th><th>参考单价 / 万</th></tr></thead><tbody>${rows.map((row,i)=>`<tr data-shared-name="${esc(row.name)}"><td><span class="shared-price-item">${picture(row)}${esc(row.name)}</span>${row.item.kind==='pet'?'<small>'+((row.item.skillCount===undefined||row.item.skillCount===null||row.item.skillCount==='')?'技能数未填写':'召唤兽')+'</small>':''}</td><td>${row.priceMode==='fixed'?'固定价格':'自定义价格'}</td><td><input aria-label="${esc(row.name)}共享价格" data-shared-price="${i}" type="number" min="0" max="1000000000" step="0.0001" value="${row.configured?row.price:''}" placeholder="未设置" inputmode="decimal"></td></tr>`).join('')}</tbody></table></div><p class="shared-prices-note">召唤兽按名称＋技能数分价，场景录入后的技能档会出现在这里；未填与 0 技能分开。兽诀、内丹、书铁仍按具体名称和等级区分。未设置保留各页原参考价，明确填 0 可设为零价。</p><footer><span data-shared-status role="status"></span><button type="submit">保存并同步各页面</button></footer></form>`;
    dialog.querySelector('[data-shared-search]').addEventListener('input',e=>{const value=e.target.value.trim().toLowerCase();dialog.querySelectorAll('[data-shared-name]').forEach(tr=>{tr.hidden=!tr.dataset.sharedName.toLowerCase().includes(value);});});
    dialog.querySelector('[data-shared-save]').addEventListener('submit',e=>{
      e.preventDefault();try{const updates=[];dialog.querySelectorAll('[data-shared-price]').forEach(input=>{const row=rows[Number(input.dataset.sharedPrice)];if(input.value.trim()==='')return;const price=Number(input.value);if(!row.configured||price!==row.price)updates.push({item:row.item,price});});api().setMany(updates);for(const row of rows){row.configured=api().has(row.item);row.price=api().get(row.item,row.price);}dialog.querySelector('[data-shared-status]').textContent=updates.length?'已同步 '+updates.length+' 项参考价格；已有账目未改动。':'没有需要同步的价格。';}catch(error){dialog.querySelector('[data-shared-status]').textContent=error.message;}
    });
  }
  function open(){try{init();if(!dialog){dialog=document.createElement('dialog');dialog.id='shared-prices-dialog';dialog.setAttribute('aria-label','共用物品价格设置');document.body.append(dialog);dialog.addEventListener('close',()=>previousFocus?.focus?.());}previousFocus=document.activeElement;render();dialog.showModal();dialog.querySelector('[data-shared-search]').focus();}catch(error){warn(error);}}
  root.addEventListener('shared-prices-changed',()=>{try{applyMain();}catch(error){warn(error);}});
  document.addEventListener('click',event=>{if(event.target.closest('[data-shared-prices-open]'))open();});
  root.sharedPriceUI={open,attachMain,syncMain,catalog};
})(window);
