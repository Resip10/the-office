import type { SessionRecord } from '../../../desktop/src/core/types'

export type TimeRange = 'today' | '7d' | '30d' | 'all'

export interface Filters {
  query: string
  range: TimeRange
  project: string | null
  runningOnly: boolean
}

export interface Sections {
  running: SessionRecord[]
  pinned: SessionRecord[]
  recent: SessionRecord[]
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export function projectName(path: string | null): string {
  if (!path) return '—'
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '—'
}

export function stateOf(r: SessionRecord): string {
  if (!r.live) return 'ended'
  return r.live.status === 'busy' ? 'running' : r.live.status
}

export function relativeTime(ts: number, now: number): string {
  const diff = now - ts
  if (diff < MIN) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function rangeStart(range: TimeRange, now: number): number {
  switch (range) {
    case 'today': { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime() }
    case '7d': return now - 7 * DAY
    case '30d': return now - 30 * DAY
    case 'all': return -Infinity
  }
}

function matchesQuery(r: SessionRecord, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [r.title, projectName(r.projectPath), r.gitBranch, r.lastPrompt]
    .some(field => field?.toLowerCase().includes(q))
}

export function buildSections(records: SessionRecord[], pins: string[], f: Filters, now: number): Sections {
  const pinned = new Set(pins)
  const since = rangeStart(f.range, now)
  const sections: Sections = { running: [], pinned: [], recent: [] }

  const visible = records
    .filter(r => matchesQuery(r, f.query) && (f.project === null || r.projectPath === f.project))
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)

  for (const r of visible) {
    if (r.live) sections.running.push(r)
    else if (f.runningOnly) continue
    else if (pinned.has(r.id)) sections.pinned.push(r)
    else if (r.lastActivityAt >= since) sections.recent.push(r)
  }
  return sections
}
