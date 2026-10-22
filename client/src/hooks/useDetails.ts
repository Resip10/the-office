import { useEffect, useState } from 'react'
import type { SessionDetails } from '../../../desktop/src/core/types'

// Handoff and peek for one session, loaded on demand; refetched when the session gets new activity.
// Results are tagged with their id so a switch never shows the previous session's details.
export function useDetails(id: string, lastActivityAt: number) {
  const [loaded, setLoaded] = useState<{ id: string; details: SessionDetails | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    window.sessionTray.details(id).then(
      details => { if (!cancelled) setLoaded({ id, details }) },
      () => { if (!cancelled) setLoaded({ id, details: null }) },
    )
    return () => { cancelled = true }
  }, [id, lastActivityAt])

  const current = loaded?.id === id ? loaded : null
  return { details: current?.details ?? null, loading: current === null }
}
