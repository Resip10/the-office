import type { OpenWindowOptions, SessionDetails, SessionsPayload, Settings } from '../../desktop/src/core/types'

// Bridge exposed by desktop/src/preload.ts.
declare global {
  interface Window {
    sessionTray: {
      platform: NodeJS.Platform
      onUpdate(cb: (p: SessionsPayload) => void): () => void
      resume(id: string): void
      copy(id: string): void
      togglePin(id: string): void
      reveal(id: string): void
      openUrl(url: string): void
      openWindow(opts?: OpenWindowOptions): void
      onOpen(cb: (opts: OpenWindowOptions) => void): () => void
      removeLegacyHooks(): void
      setSettings(patch: Partial<Settings>): void
      openSettings(section?: 'stats'): void
      onSettingsSection(cb: (section: 'stats') => void): () => void
      connectStatusLine(): Promise<{ ok: boolean; reason?: string }>
      disconnectStatusLine(): Promise<string>
      details(id: string): Promise<SessionDetails | null>
      copyText(text: string): void
      rename(id: string, name: string | null): void
      continueIn(id: string, opts: { folder: string; prompt: string; target: 'claude' | 'clipboard' }): void
      pickFolder(): Promise<string | null>
      archive(ids: string[]): void
      restore(ids: string[]): void
      keep(ids: string[]): void
      dismissNotifyTip(): void
    }
  }
}

export {}
