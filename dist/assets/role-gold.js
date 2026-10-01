(function(root){
  'use strict';
  const STORAGE_KEY='mh_role_gold_rows_v1';
  function calculate(rows){
    let start=0,end=0;
    const details=rows.map((row,index)=>{
      const startGold=Number(row.startGold),endGold=Number(row.endGold);
      if(!Number.isFinite(startGold)||!Number.isFinite(endGold)||startGold<0||endGold<0)
        throw new Error('角色 '+(index+1)+' 的开始金币和结束金币须为大于或等于 0 的数字');
      start+=startGold;end+=endGold;
      return {...row,startGold,endGold,difference:endGold-startGold};
    });
    return {rows:details,startGold:Number(start.toFixed(6)),endGold:Number(end.toFixed(6)),difference:Number((end-start).toFixed(6))};
  }
  if(typeof module==='object'&&module.exports){module.exports={calculate};return;}
  function open(options){
    const existing=document.querySelector('.role-gold-dialog');if(existing){existing.showModal();return;}
    let saved=[];try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');}catch(_){}
    if(!Array.isArray(saved))saved=[];
    let count=Math.max(1,Math.min(8,Number(options.roleNumber)||1));
    const rows=Array.from({length:8},(_,index)=>({
      name:saved[index]?.name||'角色'+(index+1),
      startGold:saved[index]?.startGold??(index===0?Number(options.startGold)||0:0),
      endGold:saved[index]?.endGold??(index===0?Number(options.endGold)||0:0)
    }));
    const dialog=document.createElement('dialog');dialog.className='role-gold-dialog';
    const heading=document.createElement('h2');heading.textContent='角色金币统计';
    const form=document.createElement('form');form.method='dialog';
    const toolbar=document.createElement('div');toolbar.className='role-gold-toolbar';
    const label=document.createElement('label');label.textContent='角色数量：';
    const quantity=document.createElement('select');quantity.setAttribute('aria-label','角色数量');
    for(let index=1;index<=8;index++){const option=document.createElement('option');option.value=index;option.textContent=index+' 个';quantity.append(option);}quantity.value=count;label.append(quantity);
    const unit=document.createElement('span');unit.textContent='金额单位：'+(options.unit==='W'?'万':'与主界面一致');
    toolbar.append(label,unit);
    const hint=document.createElement('p');hint.textContent='填写每个角色的开始金币和结束金币，下方自动汇总。';hint.className='role-gold-hint';
    const table=document.createElement('table');const head=document.createElement('thead'),headRow=document.createElement('tr');
    ['角色','开始金币','结束金币','获得金币'].forEach(text=>{const th=document.createElement('th');th.textContent=text;headRow.append(th);});head.append(headRow);
    const body=document.createElement('tbody');table.append(head,body);
    const total=document.createElement('div');total.className='role-gold-total';total.setAttribute('aria-live','polite');
    const error=document.createElement('p');error.className='role-gold-error';error.setAttribute('role','alert');
    const actions=document.createElement('div');actions.className='role-gold-actions';
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='取消';cancel.onclick=()=>dialog.close();
    const apply=document.createElement('button');apply.type='submit';apply.textContent='应用合计';actions.append(cancel,apply);
    function updateTotal(){
      try{const summary=calculate(rows.slice(0,count));error.textContent='';
        total.textContent='开始合计：'+summary.startGold.toFixed(2)+'　结束合计：'+summary.endGold.toFixed(2)+'　获得合计：'+summary.difference.toFixed(2);
        body.querySelectorAll('[data-difference]').forEach((cell,index)=>{cell.textContent=summary.rows[index].difference.toFixed(2);cell.classList.toggle('negative',summary.rows[index].difference<0);});
      }catch(e){error.textContent=e.message;total.textContent='请检查填写的金币数';}
    }
    function draw(){
      body.replaceChildren();
      rows.slice(0,count).forEach((row,index)=>{
        const tr=document.createElement('tr');
        for(const field of ['name','startGold','endGold']){
          const cell=document.createElement('td'),input=document.createElement('input');
          input.type=field==='name'?'text':'number';input.value=row[field];input.setAttribute('aria-label','角色'+(index+1)+(field==='name'?'名称':field==='startGold'?'开始金币':'结束金币'));
          if(field==='name')input.maxLength=24;else{input.min='0';input.step='any';input.inputMode='decimal';}
          input.oninput=()=>{row[field]=input.value;updateTotal();};cell.append(input);tr.append(cell);
        }
        const difference=document.createElement('td');difference.dataset.difference='true';tr.append(difference);body.append(tr);
      });updateTotal();
    }
    quantity.onchange=()=>{count=Number(quantity.value);draw();};
    form.onsubmit=event=>{event.preventDefault();try{
      const result=calculate(rows.slice(0,count));
      localStorage.setItem(STORAGE_KEY,JSON.stringify(rows));
      options.onSave({...result,roleNumber:count});dialog.close();
    }catch(e){error.textContent=e.message;}};
    form.append(toolbar,hint,table,total,error,actions);dialog.append(heading,form);document.body.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});draw();dialog.showModal();
  }
  root.roleGold={open,calculate};
})(typeof window==='object'?window:globalThis);
