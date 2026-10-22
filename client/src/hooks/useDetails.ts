import { useEffect, useState } from 'react'
import type { SessionDetails } from '../../../desktop/src/core/types'

// Handoff and peek for one session, loaded on demand; refetched when the session gets new activity.
export function useDetails(id: string, lastActivityAt: number) {
  const [details, setDetails] = useState<SessionDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.sessionTray.details(id).then(
      d => { if (!cancelled) { setDetails(d); setLoading(false) } },
      () => { if (!cancelled) { setDetails(null); setLoading(false) } },
    )
    return () => { cancelled = true }
  }, [id, lastActivityAt])

  return { details, loading }
}
