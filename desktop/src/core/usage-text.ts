import type { LimitWindow, PlanUsage } from './types'

// Pure: plan-usage text for the footers (renderer) and the tray tooltip (main).

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const STALE_MS = 30 * MIN
const WARN_PCT = 80

export interface UsagePart { label: '5h' | 'wk'; text: string; warn: boolean }

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

function part(label: UsagePart['label'], w: LimitWindow, now: number): UsagePart {
  if (w.resetsAt !== null && w.resetsAt <= now) return { label, text: 'reset', warn: false }
  const pct = Math.round(w.usedPct)
  return { label, text: w.resetsAt === null ? `${pct}%` : `${pct}% · resets ${resetText(w.resetsAt, now)}`, warn: pct >= WARN_PCT }
}

export function usageParts(u: PlanUsage, now: number): UsagePart[] {
  const parts: UsagePart[] = []
  if (u.fiveHour) parts.push(part('5h', u.fiveHour, now))
  if (u.sevenDay) parts.push(part('wk', u.sevenDay, now))
  return parts
}

export function usageStale(u: PlanUsage, now: number): string | null {
  const age = now - u.capturedAt
  if (age <= STALE_MS) return null
  return age < HOUR ? `as of ${Math.floor(age / MIN)}m ago` : `as of ${Math.floor(age / HOUR)}h ago`
}

export function usageTooltip(u: PlanUsage, now: number): string {
  return usageParts(u, now).map(p => `${p.label} ${p.text.split(' · ')[0]}`).join(' · ')
}
