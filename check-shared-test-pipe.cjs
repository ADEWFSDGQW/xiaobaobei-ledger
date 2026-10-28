'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs');
const child=spawn(require('electron'),[path.join(__dirname,'check-shared-prices-ui.cjs')],{cwd:__dirname,windowsHide:true,stdio:['ignore','pipe','pipe']});
let disconnected=false,stderr='';
child.stdout.once('data',()=>{disconnected=true;child.stdout.destroy();});
child.stderr.on('data',chunk=>{stderr+=chunk;});
const timeout=setTimeout(()=>{child.kill();console.error('FAIL: closed-log test timed out');process.exitCode=1;},45000);
child.on('error',error=>{clearTimeout(timeout);console.error(error);process.exitCode=1;});
child.on('exit',code=>{
  clearTimeout(timeout);
  const result={test:'Closed stdout pipe during isolated Electron integration test',disconnected,exitCode:code,stderr,completedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(__dirname,'docs','测试日志断管回归.json'),JSON.stringify(result,null,2));
  if(code!==0||!disconnected){console.error('FAIL',result);process.exitCode=1;return;}
  console.log('PASS: test completed with exit 0 after its stdout pipe was deliberately disconnected; no EPIPE crash.');
});
