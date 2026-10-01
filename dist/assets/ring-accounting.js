(function (root) {
  'use strict';
  const roundTools = typeof module === 'object' && module.exports ? require('./ring-project.js') : root.ringProject;
  const num = value => Number(value) || 0;
  const round = value => Math.round(value * 10000) / 10000;
  function localDay(value) {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) throw new Error('跑环结算日期异常');
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function derive(history) {
    const days = {}, seen = new Set();
    history.forEach(record => {
      if (!record.id || seen.has(record.id)) throw new Error('跑环结算编号重复或缺失');
      seen.add(record.id);
      const date = localDay(record.endedAt), totals = roundTools.totals(record);
      const day = days[date] || (days[date] = { revenue: 0, cost: 0, count: 0, rows: [] });
      const label = (record.mode === 'pet' ? '宠环' : '人环') + (record.role ? '·' + record.role : '');
      day.count++;
      day.revenue = round(day.revenue + totals.revenue / 10000);
      day.cost = round(day.cost + totals.expense / 10000);
      record.rewards.forEach((reward, index) => day.rows.push({ id: `${record.id}:reward:${index}`, source: 'ring', roundId: record.id, date,
        name: `${label}·${reward.kind} ${reward.level ? reward.level + '级 ' : ''}${reward.name}×${reward.quantity}`,
        price: round(roundTools.gold(reward.price) * num(reward.quantity) / 10000), category: '跑环奖励' }));
      day.rows.push({ id: `${record.id}:cost`, source: 'ring', roundId: record.id, date, name: `${label}·总支出（含领取费10万）`, price: -totals.expense / 10000, category: '跑环支出' });
    });
    return days;
  }
  function mergeDaily(base, days, settings) {
    const records = new Map(base.map(row => [row.date, { ...row }]));
    Object.keys(days).forEach(date => { if (!records.has(date)) records.set(date, { date, goldIncome: 0, itemIncome: 0, cardCost: 0, netIncome: 0, convertedIncome: 0 }); });
    return [...records.values()].map(row => {
      const day = days[row.date] || { revenue: 0, cost: 0, count: 0 };
      const original = row.ringBase || { itemIncome: num(row.itemIncome), netIncome: num(row.netIncome), convertedIncome: num(row.convertedIncome) };
      const factor = Number.isFinite(row.conversionFactor) ? row.conversionFactor : original.netIncome ? original.convertedIncome / original.netIncome : num(settings.ratio) / 3000 * (num(settings.discount) || 95) / 100;
      return { ...row, ringBase: original, ringIncome: day.revenue, ringCost: day.cost, ringCount: day.count,
        itemIncome: round(original.itemIncome + day.revenue), netIncome: round(original.netIncome + day.revenue - day.cost),
        convertedIncome: round(original.convertedIncome + (day.revenue - day.cost) * factor) };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }
  function createReader(read) {
    let cached;
    return { days() { if (!cached) cached = derive(read()); return cached; }, invalidate() { cached = undefined; } };
  }
  if (typeof module === 'object' && module.exports) { module.exports = { localDay, derive, mergeDaily, createReader }; return; }
  const reader = createReader(() => {
    const data = JSON.parse(localStorage.getItem('mh_ring_project_v1') || '{"history":[]}');
    if (!Array.isArray(data.history)) throw new Error('跑环历史记录格式异常');
    return data.history;
  });
  root.addEventListener('ring-ledger-changed', () => reader.invalidate());
  root.addEventListener('storage', event => { if (!event.key || event.key === 'mh_ring_project_v1') reader.invalidate(); });
  root.ringAccounting = {
    day(date) { return reader.days()[date] || { revenue: 0, cost: 0, count: 0, rows: [] }; },
    mergeDaily(base, settings) { return mergeDaily(base, reader.days(), settings); }
  };
})(typeof window === 'object' ? window : globalThis);
