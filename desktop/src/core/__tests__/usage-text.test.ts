import { resetText, statuslineParts, usageParts, usageStale, usageTooltip } from '../usage-text'
import type { StatuslineSnapshot } from '../types'

const MIN = 60_000
const HOUR = 60 * MIN
const NOW = new Date(2026, 9, 23, 12, 0).getTime() // Fri Oct 23 2026, 12:00 local
const SAT_14 = new Date(2026, 9, 24, 14, 0).getTime()

const usage = (over: Partial<StatuslineSnapshot> = {}): StatuslineSnapshot => ({
  fiveHour: { usedPct: 11, resetsAt: NOW + 2 * HOUR + 14 * MIN },
  sevenDay: { usedPct: 47.5, resetsAt: SAT_14 },
  capturedAt: NOW,
  sessionId: null,
  effort: 'medium', thinking: true,
  text: 'app on main',
  ...over,
})

describe('resetText', () => {
  it('under a day: time left; later: weekday and time', () => {
    expect(resetText(NOW + 2 * HOUR + 14 * MIN, NOW)).toBe('2h 14m')
    expect(resetText(NOW + 9 * MIN, NOW)).toBe('9m')
    expect(resetText(SAT_14, NOW)).toBe('Sat 14:00')
  })
})

describe('usageParts', () => {
  it('5h and weekly, rounded, with reset times', () => {
    expect(usageParts(usage(), NOW)).toEqual([
      { label: '5h', text: '11% · resets 2h 14m', warn: false },
      { label: 'wk', text: '48% · resets Sat 14:00', warn: false },
    ])
  })

  it('warns at 80% or more', () => {
    const parts = usageParts(usage({ fiveHour: { usedPct: 80, resetsAt: NOW + HOUR } }), NOW)
    expect(parts[0]).toEqual({ label: '5h', text: '80% · resets 1h 0m', warn: true })
  })

  it('a window whose reset has passed shows "reset" instead of the old number', () => {
    const parts = usageParts(usage({ fiveHour: { usedPct: 95, resetsAt: NOW - MIN } }), NOW)
    expect(parts[0]).toEqual({ label: '5h', text: 'reset', warn: false })
  })

  it('no reset time: just the percentage; missing windows are left out', () => {
    expect(usageParts(usage({ fiveHour: { usedPct: 5, resetsAt: null }, sevenDay: null }), NOW))
      .toEqual([{ label: '5h', text: '5%', warn: false }])
  })
})

describe('usageStale', () => {
  it('notes the age once the file is older than 30 minutes', () => {
    expect(usageStale(usage({ capturedAt: NOW - 10 * MIN }), NOW)).toBeNull()
    expect(usageStale(usage({ capturedAt: NOW - 42 * MIN }), NOW)).toBe('as of 42m ago')
    expect(usageStale(usage({ capturedAt: NOW - 3 * HOUR }), NOW)).toBe('as of 3h ago')
  })
})

describe('usageTooltip', () => {
  it('short form for the tray', () => {
    expect(usageTooltip(usage(), NOW)).toBe('5h 11% · wk 48%')
    expect(usageTooltip(usage({ fiveHour: null, sevenDay: null }), NOW)).toBe('')
  })
})

describe('statuslineParts', () => {
  it('plan limits only; app items are skipped', () => {
    expect(statuslineParts(usage(), ['running', 'limits'], NOW)).toEqual([
      { label: '5h', text: '11% · resets 2h 14m', warn: false },
      { label: 'wk', text: '48% · resets Sat 14:00', warn: false },
    ])
  })

  it('missing values drop their item', () => {
    expect(statuslineParts(usage({ fiveHour: null, sevenDay: null }), ['limits'], NOW)).toEqual([])
  })
})
