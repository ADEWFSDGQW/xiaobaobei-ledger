const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const code=fs.readFileSync('electron/main.js','utf8');
async function check(ownsLock){
  const events={},windows=[],handlers={};let quit=0,copied='';
  class Window {
    constructor(options){this.options=options;this.events={};this.shown=0;this.restored=0;this.focused=0;this.webContents={executeJavaScript(){},openDevTools(){}};windows.push(this)}
    once(event,callback){this.events[event]=callback}
    loadFile(path){this.loaded=path}
    isDestroyed(){return false}
    isMinimized(){return true}
    restore(){this.restored++}
    show(){this.shown++}
    focus(){this.focused++}
    static getAllWindows(){return windows}
  }
  const app={getPath:()=>'/existing/appData',setPath(){},getVersion:()=> '1.1.0',isPackaged:false,requestSingleInstanceLock:()=>ownsLock,quit:()=>quit++,whenReady:()=>Promise.resolve(),on:(key,callback)=>events[key]=callback};
  const electron={app,BrowserWindow:Window,ipcMain:{on(){},handle(key,handler){handlers[key]=handler}},Menu:{buildFromTemplate:value=>value,setApplicationMenu(){}},dialog:{},clipboard:{writeText(value){copied=value}}};
  vm.runInNewContext(code,{require:name=>name==='electron'?electron:name==='./updates'?require('./electron/updates'):name==='electron-updater'?{autoUpdater:{}}:require(name),__dirname:require('node:path').join(__dirname,'electron'),process:{env:{},platform:'win32'},console});
  await Promise.resolve();
  assert.equal(handlers['copy-mini-program'](),true);
  assert.equal(copied,'#小程序://小宝贝/6rgi3WZtRC9rX0v');
  if(!ownsLock){assert.equal(quit,1);assert.equal(windows.length,0);return}
  assert.equal(windows.length,1);const window=windows[0];
  assert.equal(window.options.show,false);assert.equal(window.shown,0);
  assert.match(window.loaded,/index\.html$/);
  window.events['ready-to-show']();assert.equal(window.shown,1);
  events['second-instance']();assert.equal(windows.length,1);assert.equal(window.restored,1);assert.equal(window.focused,1);
}
(async()=>{await check(false);await check(true);console.log('PASS: existing-instance exit, initial window readiness, repeated-launch window reuse and restore.');})().catch(error=>{console.error(error);process.exitCode=1});
