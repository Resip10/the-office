import { fireEvent, render, screen, within } from '@testing-library/react'
import type { SessionRecord, SessionsPayload } from '../../../desktop/src/core/types'
import { Cleanup } from '../views/Cleanup'
import { mockApi, makePayload } from './bridge'

const NOW = Date.now()
const DAY = 86_400_000
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333']

function rec(id: string, over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    tool: 'claude', id, filePath: `C:\\x\\${id}.jsonl`, title: `Session ${id.slice(0, 1)}`, titleSource: 'ai',
    projectPath: 'C:\\projects\\app', projectExists: true, gitBranch: 'main', entrypoint: 'cli', version: '2.1.302',
    createdAt: NOW - 50 * DAY, lastActivityAt: NOW - 40 * DAY, messageCount: 10, fileSize: 1024 * 1024, contextTokens: null,
    model: null, costUSD: null, prUrls: [], lastPrompt: null, awaySummary: null, continuedInId: null, editCount: 1,
    subagentCount: 0, live: null, ...over,
  }
}

function setup(over: Partial<SessionsPayload> = {}) {
  const payload = makePayload({
    records: [
      rec(ids[0]),
      rec(ids[1], { lastActivityAt: NOW - DAY, messageCount: 1, editCount: 0 }),
      rec(ids[2], { lastActivityAt: NOW - DAY }),
    ],
    ...over,
  })
  window.sessionTray = mockApi(payload)
  render(<Cleanup />)
}

describe('Cleanup', () => {
  it('shows the stale count, rule cards with counts and the table', () => {
    setup()
    expect(screen.getByRole('heading', { name: '2 sessions look stale' })).toBeInTheDocument()
    const rules = screen.getByRole('group', { name: 'Rules' })
    expect(within(rules).getByRole('checkbox', { name: /No activity for 30d/ })).toBeChecked()
    const table = screen.getByRole('table')
    expect(within(table).getByText('idle 40d')).toBeInTheDocument()
    expect(within(table).getByText('trivial')).toBeInTheDocument()
  })

  it('all rows start checked; unchecking one updates the Archive button', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Archive 2' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Session 1' }))
    expect(screen.getByRole('button', { name: 'Archive 1' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Archive 1' }))
    expect(window.sessionTray.archive).toHaveBeenCalledWith([ids[1]])
  })

  it('Keep all keeps every stale session', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Keep all' }))
    expect(window.sessionTray.keep).toHaveBeenCalledWith([ids[0], ids[1]])
  })

  it('a rule card turns its rule off', () => {
    setup()
    fireEvent.click(screen.getByRole('checkbox', { name: /No activity for 30d/ }))
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ stale: { idleDays: null, trivialMessages: 3, missingFolder: true } })
  })

  it('the Archive tab lists archived sessions with Restore', () => {
    setup({ archived: [ids[2]] })
    fireEvent.click(screen.getByRole('tab', { name: 'Archive' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(window.sessionTray.restore).toHaveBeenCalledWith([ids[2]])
  })

  it('the Archive tab count skips archived ids whose transcripts are gone', () => {
    setup({ archived: [ids[2], '99999999-9999-4999-8999-999999999999'] })
    expect(screen.getByRole('tab', { name: 'Archive' })).toHaveTextContent(/^Archive · 1$/)
  })
})
