const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
app.setPath('userData',path.join(__dirname,'release','toolbox-test-profile'));
app.disableHardwareAcceleration();
ipcMain.handle('toolbox-game-status',()=>({active:false,message:'尚未设置关闭定时'}));
ipcMain.handle('toolbox-game-windows',()=>({windows:[{pid:123,title:'测试游戏窗口'}]}));
ipcMain.handle('toolbox-game-close',()=>({canceled:true}));
ipcMain.handle('toolbox-game-cancel',()=>({active:false}));
ipcMain.handle('copy-mini-program',()=>true);
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1180,height:780,show:false,webPreferences:{preload:path.join(__dirname,'electron/preload.js'),contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
  const errors=[];win.webContents.on('console-message',event=>{if(event.level==='error'){errors.push(event.message);console.error('Renderer:',event.message);}});
  await win.loadFile(path.join(__dirname,'dist/index.html'));
  const run=script=>win.webContents.executeJavaScript(script).catch(e=>{console.error('Failed script:',script);throw e;});
  try{
    await run(`localStorage.removeItem('mh_toolbox_v1');document.getElementById('project-toolbox').click();`);
    assert.equal(await run(`document.querySelectorAll('#toolbox-project details').length`),3);
    await run(`document.querySelector('#toolbox-project [data-edit]').click();var f=document.querySelector('[data-form=entry]');f.elements.title.value='修改后的攻略';f.elements.text.value='<img src=x onerror=alert(1)> 自写攻略';f.requestSubmit();`);
    assert.equal(await run(`JSON.parse(localStorage.getItem('mh_toolbox_v1')).entries[0].title`),'修改后的攻略');
    assert.equal(await run(`document.querySelectorAll('#toolbox-project .tb-text img').length`),0);
    await run(`document.querySelector('[data-action=new]').click();var f=document.querySelector('[data-form=entry]');f.elements.title.value='我的副本';f.elements.source.value='自写';f.elements.category.value='副本攻略';f.elements.text.value='第一步\\n第二步';f.requestSubmit();`);
    assert.equal(await run(`document.querySelectorAll('#toolbox-project details').length`),4);
    await run(`document.querySelector('[data-search]').value='我的副本';document.querySelector('[data-search]').dispatchEvent(new Event('input',{bubbles:true}));`);
    assert.equal(await run(`document.querySelectorAll('#toolbox-project details').length`),1);
    await run(`document.querySelector('[data-view=budget]').click();var f=document.querySelector('[data-form=budget]');for(var i=0;i<5;i++){f.elements['experience'+i].value=100;f.elements['balance'+i].value=20;f.elements['money'+i].value=0.1;}f.requestSubmit();`);
    assert.match(await run(`document.querySelector('[data-total]').textContent`),/400/);
    assert.match(await run(`document.querySelector('[data-total]').textContent`),/0.5 万/);
    await run(`document.getElementById('project-scene').click();`);assert.equal(await run(`document.getElementById('toolbox-project').hidden`),true);
    await run(`document.getElementById('project-toolbox').click();`);assert.equal(await run(`document.getElementById('scene-project').hidden`),true);
    await run(`document.querySelector('[data-view=timer]').click();document.querySelector('[data-action=choose]').click();`);
    for(let i=0;i<30;i++){if(await run(`!!document.querySelector('[name=pid]')`))break;await new Promise(r=>setTimeout(r,100));}
    assert.equal(await run(`document.querySelector('[name=pid]').value`),'123');
    await run(`localStorage.removeItem('mh_toolbox_v1');window.toolboxProject.open();document.querySelector('[data-view=library]').click();document.querySelector('#toolbox-project details').open=true;`);
    await new Promise(r=>setTimeout(r,200));
    fs.mkdirSync(path.join(__dirname,'docs'),{recursive:true});
    await fs.promises.writeFile(path.join(__dirname,'docs','工具箱预览.png'),(await win.webContents.capturePage()).toPNG());
    assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: real renderer guide editing/add/search/escaping, five-role budgets, navigation isolation, desktop timer IPC and screenshot.');
  }finally{win.destroy();}
  app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
