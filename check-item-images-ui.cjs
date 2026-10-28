'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dist=process.env.ITEM_IMAGES_TEST_DIST?path.resolve(process.env.ITEM_IMAGES_TEST_DIST):path.join(__dirname,'dist');
app.setPath('userData',path.join(__dirname,'release','item-images-test-profile'));app.disableHardwareAcceleration();
ipcMain.handle('copy-mini-program',()=>true);ipcMain.handle('toolbox-game-status',()=>({active:false,message:'未设置'}));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1180,height:780,show:false,webPreferences:{preload:path.join(__dirname,'electron/preload.js'),contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
  const errors=[];win.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});
  const run=s=>win.webContents.executeJavaScript(s).catch(e=>{console.error('Failed script:',s);throw e;});
  const click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`);
  const waitImages=async selector=>{
    const images=await run(`Promise.all(Array.from(document.querySelectorAll(${JSON.stringify(selector)})).map(img=>new Promise(resolve=>{if(img.complete){resolve({alt:img.alt,ok:img.naturalWidth>0,src:img.getAttribute('src')});return;}const done=()=>resolve({alt:img.alt,ok:img.naturalWidth>0,src:img.getAttribute('src')});img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});setTimeout(done,3000);})))`);
    assert(images.length>0,'Expected images for '+selector);assert(images.every(i=>i.ok&&i.alt),JSON.stringify(images.filter(i=>!i.ok||!i.alt)));return images;
  };
  async function shot(name){await new Promise(r=>setTimeout(r,150));fs.mkdirSync(path.join(__dirname,'docs'),{recursive:true});fs.writeFileSync(path.join(__dirname,'docs',name+(process.env.ITEM_IMAGES_TEST_DIST?'-打包版':'')+'.png'),(await win.webContents.capturePage()).toPNG());}
  try{
    await win.loadFile(path.join(dist,'index.html'));
    await run(`localStorage.clear();localStorage.setItem('mh_records',JSON.stringify(['金刚石','60级制造指南书','60级百炼精铁'].map((name,i)=>({id:'image-test-'+i,rId:1,name,price:100,category:i?'书铁':'五宝',date:window.treasureCore.day()}))));`);
    await win.loadFile(path.join(dist,'index.html'));
    await run(`window.confirm=()=>true;window.alert=msg=>window.__lastAlert=msg;void 0;`);
    const mainImages=await waitImages('#app .ledger-item-image');assert(mainImages.some(i=>i.alt==='金刚石'));
    assert(mainImages.some(i=>i.src.endsWith('/zhizao-zhinanshu.jpg')),'Main ledger must show sourced book artwork');
    assert(mainImages.some(i=>i.src.endsWith('/bailian-jingtie.jpg')),'Main ledger must show sourced iron artwork');
    await click('#project-treasure');assert.equal(await run(`document.querySelectorAll('#treasure-project [data-add] img').length`),27);
    const treasureImages=await waitImages('#treasure-project [data-add] img');
    assert.equal(treasureImages.filter(i=>i.src.endsWith('/zhizao-zhinanshu.jpg')).length,7,'Seven book levels share the verified original artwork');
    assert.equal(treasureImages.filter(i=>i.src.endsWith('/bailian-jingtie.jpg')).length,7,'Seven iron levels share the verified original artwork');
    await click('[data-add=five-0]');await waitImages('#treasure-project .tr-name-cell img');
    await click('[data-mode=advanced]');assert.equal(await run(`document.querySelectorAll('#treasure-project [data-add] img').length`),9);await waitImages('#treasure-project [data-add] img');await click('[data-mode=normal]');
    await shot('挖图图片按钮预览');
    await click('#project-ring');assert.equal(await run(`document.querySelectorAll('#ring-project [data-action=task] img').length`),25);await waitImages('#ring-project [data-action=task] img');
    await click('#ring-project [data-name="60武器"]');await waitImages('#ring-project .ring-item-name img');
    await run(`var f=document.querySelector('#ring-project [data-form=reward]');f.elements.name.value='制造指南书';f.elements.quantity.value=1;f.elements.price.value=100;f.requestSubmit();`);
    const ringRewards=await waitImages('#ring-project .ring-rewards .ring-item-name img');
    assert(ringRewards.some(i=>i.src.endsWith('/zhizao-zhinanshu.jpg')),'Ring reward must use sourced book artwork');
    await shot('跑环物品图片预览');
    await click('#ring-project [data-view=prices]');await waitImages('#ring-project .ring-price-name img');
    await click('#project-scene');
    assert.equal(await run(`document.querySelectorAll('#scene-project [data-scene-item] img').length`),7);await waitImages('#scene-project [data-scene-item] img');
    for(const name of ['60武器','60防具','70武器','70防具','80武器','80防具','炼妖石']){
      await click('#scene-project [data-scene-item="'+name+'"]');
      const values=await run(`(()=>{const f=document.querySelector('#scene-project [data-form=row]');return {kind:f.elements.kind.value,name:f.elements.name.value,quantity:f.elements.quantity.value,count:(JSON.parse(localStorage.getItem('mh_scene_project_v1')||'null')?.draft.rows.length||0)};})()`);
      assert.equal(values.kind,'item');assert.equal(values.name,name);assert.equal(values.quantity,'1');assert.equal(values.count,0,'Quick item selection must not add financial entries');
    }
    await run(`var f=document.querySelector('#scene-project [data-form=row]');f.elements.name.value='115级炼妖石';f.elements.quantity.value=2;f.elements.price.value=25;f.requestSubmit();var el=document.querySelector('#scene-project [data-field=scene]');el.value='无名鬼城';el.dispatchEvent(new Event('change',{bubbles:true}));`);
    const stone=await waitImages('#scene-project .scene-item-name img');assert(stone.some(i=>decodeURIComponent(i.src).includes('炼妖石')));
    await waitImages('#scene-project [data-pet] img');
    assert.equal(await run(`Array.from(document.querySelectorAll('#scene-project [data-pet] img')).every(i=>i.dataset.iconKind==='asset'&&i.getAttribute('src').startsWith('./icons/scene-pets/')&&!i.title.includes('通用'))`),true);
    await run(`document.querySelector('#scene-project .scene-common-items').closest('section').scrollIntoView({block:'center'});`);await shot('场景环装炼妖石图片预览');
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('PASS: main ledger item images; all 36 treasure image buttons and details; ring tasks/costs/rewards/prices; scene six gear + refining stone quick prefills; graded-stone and real pet images. No broken local images or renderer errors.');
    console.log('Tested dist: '+dist+'; isolated test profile only.');
  }finally{win.destroy();}app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
