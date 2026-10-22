import type { OpenWindowOptions, SessionsPayload } from '../../desktop/src/core/types'

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
    }
  }
}

export {}
