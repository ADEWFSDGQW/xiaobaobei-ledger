const { contextBridge, ipcRenderer } = require('electron')


contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('close-window'),
  chooseGameWindows: () => ipcRenderer.invoke('toolbox-game-windows'),
  scheduleGameClose: (payload) => ipcRenderer.invoke('toolbox-game-close', payload),
  cancelGameClose: () => ipcRenderer.invoke('toolbox-game-cancel'),
  gameCloseStatus: () => ipcRenderer.invoke('toolbox-game-status'),
  savePriceList: (csv) => ipcRenderer.invoke('save-price-list', { csv }),
  copyMiniProgram: () => ipcRenderer.invoke('copy-mini-program'),
  getIconsPath: () => {
    const appPath = __dirname.replace(/[\\/][^\\/]+$/, '')
    const iconsPath = appPath + '/resources/icons'
    return iconsPath.replace(/\\/g, '/')
  }
})
