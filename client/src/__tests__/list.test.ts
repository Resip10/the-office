import { DEFAULT_SETTINGS } from '../../../desktop/src/core/types'
import type { SessionRecord } from '../../../desktop/src/core/types'
import { buildSections, projectName, relativeTime, stateOf, type Filters, staleList } from '../lib/list'

const NOW = new Date(2026, 9, 19, 15, 0, 0).getTime() // local time, Oct 19 2026 15:00
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

function rec(id: string, over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    tool: 'claude', id, filePath: `/p/${id}.jsonl`, title: `Session ${id}`, titleSource: 'ai',
    projectPath: 'C:\\projects\\app', projectExists: true, gitBranch: 'main', entrypoint: 'cli', version: '2.1.302',
    createdAt: NOW - DAY, lastActivityAt: NOW - HOUR, messageCount: 10, fileSize: 1000, contextTokens: null,
    model: null, costUSD: null, prUrls: [], lastPrompt: null, awaySummary: null, continuedInId: null, editCount: 0,
    subagentCount: 0, live: null, ...over,
  }
}
const busy = { pid: 1, status: 'busy', name: null, updatedAt: NOW }
const idle = { pid: 2, status: 'idle', name: null, updatedAt: NOW }
const ALL: Filters = { query: '', range: 'all', project: null, runningOnly: false }
const ids = (list: SessionRecord[]) => list.map(r => r.id)

describe('buildSections', () => {
  it('puts each session in one section: Running > Pinned > Recent', () => {
    const records = [rec('a', { live: busy }), rec('b'), rec('c')]
    const s = buildSections(records, ['a', 'b'], ALL, NOW)
    expect(ids(s.running)).toEqual(['a'])
    expect(ids(s.pinned)).toEqual(['b'])
    expect(ids(s.recent)).toEqual(['c'])
  })

  it('Running holds every live session, busy or idle', () => {
    const s = buildSections([rec('a', { live: idle }), rec('b', { live: busy })], [], ALL, NOW)
    expect(ids(s.running).sort()).toEqual(['a', 'b'])
  })

  it('sorts each section by lastActivityAt desc', () => {
    const records = [rec('old', { lastActivityAt: NOW - 3 * HOUR }), rec('new', { lastActivityAt: NOW - MIN }), rec('mid')]
    expect(ids(buildSections(records, [], ALL, NOW).recent)).toEqual(['new', 'mid', 'old'])
  })

  it('range filters Recent only — old pinned and running sessions stay', () => {
    const old = NOW - 20 * DAY
    const records = [rec('pin', { lastActivityAt: old }), rec('run', { lastActivityAt: old, live: busy }), rec('rec', { lastActivityAt: old })]
    const s = buildSections(records, ['pin'], { ...ALL, range: '7d' }, NOW)
    expect(ids(s.pinned)).toEqual(['pin'])
    expect(ids(s.running)).toEqual(['run'])
    expect(s.recent).toEqual([])
  })

  it("'today' means since local midnight", () => {
    const records = [rec('morning', { lastActivityAt: new Date(2026, 9, 19, 0, 5).getTime() }), rec('yesterday', { lastActivityAt: new Date(2026, 9, 18, 23, 55).getTime() })]
    expect(ids(buildSections(records, [], { ...ALL, range: 'today' }, NOW).recent)).toEqual(['morning'])
  })

  it('30d keeps 29-day-old sessions and drops 31-day-old ones', () => {
    const records = [rec('in', { lastActivityAt: NOW - 29 * DAY }), rec('out', { lastActivityAt: NOW - 31 * DAY })]
    expect(ids(buildSections(records, [], { ...ALL, range: '30d' }, NOW).recent)).toEqual(['in'])
  })

  it('query matches title, project name, branch and lastPrompt, case-insensitive, in all sections', () => {
    const records = [
      rec('t', { title: 'Fix LOGIN bug' }),
      rec('p', { projectPath: 'C:\\projects\\login-service' }),
      rec('b', { gitBranch: 'feat/login' }),
      rec('l', { lastPrompt: 'now the login page', live: busy }),
      rec('none'),
    ]
    const s = buildSections(records, ['p'], { ...ALL, query: 'Login' }, NOW)
    expect(ids(s.running)).toEqual(['l'])
    expect(ids(s.pinned)).toEqual(['p'])
    expect(ids(s.recent).sort()).toEqual(['b', 't'])
  })

  it('query does not match the full project path, only its name', () => {
    const s = buildSections([rec('a', { projectPath: 'C:\\projects\\app' })], [], { ...ALL, query: 'projects' }, NOW)
    expect(s.recent).toEqual([])
  })

  it('project filter applies to all sections', () => {
    const other = 'C:\\projects\\other'
    const records = [rec('a', { live: busy }), rec('b', { projectPath: other, live: busy }), rec('c', { projectPath: other })]
    const s = buildSections(records, ['c'], { ...ALL, project: other }, NOW)
    expect(ids(s.running)).toEqual(['b'])
    expect(ids(s.pinned)).toEqual(['c'])
  })

  it('runningOnly empties Pinned and Recent', () => {
    const s = buildSections([rec('a', { live: busy }), rec('b'), rec('c')], ['b'], { ...ALL, runningOnly: true }, NOW)
    expect(ids(s.running)).toEqual(['a'])
    expect(s.pinned).toEqual([])
    expect(s.recent).toEqual([])
  })

  it('pins for sessions that no longer exist are ignored', () => {
    const s = buildSections([rec('a')], ['gone'], ALL, NOW)
    expect(s.pinned).toEqual([])
    expect(ids(s.recent)).toEqual(['a'])
  })
})

describe('relativeTime', () => {
  it.each([
    [59 * 1000, 'just now'],
    [MIN, '1m ago'],
    [59 * MIN, '59m ago'],
    [60 * MIN, '1h ago'],
    [23 * HOUR, '23h ago'],
    [DAY, '1d ago'],
    [6 * DAY, '6d ago'],
  ])('%d ms ago → %s', (ago, expected) => {
    expect(relativeTime(NOW - ago, NOW)).toBe(expected)
  })

  it('7 days or more → short date', () => {
    expect(relativeTime(new Date(2026, 9, 2, 12, 0).getTime(), NOW)).toBe('Oct 2')
  })

  it('future timestamps (clock skew) → just now', () => {
    expect(relativeTime(NOW + 5 * MIN, NOW)).toBe('just now')
  })
})

describe('projectName', () => {
  it.each([
    ['C:\\projects\\the-office', 'the-office'],
    ['C:\\projects\\the-office\\', 'the-office'],
    ['/Users/me/app', 'app'],
    [null, '—'],
  ])('%s → %s', (path, expected) => {
    expect(projectName(path)).toBe(expected)
  })
})

describe('stateOf', () => {
  it('live busy → running, other live status → that status, no live → ended', () => {
    expect(stateOf(rec('a', { live: busy }))).toBe('running')
    expect(stateOf(rec('a', { live: idle }))).toBe('idle')
    expect(stateOf(rec('a'))).toBe('ended')
  })
})

describe('app names', () => {
  it('search matches a renamed session by its app name', () => {
    const named = rec('a', { title: 'My export', titleSource: 'app' })
    const s = buildSections([named, rec('b')], [], { ...ALL, query: 'my export' }, NOW)
    expect(ids(s.recent)).toEqual(['a'])
  })
})

describe('archive', () => {
  it('archived sessions leave pinned and recent', () => {
    const s = buildSections([rec('a'), rec('b')], ['a'], ALL, NOW, new Set(['a', 'b']))
    expect(s.pinned).toEqual([])
    expect(s.recent).toEqual([])
  })

  it('an archived session that is live again shows in Running', () => {
    const s = buildSections([rec('a', { live: busy })], [], ALL, NOW, new Set(['a']))
    expect(ids(s.running)).toEqual(['a'])
  })
})

describe('staleList', () => {
  const state = { pins: [] as string[], archived: [] as string[], keptAt: {}, settings: DEFAULT_SETTINGS }

  it('lists stale sessions with their reasons, skipping pinned ones', () => {
    const old = rec('old', { lastActivityAt: NOW - 40 * DAY })
    const pinned = rec('pin', { lastActivityAt: NOW - 40 * DAY })
    const fresh = rec('fresh')
    const list = staleList([old, pinned, fresh], { ...state, pins: ['pin'] }, NOW)
    expect(list.map(x => x.record.id)).toEqual(['old'])
    expect(list[0].reasons).toEqual([{ kind: 'idle', days: 40 }])
  })
})
