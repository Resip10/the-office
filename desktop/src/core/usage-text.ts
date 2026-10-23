import type { LimitWindow, StatId, StatuslineSnapshot } from './types'

// Pure: text for status line items in the stats line (renderer) and the tray tooltip (main).

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const STALE_MS = 30 * MIN
const WARN_PCT = 80

export interface StatPart { label: string | null; text: string; warn: boolean }

const pad = (n: number) => String(n).padStart(2, '0')

// Under a day: time left ("2h 14m"); later: local weekday and time ("Sat 14:00").
export function resetText(at: number, now: number): string {
  const left = at - now
  if (left < DAY) {
    const h = Math.floor(left / HOUR)
    const m = Math.floor((left % HOUR) / MIN)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }
  const d = new Date(at)
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function limitPart(label: string, w: LimitWindow, now: number): StatPart {
  if (w.resetsAt !== null && w.resetsAt <= now) return { label, text: 'reset', warn: false }
  const pct = Math.round(w.usedPct)
  return { label, text: w.resetsAt === null ? `${pct}%` : `${pct}% · resets ${resetText(w.resetsAt, now)}`, warn: pct >= WARN_PCT }
}

export function usageParts(s: StatuslineSnapshot, now: number): StatPart[] {
  const parts: StatPart[] = []
  if (s.fiveHour) parts.push(limitPart('5h', s.fiveHour, now))
  if (s.sevenDay) parts.push(limitPart('wk', s.sevenDay, now))
  return parts
}

function itemParts(s: StatuslineSnapshot, id: StatId, now: number): StatPart[] {
  const plain = (label: string | null, text: string): StatPart[] => [{ label, text, warn: false }]
  switch (id) {
    case 'limits': return usageParts(s, now)
    case 'lines': return s.linesAdded === null || s.linesRemoved === null ? [] : plain(null, `+${s.linesAdded} −${s.linesRemoved}`)
    case 'cache':
      if (s.cacheHitPct === null) return []
      return plain('cache', s.cacheColdAt !== null && s.cacheColdAt > now ? `${s.cacheHitPct}% · cold in ${resetText(s.cacheColdAt, now)}` : `${s.cacheHitPct}%`)
    case 'effort': return s.effort === null ? [] : plain('effort', s.thinking ? `${s.effort} · thinking` : s.effort)
    case 'pr': return s.pr === null ? [] : plain('PR', s.pr.reviewState ? `#${s.pr.number} · ${s.pr.reviewState}` : `#${s.pr.number}`)
    case 'text': return s.text === null ? [] : plain(null, s.text)
    default: return []
  }
}

// Status line items in the user's order; the app's own items are skipped here.
export function statuslineParts(s: StatuslineSnapshot, items: StatId[], now: number): StatPart[] {
  return items.flatMap(id => itemParts(s, id, now))
}

export function usageStale(s: StatuslineSnapshot, now: number): string | null {
  const age = now - s.capturedAt
  if (age <= STALE_MS) return null
  return age < HOUR ? `as of ${Math.floor(age / MIN)}m ago` : `as of ${Math.floor(age / HOUR)}h ago`
}

export function usageTooltip(s: StatuslineSnapshot, now: number): string {
  return usageParts(s, now).map(p => `${p.label} ${p.text.split(' · ')[0]}`).join(' · ')
}
