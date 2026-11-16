const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  savePdfDialog: (defaultFilename) => ipcRenderer.invoke('save-pdf-dialog', defaultFilename),
});
