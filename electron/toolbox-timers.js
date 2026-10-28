'use strict';
const {execFile}=require('node:child_process');
const run=require('node:util').promisify(execFile);
const quote=s=>"'"+s.replace(/'/g,"''")+"'";
async function ps(script){const r=await run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('[Console]::OutputEncoding=[Text.Encoding]::UTF8; '+script,'utf16le').toString('base64')],{windowsHide:true,timeout:15000,maxBuffer:1024*1024});return r.stdout.trim();}
async function list(exe){const s=await ps(`$wanted=${quote(exe)}; $rows=@(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.Path -eq $wanted } | ForEach-Object { @{pid=$_.Id; title=$_.MainWindowTitle; path=$_.Path; start=$_.StartTime.ToUniversalTime().ToString('o')} }); ConvertTo-Json -InputObject $rows -Compress`);return s?JSON.parse(s):[];}
async function close(row){return ps(`$p=Get-Process -Id ${row.pid} -ErrorAction SilentlyContinue; if($null -eq $p){ '已退出'; exit }; if($p.Path -ne ${quote(row.path)} -or $p.StartTime.ToUniversalTime().ToString('o') -ne ${quote(row.start)}){ '进程已变化，已跳过'; exit }; if($p.CloseMainWindow()){ '已请求正常关闭' } else { '未能关闭' }`);}
function createScheduler({closeWindow=close,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  let handle=null,generation=0,state={active:false,message:'尚未设置关闭定时'};
  function cancel(){generation++;if(handle)clearTimer(handle);handle=null;state={active:false,message:'关闭定时已取消'};return {...state};}
  function schedule(rows,minutes){
    if(!Array.isArray(rows)||!rows.length||rows.length>20||!Number.isInteger(minutes)||minutes<1||minutes>1440)throw new Error('请选择窗口，时间为 1～1440 分钟');
    rows.forEach(r=>{if(!r||!Number.isInteger(r.pid)||r.pid<=0||typeof r.path!=='string'||!r.path||typeof r.start!=='string'||!r.start||typeof r.title!=='string')throw new Error('窗口信息不正确');});
    cancel();const token=generation;state={active:true,end:now()+minutes*60000,message:'将关闭 '+rows.length+' 个选定窗口'};
    handle=setTimer(async()=>{handle=null;const results=[];for(const r of rows){if(token!==generation)return;try{results.push(r.pid+'：'+await closeWindow(r));}catch(_){results.push(r.pid+'：执行失败');}}if(token===generation)state={active:false,message:'定时执行完成；'+results.join('；')};},minutes*60000);return {...state};
  }
  return {schedule,cancel,status:()=>({...state})};
}
function installToolboxTimers({app,ipcMain,dialog,getWindow}){
  const timer=createScheduler();let windows=[];
  function trust(e){if(e.sender!==getWindow()?.webContents)throw new Error('无效来源');}
  ipcMain.handle('toolbox-game-windows',async e=>{trust(e);const r=await dialog.showOpenDialog(getWindow(),{title:'选择实际游戏客户端 EXE（不要选启动器）',properties:['openFile'],filters:[{name:'客户端',extensions:['exe']}]});if(r.canceled)return {canceled:true};windows=await list(r.filePaths[0]);return {windows};});
  ipcMain.handle('toolbox-game-close',async(e,p)=>{
    trust(e);if(!p||!Array.isArray(p.pids)||!p.pids.length||new Set(p.pids).size!==p.pids.length||!p.pids.every(Number.isInteger)||!Number.isInteger(p.minutes)||p.minutes<1||p.minutes>1440)throw new Error('窗口和分钟设置不正确');
    const rows=p.pids.map(pid=>windows.find(w=>w.pid===pid));if(rows.some(r=>!r))throw new Error('窗口列表已变化，请重新读取');
    const r=await dialog.showMessageBox(getWindow(),{type:'question',title:'确认定时关闭游戏',message:`${p.minutes} 分钟后关闭以下 ${rows.length} 个窗口？`,detail:rows.map(w=>w.title+'（PID '+w.pid+'）').join('\n')+'\n只请求正常关闭，若游戏弹出确认框需手动处理。退出记账本会取消定时。',buttons:['取消','启动定时'],defaultId:0,cancelId:0,noLink:true});
    return r.response===1?timer.schedule(rows,p.minutes):{canceled:true};
  });
  ipcMain.handle('toolbox-game-cancel',e=>{trust(e);return timer.cancel();});
  ipcMain.handle('toolbox-game-status',e=>{trust(e);return timer.status();});
  app.on('before-quit',()=>timer.cancel());
}
module.exports={createScheduler,installToolboxTimers};
