(function (root) {
  'use strict';
  function number(value, label, max = 1e12, integer = false) {
    const n = Number(value);
    if (String(value).trim() === '' || !Number.isFinite(n) || n < 0 || n > max || (integer && !Number.isInteger(n))) throw new Error(label + '不正确');
    return n;
  }
  function progression(rows, from, to, balance, count) {
    from = number(from, '当前等级', 200, true); to = number(to, '目标等级', 200, true);
    balance = number(balance, '已有经验'); count = number(count, '角色数量', 5, true);
    if (to <= from || !count) throw new Error('目标等级须高于当前等级，角色数量为 1～5');
    let experience = 0, money = 0, contribution = 0;
    for (let level = from; level < to; level++) {
      const row = rows.find(r => r.level === level);
      if (!row) throw new Error('缺少 ' + level + '→' + (level + 1) + ' 级数据，请先维护消耗表');
      experience += number(row.experience, '经验'); money += number(row.money, '金钱'); contribution += number(row.contribution, '帮贡');
    }
    if (![experience,money,contribution].every(Number.isSafeInteger)) throw new Error('累计消耗须为安全范围内的整数');
    return { experience, remaining: Math.max(0, experience - balance), money, contribution, totalExperience: experience * count, totalRemaining: Math.max(0, experience - balance) * count, totalMoney: money * count, totalContribution: contribution * count };
  }
  function gems(base, target, quantity, price, owned) {
    base = number(base,'材料等级',20,true); target = number(target,'目标等级',20,true);
    quantity = number(quantity,'目标数量',1000,true); price = number(price,'材料单价'); owned = number(owned,'已有材料',1e9,true);
    if (!base || target < base || !quantity) throw new Error('等级至少为 1，目标不低于材料等级，数量至少为 1');
    const materials = 2 ** (target-base) * quantity;
    const purchase = Math.max(0,materials-owned);
    return { materials, purchase, cost: Math.round(purchase * price * 10000) / 10000 };
  }
  function validate(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.entries) || !Array.isArray(data.tables) || data.entries.length > 5000 || data.tables.length > 30) throw new Error('工具箱备份格式不正确');
    if(data.roles !== undefined) {
      if(!Array.isArray(data.roles)||data.roles.length!==5)throw new Error('须包含五个角色预算');
      data.roles.forEach(r=>{if(!r||typeof r.name!=='string'||r.name.length>100||typeof r.target!=='string'||r.target.length>200)throw new Error('角色预算格式不正确');['experience','balance','money','contribution'].forEach(k=>number(r[k],k));});
    }
    const ids = new Set();
    for (const entry of data.entries) {
      if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) || typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 150 || typeof entry.text !== 'string' || entry.text.length > 30000 || !['人物','技能','修炼','任务','孩子','召唤兽','查询','跑商','攻略','其他','帮派迷宫','神器攻略','副本攻略'].includes(entry.category) || typeof entry.source !== 'string' || entry.source.length > 1000) throw new Error('资料条目格式不正确');
      ids.add(entry.id);
    }
    const tableIds = new Set();
    for (const table of data.tables) {
      if (!table || typeof table.id !== 'string' || !table.id || tableIds.has(table.id) || typeof table.name !== 'string' || !table.name.trim() || table.name.length > 100 || typeof table.source !== 'string' || table.source.length > 1000 || !Array.isArray(table.rows) || table.rows.length > 201) throw new Error('消耗表格式不正确');
      tableIds.add(table.id); const levels = new Set();
      for (const row of table.rows) {
        number(row.level,'等级',200,true); if (levels.has(row.level)) throw new Error('等级数据重复'); levels.add(row.level);
        ['experience','money','contribution'].forEach(k => number(row[k],k,1e12,true));
      }
    }
    return data;
  }
  function parseRows(text) {
    return String(text).trim().split(/\r?\n/).filter(Boolean).map(line => {
      const values = line.trim().split(/[,，\t ]+/);
      if (values.length !== 4) throw new Error('每行须填写：当前等级,经验,金钱（两）,帮贡');
      return { level: number(values[0],'等级',200,true), experience:number(values[1],'经验',1e12,true), money:number(values[2],'金钱',1e12,true), contribution:number(values[3],'帮贡',1e12,true) };
    });
  }
  const api = { number, progression, gems, validate, parseRows };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.toolboxCore = api;
})(globalThis);
