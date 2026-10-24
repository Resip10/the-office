import { vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { SessionRecord, SessionsPayload } from '../../../desktop/src/core/types'
import { mockApi, makePayload } from './bridge'
import { Popover } from '../views/Popover'
import { Window } from '../views/Window'

const NOW = Date.now()
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

function rec(id: string, over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    tool: 'claude', id, filePath: `C:\\x\\${id}.jsonl`, title: `Session ${id.slice(0, 4)}`, titleSource: 'ai',
    projectPath: 'C:\\projects\\app', projectExists: true, gitBranch: 'main', entrypoint: 'cli', version: '2.1.302',
    createdAt: NOW - 7_200_000, lastActivityAt: NOW - 3_600_000, messageCount: 5, fileSize: 2048, contextTokens: null,
    model: null, costUSD: null, prUrls: [], lastPrompt: null, awaySummary: null, continuedInId: null, editCount: 0,
    subagentCount: 0, live: null, agents: [], ...over,
  }
}

function mockBridge(payload: Partial<SessionsPayload>) {
  window.sessionTray = mockApi(makePayload(payload))
}

describe('Popover', () => {
  it('shows Running and Recent sections from the bridge payload', () => {
    mockBridge({
      records: [rec(A, { title: 'Live one', live: { pid: 1, status: 'busy', name: null, updatedAt: NOW, waitingFor: null, statusUpdatedAt: null } }), rec(B, { title: 'Old one' })],
      pins: [], legacyHooks: false,
    })
    render(<Popover />)
    const running = screen.getByText('Running', { selector: 'h2' }).closest('section') as HTMLElement
    const recent = screen.getByText('Recent', { selector: 'h2' }).closest('section') as HTMLElement
    expect(within(running).getByText('Live one')).toBeInTheDocument()
    expect(within(recent).getByText('Old one')).toBeInTheDocument()
  })

  it('a waiting session shows the notifications tip; Turn on enables them', () => {
    mockBridge({ records: [rec(A, { live: { pid: 1, status: 'waiting', name: null, updatedAt: NOW, waitingFor: 'input needed', statusUpdatedAt: NOW } })] })
    render(<Popover />)
    expect(screen.getByText(/waiting for input/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }))
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ notify: true })
  })

  it('closing the tip retires it', () => {
    mockBridge({ records: [rec(A, { live: { pid: 1, status: 'waiting', name: null, updatedAt: NOW, waitingFor: 'input needed', statusUpdatedAt: NOW } })] })
    render(<Popover />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss tip' }))
    expect(window.sessionTray.dismissNotifyTip).toHaveBeenCalled()
  })

  it('no tip once it is done, when notifications are on, or with nothing waiting', () => {
    const waitingRec = rec(A, { live: { pid: 1, status: 'waiting', name: null, updatedAt: NOW, waitingFor: 'input needed', statusUpdatedAt: NOW } })
    for (const payload of [
      { records: [waitingRec], notifyTipDone: true },
      { records: [waitingRec], settings: { ...makePayload().settings, notify: true } },
      { records: [rec(A)] },
    ]) {
      mockBridge(payload)
      const { unmount } = render(<Popover />)
      expect(screen.queryByRole('button', { name: 'Turn on' })).toBeNull()
      unmount()
    }
  })

  it('shows the legacy hooks banner and removes on click', () => {
    mockBridge({ records: [rec(A)], pins: [], legacyHooks: true })
    render(<Popover />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(window.sessionTray.removeLegacyHooks).toHaveBeenCalled()
  })

  it("shows 'Scanning…', not the empty state, until the first payload arrives", () => {
    mockBridge({ records: [], pins: [], legacyHooks: false })
    window.sessionTray.onUpdate = vi.fn(() => () => {}) // never delivers
    render(<Popover />)
    expect(screen.getByText('Scanning…')).toBeInTheDocument()
    expect(screen.queryByText('No Claude Code sessions found in ~/.claude/projects')).toBeNull()
  })

  it('empty state when there are no sessions', () => {
    mockBridge({ records: [], pins: [], legacyHooks: false })
    render(<Popover />)
    expect(screen.getByText('No Claude Code sessions found in ~/.claude/projects')).toBeInTheDocument()
  })

  it('search filters the list', () => {
    mockBridge({ records: [rec(A, { title: 'Login page' }), rec(B, { title: 'Payments' })], pins: [], legacyHooks: false })
    render(<Popover />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'login' } })
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Payments')).toBeNull()
  })
})

describe('Popover footer and headers', () => {
  it('section headers show their count', () => {
    mockBridge({ records: [rec(A, { live: { pid: 1, status: 'busy', name: null, updatedAt: NOW, waitingFor: null, statusUpdatedAt: null } })], pins: [], legacyHooks: false })
    render(<Popover />)
    const header = screen.getByText('Running', { selector: 'h2' })
    expect(within(header).getByText('1')).toBeInTheDocument()
  })

  it('footer shows totals and opens the window', () => {
    mockBridge({ records: [rec(A), rec(B)], pins: [], legacyHooks: false })
    render(<Popover />)
    expect(screen.getByText('2 sessions · 1 project')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open window' }))
    expect(window.sessionTray.openWindow).toHaveBeenCalledWith()
  })
})

describe('Popover stale count', () => {
  it('shows N stale and opens the Cleanup view', () => {
    mockBridge({ records: [rec(A, { lastActivityAt: NOW - 40 * 86_400_000 }), rec(B, { lastActivityAt: NOW - 50 * 86_400_000 })] })
    render(<Popover />)
    fireEvent.click(screen.getByRole('button', { name: '2 stale' }))
    expect(window.sessionTray.openWindow).toHaveBeenCalledWith({ view: 'cleanup' })
  })

  it('archived sessions are left out of the footer count', () => {
    mockBridge({ records: [rec(A), rec(B)], archived: [B] })
    render(<Popover />)
    expect(screen.getByText('1 session · 1 project')).toBeInTheDocument()
  })

  it('hides the stale count when nothing is stale', () => {
    mockBridge({ records: [rec(A)] })
    render(<Popover />)
    expect(screen.queryByRole('button', { name: /stale/ })).toBeNull()
  })
})

describe('Window', () => {
  it('selects the session main asks it to open', () => {
    let opened: ((o: { id?: string }) => void) | undefined
    mockBridge({ records: [rec(A, { title: 'Peeked' })], pins: [], legacyHooks: false })
    window.sessionTray.onOpen = vi.fn(cb => { opened = cb; return () => {} })
    render(<Window />)
    act(() => opened?.({ id: A }))
    expect(screen.getByRole('heading', { name: 'Peeked' })).toBeInTheDocument()
  })

  it('selecting a row shows its details and resume command', () => {
    mockBridge({ records: [rec(A, { title: 'Pick me', prUrls: ['https://github.com/acme/app/pull/7'] })], pins: [], legacyHooks: false })
    render(<Window />)
    expect(screen.getByText('Select a session to see details')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Pick me'))
    expect(screen.getByRole('heading', { name: 'Pick me' })).toBeInTheDocument()
    expect(screen.getByText(`cd 'C:\\projects\\app'; claude --resume ${A}`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'https://github.com/acme/app/pull/7' }))
    expect(window.sessionTray.openUrl).toHaveBeenCalledWith('https://github.com/acme/app/pull/7')
  })

  it("resume command uses the bridge platform's quoting (PowerShell doubles ')", () => {
    mockBridge({ records: [rec(A, { title: 'Quote', projectPath: "C:\\Bob's app" })], pins: [], legacyHooks: false })
    render(<Window />)
    fireEvent.click(screen.getByText('Quote'))
    expect(screen.getByText(`cd 'C:\\Bob''s app'; claude --resume ${A}`)).toBeInTheDocument()
  })

  it("'Continued in →' selects the successor, even outside the time range", () => {
    mockBridge({
      records: [rec(A, { title: 'First part', continuedInId: B }), rec(B, { title: 'Second part', lastActivityAt: NOW - 40 * 86_400_000 })],
      pins: [], legacyHooks: false,
    })
    render(<Window />)
    fireEvent.click(screen.getByText('First part'))
    const detail = screen.getByRole('region', { name: 'Session details' })
    fireEvent.click(within(detail).getByRole('button', { name: 'Continued in →' }))
    expect(screen.getByRole('heading', { name: 'Second part' })).toBeInTheDocument()
  })
})

describe('overview line', () => {
  const HOUR = 3_600_000
  const snapshot = {
    capturedAt: Date.now(),
    fiveHour: { usedPct: 11, resetsAt: Date.now() + 2 * HOUR + 30 * 60_000 },
    sevenDay: { usedPct: 85, resetsAt: Date.now() + 3 * 24 * HOUR },
    sessionId: null, effort: null, thinking: null, text: null,
  }
  const busy = { pid: 1, status: 'busy', name: null, updatedAt: NOW, waitingFor: null, statusUpdatedAt: null }

  it('shows the app items, then status line items in their own marked group', () => {
    mockBridge({ records: [rec(A, { live: busy })], statusline: snapshot, statuslineLinked: true })
    render(<Popover />)
    const stats = screen.getByLabelText('Overview')
    expect(within(stats).getByText('1 running')).toBeInTheDocument()
    const fromStatusline = within(stats).getByRole('group', { name: 'From your Claude Code status line' })
    expect(within(fromStatusline).getByText(/^11% · resets 2h \d+m$/)).not.toHaveClass('text-run')
    expect(within(fromStatusline).getByText(/^85% · resets/)).toHaveClass('text-run')
  })

  it('the cog opens Settings on the Overview section', () => {
    mockBridge({ records: [rec(A)] })
    render(<Popover />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit overview' }))
    expect(window.sessionTray.openSettings).toHaveBeenCalledWith('overview')
  })

  it('no status line group until one is connected; old data says how old', () => {
    mockBridge({ records: [rec(A)], statusline: null })
    const { unmount } = render(<Popover />)
    expect(screen.queryByRole('group', { name: 'From your Claude Code status line' })).toBeNull()
    unmount()
    mockBridge({ records: [rec(A)], statusline: { ...snapshot, capturedAt: Date.now() - 2 * HOUR }, statuslineLinked: true })
    render(<Popover />)
    expect(screen.getByText('as of 2h ago')).toBeInTheDocument()
  })

  it('the window header shows the overview line', () => {
    mockBridge({ records: [rec(A, { costUSD: 2.5, lastActivityAt: Date.now() })], statusline: snapshot, statuslineLinked: true })
    render(<Window />)
    const stats = screen.getByLabelText('Overview')
    expect(within(stats).getByText('≈ $2.50 this week')).toBeInTheDocument()
    expect(within(stats).getByText(/^11%/)).toBeInTheDocument()
  })
})
