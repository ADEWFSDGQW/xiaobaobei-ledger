'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
// Test runners may disconnect their log pipe. This is not a renderer/app error.
// Ignore only EPIPE; preserve all other failures and the JSON test report.
for(const stream of [process.stdout,process.stderr])stream.on('error',error=>{if(error.code!=='EPIPE')throw error;});
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const scene=require('./dist/assets/scene-project.js'),ring=require('./dist/assets/ring-project.js'),treasure=require('./dist/assets/treasure-core.js');
const dist=process.env.SHARED_PRICES_TEST_DIST?path.resolve(process.env.SHARED_PRICES_TEST_DIST):path.join(__dirname,'dist');
const profile=path.join(os.tmpdir(),'xiaobaobei-shared-prices-ui-'+Date.now()+'-'+process.pid);
app.setPath('userData',profile);app.disableHardwareAcceleration();
ipcMain.handle('copy-mini-program',()=>true);ipcMain.handle('toolbox-game-status',()=>({active:false,message:'未设置'}));
const report={test:'Shared reference prices real DOM integration',startedAt:new Date().toISOString(),dist,profile,isolated:true,network:'HTTP and HTTPS requests blocked; local dist only; no user accounts used',steps:[],errors:[],screenshots:[]};
const index=fs.readFileSync(path.join(dist,'index.html'),'utf8'),targetFiles=['index.html',...Array.from(index.matchAll(/(?:src|href)="\.\/([^"?#]+\.(?:js|css))"/g),match=>match[1])];
report.targetSHA256=Object.fromEntries(targetFiles.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,file))).digest('hex')]));
const docs=path.join(__dirname,'docs');fs.mkdirSync(docs,{recursive:true});
let win;
app.whenReady().then(async()=>{
  win=new BrowserWindow({width:1180,height:780,show:false,webPreferences:{preload:path.join(__dirname,'electron/preload.js'),contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
  report.blockedNetworkRequests=[];
  win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,callback)=>{report.blockedNetworkRequests.push(details.url);callback({cancel:true});});
  win.webContents.on('console-message',event=>{if(event.level==='error'){report.errors.push(event.message);console.error('Renderer:',event.message);}});
  const run=script=>win.webContents.executeJavaScript(script).catch(error=>{console.error('Failed script:',script);throw error;});
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const click=selector=>run(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing '+${JSON.stringify(selector)});el.click();})()`);
  const read=key=>run(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))`);
  const getShared=item=>run(`window.itemPrices.get(${JSON.stringify(item)})`);
  const waitFor=async(script,label)=>{for(let i=0;i<40;i++){if(await run(script))return;await pause(50);}throw Error('Timed out: '+label);};
  const financial=()=>run(`(()=>{const parse=k=>JSON.parse(localStorage.getItem(k)||'null');const sc=parse('mh_scene_project_v1'),r=parse('mh_ring_project_v1'),t=parse('mh_treasure_project_v1');return JSON.stringify({records:localStorage.getItem('mh_records'),daily:localStorage.getItem('mh_daily_income'),scene:{draft:sc?.draft,history:sc?.history},ring:{drafts:r?.drafts,history:r?.history},treasure:{drafts:t?.drafts,history:t?.history}});})()`);
  const step=async(name,fn)=>{await fn();report.steps.push({name,status:'PASS'});console.log('PASS:',name);};
  const shot=async name=>{await pause(180);const file=path.join(docs,name+'.png');fs.writeFileSync(file,(await win.webContents.capturePage()).toPNG());report.screenshots.push(file);};
  const dialogPrice=async changes=>{
    await click('[data-shared-prices-open]');
    assert.equal(await run(`document.getElementById('shared-prices-dialog').open`),true);
    await run(`(()=>{const changes=${JSON.stringify(changes)};for(const [name,value] of Object.entries(changes)){const row=Array.from(document.querySelectorAll('#shared-prices-dialog [data-shared-name]')).find(el=>el.dataset.sharedName===name);if(!row)throw Error('Missing shared item '+name);const input=row.querySelector('[data-shared-price]');input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('#shared-prices-dialog [data-shared-save]').requestSubmit();})()`);
    await pause(100);
    const message=await run(`document.querySelector('#shared-prices-dialog [data-shared-status]').textContent`);
    assert.match(message,/已同步|没有需要同步/,message);
  };
  const closeDialog=()=>run(`document.querySelector('#shared-prices-dialog form[method=dialog] button').click()`);
  const rightClickPrice=async(name,price)=>{
    await click('#project-accounting');
    await run(`(()=>{const image=document.querySelector('#app img[alt='+JSON.stringify(${JSON.stringify(name)})+']');if(!image)throw Error('Missing main image');image.parentElement.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:200,clientY:200}));})()`);
    await waitFor(`!!document.querySelector('#app textarea[placeholder*="价格"]')`,'main price modal');
    await run(`(()=>{const input=document.querySelector('#app textarea[placeholder*="价格"]');input.value=${JSON.stringify(String(price))};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await run(`Array.from(document.querySelectorAll('#app button')).find(button=>button.textContent.trim()==='确认').click()`);
    await waitFor(`window.itemPrices.get({name:${JSON.stringify(name)}})===${price}`,'main watcher writes shared value');
  };
  try{
    await win.loadFile(path.join(dist,'index.html'));
    const date=treasure.day();
    const s=scene.empty();s.draft.scene='无名鬼城';s.draft.rows=[{kind:'item',name:'60武器',quantity:1,price:7}];s.history=[{...scene.fresh(),id:'scene-history',date,scene:'青丘',minutes:30,rows:[{kind:'item',name:'60武器',quantity:1,price:6}]}];
    const r=ring.empty();r.drafts.pet.costs=[{name:'60武器',price:8,score:2,time:new Date().toISOString()}];r.history=[{...ring.fresh('pet'),id:'ring-history',endedAt:new Date().toISOString(),costs:[{name:'60武器',price:9,score:2}],rewards:[{kind:'铁',name:'百炼精铁',level:'100',quantity:1,price:10}]}];r.rewardPrices={'["pet","书","剑","100"]':1000000,'["pet","书","刀","100"]':2000000,'["pet","书","剑","110"]':3000000,'["pet","铁","百炼精铁","100"]':123456};
    const t=treasure.empty();t.drafts.normal.quantity=3;t.drafts.normal.unitCost=1;t.drafts.normal.rows=[{id:'old-diamond',name:'金刚石',category:'五宝',source:'direct',quantity:1,price:10,cash:false,realized:false},{id:'old-custom',name:'自写小物品',category:'自定义物品',source:'direct',quantity:1,price:30,cash:false,realized:false}];t.history=[{...treasure.fresh(),id:'treasure-history',quantity:2,unitCost:1,rows:[{id:'old-loot',name:'60级武器',category:'环装',source:'direct',quantity:1,price:11,cash:false,realized:true}]}];
    const fixtures={mh_items:[{id:1,name:'60武器',type:'fixed',category:'装备',price:20},{id:7,name:'金刚石',type:'fixed',category:'五宝',price:140}],mh_scene_project_v1:s,mh_ring_project_v1:r,mh_treasure_project_v1:t,mh_records:[{id:'manual-history',rId:1,name:'金刚石',price:42,category:'五宝',date}],mh_daily_income:[{date,goldIncome:100,itemIncome:42,cardCost:0,netIncome:142,convertedIncome:142,conversionFactor:1}]};
    await run(`localStorage.clear();for(const [key,value] of Object.entries(${JSON.stringify(fixtures)}))localStorage.setItem(key,JSON.stringify(value));`);
    await win.loadFile(path.join(dist,'index.html'));
    await run(`window.__sharedAlerts=[];window.alert=message=>window.__sharedAlerts.push(String(message));window.confirm=()=>true;void 0;`);
    await pause(150);
    const originalFinancial=await financial();
    await step('Shared dialog edits main reference prices without changing existing drafts/history/ledger',async()=>{
      await dialogPrice({'60武器':12.3456,'金刚石':150});
      assert.equal(await getShared({name:'60防具'}),21,'Existing ring reference source remains independently seeded');
      assert.equal(await getShared({name:'60武器'}),12.3456);assert.equal(await getShared({name:'金刚石'}),150);
      const main=await read('mh_items');assert.equal(main.find(item=>item.id===1).price,12.3456);assert.equal(main.find(item=>item.id===7).price,150);
      assert.equal(await financial(),originalFinancial);
      assert.equal(await run(`Array.from(document.querySelectorAll('#shared-prices-dialog [data-shared-name]')).some(el=>['低级兽诀','高级魔兽要诀','低级召唤兽内丹'].includes(el.dataset.sharedName))`),false,'Generic skill categories must not share one price');
      await shot('共用价格设置实测');await closeDialog();
    });
    await step('Scene quick entry and name aliases use current shared reference; existing row stays unchanged',async()=>{
      await click('#project-scene');await click('#scene-project [data-scene-item="60武器"]');
      assert.equal(await run(`document.querySelector('#scene-project [data-form=row]').elements.price.value`),'12.3456');
      await run(`var f=document.querySelector('#scene-project [data-form=row]');f.elements.name.value='60级武器';f.elements.name.dispatchEvent(new Event('change',{bubbles:true}));`);
      assert.equal(await run(`document.querySelector('#scene-project [data-form=row]').elements.price.value`),'12.3456');
      assert.equal((await read('mh_scene_project_v1')).draft.rows[0].price,7);
      await run(`document.querySelector('#scene-project [data-form=row]').requestSubmit();`);
      assert.equal((await read('mh_scene_project_v1')).draft.rows.at(-1).price,12.3456);
    });
    await step('Ring task creates only a new cost row at the shared price',async()=>{
      await click('#project-ring');await click('#ring-project [data-action=task][data-name="60武器"]');
      const state=await read('mh_ring_project_v1');assert.equal(state.drafts.pet.costs[0].price,8);assert.equal(state.drafts.pet.costs.at(-1).price,12.3456);assert.equal(state.history[0].costs[0].price,9);
    });
    await step('Books preserve level and equipment-type separation through dialog edits and ring prefill',async()=>{
      const before=await financial();await dialogPrice({'100级剑制造指南书':111});await closeDialog();
      assert.equal(await getShared({name:'剑',kind:'书',level:100}),111);assert.equal(await getShared({name:'刀',kind:'书',level:100}),200);assert.equal(await getShared({name:'剑',kind:'书',level:110}),300);assert.equal(await getShared({name:'百炼精铁',kind:'铁',level:100}),12.3456);assert.equal(await financial(),before);
      await click('#project-ring');await run(`var f=document.querySelector('#ring-project [data-form=reward]');f.elements.name.value='剑';f.elements.name.dispatchEvent(new Event('change',{bubbles:true}));f.elements.level.value='100';f.elements.level.dispatchEvent(new Event('change',{bubbles:true}));`);
      assert.equal(await run(`document.querySelector('#ring-project [data-form=reward]').elements.price.value`),'111');
    });
    await step('Main real right-click price editor publishes to other pages without historical recalculation',async()=>{
      const before=await financial();await rightClickPrice('60武器',22.2222);assert.equal(await financial(),before);
      await click('#project-scene');await click('#scene-project [data-scene-item="60武器"]');assert.equal(await run(`document.querySelector('#scene-project [data-form=row]').elements.price.value`),'22.2222');
      await click('#project-ring');assert.match(await run(`document.querySelector('#ring-project [data-action=task][data-name="60武器"] small').textContent`),/22\.2222/);
    });
    await step('Explicit zero is retained and does not fall back to stale page prices',async()=>{
      const before=await financial();await rightClickPrice('60武器',0);assert.equal(await getShared({name:'60武器'}),0);assert.equal(await run(`window.itemPrices.has({name:'60级武器'})`),true);assert.equal(await financial(),before);
      await click('#project-scene');await click('#scene-project [data-scene-item="60武器"]');assert.equal(await run(`document.querySelector('#scene-project [data-form=row]').elements.price.value`),'0');
      await click('#project-ring');assert.match(await run(`document.querySelector('#ring-project [data-action=task][data-name="60武器"] small').textContent`),/^0 万$/);
    });
    await step('Treasure new rows use shared prices; existing estimates retain original values',async()=>{
      await click('#project-treasure');await click('#treasure-project [data-add="five-0"]');
      const state=await read('mh_treasure_project_v1');assert.equal(state.drafts.normal.rows.find(row=>row.id==='old-diamond').price,10);assert.equal(state.drafts.normal.rows.at(-1).price,150);assert.equal(state.history[0].rows[0].price,11);
      await shot('挖图共享价格实测');
    });
    await step('Treasure fixed/custom groups show separate totals and classification snapshots',async()=>{
      assert.equal(await run(`typeof window.treasureCore.priceBreakdown`),'function');
      const state=await read('mh_treasure_project_v1'),groups=await run(`window.treasureCore.priceBreakdown(JSON.parse(localStorage.getItem('mh_treasure_project_v1')).drafts.normal)`);
      report.treasureBreakdown=groups;report.treasureRows=state.drafts.normal.rows;
      assert(await run(`document.querySelector('#treasure-project').textContent.includes('固定')&&document.querySelector('#treasure-project').textContent.includes('自定义')`),'Fixed/custom DOM labels must be visible');
      assert.equal(state.drafts.normal.rows.find(row=>row.id==='old-custom').price,30);
      assert.equal(state.drafts.normal.rows.at(-1).priceMode,'fixed','New rows must preserve classification snapshots');
      assert.deepEqual([groups.fixed.quantity,groups.fixed.revenue,groups.fixed.actualRevenue],[2,160,0]);
      assert.deepEqual([groups.custom.quantity,groups.custom.revenue,groups.custom.actualRevenue],[1,30,0]);
      assert.deepEqual([groups.cash.quantity,groups.cash.revenue,groups.cash.actualRevenue],[0,0,0]);
      const dom=await run(`(()=>{const root=document.querySelector('#treasure-project'),result={};for(const mode of ['fixed','custom','cash']){const body=root.querySelector('tbody[data-price-group="'+mode+'"]'),subtotal=body.querySelector('[data-price-subtotal]');result[mode]={rows:body.querySelectorAll('tr[data-price-row]').length,quantity:subtotal.querySelector('[data-breakdown-quantity]').textContent.trim(),revenue:Number(subtotal.querySelector('[data-breakdown-revenue]').textContent.replaceAll(',','')),actual:Number(subtotal.querySelector('[data-breakdown-actual]').textContent.replaceAll(',','')),quickCount:root.querySelectorAll('[data-quick-group="'+mode+'"] [data-add][data-price-mode="'+mode+'"]').length};}return result;})()`);
      report.treasureGroupDOM=dom;
      assert.deepEqual([dom.fixed.rows,dom.fixed.quantity,dom.fixed.revenue,dom.fixed.actual],[2,'2 件',160,0]);
      assert.deepEqual([dom.custom.rows,dom.custom.quantity,dom.custom.revenue,dom.custom.actual],[1,'1 件',30,0]);
      assert.deepEqual([dom.cash.rows,dom.cash.quantity,dom.cash.revenue,dom.cash.actual],[0,'0 笔',0,0]);
      assert(dom.fixed.quickCount>0&&dom.custom.quickCount>0&&dom.cash.quickCount>0,'Every quick group must contain correctly classified controls');
    });
    const beforeReload=await financial();
    await step('Reload persists shared values and keeps financial data unchanged',async()=>{
      await win.loadFile(path.join(dist,'index.html'));await pause(150);assert.equal(await getShared({name:'60武器'}),0);assert.equal(await getShared({name:'金刚石'}),150);assert.equal(await getShared({name:'剑',kind:'书',level:100}),111);assert.equal(await financial(),beforeReload);
    });
    assert.equal(report.errors.length,0,report.errors.join('\n'));
    report.status='PASS';console.log('PASS: all real DOM shared-price integration checks; no real account data or existing profile accessed.');
  }catch(error){report.status='FAIL';report.failure=error.stack||String(error);try{await shot('共用价格测试失败现场');}catch(_){}throw error;}
  finally{report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(docs,'shared-prices-ui-test-report.json'),JSON.stringify(report,null,2)+'\n');if(win&&!win.isDestroyed())win.destroy();}
  app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
