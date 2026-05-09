import { useState } from 'react'

const DISMISSED_KEY = 'hooks-banner-dismissed'

interface Props {
  hooksInstalled: boolean
}

export function HooksBanner({ hooksInstalled }: Props) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === 'true'
  )

  if (hooksInstalled || dismissed) return null

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  async function handleInstall() {
    try {
      await fetch('http://localhost:7777/api/hooks/setup', { method: 'POST' })
    } catch {
      // server unreachable — ignore
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-surface border-b border-border text-xs text-text-muted shrink-0">
      <span className="text-status-starting">●</span>
      <span>
        Install hooks for real-time updates — dashboard works without them (JSONL fallback, ~500ms lag)
      </span>
      <button
        onClick={handleInstall}
        className="ml-auto shrink-0 text-status-starting hover:underline"
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        className="shrink-0 text-text-muted hover:text-text-primary"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
