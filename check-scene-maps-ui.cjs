'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const TEST_DIST=process.env.SCENE_TEST_DIST?path.resolve(process.env.SCENE_TEST_DIST):path.join(__dirname,'dist');
const SUFFIX=process.env.SCENE_TEST_DIST?'-打包版':'';
const PROFILE=path.join(__dirname,'release','scene-maps-ui-test-profile'+(SUFFIX?'-packaged':''));
app.setPath('userData',PROFILE);app.disableHardwareAcceleration();
const model=require(path.join(TEST_DIST,'assets','scene-project.js'));
const pets=require(path.join(TEST_DIST,'assets','scene-data.js')).pets;
const MAPS=['无名鬼城','青丘','银华境','须弥东界','鬼市','五行山'];
const normalize=s=>s==='银华镜'?'银华境':s==='5行山'?'五行山':s;
const expectedPets=scene=>pets.filter(p=>p.scenes.some(s=>normalize(s)===normalize(scene))).map(p=>p.id).sort();
const KEY='mh_scene_project_v1',DATE='2026-10-07',NOTE='旧数据角色／备注：保留原文',MINUTES=91;
const logs=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function pass(name,detail){logs.push({name,result:'PASS',detail});console.log('PASS:',name,detail||'');}
function fixture(scene,rows=1){const data=model.empty();data.draft={...model.fresh(),date:DATE,scene,note:NOTE,minutes:MINUTES,rows:Array.from({length:rows},(_,i)=>({kind:'item',name:'测试收益'+i,quantity:1,price:2}))};return data;}
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1180,height:780,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}}),errors=[];
  win.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});
  const run=code=>win.webContents.executeJavaScript(code).catch(error=>{console.error('Renderer script failed:',code);throw error;});
  const click=selector=>run(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing '+${JSON.stringify(selector)});el.click();})()`);
  const read=()=>run(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}))`);
  const raw=()=>run(`localStorage.getItem(${JSON.stringify(KEY)})`);
  const open=async data=>{await run(`${data===null?`localStorage.removeItem(${JSON.stringify(KEY)})`:`localStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(JSON.stringify(data))})`};window.sceneProject.open();document.querySelector('#scene-project [data-view=run]').click();`);};
  const chooser=()=>run(`(()=>{const s=document.querySelector('#scene-project [data-field=scene]');return {tag:s.tagName,value:s.value,options:Array.from(s.options).map(o=>({value:o.value,text:o.textContent,disabled:o.disabled,selected:o.selected})),legacyDatalist:!!document.querySelector('#scene-project #scene-options')};})()`);
  const setMap=value=>run(`(()=>{const s=document.querySelector('#scene-project [data-field=scene]');s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const shownPets=()=>run(`Array.from(document.querySelectorAll('#scene-project [data-pet]')).map(b=>b.dataset.pet).sort()`);
  function assertOptions(state,extra=0){assert.equal(state.tag,'SELECT');assert.deepEqual(state.options.filter(o=>!o.disabled).map(o=>o.value),MAPS);assert.equal(state.options.length,6+extra);assert.equal(state.legacyDatalist,false);}
  try{
    await win.loadFile(path.join(TEST_DIST,'index.html'));
    await run(`window.__mapAlerts=[];window.alert=m=>window.__mapAlerts.push(String(m));window.confirm=()=>true;window.__mapDownloads=[];const orig=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.__mapDownloads.push(blob);return orig(blob);};HTMLAnchorElement.prototype.click=function(){};void 0;`);
    assert.equal(model.fresh().scene,MAPS[0],'New data model must start at 无名鬼城');
    await open(null);let select=await chooser();assertOptions(select);assert.equal(select.value,MAPS[0]);
    assert.equal(await raw(),null,'Opening an unused page must not silently write storage');
    assert.deepEqual(await shownPets(),expectedPets(MAPS[0]));
    const blank=fixture('',0);blank.history=[{...fixture('地狱迷宫1层').draft,id:'old-history'}];
    await open(blank);assert.equal((await chooser()).value,MAPS[0]);assert.equal(await raw(),JSON.stringify(blank),'Empty-draft in-memory default must not overwrite stored data');
    const unusedLegacy=fixture('地狱迷宫1层',0);unusedLegacy.history=[{...fixture('地狱迷宫1层').draft,id:'old-ground-history'}];await open(unusedLegacy);assertOptions(await chooser());assert.equal((await chooser()).value,MAPS[0]);assert.equal(await raw(),JSON.stringify(unusedLegacy),'Unused out-of-list draft should default only in memory, preserving stored notes/date/history');
    pass('New/unused empty draft defaults to first map without rewriting history');
    await open(null);const counts={};
    for(const scene of MAPS){await setMap(scene);select=await chooser();assertOptions(select);assert.equal(select.value,scene);const actual=await shownPets(),expected=expectedPets(scene);assert(expected.length>0,'Source data lacks pets for '+scene);assert.deepEqual(actual,expected);assert.equal((await read()).draft.scene,scene);counts[scene]=actual.length;}
    pass('Six fixed enabled choices in order and nonempty source-matched pets',counts);
    const scrolling=fixture('青丘',40);await open(scrolling);
    await run(`(()=>{const f=document.querySelector('#scene-project [data-form=row]');f.elements.kind.value='item';f.elements.name.value='切换地图前尚未提交';f.elements.quantity.value='3';f.elements.price.value='7.5001';const l=document.querySelector('.scene-item-scroll'),r=document.querySelector('.scene-record-pane > .scene-scroll');l.scrollTop=20;r.scrollTop=95;})()`);
    const beforeScroll=await run(`({left:document.querySelector('.scene-item-scroll').scrollTop,right:document.querySelector('.scene-record-pane > .scene-scroll').scrollTop})`);
    await setMap('五行山');
    assert.deepEqual(await run(`(()=>{const f=document.querySelector('#scene-project [data-form=row]');return {kind:f.elements.kind.value,name:f.elements.name.value,quantity:f.elements.quantity.value,price:f.elements.price.value};})()`),{kind:'item',name:'切换地图前尚未提交',quantity:'3',price:'7.5001'});
    const afterScroll=await run(`({left:document.querySelector('.scene-item-scroll').scrollTop,right:document.querySelector('.scene-record-pane > .scene-scroll').scrollTop})`);
    assert.deepEqual(afterScroll,beforeScroll,'Same-height six-row pet groups must retain both pane scroll positions');
    let saved=await read();assert.equal(saved.draft.rows.length,40);assert.equal(saved.draft.note,NOTE);assert.equal(saved.draft.minutes,MINUTES);assert.equal(saved.draft.date,DATE);
    await click('#project-accounting');await click('#project-scene');await click('#scene-project [data-view=run]');
    assert.equal(await run(`document.querySelector('#scene-project [data-form=row]').elements.name.value`),'切换地图前尚未提交');
    pass('Map switch and page round trip retain unsubmitted form, scroll and recorded data');
    const legacy=fixture('地狱迷宫1层');legacy.history=[{...fixture('地狱迷宫1层').draft,id:'legacy-ground'}];await open(legacy);
    select=await chooser();assertOptions(select,1);assert.equal(select.value,'地狱迷宫1层');assert.equal(select.options.find(o=>o.selected).disabled,true);assert.match(select.options.find(o=>o.selected).text,/旧记录/);
    assert.equal(await raw(),JSON.stringify(legacy));await click('#scene-project [data-scene-item="60武器"]');assert.equal(await raw(),JSON.stringify(legacy));
    await click('#scene-project [data-view=history]');assert.match(await run(`document.querySelector('#scene-project').innerText`),/地狱迷宫1层/);await click('#scene-project [data-view=backup]');await click('#scene-project [data-view=run]');
    assert.equal(await raw(),JSON.stringify(legacy));assert.equal((await read()).draft.rows.length,1);assert.equal((await read()).history[0].scene,'地狱迷宫1层');
    await setMap('无名鬼城');saved=await read();assert.equal(saved.draft.scene,'无名鬼城');assert.equal(saved.history[0].scene,'地狱迷宫1层');assert.equal(saved.draft.rows.length,1);assert.equal(saved.draft.note,NOTE);assert.equal(saved.draft.minutes,MINUTES);assert.equal(saved.draft.date,DATE);
    const editing=JSON.parse(JSON.stringify(legacy));editing.draft=JSON.parse(JSON.stringify(editing.history[0]));await open(editing);await click('#scene-project [data-action=settle]');saved=await read();assert.equal(saved.history.length,1);assert.equal(saved.history[0].scene,'地狱迷宫1层');assert.equal(saved.history[0].id,'legacy-ground');assert.equal(saved.draft.scene,MAPS[0]);
    pass('Legacy 地狱迷宫 draft/history stay intact; only an explicit selection changes draft map');
    for(const alias of ['银华镜','5行山']){
      const source=fixture(alias);await open(source);select=await chooser();assertOptions(select);assert.equal(select.value,normalize(alias));assert.deepEqual(await shownPets(),expectedPets(alias));assert.equal(await raw(),JSON.stringify(source),'Alias display must not rename stored draft');
      await click('#project-accounting');await click('#project-scene');await click('#scene-project [data-view=run]');assert.equal((await read()).draft.scene,alias);
      await click('#scene-project [data-action=settle]');saved=await read();assert.equal(saved.history.length,1);assert.equal(saved.history[0].scene,alias);assert.equal(saved.history[0].note,NOTE);assert.equal(saved.history[0].date,DATE);assert.equal(saved.history[0].minutes,MINUTES);
      const id=saved.history[0].id;await click('#scene-project [data-action=edit][data-id="'+id+'"]');assert.equal((await chooser()).value,normalize(alias));assert.equal((await read()).draft.scene,alias);await click('#scene-project [data-action=settle]');saved=await read();assert.equal(saved.history.length,1);assert.equal(saved.history[0].scene,alias);
      await click('#scene-project [data-view=backup]');await click('#scene-project [data-action=backup]');const backupRaw=await run(`window.__mapDownloads[window.__mapDownloads.length-1].text()`),backup=JSON.parse(backupRaw.replace(/^\uFEFF/,''));assert.equal(backup.history[0].scene,alias);
      await run(`(()=>{const input=document.querySelector('#scene-project [data-import]'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(backupRaw)}],'map-alias-backup.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause(100);
      saved=await read();assert.equal(saved.history[0].scene,alias);assert.equal(saved.history[0].id,id);assert.equal(saved.history[0].note,NOTE);assert.equal(saved.history[0].minutes,MINUTES);
      pass('Alias '+alias+' canonical pets/display and lossless settle/edit/backup');
    }
    await open(fixture('五行山',0));await pause(150);fs.mkdirSync(path.join(__dirname,'docs'),{recursive:true});fs.writeFileSync(path.join(__dirname,'docs','场景六地图选择-测试'+SUFFIX+'.png'),(await win.webContents.capturePage()).toPNG());
    assert.deepEqual(await run(`window.__mapAlerts`),[]);assert.equal(errors.length,0,errors.join('\n'));
    const result={testedDist:TEST_DIST,profile:PROFILE,fixtureOnly:true,checks:logs,rendererErrors:errors,completedAt:new Date().toISOString()};fs.writeFileSync(path.join(__dirname,'docs','场景六地图选择-UI测试记录'+SUFFIX+'.json'),JSON.stringify(result,null,2));
    console.log('PASS: fixed six-map selector UI regression complete; source files unchanged.');
  }finally{win.destroy();}
  app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
