import { useState, useEffect, useRef } from 'react'

export interface TranscriptSnapshot {
  firstPrompt: string | null
  latestAssistant: string | null
  messageCount: number
}

const POLL_MS = 3000

export function useTranscriptSnapshot(
  transcriptPath: string | undefined,
  active: boolean
): TranscriptSnapshot | null {
  const [snapshot, setSnapshot] = useState<TranscriptSnapshot | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMock = new URLSearchParams(window.location.search).has('mock')

  useEffect(() => {
    if (isMock || !transcriptPath) {
      setSnapshot(null)
      return
    }

    let cancelled = false

    async function load() {
      try {
        const res = await window.fetch(
          `/api/transcript/snapshot?path=${encodeURIComponent(transcriptPath!)}`
        )
        if (res.ok && !cancelled) {
          setSnapshot((await res.json()) as TranscriptSnapshot)
        }
      } catch {
        // server unreachable — keep previous snapshot
      }
    }

    function scheduleNext() {
      if (!active || cancelled) return
      timerRef.current = setTimeout(async () => {
        await load()
        scheduleNext()
      }, POLL_MS)
    }

    load().then(scheduleNext)

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [transcriptPath, active, isMock])

  return snapshot
}
