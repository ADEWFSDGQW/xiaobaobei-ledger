'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const TEST_DIST=process.env.SCENE_TEST_DIST?path.resolve(process.env.SCENE_TEST_DIST):path.join(__dirname,'dist');
const SUFFIX=process.env.SCENE_TEST_DIST?'-打包版':'';
const PROFILE=path.join(__dirname,'release','scene-kinds-ui-test-profile'+(SUFFIX?'-packaged':''));
app.setPath('userData',PROFILE);app.disableHardwareAcceleration();
const model=require(path.join(TEST_DIST,'assets','scene-project.js'));
const KEY='mh_scene_project_v1',DATE='2026-10-07',NOTE='旧金币成本记录备注：不丢失',MINUTES=91;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),logs=[];
function pass(name,detail){logs.push({name,result:'PASS',detail});console.log('PASS:',name,detail||'');}
function fixture(rows=[]){const s=model.empty();s.draft={...model.fresh(),scene:'青丘',date:DATE,note:NOTE,minutes:MINUTES,rows};return s;}
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1180,height:780,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}}),errors=[];
  win.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});
  const run=code=>win.webContents.executeJavaScript(code).catch(error=>{console.error('Renderer script failed:',code);throw error;});
  const click=selector=>run(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing '+${JSON.stringify(selector)});el.click();})()`);
  const read=()=>run(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}))`),raw=()=>run(`localStorage.getItem(${JSON.stringify(KEY)})`);
  const open=data=>run(`localStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(JSON.stringify(data))});window.sceneProject.open();document.querySelector('#scene-project [data-view=run]').click();`);
  const options=()=>run(`Array.from(document.querySelector('#scene-project [data-form=row]').elements.kind.options||[]).map(o=>({value:o.value,text:o.textContent}))`);
  async function assertTwo(){assert.deepEqual(await options(),[{value:'pet',text:'召唤兽'},{value:'item',text:'物品'}]);}
  async function rejected(code,before){const alertCount=await run(`window.__kindAlerts.length`);await run(code);assert.equal(await raw(),before,'Rejected submit must not change stored state');assert((await run(`window.__kindAlerts.length`))>alertCount,'Rejected submit must explain validation failure');await run(`window.__kindAlerts=[];`);}
  try{
    await win.loadFile(path.join(TEST_DIST,'index.html'));
    await run(`window.__kindAlerts=[];window.alert=m=>window.__kindAlerts.push(String(m));window.confirm=()=>true;window.__kindDownloads=[];const orig=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.__kindDownloads.push(blob);return orig(blob);};HTMLAnchorElement.prototype.click=function(){};void 0;`);
    await open(fixture());await assertTwo();
    for(const kind of ['gold','cost']){
      await open(fixture());const before=await raw();
      await rejected(`(()=>{const f=document.querySelector('#scene-project [data-form=row]');f.elements.kind.add(new Option('测试注入',${JSON.stringify(kind)}));f.elements.kind.value=${JSON.stringify(kind)};f.elements.name.value='不可新增的金币成本';f.elements.quantity.value='1';f.elements.price.value='5';f.requestSubmit();})()`,before);
    }
    pass('New-entry dropdown has only pet/item and rejects injected gold/cost');
    const ordinary=fixture([{kind:'pet',name:'普通召唤兽',quantity:1,price:20}]);
    for(const kind of ['gold','cost']){
      await open(ordinary);await click('#scene-project [data-action=edit-row][data-index="0"]');await assertTwo();const before=await raw();
      await rejected(`(()=>{const f=document.querySelector('#scene-project [data-form=row]');f.elements.kind.add(new Option('测试注入',${JSON.stringify(kind)}));f.elements.kind.value=${JSON.stringify(kind)};f.requestSubmit();})()`,before);
      assert.equal((await read()).draft.rows[0].kind,'pet');assert.equal((await read()).draft.rows.length,1);await click('#scene-project [data-action=cancel-row]');
    }
    pass('Editing ordinary rows cannot convert them to gold/cost');
    const legacy=fixture([{kind:'pet',name:'旧召唤兽',quantity:2,price:25},{kind:'gold',name:'旧金币收入',quantity:1,price:10},{kind:'cost',name:'旧成本支出',quantity:1,price:5}]);
    await open(legacy);assert.equal(await raw(),JSON.stringify(legacy),'Reading legacy data must be lossless');await assertTwo();assert.equal(model.totals((await read()).draft).profit,55);
    await click('#scene-project [data-action=edit-row][data-index="1"]');
    const goldControl=await run(`(()=>{const f=document.querySelector('#scene-project [data-form=row]'),k=f.elements.kind;return {tag:k.tagName,type:k.type,value:k.value,text:k.parentElement.textContent};})()`);
    assert.equal(goldControl.tag,'INPUT');assert.equal(goldControl.type,'hidden');assert.equal(goldControl.value,'gold');assert.match(goldControl.text,/金币/);
    const beforeLegacyTamper=await raw();await rejected(`(()=>{const f=document.querySelector('#scene-project [data-form=row]');f.elements.kind.value='cost';f.requestSubmit();})()`,beforeLegacyTamper);
    await click('#scene-project [data-action=cancel-row]');await click('#scene-project [data-action=edit-row][data-index="1"]');
    await run(`(()=>{const f=document.querySelector('#scene-project [data-form=row]');f.elements.name.value='旧金币收入已校正';f.elements.quantity.value='2';f.elements.price.value='6';f.requestSubmit();})()`);
    let saved=await read();assert.equal(saved.draft.rows.length,3);assert.deepEqual(saved.draft.rows[1],{kind:'gold',name:'旧金币收入已校正',quantity:2,price:6});await assertTwo();
    await click('#scene-project [data-action=edit-row][data-index="2"]');
    const costControl=await run(`(()=>{const k=document.querySelector('#scene-project [data-form=row]').elements.kind;return {tag:k.tagName,type:k.type,value:k.value,text:k.parentElement.textContent};})()`);
    assert.equal(costControl.tag,'INPUT');assert.equal(costControl.type,'hidden');assert.equal(costControl.value,'cost');assert.match(costControl.text,/成本/);
    await run(`(()=>{const f=document.querySelector('#scene-project [data-form=row]');f.elements.quantity.value='3';f.elements.price.value='2';f.requestSubmit();})()`);
    saved=await read();assert.equal(saved.draft.rows.length,3);assert.equal(saved.draft.rows[2].kind,'cost');assert.equal(saved.draft.rows[2].quantity,3);assert.equal(saved.draft.rows[2].price,2);assert.equal(model.totals(saved.draft).profit,56);
    assert.equal(saved.draft.date,DATE);assert.equal(saved.draft.note,NOTE);assert.equal(saved.draft.minutes,MINUTES);
    pass('Legacy gold/cost use readonly labels and hidden original kind, while amount edits replace rows');
    await click('#scene-project [data-action=settle]');saved=await read();assert.equal(saved.history.length,1);const id=saved.history[0].id;
    assert.deepEqual(saved.history[0].rows.map(r=>r.kind),['pet','gold','cost']);assert.equal(model.totals(saved.history[0]).profit,56);assert.equal(saved.history[0].note,NOTE);assert.equal(saved.history[0].minutes,MINUTES);assert.equal(saved.history[0].date,DATE);
    assert.equal(await run(`window.ringAccounting.day(${JSON.stringify(DATE)}).sceneGold`),12);assert.equal(await run(`window.ringAccounting.day(${JSON.stringify(DATE)}).revenue-window.ringAccounting.day(${JSON.stringify(DATE)}).cost`),56);
    await click('#scene-project [data-action=edit][data-id="'+id+'"]');await click('#scene-project [data-action=edit-row][data-index="1"]');
    await run(`(()=>{const f=document.querySelector('#scene-project [data-form=row]');f.elements.quantity.value='1';f.elements.price.value='15';f.requestSubmit();})()`);await click('#scene-project [data-action=settle]');
    saved=await read();assert.equal(saved.history.length,1);assert.equal(saved.history[0].id,id);assert.equal(model.totals(saved.history[0]).profit,59);assert.equal(saved.history[0].rows[1].kind,'gold');assert.equal(saved.history[0].rows[2].kind,'cost');
    pass('Settlement/history edits preserve legacy kinds, old metadata and idempotent totals', {firstProfit:56,editedProfit:59});
    await click('#scene-project [data-view=backup]');await click('#scene-project [data-action=backup]');const backupRaw=await run(`window.__kindDownloads[window.__kindDownloads.length-1].text()`),backup=JSON.parse(backupRaw.replace(/^\uFEFF/,''));assert.deepEqual(backup.history[0].rows.map(r=>r.kind),['pet','gold','cost']);
    await run(`(()=>{const input=document.querySelector('#scene-project [data-import]'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(backupRaw)}],'legacy-kinds-backup.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause(100);
    saved=await read();assert.equal(saved.history[0].id,id);assert.deepEqual(saved.history[0].rows.map(r=>r.kind),['pet','gold','cost']);assert.equal(saved.history[0].note,NOTE);assert.equal(saved.history[0].minutes,MINUTES);assert.equal(model.totals(saved.history[0]).profit,59);
    await click('#scene-project [data-view=run]');await assertTwo();await pause(120);fs.mkdirSync(path.join(__dirname,'docs'),{recursive:true});fs.writeFileSync(path.join(__dirname,'docs','场景精简类型-测试'+SUFFIX+'.png'),(await win.webContents.capturePage()).toPNG());
    pass('Legacy kinds and old metadata preserved by JSON backup/restore');
    assert.deepEqual(await run(`window.__kindAlerts`),[]);assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(__dirname,'docs','场景精简类型-UI测试记录'+SUFFIX+'.json'),JSON.stringify({testedDist:TEST_DIST,profile:PROFILE,fixtureOnly:true,checks:logs,rendererErrors:errors,completedAt:new Date().toISOString()},null,2));
    console.log('PASS: scene restricted-kind UI regression complete; source files unchanged.');
  }finally{win.destroy();}
  app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
