'use strict';
const {app,BrowserWindow,nativeImage}=require('electron');
for(const stream of [process.stdout,process.stderr])stream.on('error',error=>{if(error.code!=='EPIPE')throw error;});
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const TEST_DIST=process.env.SCENE_TEST_DIST?path.resolve(process.env.SCENE_TEST_DIST):path.join(__dirname,'dist');
const SUFFIX=process.env.SCENE_TEST_DIST?'-打包版':'';
const DOCS=path.join(__dirname,'docs');fs.mkdirSync(DOCS,{recursive:true});
const DIAGNOSTIC=path.join(DOCS,'场景召唤兽原图-harness诊断'+SUFFIX+'.log');
fs.writeFileSync(DIAGNOSTIC,'');
const trace=message=>{const line=new Date().toISOString()+' '+message;fs.appendFileSync(DIAGNOSTIC,line+'\n');console.log(line);};
async function bounded(label,operation,timeout=15000){
  const started=Date.now();trace('START '+label);let timer;
  try{const value=await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timed out after '+timeout+'ms: '+label)),timeout);})]);trace('DONE '+label+' ('+(Date.now()-started)+'ms)');return value;}
  catch(error){trace('FAIL '+label+' '+error.stack);throw error;}
  finally{clearTimeout(timer);}
}
const watchdog=setTimeout(()=>{trace('FAIL global 180000ms watchdog');app.exit(2);},180000);
const PROFILE=path.join(__dirname,'release','scene-pet-images-ui-test-profile'+(SUFFIX?'-packaged':'')+'-'+Date.now()+'-'+process.pid);
app.setPath('userData',PROFILE);app.disableHardwareAcceleration();
const model=require(path.join(TEST_DIST,'assets','scene-project.js'));
const sourcePets=require(path.join(TEST_DIST,'assets','scene-data.js')).pets;
const MAPS=['无名鬼城','青丘','银华境','须弥东界','鬼市','五行山'];
const normal=s=>s==='5行山'?'五行山':s==='银华镜'?'银华境':s;
const mapPets=scene=>sourcePets.filter(p=>p.scenes.some(s=>normal(s)===scene));
const KEY='mh_scene_project_v1',DATE='2026-10-07',logs=[],pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function pass(name,detail){logs.push({name,result:'PASS',detail});trace('PASS '+name+' '+(detail||''));}
function cropStyle(item){const c=item.renderCrop;if(!c)return '';const r=c.width/c.height,h=r<1?(1-r)/2*100:0,v=r>1?(1-1/r)/2*100:0;return 'object-view-box:inset('+[c.y/item.height*100,(item.width-c.x-c.width)/item.width*100,(item.height-c.y-c.height)/item.height*100,c.x/item.width*100].map(n=>n+'%').join(' ')+');clip-path:inset('+[v,h,v,h].map(n=>n+'%').join(' ')+')';}
bounded('Electron ready',()=>app.whenReady()).then(async()=>{
  const win=new BrowserWindow({width:1180,height:780,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}}),errors=[],blockedRequests=[];
  win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,callback)=>{blockedRequests.push(details.url);callback({cancel:true});});
  win.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});
  win.webContents.on('did-start-loading',()=>trace('EVENT did-start-loading'));
  win.webContents.on('did-finish-load',()=>trace('EVENT did-finish-load '+win.webContents.getURL()));
  win.webContents.on('did-fail-load',(event,code,message,url)=>trace('EVENT did-fail-load '+JSON.stringify({code,message,url})));
  win.webContents.on('render-process-gone',(event,details)=>trace('EVENT render-process-gone '+JSON.stringify(details)));
  win.on('unresponsive',()=>trace('EVENT unresponsive'));
  const run=(code,label)=>bounded(label||'renderer '+code.replace(/\s+/g,' ').slice(0,180),()=>win.webContents.executeJavaScript(code));
  const load=file=>bounded('loadFile '+file,()=>win.loadFile(file),20000);
  const click=selector=>run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.click();})()`);
  const raw=()=>run(`localStorage.getItem(${JSON.stringify(KEY)})`),read=()=>run(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}))`);
  // Chromium decode() can stay pending in this hidden offscreen window, even
  // for a detached Image. Fully decode all 55 original buffers with Electron's
  // nativeImage/getBitmap below; separately require every rendered element to
  // finish loading with matching natural dimensions, identity and crop rules.
  const imageData=selector=>run(`Promise.all(Array.from(document.querySelectorAll(${JSON.stringify(selector)})).map(async img=>{img.loading='eager';if(!img.complete)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('image load timed out: '+img.alt+' '+img.src)),6000);const done=()=>{clearTimeout(timer);resolve();};img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});});const b=img.closest('[data-pet]'),rect=img.getBoundingClientRect();return {id:b?.dataset.pet||null,buttonName:b?.querySelector('.scene-pet-label')?.textContent?.trim()||null,alt:img.alt,src:img.getAttribute('src'),absolute:img.currentSrc||img.src,kind:img.dataset.iconKind,width:img.naturalWidth,height:img.naturalHeight,displayWidth:rect.width,displayHeight:rect.height,viewBox:img.style.getPropertyValue('object-view-box'),computedViewBox:getComputedStyle(img).getPropertyValue('object-view-box'),viewClip:img.style.getPropertyValue('clip-path'),computedClip:getComputedStyle(img).getPropertyValue('clip-path'),title:img.title};}))`,'rendered image load '+selector);
  function assertLocalAsset(img,label){assert(img.width>0&&img.height>0,label+' image must decode: '+JSON.stringify(img));assert.equal(img.kind,'asset',label+' must use original asset, not generic/fallback');assert.equal(new URL(img.absolute).protocol,'file:',label+' must load from local files, including offline packaged assets');assert(img.alt,label+' must have descriptive alt');}
  async function screenshot(file){await bounded('screenshot settle '+file,()=>pause(120));const result=await bounded('capturePage '+file,()=>win.webContents.capturePage(),15000);assert(!result.isEmpty(),'Screenshot must contain rendered pixels: '+file);fs.writeFileSync(path.join(DOCS,file+SUFFIX+'.png'),result.toPNG());trace('SAVED screenshot '+file+SUFFIX+'.png');}
  const all=new Map(),mapResults={};
  try{
    const manifestPath=path.join(TEST_DIST,'icons','scene-pets','manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    assert.equal(manifest.count,55);assert.equal(manifest.items.length,55);assert.deepEqual(manifest.scenes,MAPS);
    const byId=new Map(manifest.items.map(item=>[String(item.id),item]));assert.equal(byId.size,55);
    for(const item of manifest.items){
      const pet=sourcePets.find(p=>String(p.id)===String(item.id));assert(pet,'Manifest id missing from source data');assert.equal(item.name,pet.name);assert.equal(item.kind,'asset');
      assert(/^\.\/icons\/scene-pets\/\d+\.(?:png|gif|jpe?g|webp)$/i.test(item.src),'Unexpected original asset path: '+item.src);
      const bytes=fs.readFileSync(path.join(TEST_DIST,item.src));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256.toLowerCase(),'Original byte hash mismatch: '+item.name);
      assert(item.width>0&&item.height>0,'Manifest dimensions must be present');assert(/^https?:$/.test(new URL(item.sourcePage).protocol)&&/^https?:$/.test(new URL(item.imageUrl).protocol),'Original source metadata must be present');
      const decoded=nativeImage.createFromBuffer(bytes);assert(!decoded.isEmpty(),'Original image decoder rejected '+item.name);assert.deepEqual(decoded.getSize(),{width:item.width,height:item.height},'Original decoded dimensions mismatch: '+item.name);assert.equal(decoded.getBitmap().length,item.width*item.height*4,'Original full bitmap decode mismatch: '+item.name);
      if(item.renderCrop){const c=item.renderCrop;assert([c.x,c.y,c.width,c.height].every(Number.isFinite)&&c.x>=0&&c.y>=0&&c.width>0&&c.height>0&&c.x+c.width<=item.width&&c.y+c.height<=item.height,'Crop must be within original image: '+item.name);}
    }
    pass('55 original asset identities, provenance, dimensions, full bitmap decodes and SHA256 match manifest');
    trace('TEST_DIST '+TEST_DIST+' PROFILE '+PROFILE);
    await load(path.join(TEST_DIST,'index.html'));
    assert.equal(await run(`CSS.supports('object-view-box','inset(0% 0% 0% 0%)')`),true,'This Electron must support CSS original-image viewport cropping');
    await run(`window.__petImageAlerts=[];window.alert=m=>window.__petImageAlerts.push(String(m));window.confirm=()=>true;void 0;`);
    for(const scene of MAPS){
      trace('SCENE '+scene);
      const expected=mapPets(scene);assert(expected.length>0,'No source pets for '+scene);
      const fixture=model.empty();fixture.draft={...model.fresh(),scene,date:DATE};
      await run(`localStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(JSON.stringify(fixture))});window.sceneProject.open();document.querySelector('#scene-project [data-view=run]').click();`);
      const left=await imageData('#scene-project [data-pet] img');
      assert.deepEqual(left.map(i=>i.id).sort(),expected.map(p=>p.id).sort());
      for(let i=0;i<left.length;i++){
        const img=left[i],pet=expected.find(p=>p.id===img.id);assertLocalAsset(img,scene+' '+img.id);
        assert.equal(img.buttonName,pet.name);assert.equal(img.alt,pet.name);
        const provenance=byId.get(pet.id);assert(provenance);assert.equal(img.src,provenance.src);assert.equal(img.width,provenance.width);assert.equal(img.height,provenance.height);
        assert.equal(img.displayWidth,48);assert.equal(img.displayHeight,48);if(provenance.renderCrop){assert(img.viewBox.startsWith('inset('),'Original property card requires CSS viewport, not whole-card thumbnail');assert.notEqual(img.computedViewBox,'none');assert(img.viewClip.startsWith('inset('),'Original viewport needs letterbox clipping to hide adjacent art or text');assert.notEqual(img.computedClip,'none');}
        const resolved=await run(`(()=>{const r=(window.itemIcons||window.treasureIcons).resolve({id:${JSON.stringify(pet.id)},name:${JSON.stringify(pet.name)},category:'召唤兽',kind:'pet'});return {kind:r.kind,src:new URL(r.src,document.baseURI).href};})()`);
        assert.equal(resolved.kind,'asset');assert.equal(resolved.src,img.absolute,'Correct pet name/id must resolve to this asset');
        const old=all.get(pet.id);if(old){assert.equal(old.name,pet.name);assert.equal(old.absolute,img.absolute);}else all.set(pet.id,{...img,name:pet.name});
        const before=await raw();await click('#scene-project [data-pet="'+pet.id+'"]');assert.equal(await raw(),before,'Pet image button is prefill only: '+pet.name);
        assert.deepEqual(await run(`(()=>{const f=document.querySelector('#scene-project [data-form=row]');return {kind:f.elements.kind.value,name:f.elements.name.value,quantity:f.elements.quantity.value};})()`),{kind:'pet',name:pet.name,quantity:'1'});
        await run(`(()=>{const f=document.querySelector('#scene-project [data-form=row]');f.elements.price.value='0.01';f.requestSubmit();})()`);
        const data=await read();assert.equal(data.draft.rows.length,i+1);assert.equal(data.draft.rows[i].name,pet.name);assert.equal(data.draft.rows[i].kind,'pet');
      }
      const right=await imageData('#scene-project .scene-record-pane .scene-item-name img');assert.equal(right.length,left.length);
      for(let i=0;i<right.length;i++){assertLocalAsset(right[i],scene+' recorded '+expected[i].name);assert.equal(right[i].alt,left[i].alt);assert.equal(right[i].absolute,left[i].absolute,'Left and right artwork must match for '+left[i].alt);assert.equal(right[i].viewBox,left[i].viewBox,'Row must use the same original-image viewport');assert.equal(right[i].viewClip,left[i].viewClip);}
      const layouts=[];
      for(const [width,height] of [[1180,780],[1060,700]]){
        win.setSize(width,height);await bounded('resize settle '+scene+' '+width+'x'+height,()=>pause(100));const layout=await run(`(()=>{const p=document.querySelector('#scene-project'),l=p.querySelector('.scene-item-pane').getBoundingClientRect(),r=p.querySelector('.scene-record-pane').getBoundingClientRect();return {viewport:[innerWidth,innerHeight],documentWidth:[document.documentElement.clientWidth,document.documentElement.scrollWidth],pageWidth:[p.clientWidth,p.scrollWidth],left:[l.x,l.right,l.bottom],right:[r.x,r.right,r.bottom],settleBottom:p.querySelector('[data-action=settle]').getBoundingClientRect().bottom};})()`);
        assert(layout.documentWidth[1]<=layout.documentWidth[0]+1&&layout.pageWidth[1]<=layout.pageWidth[0]+1,'No horizontal overflow '+scene+' '+width);assert(layout.left[1]<=layout.right[0]+1,'Columns overlap');assert(layout.settleBottom<=height+1,'Settlement button remains in viewport');layouts.push(layout);
        if(scene==='青丘')await screenshot('场景召唤兽原图-'+width+'x'+height+'-测试');
      }
      win.setSize(1180,780);await click('#scene-project [data-action=settle]');
      const stored=await read();assert.equal(stored.history.length,1);assert.equal(stored.history[0].rows.length,left.length);
      const historic=await imageData('#scene-project .scene-history-record .scene-item-name img');assert.equal(historic.length,left.length);
      for(let i=0;i<historic.length;i++){assertLocalAsset(historic[i],scene+' history '+left[i].alt);assert.equal(historic[i].alt,left[i].alt);assert.equal(historic[i].absolute,left[i].absolute,'History artwork must match original pet');assert.equal(historic[i].viewBox,left[i].viewBox,'History must preserve original-image viewport');assert.equal(historic[i].viewClip,left[i].viewClip);}
      mapResults[scene]={count:left.length,layouts};pass('Original local pet assets, prefill-only buttons and matching rows/history: '+scene,left.length+' pets');
    }
    assert.equal(all.size,55,'Six configured maps should cover 55 unique pet ids');
    assert.deepEqual(await run(`window.__petImageAlerts`),[]);
    const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>六场景召唤兽原图视觉检查</title><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#f4f5f7;color:#1d2735;font:13px Microsoft YaHei,sans-serif}h1{font-size:22px;margin:0 0 8px}p{margin:0 0 16px;color:#536174}.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.card{border:1px solid #cad2db;border-radius:5px;background:white;text-align:center;padding:8px;min-height:146px;break-inside:avoid}.card img{display:block;object-fit:contain;width:100px;height:100px;margin:0 auto 4px}.name{font-weight:600;line-height:18px}.id{font-size:11px;color:#61718a}</style><h1>六场景召唤兽原图检查：55 个唯一条目</h1><p>本地原图以与界面相同的 CSS object-view-box 取景，未修改原始图片字节；网络请求全部禁止。</p><div class="grid">'+[...all.values()].map(p=>'<div class="card"><img src="'+esc(p.absolute)+'" alt="'+esc(p.name)+'" style="'+esc(cropStyle(byId.get(p.id)))+'"><div class="name">'+esc(p.name)+'</div><div class="id">ID '+esc(p.id)+'</div></div>').join('')+'</div></html>';
    const htmlPath=path.join(DOCS,'场景55召唤兽原图网格'+SUFFIX+'.html');fs.writeFileSync(htmlPath,html);trace('CONTACTSHEET '+htmlPath);await load(htmlPath);win.setSize(1180,1700);await bounded('contactsheet resize settle',()=>pause(150));const grid=await imageData('.card img');assert.equal(grid.length,55,'Contactsheet must include every unique pet');for(const [i,image] of grid.entries()){const original=[...all.values()][i];assert(image.width>0&&image.height>0,'Contactsheet image must load: '+image.alt);assert.equal(image.absolute,original.absolute);assert.equal(image.width,original.width);assert.equal(image.height,original.height);}win.setSize(1180,Math.min(2400,(await run('document.documentElement.scrollHeight','contactsheet document height'))+20));await screenshot('场景55召唤兽原图网格-测试');
    assert.deepEqual(await run(`typeof window.__petImageAlerts==='undefined'?[]:window.__petImageAlerts`),[]);assert.equal(errors.length,0,errors.join('\n'));
    fs.writeFileSync(path.join(__dirname,'docs','场景召唤兽原图-UI测试记录'+SUFFIX+'.json'),JSON.stringify({testedDist:TEST_DIST,manifest:manifestPath,sha256Checks:55,nativeBitmapDecodeChecks:55,profile:PROFILE,fixtureOnly:true,uniquePets:all.size,maps:mapResults,checks:logs,assets:[...all.values()],blockedNetworkRequests:blockedRequests,rendererErrors:errors,completedAt:new Date().toISOString()},null,2));
    trace('PASS all 55 unique pets use local original asset images; UI selection, rows/history and offline layout verified.');
  }finally{trace('DESTROY test window');win.destroy();}
  clearTimeout(watchdog);
  app.exit(0);
}).catch(error=>{trace('FAILED '+error.stack);clearTimeout(watchdog);app.exit(1);});
