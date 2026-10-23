import type { SessionRecord, Settings } from './types'

// Pure (no Node imports): the renderer uses it for the Cleanup view and the stale count.

export type StaleReason = { kind: 'idle'; days: number } | { kind: 'trivial' } | { kind: 'folder-gone' }

const DAY = 86_400_000
const KEEP_MS = 30 * DAY

export function staleReasons(
  r: SessionRecord,
  ctx: { now: number; rules: Settings['stale']; pinned: boolean; archived: boolean; keptAt: number | undefined },
): StaleReason[] {
  if (ctx.pinned || ctx.archived || r.live) return []
  // "Keep" holds until the session is used again or 30 days pass.
  if (ctx.keptAt !== undefined && r.lastActivityAt <= ctx.keptAt && ctx.now - ctx.keptAt < KEEP_MS) return []

  const reasons: StaleReason[] = []
  const idleDays = Math.floor((ctx.now - r.lastActivityAt) / DAY)
  if (ctx.rules.idleDays !== null && idleDays > ctx.rules.idleDays) reasons.push({ kind: 'idle', days: idleDays })
  if (ctx.rules.trivialMessages !== null && r.messageCount < ctx.rules.trivialMessages && r.editCount === 0) reasons.push({ kind: 'trivial' })
  // No recorded folder means unknown, not gone.
  if (ctx.rules.missingFolder && r.projectPath !== null && !r.projectExists) reasons.push({ kind: 'folder-gone' })
  return reasons
}

export function reasonLabel(r: StaleReason): string {
  switch (r.kind) {
    case 'idle': return `idle ${r.days}d`
    case 'trivial': return 'trivial'
    case 'folder-gone': return 'folder gone'
  }
}
