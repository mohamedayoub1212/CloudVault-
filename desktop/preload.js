const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateChecking: (callback) => ipcRenderer.on('update-checking', callback),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_, v) => callback(v)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_, msg) => callback(msg)),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // Sync (Drive local)
  syncSelectFolder: () => ipcRenderer.invoke('sync-select-folder'),
  syncGetDefaultPath: () => ipcRenderer.invoke('sync-get-default-path'),
  syncStart: (opts) => ipcRenderer.invoke('sync-start', opts),
  syncStop: () => ipcRenderer.invoke('sync-stop'),
  syncStatus: () => ipcRenderer.invoke('sync-status'),
  syncNow: () => ipcRenderer.invoke('sync-now'),
  onSyncEvent: (callback) => ipcRenderer.on('sync-event', (_, event, data) => callback(event, data))
});
