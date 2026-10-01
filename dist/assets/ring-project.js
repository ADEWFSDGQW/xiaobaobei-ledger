(function (root) {
  'use strict';
  const KEY = 'mh_ring_project_v1';
  const ENTRY_FEE = 10;
  const TYPES = { pet: '宠环', human: '人环' };
  const REWARDS = { pet: ['书', '铁', '修炼果', '战魄'], human: ['书', '铁', '灵饰书', '灵饰铁', '战魄'] };
  const BOOK_IRON_LEVELS = [80, 90, 100, 110, 120, 130, 140, 150];
  const ACCESSORY_LEVELS = [60, 80, 100, 120, 140];
  function rewardLevels(kind) {
    return kind === '书' || kind === '铁' ? BOOK_IRON_LEVELS : kind === '灵饰书' || kind === '灵饰铁' ? ACCESSORY_LEVELS : [];
  }
  const ITEMS = [
    ['找人', 0, 1], ['60武器', 20, 2], ['60装备', 21, 2], ['70武器', 18, 3],
    ['70装备', 10, 3], ['80武器', 48, 5], ['80装备', 40, 5],
    ['一级家具', 2, 2], ['二级家具', 3, 5], ['三药／烹饪', 2, 2],
    ['唢呐', 10, 4], ['笛子', 10, 4], ['琵琶', 10, 4], ['竖琴', 10, 4],
    ['钵', 0, 4], ['箫', 0, 4], ['木鱼', 10, 4], ['编钟', 10, 4],
    ['玫瑰', 21, 4], ['牡丹', 4, 4], ['百合', 1, 4], ['康乃馨', 4, 4],
    ['垃圾变异', 300, 5], ['指定变异', 500, 10], ['指定普通', 0, -15]
  ];
  function number(value, label, integer = false) {
    if (String(value).trim() === '') throw new Error(label + '不能为空');
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) throw new Error(label + '须为非负' + (integer ? '整数' : '数字'));
    return n;
  }
  function gold(value, label = '金额') {
    const n = number(value, label);
    if (n > 1e9) throw new Error(label + '过大');
    return Math.round(n * 10000);
  }
  function money(value) { return Number((value / 10000).toFixed(4)).toLocaleString('zh-CN', { maximumFractionDigits: 4 }); }
  function fresh(mode) {
    return { id: '', mode, role: '', startedAt: new Date().toISOString(), fee: ENTRY_FEE, extra: 0, fruitPrice: 0, costs: [], rewards: [] };
  }
  function empty() {
    return { version: 1, mode: 'pet', prices: Object.fromEntries(ITEMS.map(([name, price]) => [name, gold(price)])), rewardPrices: {}, drafts: { pet: fresh('pet'), human: fresh('human') }, history: [] };
  }
  function totals(draft) {
    if (!TYPES[draft.mode]) throw new Error('跑环类型不正确');
    let expense = gold(ENTRY_FEE, '领取费用') + gold(draft.extra, '其他费用');
    let score = 0, cultivation = 0, revenue = 0;
    draft.costs.forEach((row, index) => {
      expense += gold(row.price, '第 ' + (index + 1) + ' 环成本');
      if (!Number.isFinite(Number(row.score))) throw new Error('任务积分不正确');
      score += Number(row.score);
      if (draft.mode === 'pet') cultivation += Math.floor((index + 1) / 10) + 3;
    });
    draft.rewards.forEach(row => {
      if (!REWARDS[draft.mode].includes(row.kind)) throw new Error('该跑环类型不支持此奖励');
      const quantity = number(row.quantity, '奖励数量', true);
      if (quantity > 100000) throw new Error('奖励数量过大');
      revenue += gold(row.price, '奖励单价') * quantity;
    });
    if (!Number.isSafeInteger(expense) || !Number.isSafeInteger(revenue)) throw new Error('总金额超出范围');
    return { rings: draft.costs.length, expense, revenue, profit: revenue - expense, score, cultivation,
      perPoint: cultivation ? Math.floor(expense / cultivation) : null,
      fruitPerPoint: Math.floor(gold(draft.fruitPrice || 0, '修炼果参考价') / 150) };
  }
  function settle(state, mode) {
    const draft = state.drafts[mode], summary = totals(draft);
    draft.fee = ENTRY_FEE;
    if (!draft.costs.length) throw new Error('请先记录至少一环');
    const now = new Date().toISOString();
    const record = JSON.parse(JSON.stringify({ ...draft, id: draft.id || 'ring-' + Date.now() + '-' + Math.random().toString(36).slice(2), endedAt: draft.endedAt || now, updatedAt: now, summary }));
    const index = state.history.findIndex(item => item.id === record.id);
    if (index >= 0) state.history[index] = record; else state.history.unshift(record);
    state.drafts[mode] = fresh(mode);
    return record;
  }
  if (typeof module === 'object' && module.exports) { module.exports = { ITEMS, REWARDS, empty, fresh, gold, totals, settle, rewardLevels }; return; }
  let state, page, view = 'run', detail = '', status = '';
  function read() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    if (data.version !== 1 || !data.drafts || !Array.isArray(data.history) || !data.prices || !data.rewardPrices || !TYPES[data.mode]) throw new Error('跑环数据格式异常，请保留本机数据后检查');
    ['pet', 'human'].forEach(mode => { if (data.drafts[mode].mode !== mode) throw new Error('跑环草稿类型异常'); data.drafts[mode].fee = ENTRY_FEE; totals(data.drafts[mode]); });
    data.history.forEach(record => { record.fee = ENTRY_FEE; record.summary = totals(record); });
    localStorage.setItem(KEY, JSON.stringify(data));
    return data;
  }
  function save(next, syncLedger = false) {
    localStorage.setItem(KEY, JSON.stringify(next));
    state = next;
    if (syncLedger) root.dispatchEvent(new CustomEvent("ring-ledger-changed"));
  }
  function change(fn, repaint = true, syncLedger = false) {
    try {
      const next = JSON.parse(JSON.stringify(state)); fn(next); save(next, syncLedger); status = '已自动保存';
      if (repaint) render();
      else if (view === 'run') {
        const d = state.drafts[state.mode], t = totals(d);
        page.querySelector('.ring-summary').outerHTML = overview(d);
        if (d.mode === 'pet') page.querySelector('.ring-round-info .ring-hint').textContent = cultivationHint(t);
        const rewardRows = page.querySelectorAll('input[data-reward][data-prop="price"]');
        rewardRows.forEach(el => { const row = d.rewards[Number(el.dataset.reward)]; el.closest('td').nextElementSibling.textContent = money(gold(row.price) * row.quantity); });
      }
    }
    catch (error) { alert('未保存：' + error.message); }
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const date = value => new Date(value).toLocaleString('zh-CN', { hour12: false });
  function input(label, key, value, type = 'number') {
    return `<label>${label}<input aria-label="${label}" data-field="${key}" type="${type}" ${type === 'number' ? 'min="0" step="0.0001"' : 'maxlength="100"'} value="${esc(value)}"></label>`;
  }
  function rewardKey(mode, row) { return JSON.stringify([mode, row.kind, row.name.trim(), row.level.trim()]); }
  function cultivationHint(t) { return `任务积分：${t.score} 分 · 参考修炼点：${t.cultivation} 点 · 跑环成本：${t.perPoint === null ? '—' : t.perPoint} 两／点 · 修炼果：${t.fruitPerPoint} 两／点。参考修炼点按每环 floor(环数 / 10) + 3 累计，不计入金币收益。`; }
  function overview(draft) {
    const t = totals(draft);
    return `<div class="ring-summary"><div>已记环数<strong>${t.rings} / ${draft.mode === 'pet' ? 100 : 300}</strong></div><div>累计成本<strong>${money(t.expense)} 万</strong></div><div>奖励收益<strong>${money(t.revenue)} 万</strong></div><div>净利润<strong class="${t.profit < 0 ? 'ring-loss' : 'ring-gain'}">${money(t.profit)} 万</strong></div></div>`;
  }
  function costTable(draft, editable) {
    return `<div class="ring-table-scroll"><table><thead><tr><th>环数</th><th>时间</th><th>事项</th>${draft.mode === 'pet' ? '<th>积分</th>' : ''}<th>成本（万）</th>${editable ? '<th>操作</th>' : ''}</tr></thead><tbody>${draft.costs.map((row, i) => `<tr><td>${i + 1}</td><td>${esc(date(row.time))}</td><td>${esc(row.name)}</td>${draft.mode === 'pet' ? `<td>${row.score}</td>` : ''}<td>${editable ? `<input aria-label="第${i + 1}环成本" type="number" min="0" step="0.0001" data-cost="${i}" value="${row.price}">` : esc(row.price)}</td>${editable ? `<td><button data-action="remove-cost" data-index="${i}">移除</button></td>` : ''}</tr>`).reverse().join('') || '<tr><td colspan="6" class="ring-empty">还没有记录，完成一环后点击下方任务按钮。</td></tr>'}</tbody></table></div>`;
  }
  function rewardsTable(draft, editable) {
    return `<div class="ring-table-scroll"><table><thead><tr><th>奖励类型</th><th>名称</th><th>等级</th><th>数量</th><th>单价（万）</th><th>收益（万）</th>${editable ? '<th>操作</th>' : ''}</tr></thead><tbody>${draft.rewards.map((row, i) => `<tr><td>${esc(row.kind)}</td><td>${esc(row.name)}</td><td>${esc(row.level) || '—'}</td><td>${editable ? `<input aria-label="奖励${i + 1}数量" type="number" min="0" step="1" data-reward="${i}" data-prop="quantity" value="${row.quantity}">` : row.quantity}</td><td>${editable ? `<input aria-label="奖励${i + 1}单价" type="number" min="0" step="0.0001" data-reward="${i}" data-prop="price" value="${row.price}">` : row.price}</td><td>${money(gold(row.price) * row.quantity)}</td>${editable ? `<td><button data-action="remove-reward" data-index="${i}">移除</button></td>` : ''}</tr>`).join('') || '<tr><td colspan="7" class="ring-empty">按实际获得的奖励录入；自用物品也可按自定义估值记账。</td></tr>'}</tbody></table></div>`;
  }
  function running() {
    const d = state.drafts[state.mode], t = totals(d);
    return `${overview(d)}<div class="ring-run-columns"><section class="ring-expenses"><div class="ring-section-head"><h2>记录每环支出</h2><button data-action="undo" ${d.costs.length ? '' : 'disabled'}>撤销上一环</button></div><div class="ring-task-buttons">${ITEMS.filter((item, i) => d.mode === 'pet' || i < 7 || i === 9).map(([name], i) => `<button data-action="task" data-name="${esc(name)}">${esc(name)}<small>${money(state.prices[name])} 万</small></button>`).join('')}</div><form data-form="cost" class="ring-inline"><label>自定义事项<input name="name" required maxlength="100" placeholder="实际交付物品或任务"></label><label>实际成本（万）<input name="price" type="number" min="0" step="0.0001" value="0" required></label>${d.mode === 'pet' ? '<label>任务积分<input name="score" type="number" step="1" value="0" required></label>' : ''}<button type="submit">记一环</button></form>${costTable(d, true)}</section><section class="ring-rewards"><h2>本轮奖励收益</h2><form data-form="reward" class="ring-inline"><label>奖励类型<select name="kind">${REWARDS[d.mode].map(kind => `<option>${kind}</option>`).join('')}</select></label><label>名称<input name="name" maxlength="100" placeholder="如制造指南书／剑" required></label><label>等级<select name="level" aria-label="奖励等级">${rewardLevels("书").map(level => `<option value="${level}">${level} 级</option>`).join("")}</select></label><label>数量<input name="quantity" type="number" min="1" max="100000" step="1" value="1" required></label><label>单价（万）<input name="price" type="number" min="0" step="0.0001" value="0" required></label><button type="submit">添加奖励</button></form><p class="ring-hint">${d.mode === 'pet' ? '支持书、铁、修炼果、战魄。书铁等级 80～150，每 10 级一档；修炼果按实际领取数量填写。' : '支持书、铁、灵饰书、灵饰铁、战魄。书铁等级 80～150；灵饰书铁等级为 60、80、100、120、140。'} 同类型、名称和等级的单价会记住，后续修改价格不会改变已结算历史。</p>${rewardsTable(d, true)}</section></div><div class="ring-bottom"><span>${esc(status)} · 草稿自动保存，关闭页面后可继续。</span><button class="ring-primary" data-action="settle">${d.id ? '保存历史修改' : '结束本轮并保存收益'}</button></div><section class="ring-round-info"><h2>本轮信息 ${d.id ? '<small>正在修改历史记录</small>' : ''}</h2><div class="ring-fields">${input('角色／备注', 'role', d.role, 'text')}<label>领取费用（万）<input aria-label="领取费用（万）" type="number" value="10" readonly title="每轮固定领取费用 10 万"></label>${input('其他费用（万）', 'extra', d.extra)}${d.mode === 'pet' ? input('修炼果参考价（万）', 'fruitPrice', d.fruitPrice) : ''}</div>${d.mode === 'pet' ? `<p class="ring-hint">任务积分：${t.score} 分 · 参考修炼点：${t.cultivation} 点 · 跑环成本：${t.perPoint === null ? '—' : t.perPoint} 两／点 · 修炼果：${t.fruitPerPoint} 两／点。参考修炼点按每环 floor(环数 / 10) + 3 累计，不计入金币收益。</p>` : '<p class="ring-hint">人环按实际支出记账；每次点击表示完成一环。奖励可在过程中或结束后逐项录入。</p>'}</section>`;
  }
  function history() {
    const records = state.history.filter(record => record.mode === state.mode);
    const aggregate = records.reduce((a, record) => { const t = totals(record); a.expense += t.expense; a.revenue += t.revenue; a.profit += t.profit; return a; }, { expense: 0, revenue: 0, profit: 0 });
    const selected = records.find(row => row.id === detail);
    return `<div class="ring-summary"><div>已结算<strong>${records.length} 次</strong></div><div>累计成本<strong>${money(aggregate.expense)} 万</strong></div><div>累计收益<strong>${money(aggregate.revenue)} 万</strong></div><div>累计净利润<strong class="${aggregate.profit < 0 ? 'ring-loss' : 'ring-gain'}">${money(aggregate.profit)} 万</strong></div></div><section><h2>${TYPES[state.mode]}历史收益记录</h2><div class="ring-table-scroll"><table><thead><tr><th>结算时间</th><th>角色／备注</th><th>环数</th><th>奖励</th><th>成本（万）</th><th>收益（万）</th><th>净利润（万）</th><th>操作</th></tr></thead><tbody>${records.map(record => { const t = totals(record); return `<tr><td>${esc(date(record.endedAt))}</td><td>${esc(record.role) || '—'}</td><td>${t.rings}</td><td>${esc(record.rewards.map(r => `${r.kind}${r.level ? ' ' + r.level + '级' : ''} ×${r.quantity}`).join('、')) || '无奖励'}</td><td>${money(t.expense)}</td><td>${money(t.revenue)}</td><td class="${t.profit < 0 ? 'ring-loss' : 'ring-gain'}">${money(t.profit)}</td><td><button data-action="detail" data-id="${esc(record.id)}">详情</button> <button data-action="edit" data-id="${esc(record.id)}">修改</button></td></tr>`; }).join('') || '<tr><td colspan="8" class="ring-empty">尚无已结算记录。</td></tr>'}</tbody></table></div></section>${selected ? `<section><h2>本轮明细 · ${esc(selected.role) || TYPES[selected.mode]}</h2><p>领取费用 ${esc(selected.fee)} 万 · 其他费用 ${esc(selected.extra)} 万</p>${costTable(selected, false)}<h2>奖励明细</h2>${rewardsTable(selected, false)}</section>` : ''}`;
  }
  function prices() {
    return `<section><h2>任务价格设置</h2><p class="ring-hint">以下初始值仅供参考，请按所在服务器修改。金额单位为万，支持四位小数。改价只影响之后添加的环，已有记录保持原价；临时成交价可直接修改该环成本。</p><div class="ring-price-grid">${ITEMS.map(([name]) => `<label>${esc(name)}<input aria-label="${esc(name)}价格" data-price="${esc(name)}" type="number" min="0" step="0.0001" value="${state.prices[name] / 10000}"></label>`).join('')}</div></section><section><h2>已记住的奖励单价</h2><p class="ring-hint">添加奖励时按跑环类型、奖励种类、名称和等级匹配；每次结算前可修改实际价格。</p><div class="ring-price-grid">${Object.entries(state.rewardPrices).map(([key, price]) => { const [mode, kind, name, level] = JSON.parse(key); return `<label>${esc(TYPES[mode] + ' · ' + kind + ' · ' + name + (level ? ' · ' + level + '级' : ''))}<input aria-label="奖励参考单价" type="number" min="0" step="0.0001" data-reward-price="${esc(key)}" value="${price / 10000}"></label>`; }).join('') || '<p class="ring-empty">添加第一项奖励后，这里会显示它的价格。</p>'}</div></section>`;
  }
  function render() {
    page.innerHTML = `<header class="ring-header"><div><h1>跑环记账</h1><p>结算后自动合并五开总账 · 金额单位：万梦幻币</p></div><button data-action="back">返回五开记账本</button></header><nav class="ring-nav"><div>${Object.entries(TYPES).map(([mode, label]) => `<button data-mode="${mode}" class="${state.mode === mode ? 'ring-active' : ''}">${label}</button>`).join('')}</div><div>${[['run', '本轮记账'], ['history', '历史收益'], ['prices', '价格设置']].map(([id, label]) => `<button data-view="${id}" class="${view === id ? 'ring-active' : ''}">${label}</button>`).join('')}<button data-action="export">导出跑环备份</button></div></nav><main class="${view === 'run' ? 'ring-main-run' : ''}">${view === 'history' ? history() : view === 'prices' ? prices() : running()}</main>`;
  }
  function addCost(next, row) {
    const d = next.drafts[next.mode], limit = next.mode === 'pet' ? 100 : 300;
    if (d.costs.length >= limit) throw new Error('已达到 ' + limit + ' 环，请先结算本轮');
    if (!row.name.trim()) throw new Error('请填写事项名称');
    gold(row.price, '本环成本');
    if (!Number.isInteger(Number(row.score))) throw new Error('任务积分须为整数');
    d.costs.push({ ...row, score: Number(row.score), time: new Date().toISOString() });
  }
  function prefill(form, kindChanged = false) {
    const kind = form.elements.kind.value, level = form.elements.level;
    const levels = rewardLevels(kind), previous = Number(level.value);
    level.innerHTML = levels.length ? levels.map(value => `<option value="${value}">${value} 级</option>`).join('') : '<option value="">不分等级</option>';
    level.disabled = !levels.length;
    if (levels.includes(previous)) level.value = String(previous);
    const defaults = { 铁: '百炼精铁', 灵饰铁: '元灵晶石', 修炼果: '修炼果', 战魄: '战魄' };
    if (kindChanged && defaults[kind]) form.elements.name.value = defaults[kind];
    else if (kindChanged && Object.values(defaults).includes(form.elements.name.value)) form.elements.name.value = '';
    const row = { kind: form.elements.kind.value, name: form.elements.name.value, level: form.elements.level.value };
    if (row.kind === '修炼果') { form.elements.name.value = '修炼果'; form.elements.level.value = ''; row.name = '修炼果'; row.level = ''; }
    const saved = state.rewardPrices[rewardKey(state.mode, row)];
    form.elements.price.value = saved === undefined ? (row.kind === '修炼果' ? state.drafts.pet.fruitPrice : 0) : saved / 10000;
  }
  function open() {
    root.supportProject?.hide();
    if (page) { page.hidden = false; document.getElementById('app').hidden = true; root.projectNavigation?.select('ring'); return; }
    try { state = read(); } catch (error) { alert(error.message); return; }
    page = document.createElement('div'); page.id = 'ring-project'; document.body.append(page);
    document.getElementById('app').hidden = true;
    root.projectNavigation?.select('ring');
    page.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.dataset.mode) { change(next => { next.mode = button.dataset.mode; }); detail = ''; return; }
      if (button.dataset.view) { view = button.dataset.view; render(); return; }
      const action = button.dataset.action, index = Number(button.dataset.index);
      if (!action) return;
      if (action === 'back') { close(); return; }
      if (action === 'detail') { detail = button.dataset.id; render(); return; }
      if (action === 'export') {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = '跑环备份_' + new Date().toLocaleDateString('sv-SE') + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
      }
      if (action === 'settle' && !state.drafts[state.mode].rewards.length && !confirm('本轮尚未录入奖励，是否按收益 0 结算？')) return;
      if (action === 'edit' && (state.drafts[state.mode].costs.length || state.drafts[state.mode].rewards.length || state.drafts[state.mode].role || Number(state.drafts[state.mode].extra))) { alert('请先结算当前草稿，再修改历史记录。'); return; }
      change(next => {
        const d = next.drafts[next.mode];
        if (action === 'task') { const item = ITEMS.find(row => row[0] === button.dataset.name); addCost(next, { name: item[0], price: next.prices[item[0]] / 10000, score: next.mode === 'pet' ? item[2] : 0 }); }
        if (action === 'undo') d.costs.pop();
        if (action === 'remove-cost') d.costs.splice(index, 1);
        if (action === 'remove-reward') d.rewards.splice(index, 1);
        if (action === 'settle') { settle(next, next.mode); view = 'history'; }
        if (action === 'edit') { next.drafts[next.mode] = JSON.parse(JSON.stringify(next.history.find(row => row.id === button.dataset.id))); view = 'run'; }
      }, true, action === 'settle');
    });
    function onEdit(event) {
      const el = event.target;
      if (el.closest('[data-form="reward"]') && ['kind', 'name', 'level'].includes(el.name)) { prefill(el.form, el.name === 'kind'); return; }
      if (el.dataset.field || el.dataset.cost !== undefined || el.dataset.reward !== undefined || el.dataset.price || el.dataset.rewardPrice) change(next => {
        const d = next.drafts[next.mode];
        if (el.dataset.field) { if (el.dataset.field !== 'role') gold(el.value); d[el.dataset.field] = el.dataset.field === 'role' ? el.value : Number(el.value); }
        if (el.dataset.cost !== undefined) { gold(el.value); d.costs[Number(el.dataset.cost)].price = Number(el.value); }
        if (el.dataset.reward !== undefined) { const row = d.rewards[Number(el.dataset.reward)]; number(el.value, '奖励' + (el.dataset.prop === 'quantity' ? '数量' : '单价'), el.dataset.prop === 'quantity'); row[el.dataset.prop] = Number(el.value); totals(d); next.rewardPrices[rewardKey(next.mode, row)] = gold(row.price); }
        if (el.dataset.price) next.prices[el.dataset.price] = gold(el.value);
        if (el.dataset.rewardPrice) next.rewardPrices[el.dataset.rewardPrice] = gold(el.value);
        totals(d);
      }, false);
    }
    page.addEventListener('change', onEdit);
    page.addEventListener('input', event => {
      const el = event.target;
      if (!(el.dataset.field || el.dataset.cost !== undefined || el.dataset.reward !== undefined || el.dataset.price || el.dataset.rewardPrice)) return;
      if (el.dataset.field !== 'role' && (el.value.trim() === '' || !Number.isFinite(Number(el.value)) || Number(el.value) < 0 || (el.dataset.prop === 'quantity' && !Number.isInteger(Number(el.value))))) return;
      onEdit(event);
    });
    page.addEventListener('submit', event => {
      event.preventDefault(); const form = event.target, data = Object.fromEntries(new FormData(form));
      change(next => {
        if (form.dataset.form === 'cost') addCost(next, { name: data.name.trim(), price: Number(data.price), score: next.mode === 'pet' ? Number(data.score) : 0 });
        if (form.dataset.form === 'reward') {
          const row = { kind: data.kind, name: data.name.trim(), level: (data.level || '').trim(), quantity: number(data.quantity, '奖励数量', true), price: Number(data.price) };
          const levels = rewardLevels(row.kind);
          if (levels.length && !levels.includes(Number(row.level))) throw new Error('请选择对应奖励的等级');
          if (!levels.length) row.level = '';
          if (!row.name || row.quantity < 1) throw new Error('请填写奖励名称和大于 0 的数量');
          next.drafts[next.mode].rewards.push(row); totals(next.drafts[next.mode]); next.rewardPrices[rewardKey(next.mode, row)] = gold(row.price);
        }
      });
    });
    render();
  }
  function close() {
    if (page) page.hidden = true;
    root.supportProject?.hide();
    document.getElementById('app').hidden = false;
    root.projectNavigation?.select('accounting');
  }
  function hide() { if (page) page.hidden = true; }
  root.ringProject = { open, close, hide, totals, gold };
  document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.getElementById('project-tabs');
    if (!tabs) return;
    const buttons = Array.from(tabs.querySelectorAll('[data-project]'));
    root.projectNavigation = { select(project) {
      buttons.forEach(button => {
        const active = button.dataset.project === project;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      });
    } };
    tabs.addEventListener('click', event => {
      const button = event.target.closest('[data-project]');
      if (!button) return;
      if (button.dataset.project === 'ring') open();
      else if (button.dataset.project === 'support') root.supportProject?.open();
      else close();
    });
    tabs.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next].focus(); buttons[next].click();
    });
  });
})(typeof window === 'object' ? window : globalThis);
