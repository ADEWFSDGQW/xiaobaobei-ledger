const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('node:path');
const assert = require('node:assert/strict');
app.setPath('userData', path.join(app.getPath('temp'), 'ledger-mini-program-check'));
ipcMain.handle('copy-mini-program', () => { clipboard.writeText('#小程序://小宝贝/6rgi3WZtRC9rX0v'); return true; });
app.whenReady().then(async () => {
  const window = new BrowserWindow({show:false, webPreferences:{preload:path.join(__dirname,'electron/preload.js'),contextIsolation:true,nodeIntegration:false}});
  try {
    await window.loadFile(path.join(__dirname,'dist/index.html'));
    const result = await window.webContents.executeJavaScript(`(async () => {
      const button = document.querySelector('.mini-program-entry');
      if (!button) throw new Error('底部入口未生成');
      button.click();
      const dialog = document.querySelector('.mini-program-dialog');
      if (!dialog.open) throw new Error('弹窗未打开');
      const image = dialog.querySelector('.mini-program-code');
      await image.decode();
      if (image.naturalWidth < 100) throw new Error('小程序码未正确加载');
      await dialog.querySelector('[data-copy]').onclick();
      const message = dialog.querySelector('[role=status]').textContent;
      dialog.querySelector('[data-close]').click();
      return {message, closed:!dialog.open, count:document.querySelectorAll('.mini-program-entry').length};
    })()`);
    assert.match(result.message,/口令已复制/);
    assert.equal(result.closed,true);
    assert.equal(result.count,2);
    assert.equal(await clipboard.readText(),'#小程序://小宝贝/6rgi3WZtRC9rX0v');
    console.log('PASS: rendered footer buttons, modal opening/closing and Electron clipboard copy.');
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
