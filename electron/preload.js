const { contextBridge, ipcRenderer } = require('electron')


contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('close-window'),
  savePriceList: (csv) => ipcRenderer.invoke('save-price-list', { csv }),
  copyMiniProgram: () => ipcRenderer.invoke('copy-mini-program'),
  getIconsPath: () => {
    const appPath = __dirname.replace(/[\\/][^\\/]+$/, '')
    const iconsPath = appPath + '/resources/icons'
    return iconsPath.replace(/\\/g, '/')
  }
})
