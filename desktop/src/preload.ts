import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { OpenWindowOptions, SessionDetails, SessionsPayload, Settings } from './core/types'

contextBridge.exposeInMainWorld('sessionTray', {
  platform: process.platform,
  onUpdate(cb: (p: SessionsPayload) => void): () => void {
    const handler = (_e: IpcRendererEvent, p: SessionsPayload) => cb(p)
    ipcRenderer.on('sessions:update', handler)
    // null = main has not finished its first scan; the first broadcast will deliver data.
    void ipcRenderer.invoke('sessions:get').then((p: SessionsPayload | null) => { if (p) cb(p) })
    return () => { ipcRenderer.removeListener('sessions:update', handler) }
  },
  resume: (id: string) => ipcRenderer.send('session:resume', id),
  copy: (id: string) => ipcRenderer.send('session:copy', id),
  togglePin: (id: string) => ipcRenderer.send('session:pin', id),
  reveal: (id: string) => ipcRenderer.send('session:reveal', id),
  openUrl: (url: string) => ipcRenderer.send('app:open-url', url),
  openWindow: (opts?: OpenWindowOptions) => ipcRenderer.send('app:open-window', opts),
  onOpen(cb: (opts: OpenWindowOptions) => void): () => void {
    const handler = (_e: IpcRendererEvent, opts: OpenWindowOptions) => cb(opts)
    ipcRenderer.on('window:open', handler)
    return () => { ipcRenderer.removeListener('window:open', handler) }
  },
  removeLegacyHooks: () => ipcRenderer.send('app:remove-legacy-hooks'),
  setSettings: (patch: Partial<Settings>) => ipcRenderer.send('settings:set', patch),
  openSettings: (section?: 'overview') => ipcRenderer.send('app:open-settings', section),
  onSettingsSection(cb: (section: 'overview') => void): () => void {
    const handler = (_e: IpcRendererEvent, section: 'overview') => cb(section)
    ipcRenderer.on('settings:section', handler)
    return () => { ipcRenderer.removeListener('settings:section', handler) }
  },
  connectStatusLine: (): Promise<{ ok: boolean; reason?: string }> => ipcRenderer.invoke('statusline:connect'),
  disconnectStatusLine: (): Promise<string> => ipcRenderer.invoke('statusline:disconnect'),
  details: (id: string): Promise<SessionDetails | null> => ipcRenderer.invoke('session:details', id),
  copyText: (text: string) => ipcRenderer.send('session:copy-text', text),
  rename: (id: string, name: string | null) => ipcRenderer.send('session:rename', id, name),
  continueIn: (id: string, opts: { folder: string; prompt: string; target: 'claude' | 'clipboard' }) =>
    ipcRenderer.send('session:continue', id, opts),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pick-folder'),
  archive: (ids: string[]) => ipcRenderer.send('session:archive', ids),
  restore: (ids: string[]) => ipcRenderer.send('session:restore', ids),
  keep: (ids: string[]) => ipcRenderer.send('session:keep', ids),
  dismissNotifyTip: () => ipcRenderer.send('app:dismiss-notify-tip'),
})
