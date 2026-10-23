import { reasonLabel, staleReasons } from '../stale'
import { DEFAULT_SETTINGS, type SessionRecord } from '../types'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 22)
const RULES = DEFAULT_SETTINGS.stale

function rec(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    tool: 'claude', id: 'a', filePath: 'x', title: 't', titleSource: 'ai', projectPath: 'C:\\app', projectExists: true,
    gitBranch: null, entrypoint: null, version: null, createdAt: null, lastActivityAt: NOW - DAY, messageCount: 20,
    fileSize: 1, contextTokens: null, model: null, costUSD: null, prUrls: [], lastPrompt: null, awaySummary: null,
    continuedInId: null, editCount: 1, subagentCount: 0, live: null, ...over,
  }
}

const ctx = (over: Partial<Parameters<typeof staleReasons>[1]> = {}) =>
  ({ now: NOW, rules: RULES, pinned: false, archived: false, keptAt: undefined, ...over })

describe('staleReasons', () => {
  it('idle past the threshold', () => {
    expect(staleReasons(rec({ lastActivityAt: NOW - 31 * DAY }), ctx())).toEqual([{ kind: 'idle', days: 31 }])
    expect(staleReasons(rec({ lastActivityAt: NOW - 29 * DAY }), ctx())).toEqual([])
  })

  it('trivial needs few messages and no edits', () => {
    expect(staleReasons(rec({ messageCount: 2, editCount: 0 }), ctx())).toEqual([{ kind: 'trivial' }])
    expect(staleReasons(rec({ messageCount: 2, editCount: 1 }), ctx())).toEqual([])
  })

  it('project folder gone', () => {
    expect(staleReasons(rec({ projectExists: false }), ctx())).toEqual([{ kind: 'folder-gone' }])
  })

  it('no recorded folder is not "folder gone"', () => {
    expect(staleReasons(rec({ projectPath: null, projectExists: false }), ctx())).toEqual([])
  })

  it('each rule can be turned off', () => {
    const all = rec({ lastActivityAt: NOW - 40 * DAY, messageCount: 1, editCount: 0, projectExists: false })
    expect(staleReasons(all, ctx({ rules: { ...RULES, idleDays: null } })).map(r => r.kind)).toEqual(['trivial', 'folder-gone'])
    expect(staleReasons(all, ctx({ rules: { ...RULES, trivialMessages: null } })).map(r => r.kind)).toEqual(['idle', 'folder-gone'])
    expect(staleReasons(all, ctx({ rules: { ...RULES, missingFolder: false } })).map(r => r.kind)).toEqual(['idle', 'trivial'])
  })

  it('pinned, archived and live sessions are never stale', () => {
    const old = rec({ lastActivityAt: NOW - 40 * DAY })
    expect(staleReasons(old, ctx({ pinned: true }))).toEqual([])
    expect(staleReasons(old, ctx({ archived: true }))).toEqual([])
    expect(staleReasons(rec({ lastActivityAt: NOW - 40 * DAY, live: { pid: 1, status: 'idle', name: null, updatedAt: NOW } }), ctx())).toEqual([])
  })

  it('a kept session stays quiet until new activity or 30 days pass', () => {
    const old = rec({ lastActivityAt: NOW - 40 * DAY })
    expect(staleReasons(old, ctx({ keptAt: NOW - 5 * DAY }))).toEqual([])
    expect(staleReasons(old, ctx({ keptAt: NOW - 31 * DAY }))).toHaveLength(1)
    const trivialAfterKeep = rec({ messageCount: 1, editCount: 0, lastActivityAt: NOW - DAY })
    expect(staleReasons(trivialAfterKeep, ctx({ keptAt: NOW - 2 * DAY }))).toEqual([{ kind: 'trivial' }])
  })

  it('returns every matching reason in rule order', () => {
    const all = rec({ lastActivityAt: NOW - 40 * DAY, messageCount: 1, editCount: 0, projectExists: false })
    expect(staleReasons(all, ctx()).map(r => r.kind)).toEqual(['idle', 'trivial', 'folder-gone'])
  })
})

describe('reasonLabel', () => {
  it('names each reason', () => {
    expect(reasonLabel({ kind: 'idle', days: 34 })).toBe('idle 34d')
    expect(reasonLabel({ kind: 'trivial' })).toBe('trivial')
    expect(reasonLabel({ kind: 'folder-gone' })).toBe('folder gone')
  })
})
