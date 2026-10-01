const { contextBridge, ipcRenderer } = require('electron')
const path = require('path')

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('close-window'),
  savePriceList: (csv) => ipcRenderer.invoke('save-price-list', { csv }),
  copyMiniProgram: () => ipcRenderer.invoke('copy-mini-program'),
  getIconsPath: () => {
    const appPath = path.dirname(__dirname)
    const iconsPath = path.join(appPath, 'resources', 'icons')
    return iconsPath.replace(/\\/g, '/')
  }
})
