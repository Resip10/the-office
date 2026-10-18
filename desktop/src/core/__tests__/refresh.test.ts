import { scanDue, unknownLiveIds, SCAN_HIDDEN_MS, SCAN_VISIBLE_MS } from '../refresh'

describe('unknownLiveIds', () => {
  it('returns live ids with no record that have not been tried yet', () => {
    const tried = new Set(['b'])
    expect(unknownLiveIds(['a', 'b', 'c'], new Set(['c']), tried)).toEqual(['a'])
  })

  it('a live session that never gets a transcript triggers one rescan, not one per poll', () => {
    const tried = new Set<string>()
    const known = new Set<string>()
    const first = unknownLiveIds(['x'], known, tried)
    first.forEach(id => tried.add(id))
    expect(first).toEqual(['x'])
    expect(unknownLiveIds(['x'], known, tried)).toEqual([])
  })
})

describe('scanDue', () => {
  const t0 = 1_000_000
  it('every 30 s while a window is visible', () => {
    expect(scanDue({ visible: true, lastScanAt: t0, now: t0 + SCAN_VISIBLE_MS - 1 })).toBe(false)
    expect(scanDue({ visible: true, lastScanAt: t0, now: t0 + SCAN_VISIBLE_MS })).toBe(true)
  })

  it('every 5 min while hidden', () => {
    expect(scanDue({ visible: false, lastScanAt: t0, now: t0 + SCAN_VISIBLE_MS })).toBe(false)
    expect(scanDue({ visible: false, lastScanAt: t0, now: t0 + SCAN_HIDDEN_MS })).toBe(true)
  })

  it('opening a window mid-way through a hidden interval makes the 30 s cadence apply at once', () => {
    // hidden for 4 min, then the window opens: next 30 s tick must scan, not wait for the 5 min mark
    expect(scanDue({ visible: true, lastScanAt: t0, now: t0 + 4 * 60_000 })).toBe(true)
  })
})
