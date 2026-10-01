const { app, BrowserWindow, ipcMain, Menu, dialog, clipboard } = require('electron')
const fs = require('fs').promises
const path = require('path')
const { createUpdates, preserveProfile } = require('./updates')

preserveProfile(app)

let mainWindow
let updates

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 1060,
    minHeight: 700,
    resizable: true,
    show: false,
    backgroundColor: '#f0f0f0',
    title: '小宝贝记账本',
    icon: path.join(__dirname, '../dist/assets/app-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    const distPath = path.join(__dirname, '../dist')
    const indexPath = path.join(distPath, 'index.html')
    mainWindow.loadFile(indexPath)
  }

  const runCommand = (command) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.executeJavaScript(`window.bookCommands?.[${JSON.stringify(command)}]?.()`)
  }
  const menu = Menu.buildFromTemplate([
    { label: '文件(&F)', submenu: [
      { label: '导出价格清单（Excel / WPS 可编辑）…', click: () => runCommand('exportPrices') },
      { label: '导入修改后的价格清单…', click: () => runCommand('importPrices') },
      { type: 'separator' },
      { label: '清空当天物品记录…', click: () => runCommand('clearRecords') },
      { type: 'separator' },
      { label: '退出(&X)', accelerator: 'Alt+F4', click: () => mainWindow.close() }
    ] },
    { label: '设置(&S)', submenu: [
      { label: '比例与点卡设置…', click: () => runCommand('settings') },
      { label: '角色金币统计…', click: () => runCommand('roleGold') },
      { type: 'separator' },
      { label: '换肤…', accelerator: 'Ctrl+T', click: () => runCommand('theme') }
    ] },
    { label: '视图(&V)', submenu: [
      { label: '跑环记账', accelerator: 'Ctrl+R', click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.executeJavaScript('window.ringProject?.open()')
      } },
      { label: '收入统计…', accelerator: 'Ctrl+I', click: () => runCommand('income') },
      { type: 'separator' },
      { role: 'resetZoom', label: '实际大小' },
      { role: 'zoomIn', label: '放大' },
      { role: 'zoomOut', label: '缩小' }
    ] },
    { label: '帮助(&H)', submenu: [
      { label: '检查软件更新…', click: () => updates?.check(true) },
      { label: '关于记账本…', click: () => runCommand('about') }
    ] }
  ])
  Menu.setApplicationMenu(menu)
}

const ownsInstance = app.requestSingleInstanceLock()
if (!ownsInstance) app.quit()
else {
app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})
app.whenReady().then(() => {
  createWindow()
  updates = createUpdates({ app, updater: require('electron-updater').autoUpdater, dialog, getWindow: () => mainWindow })
  updates.start()
  app.on('before-quit', () => updates.stop())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

ipcMain.handle('copy-mini-program', () => {
  clipboard.writeText('#小程序://小宝贝/6rgi3WZtRC9rX0v')
  return true
})

ipcMain.handle('save-price-list', async (_event, payload) => {
  if (!payload || typeof payload.csv !== 'string' || payload.csv.length > 5 * 1024 * 1024) {
    throw new Error('价格清单格式不正确')
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出可编辑价格清单',
    defaultPath: path.join(app.getPath('documents'), `物品价格清单_${new Date().toLocaleDateString('sv-SE')}.csv`),
    filters: [{ name: 'CSV 表格（Excel / WPS 可编辑）', extensions: ['csv'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  await fs.writeFile(result.filePath, payload.csv, 'utf8')
  return { canceled: false, filePath: result.filePath }
})
