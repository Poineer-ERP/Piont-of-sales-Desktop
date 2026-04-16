const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  printHTML: (html) => ipcRenderer.send('print-html', html)
})