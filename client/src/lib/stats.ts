import type { SessionRecord, StatId } from '../../../desktop/src/core/types'
import type { StatPart } from '../../../desktop/src/core/usage-text'

const WEEK_MS = 7 * 86_400_000

const startOfToday = (now: number) => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime() }
const cost = (records: SessionRecord[], since: number) =>
  records.filter(r => r.costUSD !== null && r.lastActivityAt >= since).reduce((sum, r) => sum + (r.costUSD as number), 0)

// The app's own stats line items, in the user's order; empty values are left out.
export function appStatParts(records: SessionRecord[], items: StatId[], now: number): StatPart[] {
  const plain = (text: string): StatPart[] => [{ label: null, text, warn: false }]
  return items.flatMap(id => {
    switch (id) {
      case 'running': {
        const running = records.filter(r => r.live?.status === 'busy').length
        const waiting = records.filter(r => r.live?.status === 'waiting').length
        if (running + waiting === 0) return []
        return plain(waiting > 0 ? `${running} running · ${waiting} waiting` : `${running} running`)
      }
      case 'costToday': { const c = cost(records, startOfToday(now)); return c > 0 ? plain(`≈ $${c.toFixed(2)} today`) : [] }
      case 'costWeek': { const c = cost(records, now - WEEK_MS); return c > 0 ? plain(`≈ $${c.toFixed(2)} this week`) : [] }
      case 'sessionsToday': {
        const n = records.filter(r => r.lastActivityAt >= startOfToday(now)).length
        return n > 0 ? plain(`${n} today`) : []
      }
      default: return []
    }
  })
}
