const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ruangKawanDesktop', {
  isDesktop: true,
  platform: process.platform,
  chooseFile: () => ipcRenderer.invoke('desktop:choose-file'),
  revealFile: (filePath) => ipcRenderer.invoke('desktop:reveal-file', filePath),
  openExternal: (url) => ipcRenderer.invoke('desktop:open-external', url),
  notify: (title, body) => ipcRenderer.invoke('desktop:notify', { title, body }),
});
