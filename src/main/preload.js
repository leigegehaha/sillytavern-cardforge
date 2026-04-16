const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cardForgeAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // File dialogs
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  openImage: () => ipcRenderer.invoke('dialog:openImage'),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

  // File operations
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  readTextFile: (path) => ipcRenderer.invoke('fs:readTextFile', path),
  writeFile: (path, data, encoding) => ipcRenderer.invoke('fs:writeFile', path, data, encoding),
  fileExists: (path) => ipcRenderer.invoke('fs:exists', path),

  // PNG operations
  extractCharaData: (path) => ipcRenderer.invoke('png:extractCharaData', path),
  embedCharaData: (pngPath, cardJson, outputPath) =>
    ipcRenderer.invoke('png:embedCharaData', pngPath, cardJson, outputPath),

  // Settings
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // Shell
  openExternal: (url) => ipcRenderer.send('shell:openExternal', url),

  // App paths
  getResourcePath: () => ipcRenderer.invoke('app:getResourcePath'),

  // Error log
  readErrorLog: () => ipcRenderer.invoke('log:read'),
  appendErrorLog: (entry) => ipcRenderer.invoke('log:append', entry),
  clearErrorLog: () => ipcRenderer.invoke('log:clear'),
  openLogFolder: () => ipcRenderer.invoke('log:openFolder'),

  // Auto update
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  getAppVersion: () => ipcRenderer.invoke('update:getVersion')
});
