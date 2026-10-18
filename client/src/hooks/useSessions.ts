import { useEffect, useState } from 'react'
import type { SessionsPayload } from '../../../desktop/src/core/types'

const EMPTY: SessionsPayload = { records: [], pins: [], legacyHooks: false }

export function useSessions(): SessionsPayload {
  const [payload, setPayload] = useState<SessionsPayload>(EMPTY)
  useEffect(() => window.sessionTray?.onUpdate(setPayload), [])
  return payload
}

// Re-render periodically so "5m ago" labels stay current.
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
