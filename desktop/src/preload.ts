import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { SessionsPayload } from './core/types'

contextBridge.exposeInMainWorld('sessionTray', {
  onUpdate(cb: (p: SessionsPayload) => void): () => void {
    const handler = (_e: IpcRendererEvent, p: SessionsPayload) => cb(p)
    ipcRenderer.on('sessions:update', handler)
    void ipcRenderer.invoke('sessions:get').then(cb)
    return () => { ipcRenderer.removeListener('sessions:update', handler) }
  },
  resume: (id: string) => ipcRenderer.send('session:resume', id),
  copy: (id: string) => ipcRenderer.send('session:copy', id),
  togglePin: (id: string) => ipcRenderer.send('session:pin', id),
  reveal: (id: string) => ipcRenderer.send('session:reveal', id),
  openUrl: (url: string) => ipcRenderer.send('app:open-url', url),
  openWindow: () => ipcRenderer.send('app:open-window'),
  removeLegacyHooks: () => ipcRenderer.send('app:remove-legacy-hooks'),
})
