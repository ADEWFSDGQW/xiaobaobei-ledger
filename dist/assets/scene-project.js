(function (root) {
  'use strict';
  const KEY = 'mh_scene_project_v1';
  const COMMON_SCENES = Object.freeze(['无名鬼城','青丘','银华境','须弥东界','鬼市','五行山']);
  const sceneName = name => name==='银华镜'?'银华境':name==='5行山'?'五行山':name;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const round = n => Math.round(n * 10000) / 10000;
  const money = n => Number(n.toFixed(4)).toLocaleString('zh-CN', { maximumFractionDigits: 4 });
  const day = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  function number(v, label, integer = false) { const n = Number(v); if (String(v).trim() === '' || !Number.isFinite(n) || n < 0 || n > 1e9 || (integer && !Number.isInteger(n))) throw new Error(label + '格式不正确'); return n; }
  function fresh() { return { id: '', date: day(), scene: COMMON_SCENES[0], note: '', minutes: 0, rows: [] }; }
  function empty() { return { version: 1, draft: fresh(), history: [], prices: {} }; }
  function getPetSkills(row) {
    if(row.kind!=='pet'||row.skillCount===undefined||row.skillCount===null||row.skillCount==='')return null;
    if(typeof row.skillCount!=='number'||!Number.isInteger(row.skillCount)||row.skillCount<0||row.skillCount>99)throw new Error('技能数须为 0 至 99 的整数，或留空');
    return row.skillCount;
  }
  function priceKey(row){const count=getPetSkills(row);return JSON.stringify(count===null?[row.kind,row.name]:[row.kind,row.name,count]);}
  function petStats(records){
    const groups=new Map();
    for(const record of records){totals(record);for(const row of record.rows){if(row.kind!=='pet')continue;const skillCount=getPetSkills(row),quantity=number(row.quantity,'数量',true),key=JSON.stringify([row.name,skillCount]),group=groups.get(key)||{name:row.name,skillCount,quantity:0,amountUnits:0};group.quantity+=quantity;group.amountUnits+=Math.round(row.price*10000)*quantity;if(!Number.isSafeInteger(group.quantity)||!Number.isSafeInteger(group.amountUnits))throw new Error('技能统计总额过大');groups.set(key,group);}}
    return [...groups.values()].map(group=>({...group,amount:group.amountUnits/10000})).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')||(a.skillCount??100)-(b.skillCount??100));
  }
  function totals(record) {
    const result = { pet: 0, item: 0, gold: 0, cost: 0, revenue: 0, profit: 0, count: 0 };
    number(record.minutes, '时长');
    record.rows.forEach(row => {
      if (!['pet','item','gold','cost'].includes(row.kind) || !String(row.name).trim()) throw new Error('收支项目格式不正确');
      getPetSkills(row);
      const q = number(row.quantity, '数量', true); if (!q || q > 100000) throw new Error('数量须为 1 至 100000');
      const amount = Math.round(number(row.price, '单价') * 10000) * q;
      if (!Number.isSafeInteger(amount)) throw new Error('金额过大');
      result[row.kind] += amount;
      if (row.kind === 'pet') result.count += q;
    });
    ['pet','item','gold','cost'].forEach(k => { if (!Number.isSafeInteger(result[k])) throw new Error('总金额过大'); result[k] /= 10000; });
    result.revenue = round(result.pet + result.item + result.gold); result.profit = round(result.revenue - result.cost);
    return result;
  }
  function validate(record) {
    if (!record.scene.trim()) throw new Error('请填写场景');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date) || new Date(record.date+'T12:00:00Z').toISOString().slice(0,10) !== record.date) throw new Error('日期不正确');
    totals(record);
  }
  function settle(state) {
    validate(state.draft); if (!state.draft.rows.length) throw new Error('请先添加收支项目');
    const record = JSON.parse(JSON.stringify({ ...state.draft, id: state.draft.id || 'scene-'+Date.now()+'-'+Math.random().toString(36).slice(2) }));
    const index = state.history.findIndex(r => r.id === record.id);
    if (index < 0) state.history.unshift(record); else state.history[index] = record;
    state.draft = fresh(); return record;
  }
  function derive(history) {
    const days = {}, ids = new Set();
    history.forEach(record => {
      validate(record); if (!record.id || ids.has(record.id)) throw new Error('场景记录编号重复或缺失'); ids.add(record.id);
      const t = totals(record), d = days[record.date] || (days[record.date] = { revenue: 0, cost: 0, count: 0, gold: 0, rows: [] });
      d.revenue = round(d.revenue+t.revenue); d.cost = round(d.cost+t.cost); d.gold = round(d.gold+t.gold); d.count++;
      record.rows.forEach((r,i) => d.rows.push({ id: record.id+':'+i, source: 'scene', date: record.date, name: record.scene+'·'+r.name+(r.kind==='pet'&&getPetSkills(r)!==null?'（'+getPetSkills(r)+'技能）':'')+'×'+r.quantity, price: round(r.price*r.quantity)*(r.kind === 'cost' ? -1 : 1), category: {pet:'场景召唤兽',item:'场景物品',gold:'场景金币',cost:'场景支出'}[r.kind] }));
    }); return days;
  }
  function mergeDaily(base, days, settings) {
    const records = new Map(base.map(r => [r.date, r]));
    Object.keys(days).forEach(date => { if (!records.has(date)) records.set(date,{date,goldIncome:0,itemIncome:0,cardCost:0,netIncome:0,convertedIncome:0}); });
    return [...records.values()].map(row => {
      const original = row.sceneBase || {goldIncome:row.goldIncome || 0,itemIncome:row.itemIncome || 0,netIncome:row.netIncome || 0,convertedIncome:row.convertedIncome || 0};
      const d = days[row.date] || {revenue:0,cost:0,gold:0,count:0};
      const factor = Number.isFinite(row.conversionFactor) ? row.conversionFactor : original.netIncome ? original.convertedIncome/original.netIncome : (Number(settings.ratio)||0)/3000*(Number(settings.discount)||95)/100;
      return {...row,sceneBase:original,sceneIncome:d.revenue,sceneCost:d.cost,sceneCount:d.count,goldIncome:round(original.goldIncome+d.gold),itemIncome:round(original.itemIncome+d.revenue-d.gold),netIncome:round(original.netIncome+d.revenue-d.cost),convertedIncome:round(original.convertedIncome+(d.revenue-d.cost)*factor)};
    }).sort((a,b)=>b.date.localeCompare(a.date));
  }
  if (typeof module === 'object' && module.exports) { module.exports = { fresh, empty, totals, settle, derive, mergeDaily, getPetSkills, priceKey, petStats }; return; }
  function itemImage(item,extra=''){
    const resolver=root.itemIcons||root.treasureIcons;let info;
    try{if(typeof resolver?.resolve==='function')info=resolver.resolve(item);}catch(_){}
    const name=String(item.name||item.category||item.kind||'物品'),src=typeof info?.src==='string'&&info.src?info.src:'./icons/其他.png',kind=info?.kind||'fallback';
    const title=name+(kind==='asset'?'':' · 通用分类图标，非专属外观')+(info?.label?' · '+info.label:'');
    const validBox=value=>Array.isArray(value)&&value.length===4&&value.every(n=>Number.isFinite(n)&&n>=0&&n<=100);
    const viewport=validBox(info?.viewBox)?` style="object-view-box:inset(${info.viewBox.map(n=>n+'%').join(' ')});${validBox(info.viewClip)?'clip-path:inset('+info.viewClip.map(n=>n+'%').join(' ')+')':''}"`:'';
    return `<img class="scene-item-image ${esc(extra)}" src="${esc(src)}" alt="${esc(name)}" title="${esc(title)}" data-icon-kind="${esc(kind)}"${viewport} loading="lazy" decoding="async">`;
  }
  const commonItems=['60武器','60防具','70武器','70防具','80武器','80防具','炼妖石'];

  let state,page,view='run',filter='',editingRow=null;
  const freshEntry=()=>({kind:'pet',name:'',skillCount:'',quantity:'1',price:'0'});
  let entryDraft=freshEntry();
  const clone=value=>JSON.parse(JSON.stringify(value));
  const kinds={pet:'召唤兽',item:'物品',gold:'金币',cost:'成本'};
  const entryKinds={pet:kinds.pet,item:kinds.item};
  function read(){const data=JSON.parse(localStorage.getItem(KEY)||'null')||empty();if(data.version!==1||!data.draft||!Array.isArray(data.history)||!data.prices)throw new Error('场景记账数据格式异常');totals(data.draft);derive(data.history);if(!data.draft.id&&!data.draft.rows.length&&!COMMON_SCENES.includes(sceneName(data.draft.scene)))data.draft.scene=COMMON_SCENES[0];return data;}
  function captureEntry(){const f=page?.querySelector('[data-form="row"]');if(f)entryDraft=Object.fromEntries(['kind','name','skillCount','quantity','price'].map(key=>[key,f.elements[key].value]));}
  function change(fn,sync=false,{clearEntry=false,editIndex}={}){
    try{const next=clone(state);fn(next);totals(next.draft);derive(next.history);localStorage.setItem(KEY,JSON.stringify(next));state=next;
      if(clearEntry){entryDraft=freshEntry();editingRow=null;}else if(editIndex!==undefined)editingRow=editIndex;
      if(sync)root.dispatchEvent(new CustomEvent('ring-ledger-changed'));render(!clearEntry);return true;
    }catch(e){alert('未保存：'+e.message);return false;}
  }
  function download(name,content,type){const url=URL.createObjectURL(new Blob(['\ufeff',content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function table(rows,editable=false){return `<div class="scene-scroll"><table><thead><tr><th>类型</th><th>名称</th><th>技能数</th><th>数量</th><th>单价/万</th><th>总额/万</th>${editable?'<th>操作</th>':''}</tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${kinds[r.kind]}</td><td><span class="scene-item-name">${itemImage({...r,category:kinds[r.kind],cash:r.kind==='gold'})}<span>${esc(r.name)}</span></span></td><td data-row-skills>${r.kind==='pet'?(getPetSkills(r)??'未填写'):'—'}</td><td>${r.quantity}</td><td>${money(r.price)}</td><td>${money(round(r.price*r.quantity))}</td>${editable?`<td><button data-action="edit-row" data-index="${i}">改</button><button data-action="remove" data-index="${i}">移除</button></td>`:''}</tr>`).join('')||`<tr><td colspan="${editable?7:6}" class="scene-empty">点击左侧图片选择，再添加明细。</td></tr>`}</tbody></table></div>`;}
  function skillStatistics(records){const groups=petStats(records),quantity=groups.reduce((sum,row)=>sum+row.quantity,0);return `<details class="scene-skill-stats" data-skill-stats><summary>按技能数统计 · ${quantity} 只召唤兽</summary><div class="scene-skill-scroll"><table><thead><tr><th>召唤兽</th><th>技能数</th><th>数量</th><th>金额/万</th></tr></thead><tbody>${groups.map(row=>`<tr data-skill-name="${esc(row.name)}" data-skill-count="${row.skillCount??'unknown'}"><td>${esc(row.name)}</td><td>${row.skillCount??'未填写'}</td><td data-skill-quantity>${row.quantity}</td><td data-skill-amount>${money(row.amount)}</td></tr>`).join('')||'<tr><td colspan="4" class="scene-empty">暂无召唤兽明细</td></tr>'}</tbody></table></div></details>`;}
  function entryForm(){
    const original=editingRow===null?null:state.draft.rows[editingRow],legacy=original&&['gold','cost'].includes(original.kind);
    const kindField=legacy?`<span class="scene-legacy-kind">历史${kinds[original.kind]}<input type="hidden" name="kind" value="${original.kind}"></span>`:`<select name="kind">${Object.entries(entryKinds).map(([key,label])=>`<option value="${key}" ${entryDraft.kind===key?'selected':''}>${label}</option>`).join('')}</select>`;
    return `<form class="scene-fields scene-entry-form ${entryDraft.kind==='pet'?'scene-pet-entry':''}" data-form="row"><label>类型${kindField}</label><label>名称<input name="name" list="scene-pets" required maxlength="100" value="${esc(entryDraft.name)}" placeholder="点击左侧选择／自填"></label><label data-skill-field ${entryDraft.kind==='pet'?'':'hidden'}>技能数<input name="skillCount" aria-label="召唤兽技能数" type="number" min="0" max="99" step="1" value="${esc(entryDraft.skillCount??'')}" placeholder="未填" ${entryDraft.kind==='pet'?'':'disabled'}></label><label>数量<input name="quantity" type="number" min="1" max="100000" step="1" value="${esc(entryDraft.quantity)}" required></label><label>单价/万<input name="price" type="number" min="0" step="0.0001" value="${esc(entryDraft.price)}" required></label><button type="submit">${editingRow===null?'添加明细':'保存修改'}</button>${editingRow===null?'':'<button type="button" data-action="cancel-row">取消修改</button>'}</form>`;
  }
  function running(){
    const rec=state.draft,selected=sceneName(rec.scene),pets=root.sceneData.pets.filter(p=>p.scenes.some(name=>sceneName(name)===selected)),t=totals(rec);
    const sceneOptions=(COMMON_SCENES.includes(selected)?'':`<option value="${esc(rec.scene)}" selected disabled>${esc(rec.scene||'未选择')}（旧记录）</option>`)+COMMON_SCENES.map(name=>`<option value="${esc(name)}" ${name===selected?'selected':''}>${esc(name)}</option>`).join('');
    return `<div class="scene-split"><section class="scene-item-pane"><div class="scene-item-scroll"><h2>常用物品</h2><div class="scene-common-items">${commonItems.map(name=>`<button data-scene-item="${esc(name)}" title="${esc(name)}">${itemImage({name,category:'物品'},'scene-common-image')}<span>${esc(name)}</span></button>`).join('')}</div><p class="scene-hint">用于记账，不代表所选场景一定掉落。</p><div class="scene-pet-heading"><h2>召唤兽</h2><select data-field="scene" aria-label="场景">${sceneOptions}</select></div><div class="scene-pets">${pets.map(p=>`<button data-pet="${p.id}" title="${esc(p.name)}">${itemImage({id:p.id,name:p.name,category:'召唤兽',kind:'pet'},'scene-pet-image')}<span class="scene-pet-label">${esc(p.name)}</span></button>`).join('')||'<p class="scene-empty">选择场景后显示召唤兽，也可在右侧自填。</p>'}</div></div></section><section class="scene-record-pane"><h2>${editingRow===null?'收益录入':'修改第 '+(editingRow+1)+' 项'}</h2>${entryForm()}<datalist id="scene-pets">${[...new Set(pets.map(p=>p.name))].map(name=>`<option value="${esc(name)}">`).join('')}</datalist>${table(rec.rows,true)}${skillStatistics([rec])}<div class="scene-bottom"><span>净收益 <strong class="${t.profit<0?'scene-loss':''}">${money(t.profit)} 万</strong></span>${rec.id?'<button data-action="cancel">取消历史修改</button>':''}<button data-action="settle" class="scene-primary">${rec.id?'保存历史修改':'结算并合并总账'}</button></div></section></div>`;
  }
  function history(){
    const records=state.history.filter(r=>!filter||r.scene===filter),profit=round(records.reduce((sum,r)=>sum+totals(r).profit,0));
    return `<div class="scene-history-head"><label>场景<select data-filter><option value="">全部场景</option>${[...new Set(state.history.map(r=>r.scene))].map(name=>`<option ${name===filter?'selected':''}>${esc(name)}</option>`).join('')}</select></label><span>${records.length} 次 · 净收益 ${money(profit)} 万</span></div>${skillStatistics(records)}<section class="scene-history-list">${records.map(rec=>`<details class="scene-history-record"><summary>${esc(rec.date)} · ${esc(rec.scene)} <strong>净收益 ${money(totals(rec).profit)} 万</strong></summary>${table(rec.rows)}<div class="scene-history-actions"><button data-action="edit" data-id="${esc(rec.id)}">修改</button><button data-action="delete" data-id="${esc(rec.id)}">删除</button></div></details>`).join('')||'<p class="scene-empty">暂无已结算记录。</p>'}</section>`;
  }
  function backup(){return '<section class="scene-backup"><h2>场景数据备份</h2><p>备份包含草稿、历史和记忆单价，旧记录中的备注与耗时也会保留。</p><div><button data-action="backup">导出备份</button><button data-action="import">恢复备份</button><input type="file" data-import accept=".json" hidden></div></section>';}
  function render(preserveEntry=true){
    if(preserveEntry)captureEntry();
    const positions=Array.from(page.querySelectorAll('.scene-item-scroll,.scene-record-pane>.scene-scroll')).map(el=>({kind:el.className,top:el.scrollTop,left:el.scrollLeft})),scroll=page.querySelector('main')?.scrollTop||0,statsOpen=!!page.querySelector('[data-skill-stats][open]');
    page.classList.toggle('scene-run',view==='run');
    page.innerHTML=`<nav><h1>场景记账</h1><button data-view="run" aria-pressed="${view==='run'}">本次</button><button data-view="history" aria-pressed="${view==='history'}">历史</button><button data-view="backup" aria-pressed="${view==='backup'}">备份</button><button data-shared-prices-open>共用价格</button><button data-action="back" class="scene-back">返回记账</button></nav><main>${view==='run'?running():view==='history'?history():backup()}</main>`;
    for(const pos of positions){const el=Array.from(page.querySelectorAll('.scene-item-scroll,.scene-record-pane>.scene-scroll')).find(el=>el.className===pos.kind);if(el){el.scrollTop=pos.top;el.scrollLeft=pos.left;}}
    const stats=page.querySelector('[data-skill-stats]');if(stats)stats.open=statsOpen;
    if(view!=='run')page.querySelector('main').scrollTop=scroll;
  }
  function open(){
    root.treasureProject?.hide();root.toolboxProject?.hide();
    try{state=read();}catch(e){alert(e.message);return;}
    if(!page){page=document.createElement('section');page.id='scene-project';page.setAttribute('aria-label','场景记账');document.body.append(page);bind();}
    root.ringProject?.hide();root.supportProject?.hide();document.getElementById('app').hidden=true;page.hidden=false;root.projectNavigation?.select('scene');render();
  }
  function hide(){if(page)page.hidden=true;}
  function sharedPrice(item,fallback){return root.itemPrices?.get(item,fallback)??fallback;}
  function rememberShared(item,price){try{if(root.itemPrices?.describe(item).shareable)root.itemPrices.set(item,price);}catch(error){alert('本次明细已保存，但共享价格未同步：'+error.message);}}
  function identityFromForm(f){const row={kind:f.elements.kind.value,name:f.elements.name.value.trim()};if(row.kind==='pet'&&f.elements.skillCount.value.trim()!=='')row.skillCount=Number(f.elements.skillCount.value);getPetSkills(row);return row;}
  function referencePrice(row){return sharedPrice(row,state.prices[priceKey(row)]??0);}
  function selectEntry(kind,name){
    entryDraft={kind,name,skillCount:'',quantity:'1',price:String(referencePrice({kind,name}))};editingRow=null;render(false);
    page.querySelector('[data-form="row"]').elements[kind==='pet'?'skillCount':'price'].focus({preventScroll:true});
  }
  function bind(){
    page.addEventListener('input',e=>{if(e.target.closest('[data-form="row"]'))captureEntry();});
    page.addEventListener('change',async e=>{
      const el=e.target;
      if(el.dataset.field==='scene'){if(!COMMON_SCENES.includes(el.value)){alert('请选择列表中的常用场景');render();return;}change(s=>{s.draft.scene=el.value;});}
      if(el.hasAttribute('data-filter')){filter=el.value;render();}
      if(el.matches('[name="name"],[name="kind"],[name="skillCount"]')){const f=el.form;if(f?.matches('[data-form="row"]')){try{const pet=f.elements.kind.value==='pet';f.querySelector('[data-skill-field]').hidden=!pet;f.elements.skillCount.disabled=!pet;f.classList.toggle('scene-pet-entry',pet);if(!pet)f.elements.skillCount.value='';const row=identityFromForm(f);if(editingRow===null)f.elements.price.value=referencePrice(row);captureEntry();}catch(error){alert(error.message);}}}
      if(el.hasAttribute('data-import')&&el.files[0]){
        try{const file=el.files[0];if(file.size>5*1024*1024)throw new Error('备份不能超过 5 MB');const data=JSON.parse((await file.text()).replace(/^\uFEFF/,''));if(data.version!==1||!data.prices||!data.draft||!Array.isArray(data.history))throw new Error('备份格式不正确');totals(data.draft);derive(data.history);if(!confirm('恢复备份将替换场景草稿和历史，继续吗？'))return;localStorage.setItem(KEY,JSON.stringify(data));state=data;entryDraft=freshEntry();editingRow=null;root.dispatchEvent(new CustomEvent('ring-ledger-changed'));render(false);}catch(error){alert('恢复失败：'+error.message);}finally{el.value='';}
      }
    });
    page.addEventListener('submit',e=>{
      if(!e.target.matches('[data-form="row"]'))return;e.preventDefault();captureEntry();
      try{const f=e.target,row={...identityFromForm(f),quantity:number(f.elements.quantity.value,'数量',true),price:number(f.elements.price.value,'单价')},index=editingRow;
        const original=index===null?null:state.draft.rows[index],legacy=original&&['gold','cost'].includes(original.kind);
        if(legacy?row.kind!==original.kind:!Object.prototype.hasOwnProperty.call(entryKinds,row.kind))throw new Error(legacy?'历史金币／成本的类型不可修改':'仅支持新增召唤兽或物品');
        if(change(s=>{if(index===null)s.draft.rows.push(row);else{if(!s.draft.rows[index])throw new Error('这项明细已不存在');s.draft.rows[index]=row;}s.prices[priceKey(row)]=row.price;},false,{clearEntry:true}))rememberShared(row,row.price);
      }catch(error){alert('未保存：'+error.message);}
    });
    page.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.view){view=b.dataset.view;render();return;}
      if(b.dataset.sceneItem){selectEntry('item',b.dataset.sceneItem);return;}
      if(b.dataset.pet){const pet=root.sceneData.pets.find(p=>p.id===b.dataset.pet);if(pet)selectEntry('pet',pet.name);return;}
      const action=b.dataset.action,index=Number(b.dataset.index);
      if(action==='back'){hide();document.getElementById('app').hidden=false;root.projectNavigation?.select('accounting');}
      if(action==='edit-row'){const row=state.draft.rows[index];if(row){entryDraft={kind:row.kind,name:row.name,skillCount:getPetSkills(row)===null?'':String(getPetSkills(row)),quantity:String(row.quantity),price:String(row.price)};editingRow=index;render(false);page.querySelector('[data-form="row"]').elements.price.focus({preventScroll:true});}}
      if(action==='cancel-row'){entryDraft=freshEntry();editingRow=null;render(false);}
      if(action==='remove')change(s=>s.draft.rows.splice(index,1),false,{clearEntry:editingRow===index,editIndex:editingRow!==null&&editingRow>index?editingRow-1:editingRow});
      if(action==='settle')change(s=>{settle(s);view='history';filter='';},true,{clearEntry:true});
      if(action==='cancel')change(s=>{s.draft=fresh();},false,{clearEntry:true});
      if(action==='edit'){if((state.draft.id||state.draft.rows.length)&&!confirm('替换当前草稿以修改历史记录？'))return;change(s=>{s.draft=clone(s.history.find(r=>r.id===b.dataset.id));view='run';},false,{clearEntry:true});}
      if(action==='delete'&&confirm('删除这次场景记录，并从五开总账移除对应收支？'))change(s=>{s.history=s.history.filter(r=>r.id!==b.dataset.id);if(s.draft.id===b.dataset.id)s.draft=fresh();},true);
      if(action==='backup')download('场景记账备份-'+day()+'.json',JSON.stringify(state,null,2),'application/json');
      if(action==='import')page.querySelector('[data-import]').click();
    });
  }

  root.sceneProject={open,hide};
  const ring=root.ringAccounting;
  function days() {return derive(read().history);}
  root.ringAccounting={
    day(date){const r=ring.day(date),s=days()[date]||{revenue:0,cost:0,gold:0,count:0,rows:[]};return {...r,revenue:round(r.revenue+s.revenue),cost:round(r.cost+s.cost),sceneGold:s.gold,sceneCount:s.count,rows:[...r.rows,...s.rows]};},
    mergeDaily(base,settings){const stripped=base.map(r=>{if(!r.sceneBase)return r;const {sceneBase,...rest}=r;return {...rest,...sceneBase};});return mergeDaily(ring.mergeDaily(stripped,settings),days(),settings);}
  };
})(typeof window === 'object' ? window : globalThis);
