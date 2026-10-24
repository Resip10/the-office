import type { SessionRecord } from '../../../desktop/src/core/types'
import { appOverviewParts } from '../lib/overview'

const NOW = new Date(2026, 9, 23, 15, 0).getTime()
const HOUR = 3_600_000

function rec(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    tool: 'claude', id: 'a', filePath: 'x', title: 't', titleSource: 'ai', projectPath: 'C:\\app', projectExists: true,
    gitBranch: null, entrypoint: null, version: null, createdAt: null, lastActivityAt: NOW - HOUR, messageCount: 5,
    fileSize: 1, contextTokens: null, model: null, costUSD: null, prUrls: [], lastPrompt: null, awaySummary: null,
    continuedInId: null, editCount: 0, subagentCount: 0, live: null, agents: [], ...over,
  }
}
const live = (status: string) => ({ pid: 1, status, name: null, updatedAt: NOW, waitingFor: null, statusUpdatedAt: null })

describe('appOverviewParts', () => {
  const records = [
    rec({ costUSD: 1.5, live: live('busy') }),
    rec({ costUSD: 2, lastActivityAt: NOW - 20 * HOUR, live: live('waiting') }), // yesterday
    rec({ costUSD: 4, lastActivityAt: NOW - 10 * 24 * HOUR }), // older than a week
  ]

  it('counts, costs and sessions today, in the chosen order', () => {
    expect(appOverviewParts(records, ['sessionsToday', 'costToday', 'costWeek', 'running'], NOW).map(p => p.text))
      .toEqual(['1 today', '≈ $1.50 today', '≈ $3.50 this week', '1 running · 1 waiting'])
  })

  it('leaves out empty values and status line items', () => {
    expect(appOverviewParts([rec()], ['running', 'costToday', 'limits'], NOW)).toEqual([])
  })
})
