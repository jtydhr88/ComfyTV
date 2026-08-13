const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('previsionDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  versions: Object.freeze({ electron: process.versions.electron }),
  getPaths: () => ipcRenderer.invoke('desktop:get-paths'),
  saveProject: (suggestedName, contents) => ipcRenderer.invoke('project:save', { suggestedName, contents }),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveExport: (name, bytes) => ipcRenderer.invoke('export:save', { name, bytes }),
  chooseCaptureTarget: (kind, suggestedName) => ipcRenderer.invoke('capture:choose-target', { kind, suggestedName }),
  saveCaptureTarget: (token, bytes) => ipcRenderer.invoke('capture:save-target', { token, bytes }),
  captureWorkspace: token => ipcRenderer.invoke('workspace:capture', token),
  onMenuOpenProject: callback => ipcRenderer.on('menu:open-project', callback),
  onMenuSaveProject: callback => ipcRenderer.on('menu:save-project', callback)
}));
