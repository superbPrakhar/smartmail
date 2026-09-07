const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  sendNotification: (title, body) => ipcRenderer.send('show-notification', { title, body })
});
