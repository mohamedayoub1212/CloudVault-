const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateChecking: (callback) => ipcRenderer.on('update-checking', callback),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_, v) => callback(v)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', callback),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates')
});
