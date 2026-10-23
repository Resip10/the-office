// Pure: which waiting sessions should trigger a notification, and its text.

// One uninterrupted stretch of waiting. `start` is the first status time we saw for it, so a
// rewritten status file does not restart the clock.
export interface Stretch { start: number; notified: boolean }

export function trackWaiting(
  prev: Map<string, Stretch>,
  waiting: Array<{ id: string; since: number }>,
  now: number,
  thresholdMs: number,
): { next: Map<string, Stretch>; due: string[] } {
  const next = new Map<string, Stretch>()
  const due: string[] = []
  for (const { id, since } of waiting) {
    const stretch = { ...(prev.get(id) ?? { start: since, notified: false }) }
    if (!stretch.notified && now - stretch.start >= thresholdMs) {
      stretch.notified = true
      due.push(id)
    }
    next.set(id, stretch)
  }
  return { next, due }
}

export function notificationText(sessions: Array<{ title: string; waitingFor: string | null }>): { title: string; body: string } {
  if (sessions.length === 1) {
    const [s] = sessions
    return { title: `${s.title} needs input`, body: s.waitingFor ? `Waiting: ${s.waitingFor}` : 'Waiting for you in Claude Code' }
  }
  return { title: `${sessions.length} sessions need input`, body: sessions.map(s => s.title).join(' · ') }
}
