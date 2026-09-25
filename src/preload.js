const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('stepfolio', {
  call: (action, data) => ipcRenderer.invoke('stepfolio', action, data),
  onState: callback => { const fn = (_, data) => callback(data); ipcRenderer.on('state', fn); return () => ipcRenderer.removeListener('state', fn); },
  onNotice: callback => ipcRenderer.on('notice', (_, data) => callback(data))
});
