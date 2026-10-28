(function(root){
  'use strict';
  const core=root.treasureCore,previous=root.ringAccounting;
  const round=n=>Math.round(n*10000)/10000;
  let cached;
  function days(){if(cached)return cached;const state=JSON.parse(localStorage.getItem(core.KEY)||'null')||core.empty();core.validateState(state);cached=core.derive(state.history);return cached;}
  root.addEventListener('ring-ledger-changed',()=>{cached=undefined;});
  root.addEventListener('storage',e=>{if(!e.key||e.key===core.KEY)cached=undefined;});
  root.ringAccounting={
    day(date){const old=previous.day(date),t=days()[date]||{revenue:0,cost:0,gold:0,count:0,quantity:0,rows:[]};return {...old,revenue:round(old.revenue+t.revenue),cost:round(old.cost+t.cost),treasureIncome:t.revenue,treasureCost:t.cost,treasureGold:t.gold,treasureCount:t.count,treasureQuantity:t.quantity,rows:[...old.rows,...t.rows]};},
    mergeDaily(base,settings){const stripped=base.map(row=>{if(!row.treasureBase)return row;const {treasureBase,...rest}=row;return {...rest,...treasureBase};});return core.mergeDaily(previous.mergeDaily(stripped,settings),days(),settings);}
  };
})(typeof window==='object'?window:globalThis);
