export const SCAN_VISIBLE_MS = 30_000
export const SCAN_HIDDEN_MS = 300_000

// Live sessions with no transcript yet that deserve one rescan each.
// A session that never writes a transcript must not trigger a rescan on every poll.
export function unknownLiveIds(liveIds: Iterable<string>, known: Set<string>, tried: Set<string>): string[] {
  return [...liveIds].filter(id => !known.has(id) && !tried.has(id))
}

// Checked on a short tick, so a window opening mid-interval switches to the fast cadence right away.
export function scanDue(opts: { visible: boolean; lastScanAt: number; now: number }): boolean {
  return opts.now - opts.lastScanAt >= (opts.visible ? SCAN_VISIBLE_MS : SCAN_HIDDEN_MS)
}
