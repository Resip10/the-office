import { vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { SessionDetails, SessionRecord } from '../../../desktop/src/core/types'
import { handoffPrompt } from '../../../desktop/src/core/handoff-prompt'
import { DetailPanel } from '../components/DetailPanel'
import { makePayload, mockApi } from './bridge'

const NOW = Date.now()
const A = '11111111-1111-4111-8111-111111111111'

function rec(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    tool: 'claude', id: A, filePath: `C:\\x\\${A}.jsonl`, title: 'Export feature', titleSource: 'ai',
    projectPath: 'C:\\projects\\app', projectExists: true, gitBranch: 'main', entrypoint: 'cli', version: '2.1.302',
    createdAt: NOW - 9_672_000, lastActivityAt: NOW - 12_000, messageCount: 12, fileSize: 2048, contextTokens: 118_000,
    model: 'claude-opus-5-5', costUSD: 4.82, prUrls: [], lastPrompt: null, awaySummary: null, continuedInId: null, editCount: 2,
    subagentCount: 3, live: null, agents: [], ...over,
  }
}

const DETAILS: SessionDetails = {
  handoff: { source: 'extract', summary: null, goal: 'Build the export feature', lastAsk: 'Add CSV', files: ['src\\a.ts'], branch: 'main', lastAnswer: 'Done.' },
  peek: [
    { role: 'user', text: 'Add CSV', ts: null },
    { role: 'tool', text: 'Edit src\\a.ts', ts: null },
    { role: 'assistant', text: 'Done.', ts: null },
  ],
  conversation: [
    { role: 'user', text: 'Add CSV', ts: null },
    { role: 'assistant', text: 'Done.', ts: null },
  ],
  messageTotal: 12,
}

function setup(details: SessionDetails | null) {
  window.sessionTray = mockApi()
  window.sessionTray.details = vi.fn(async () => details)
  render(<DetailPanel record={rec()} pinned={false} continuedListed={false} onSelect={vi.fn()} />)
}

describe('DetailPanel', () => {
  it('hides the agents section when only old finished agents are left', () => {
    window.sessionTray = mockApi()
    window.sessionTray.details = vi.fn(async () => null)
    const live = { pid: 1, status: 'idle', name: null, updatedAt: 0, waitingFor: null, statusUpdatedAt: null }
    render(<DetailPanel record={rec({ live, agents: [
      { id: 'c', description: 'Yesterday', agentType: null, model: 'haiku', startedAt: null, lastActivityAt: Date.now() - 86_400_000, running: false },
    ] })} pinned={false} continuedListed={false} onSelect={vi.fn()} />)
    expect(screen.queryByText(/^Agents/)).toBeNull()
  })

  it('lists agents of a live session, running first, finished as done', () => {
    window.sessionTray = mockApi()
    window.sessionTray.details = vi.fn(async () => null)
    const live = { pid: 1, status: 'busy', name: null, updatedAt: 0, waitingFor: null, statusUpdatedAt: null }
    render(<DetailPanel record={rec({ live, agents: [
      { id: 'a', description: 'Code review', agentType: 'general-purpose', model: 'opus', startedAt: null, lastActivityAt: Date.now(), running: true },
      { id: 'b', description: 'Find parser', agentType: 'Explore', model: null, startedAt: null, lastActivityAt: Date.now() - 60_000, running: false },
      { id: 'c', description: 'Yesterday', agentType: 'Explore', model: null, startedAt: null, lastActivityAt: Date.now() - 86_400_000, running: false },
    ] })} pinned={false} continuedListed={false} onSelect={vi.fn()} />)
    expect(screen.getByText('Agents · 1 running · 1 done · 1 done earlier')).toBeInTheDocument()
    expect(screen.queryByText('Yesterday')).toBeNull()
    expect(screen.getByText('opus')).toBeInTheDocument()
    expect(screen.getByText('Explore · done')).toBeInTheDocument()
  })

  it('shows the stat strip', () => {
    setup(DETAILS)
    for (const label of ['Messages', 'Context', '≈ API cost', 'Active']) expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByText('2h 41m')).toBeInTheDocument()
    expect(screen.getByText('3 subagents')).toBeInTheDocument()
  })

  it('shows the handoff and message peek once details load', async () => {
    setup(DETAILS)
    const handoff = await screen.findByRole('region', { name: 'Handoff' })
    expect(within(handoff).getByText('extracted')).toBeInTheDocument()
    expect(within(handoff).getByText('Build the export feature')).toBeInTheDocument()
    const peek = screen.getByRole('region', { name: 'Messages' })
    expect(within(peek).getByText('last 2 of 12')).toBeInTheDocument()
    expect(within(peek).queryByText('Edit src\\a.ts')).toBeNull()
  })

  it('Show tools adds tool calls to the peek and is remembered in settings', async () => {
    window.sessionTray = mockApi()
    window.sessionTray.details = vi.fn(async () => DETAILS)
    const { rerender } = render(<DetailPanel record={rec()} pinned={false} continuedListed={false} onSelect={vi.fn()} />)
    const peek = await screen.findByRole('region', { name: 'Messages' })
    fireEvent.click(within(peek).getByRole('switch', { name: 'Show tools' }))
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ peekTools: true })
    rerender(<DetailPanel record={rec()} pinned={false} continuedListed={false} onSelect={vi.fn()} showTools />)
    expect(within(screen.getByRole('region', { name: 'Messages' })).getByText('Edit src\\a.ts')).toBeInTheDocument()
    expect(screen.getByText('last 3 of 12')).toBeInTheDocument()
  })

  it('Copy as prompt copies the handoff prompt', async () => {
    setup(DETAILS)
    fireEvent.click(await screen.findByRole('button', { name: 'Copy as prompt' }))
    expect(window.sessionTray.copyText).toHaveBeenCalledWith(handoffPrompt({ title: 'Export feature', id: A }, DETAILS))
  })

  it('without details it still shows stats and the command, but no cards', async () => {
    setup(null)
    await waitFor(() => expect(window.sessionTray.details).toHaveBeenCalledWith(A))
    expect(screen.getByText('Messages')).toBeInTheDocument()
    expect(screen.getByText(`cd 'C:\\projects\\app'; claude --resume ${A}`)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Handoff' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Messages' })).toBeNull()
  })

  it('keeps Resume, Reveal file and Pin', () => {
    setup(DETAILS)
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reveal file' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pin' })).toBeInTheDocument()
  })

  it('rename: pencil opens an input; Enter saves, Esc cancels', () => {
    setup(DETAILS)
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByRole('textbox', { name: 'Session name' })
    expect(input).toHaveValue('Export feature')
    fireEvent.change(input, { target: { value: 'New' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(window.sessionTray.rename).toHaveBeenCalledWith(A, 'New')

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Session name' }), { key: 'Escape' })
    expect(window.sessionTray.rename).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('textbox', { name: 'Session name' })).toBeNull()
  })

  it('Archive archives one session and is disabled while it runs', () => {
    setup(DETAILS)
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(window.sessionTray.archive).toHaveBeenCalledWith([A])
  })

  it("switching sessions never shows the previous session's handoff", async () => {
    const B = '22222222-2222-4222-8222-222222222222'
    window.sessionTray = mockApi()
    window.sessionTray.details = vi.fn(async (id: string) => (id === A ? DETAILS : new Promise<null>(() => {})))
    const { rerender } = render(<DetailPanel record={rec()} pinned={false} continuedListed={false} onSelect={vi.fn()} />)
    await screen.findByRole('region', { name: 'Handoff' })
    rerender(<DetailPanel record={rec({ id: B, title: 'Other' })} pinned={false} continuedListed={false} onSelect={vi.fn()} />)
    expect(screen.queryByRole('region', { name: 'Handoff' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Continue in…' })).toBeDisabled()
  })

  it("the session's status line text, effort and thinking show quietly, marked as such", () => {
    const r = rec()
    window.sessionTray = mockApi(makePayload({ statuslineLinked: true, sessionExtras: { [r.id]: { text: 'Opus 5.5 | main', effort: 'high', thinking: true } } }))
    render(<DetailPanel record={r} pinned={false} continuedListed={false} onSelect={vi.fn()} />)
    expect(screen.getByLabelText('From your Claude Code status line')).toHaveTextContent('Opus 5.5 | main · effort high · thinking on')
  })

  it('no status line row when nothing is known for the session', () => {
    window.sessionTray = mockApi(makePayload())
    render(<DetailPanel record={rec()} pinned={false} continuedListed={false} onSelect={vi.fn()} />)
    expect(screen.queryByLabelText('From your Claude Code status line')).toBeNull()
  })

  it('Archive is disabled for a running session', () => {
    window.sessionTray = mockApi()
    render(<DetailPanel record={rec({ live: { pid: 1, status: 'busy', name: null, updatedAt: NOW, waitingFor: null, statusUpdatedAt: null } })} pinned={false} continuedListed={false} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled()
  })
})
