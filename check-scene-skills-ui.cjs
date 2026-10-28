'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
for(const stream of [process.stdout,process.stderr])stream.on('error',error=>{if(error.code!=='EPIPE')throw error;});
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const dist=process.env.SCENE_TEST_DIST?path.resolve(process.env.SCENE_TEST_DIST):path.join(__dirname,'dist');
const suffix=process.env.SCENE_TEST_DIST?'-打包版':'';
const scene=require(path.join(dist,'assets','scene-project.js'));
const profile=path.join(os.tmpdir(),'xiaobaobei-scene-skills-ui-'+Date.now()+'-'+process.pid);
const docs=path.join(__dirname,'docs'),KEY='mh_scene_project_v1',NAME='吸血鬼',PET_ID='2077';
const DATE=scene.fresh().date,NOTE='技能数回归：旧备注保留',MINUTES=91;
app.setPath('userData',profile);app.disableHardwareAcceleration();
ipcMain.handle('toolbox-game-status',()=>({active:false,message:'未设置'}));ipcMain.handle('copy-mini-program',()=>true);
const report={test:'Scene pet skill-count real DOM regression',startedAt:new Date().toISOString(),dist,profile,isolated:true,network:'Remote HTTP/HTTPS blocked; local assets only; no real player profile used',steps:[],errors:[],screenshots:[]};
const sourceFiles=['index.html','assets/scene-project.js','assets/scene-project.css','assets/item-prices.js','assets/treasure-icons.js','assets/scene-pet-icons.js'];
report.targetSHA256=Object.fromEntries(sourceFiles.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,file))).digest('hex')]));
fs.mkdirSync(docs,{recursive:true});let win;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  win=new BrowserWindow({width:1180,height:780,show:false,webPreferences:{preload:path.join(__dirname,'electron/preload.js'),contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
  report.blockedNetworkRequests=[];
  win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,callback)=>{report.blockedNetworkRequests.push(details.url);callback({cancel:true});});
  win.webContents.on('console-message',event=>{if(event.level==='error'){report.errors.push(event.message);console.error('Renderer:',event.message);}});
  const run=script=>win.webContents.executeJavaScript(script).catch(error=>{console.error('Renderer script failed:',script);throw error;});
  const click=selector=>run(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing '+${JSON.stringify(selector)});el.click();})()`);
  const change=async(selector,value,event='change')=>run(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing '+${JSON.stringify(selector)});el.value=${JSON.stringify(String(value))};el.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);
  const read=()=>run(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}))`);
  const form=()=>run(`(()=>{const f=document.querySelector('#scene-project [data-form=row]');return Object.fromEntries(['kind','name','quantity','price','skillCount'].map(key=>[key,f.elements[key]?.value]));})()`);
  const step=async(name,fn)=>{await fn();report.steps.push({name,status:'PASS'});console.log('PASS:',name);};
  const shot=async name=>{await pause(160);const file=path.join(docs,name+suffix+'.png');fs.writeFileSync(file,(await win.webContents.capturePage()).toPNG());report.screenshots.push(file);};
  const stats=()=>run(`(()=>{const root=document.querySelector('#scene-project details.scene-skill-stats[data-skill-stats]');if(!root)throw Error('Missing scene skill statistics');root.open=true;return Array.from(root.querySelectorAll('tr[data-skill-name]')).filter(row=>row.dataset.skillName===${JSON.stringify(NAME)}).map(row=>({skill:row.dataset.skillCount,quantity:Number(row.querySelector('[data-skill-quantity]').textContent.replaceAll(',','')),amount:Number(row.querySelector('[data-skill-amount]').textContent.replaceAll(',',''))})).sort((a,b)=>a.skill.localeCompare(b.skill));})()`);
  const expected=[{skill:'3',quantity:2,amount:20},{skill:'4',quantity:1,amount:30},{skill:'unknown',quantity:1,amount:5}];
  const submit=()=>run(`document.querySelector('#scene-project [data-form=row]').requestSubmit()`);
  const addPet=async(skills,quantity,price)=>{
    await click('#scene-project [data-pet="'+PET_ID+'"]');
    await change('#scene-project [name=skillCount]',skills===undefined?'':skills);
    if(price!==undefined)await change('#scene-project [name=price]',price,'input');
    await change('#scene-project [name=quantity]',quantity,'input');await submit();
  };
  const importRaw=async raw=>{await run(`(()=>{const input=document.querySelector('#scene-project [data-import]'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(raw)}],'scene-skills-test-backup.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause(120);};
  try{
    await win.loadFile(path.join(dist,'index.html'));
    const fixture=scene.empty();fixture.draft={...scene.fresh(),date:DATE,scene:'无名鬼城',note:NOTE,minutes:MINUTES};
    fixture.prices[JSON.stringify(['pet',NAME])]=5;fixture.prices[JSON.stringify(['pet',NAME,3])]=999;fixture.prices[JSON.stringify(['pet',NAME,4])]=998;
    await run(`localStorage.clear();localStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(JSON.stringify(fixture))});`);
    await win.loadFile(path.join(dist,'index.html'));
    await run(`window.__skillAlerts=[];window.alert=message=>window.__skillAlerts.push(String(message));window.confirm=()=>true;window.__skillDownloads=[];const originalURL=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.__skillDownloads.push(blob);return originalURL(blob);};HTMLAnchorElement.prototype.click=function(){window.__skillDownloadName=this.download;};window.itemPrices.setMany([{item:{kind:'pet',name:${JSON.stringify(NAME)},skillCount:3},price:10},{item:{kind:'pet',name:${JSON.stringify(NAME)},skillCount:4},price:30},{item:{kind:'pet',name:${JSON.stringify(NAME)},skillCount:0},price:2},{item:{kind:'pet',name:${JSON.stringify(NAME)}},price:5}]);document.querySelector('#project-scene').click();`);
    await step('Pet-only integer skill input and distinct shared tiers, including zero versus unknown',async()=>{
      const spec=await run(`(()=>{const el=document.querySelector('#scene-project [name=skillCount]');return {type:el.type,min:el.min,max:el.max,step:el.step,disabled:el.disabled,value:el.value};})()`);
      assert.deepEqual(spec,{type:'number',min:'0',max:'99',step:'1',disabled:false,value:''});
      const shared=await run(`[undefined,0,3,4].map(skillCount=>{const item={kind:'pet',name:${JSON.stringify(NAME)}};if(skillCount!==undefined)item.skillCount=skillCount;return {key:window.itemPrices.describe(item).key,price:window.itemPrices.get(item)};})`);
      assert.deepEqual(shared.map(row=>row.price),[5,2,10,30]);assert.equal(new Set(shared.map(row=>row.key)).size,4);
      assert.deepEqual(shared.slice(1).map(row=>JSON.parse(row.key)),[['pet',NAME,0],['pet',NAME,3],['pet',NAME,4]]);
      await click('#scene-project [data-scene-item="60武器"]');
      assert.equal(await run(`(()=>{const el=document.querySelector('#scene-project [name=skillCount]');return el.disabled&&(!el.getClientRects().length||el.closest('[hidden]')!==null||getComputedStyle(el).display==='none');})()`),true,'Item rows hide and disable skills');
      const before=JSON.stringify(await read());await click('#scene-project [data-pet="'+PET_ID+'"]');assert.equal(JSON.stringify(await read()),before,'Pet selection is prefill only');
      assert.equal((await form()).skillCount,'');assert.equal((await form()).price,'5');
      await change('#scene-project [name=skillCount]',3);assert.equal((await form()).price,'10','Three-skill shared tier overrides stale page price 999');
      await change('#scene-project [name=skillCount]',4);assert.equal((await form()).price,'30');
      await change('#scene-project [name=skillCount]',0);assert.equal((await form()).price,'2');
      await change('#scene-project [name=skillCount]','');assert.equal((await form()).price,'5');
      report.sharedTiers=shared;
    });
    await step('Three-skill, four-skill and unknown rows aggregate four pets and exactly 55 wan',async()=>{
      await addPet(3,2);await addPet(4,1);await addPet(undefined,1);
      const saved=await read();assert.equal(saved.draft.rows.length,3);assert.deepEqual(saved.draft.rows.map(row=>row.skillCount),[3,4,undefined]);assert.equal(Object.prototype.hasOwnProperty.call(saved.draft.rows[2],'skillCount'),false);
      assert.equal(scene.totals(saved.draft).count,4);assert.equal(scene.totals(saved.draft).profit,55);assert.deepEqual(await stats(),expected);
      assert.equal(saved.prices[JSON.stringify(['pet',NAME,3])],10);assert.equal(saved.prices[JSON.stringify(['pet',NAME,4])],30);assert.equal(saved.prices[JSON.stringify(['pet',NAME])],5);
      assert.match(await run(`document.querySelector('#scene-project .scene-record-pane > .scene-scroll thead').textContent`),/技能/);
      assert.equal(await run(`document.querySelectorAll('#scene-project .scene-record-pane > .scene-scroll thead th').length`),7,'Detail table gains a dedicated skill-count column');
      assert.match(await run(`document.querySelector('#scene-project .scene-record-pane > .scene-scroll tbody').textContent`),/未填写|未知|未填/);
      await addPet(0,1);assert.equal((await read()).draft.rows[3].skillCount,0,'Explicit zero remains a numeric snapshot');
      const zero=(await stats()).find(row=>row.skill==='0');assert.deepEqual(zero,{skill:'0',quantity:1,amount:2});
      await click('#scene-project [data-action=remove][data-index="3"]');assert.deepEqual(await stats(),expected);
      assert.equal((await read()).draft.date,DATE);assert.equal((await read()).draft.note,NOTE);assert.equal((await read()).draft.minutes,MINUTES);
    });
    await step('Changing tiers reprices only new entry; scene changes and row edits preserve unsubmitted skills',async()=>{
      const before=JSON.stringify((await read()).draft.rows);
      await click('#scene-project [data-pet="'+PET_ID+'"]');await change('#scene-project [name=skillCount]',3);await change('#scene-project [name=quantity]',7,'input');await change('#scene-project [name=price]',12.75,'input');
      const entry=await form();await change('#scene-project [data-field=scene]','青丘');await change('#scene-project [data-field=scene]','无名鬼城');assert.deepEqual(await form(),entry);assert.equal(JSON.stringify((await read()).draft.rows),before);
      await click('#scene-project [data-action=edit-row][data-index="0"]');assert.equal((await form()).skillCount,'3');
      await change('#scene-project [name=skillCount]',4);const editing=await form();assert.equal(editing.price,'10','Changing a skill field while editing must not silently reprice the recorded entry');
      await change('#scene-project [data-field=scene]','青丘');await change('#scene-project [data-field=scene]','无名鬼城');assert.deepEqual(await form(),editing);assert.equal(JSON.stringify((await read()).draft.rows),before);
      await click('#scene-project [data-action=cancel-row]');
      await run(`window.itemPrices.set({kind:'pet',name:${JSON.stringify(NAME)},skillCount:3},11);`);assert.equal(JSON.stringify((await read()).draft.rows),before,'Shared tier changes must not reprice existing rows');
      await click('#scene-project [data-pet="'+PET_ID+'"]');await change('#scene-project [name=skillCount]',3);assert.equal((await form()).price,'11');
      await change('#scene-project [name=skillCount]',7);assert.equal((await form()).price,'0','Unset known tier must not borrow unknown or another tier');
      await run(`window.itemPrices.set({kind:'pet',name:${JSON.stringify(NAME)},skillCount:3},10);`);
      await change('#scene-project [name=skillCount]','');assert.equal((await form()).price,'5');
      assert.deepEqual(await stats(),expected);
    });
    await step('Skill statistics and seven-column detail table keep two panes at 1180 and 1060',async()=>{
      for(const [width,height] of [[1180,780],[1060,700]]){
        win.setContentSize(width,height);await pause(160);await stats();
        const geometry=await run(`(()=>{const p=document.querySelector('#scene-project'),l=p.querySelector('.scene-item-pane').getBoundingClientRect(),r=p.querySelector('.scene-record-pane').getBoundingClientRect(),b=p.querySelector('[data-action=settle]').getBoundingClientRect();return {width:innerWidth,height:innerHeight,pageWidth:p.clientWidth,pageScroll:p.scrollWidth,documentWidth:document.documentElement.scrollWidth,leftRight:l.right,rightX:r.x,leftTop:l.y,rightTop:r.y,rightWidth:r.width,bottom:b.bottom};})()`);
        assert(geometry.leftRight<=geometry.rightX+1);assert(Math.abs(geometry.leftTop-geometry.rightTop)<2);assert(geometry.rightWidth>=450);assert(geometry.documentWidth<=geometry.width+1);assert(geometry.pageScroll<=geometry.pageWidth+1);assert(geometry.bottom<=geometry.height+1);
        report.steps.push({name:'Geometry '+width+'x'+height,status:'PASS',geometry});await shot('场景技能档位-'+width+'x'+height+'-测试');
      }
      win.setContentSize(1180,780);await pause(100);
    });
    let recordId,backupRaw;
    await step('Settlement preserves skill snapshots and main ledger labels keep original pet images',async()=>{
      const image=await run(`document.querySelector('#scene-project [data-pet="${PET_ID}"] img').getAttribute('src')`);
      await click('#scene-project [data-action=settle]');const saved=await read();assert.equal(saved.history.length,1);recordId=saved.history[0].id;
      assert.deepEqual(saved.history[0].rows.map(row=>row.skillCount),[3,4,undefined]);assert.equal(saved.history[0].note,NOTE);assert.equal(saved.history[0].minutes,MINUTES);assert.deepEqual(await stats(),expected);
      const day=await run(`window.ringAccounting.day(${JSON.stringify(DATE)})`);assert.equal(day.revenue-day.cost,55);assert(day.rows.some(row=>row.name.includes(NAME)&&/3\s*技能/.test(row.name)));
      await click('#project-accounting');await pause(150);
      const main=await run(`(()=>{const img=Array.from(document.querySelectorAll('#app img.ledger-item-image')).find(img=>img.alt.includes(${JSON.stringify(NAME)})&&img.alt.includes('3技能'));return img?{name:img.alt,src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0}:null;})()`);
      assert(main,'Main ledger DOM must include three-skill pet label');assert.equal(main.src,image,'Skill suffix must not replace the pet illustration');assert.equal(main.loaded,true,'Pet illustration must load');report.mainLedgerPet=main;await shot('场景技能主账图片-测试');
      await click('#project-scene');await click('#scene-project [data-view=history]');
    });
    await step('Editing settled history replaces one record and keeps skill tiers',async()=>{
      await click('#scene-project [data-action=edit][data-id="'+recordId+'"]');await click('#scene-project [data-action=edit-row][data-index="1"]');assert.equal((await form()).skillCount,'4');
      await change('#scene-project [name=price]',31,'input');await submit();await click('#scene-project [data-action=settle]');
      const saved=await read();assert.equal(saved.history.length,1);assert.equal(saved.history[0].id,recordId);assert.deepEqual(saved.history[0].rows.map(row=>row.skillCount),[3,4,undefined]);assert.equal(scene.totals(saved.history[0]).profit,56);
      assert.deepEqual(await stats(),[{skill:'3',quantity:2,amount:20},{skill:'4',quantity:1,amount:31},{skill:'unknown',quantity:1,amount:5}]);
    });
    await step('Backup export and restore preserve numeric tiers and omitted unknown',async()=>{
      await click('#scene-project [data-view=backup]');await click('#scene-project [data-action=backup]');backupRaw=await run(`window.__skillDownloads.at(-1).text()`);
      const backup=JSON.parse(backupRaw.replace(/^\uFEFF/,''));assert.deepEqual(backup.history[0].rows.map(row=>row.skillCount),[3,4,undefined]);assert.equal(Object.hasOwn(backup.history[0].rows[2],'skillCount'),false);assert.equal(backup.history[0].note,NOTE);assert.equal(backup.history[0].minutes,MINUTES);
      await click('#scene-project [data-view=history]');await click('#scene-project [data-action=delete][data-id="'+recordId+'"]');assert.equal((await read()).history.length,0);
      await click('#scene-project [data-view=backup]');await importRaw(backupRaw);const restored=await read();assert.equal(restored.history.length,1);assert.equal(restored.history[0].id,recordId);assert.deepEqual(restored.history[0].rows.map(row=>row.skillCount),[3,4,undefined]);assert.equal(scene.totals(restored.history[0]).profit,56);
      assert.equal(await run(`window.ringAccounting.day(${JSON.stringify(DATE)}).revenue-window.ringAccounting.day(${JSON.stringify(DATE)}).cost`),56);
    });
    await step('Fractional, negative and 100-skill backups are rejected without overwrite',async()=>{
      const before=JSON.stringify(await read());
      for(const value of [1.5,-1,100]){const invalid=JSON.parse(backupRaw.replace(/^\uFEFF/,''));invalid.history[0].rows[0].skillCount=value;await importRaw(JSON.stringify(invalid));assert.equal(JSON.stringify(await read()),before,'Invalid skill '+value+' must not overwrite data');assert.match((await run(`window.__skillAlerts`)).at(-1),/恢复失败/);}
      report.expectedAlerts=await run(`window.__skillAlerts`);assert.equal(report.expectedAlerts.length,3);await run(`window.__skillAlerts=[];`);
    });
    await click('#scene-project [data-view=history]');await stats();await shot('场景技能历史分档-测试');
    assert.deepEqual(await run(`window.__skillAlerts`),[]);assert.equal(report.errors.length,0,report.errors.join('\n'));
    report.status='PASS';console.log('PASS: scene pet skills, separate prices/statistics, edits, main-ledger images, strict backups and compact split layout.');
  }catch(error){report.status='FAIL';report.failure=error.stack||String(error);try{await shot('场景技能测试失败现场');}catch(_){}throw error;}
  finally{report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(docs,'scene-skills-ui-test-report'+suffix+'.json'),JSON.stringify(report,null,2)+'\n');if(win&&!win.isDestroyed())win.destroy();}
  app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
