import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  installHooks: () => ipcRenderer.send('hooks:install'),
  removeHooks: () => ipcRenderer.send('hooks:remove'),
  closeWindow: () => ipcRenderer.send('hooks:close'),
})
