import { vi } from 'vitest'
import { useState } from 'react'
import { act, fireEvent, render as rtlRender, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Handoff, PluggedIn, SessionDetails, SessionRecord } from '../../../desktop/src/core/types'
import { handoffPrompt } from '../../../desktop/src/core/handoff-prompt'
import { DetailPanel } from '../components/DetailPanel'
import type { DetailTab } from '../components/details/types'
import { TooltipProvider } from '../components/ui/tooltip'
import { makePayload, mockApi } from './bridge'

const NOW = Date.now()
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const LIVE = { pid: 1, status: 'busy', name: null, updatedAt: NOW, waitingFor: null, statusUpdatedAt: null }

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

const withHandoff = (h: Partial<Handoff>): SessionDetails => ({ ...DETAILS, handoff: { ...DETAILS.handoff, ...h } })

type Extra = { pinned?: boolean; continuedListed?: boolean; onSelect?: (id: string) => void; showTools?: boolean; tab?: DetailTab }

// Holds the tab like Window does, so clicking a tab switches it.
function Harness({ r, x }: { r: SessionRecord; x: Extra }) {
  const [tab, setTab] = useState<DetailTab>(x.tab ?? 'messages')
  return (
    <DetailPanel
      record={r}
      pinned={x.pinned ?? false}
      continuedListed={x.continuedListed ?? false}
      onSelect={x.onSelect ?? vi.fn()}
      showTools={x.showTools}
      tab={tab}
      onTabChange={setTab}
    />
  )
}

const panel = (r: SessionRecord, x: Extra = {}) => (
  <TooltipProvider>
    <Harness r={r} x={x} />
  </TooltipProvider>
)

// Renders and lets the details / plugged-in loads settle, so no update lands outside act().
async function show(r: SessionRecord = rec(), details: SessionDetails | null = DETAILS, x: Extra = {}, api = mockApi()) {
  window.sessionTray = api
  window.sessionTray.details = vi.fn(async () => details)
  const view = rtlRender(panel(r, x))
  await act(async () => {})
  return view
}

describe('DetailPanel header', () => {
  it('shows the title, Resume and Continue in…', async () => {
    await show()
    expect(screen.getByRole('heading', { name: 'Export feature' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Continue in…' })).toBeEnabled()
  })

  it('reads Open another while running, with the state as a word', async () => {
    await show(rec({ live: LIVE }))
    expect(screen.getByRole('button', { name: 'Open another' })).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.queryByText(/pid/)).toBeNull()
  })

  it('an untitled session shows Untitled session, muted', async () => {
    await show(rec({ titleSource: 'none', title: 'abc' }))
    expect(screen.getByRole('heading', { name: 'Untitled session' })).toHaveClass('text-muted')
  })

  it('renaming an untitled session starts from an empty field', async () => {
    await show(rec({ titleSource: 'none', title: 'abc' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    expect(screen.getByRole('textbox', { name: 'Session name' })).toHaveValue('')
  })

  it('a very long title truncates', async () => {
    const title = 'x'.repeat(300)
    await show(rec({ title }))
    expect(screen.getByRole('heading', { name: title })).toHaveClass('truncate')
  })

  it('More actions opens Pin, Reveal file, Open transcript, Archive', async () => {
    const user = userEvent.setup()
    await show()
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    const items = screen.getAllByRole('menuitem').map(i => i.textContent)
    expect(items).toEqual(['Pin', 'Reveal file', 'Open transcript', 'Archive'])
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }))
    expect(window.sessionTray.archive).toHaveBeenCalledWith([A])
  })

  it('menu items act: Unpin toggles, Reveal file and Open transcript reveal', async () => {
    const user = userEvent.setup()
    await show(rec(), DETAILS, { pinned: true })
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Unpin' }))
    expect(window.sessionTray.togglePin).toHaveBeenCalledWith(A)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Reveal file' }))
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Open transcript' }))
    expect(window.sessionTray.reveal).toHaveBeenCalledTimes(2)
    expect(window.sessionTray.reveal).toHaveBeenCalledWith(A)
  })

  it('Archive is disabled for a live session', async () => {
    const user = userEvent.setup()
    await show(rec({ live: LIVE }))
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('subline: project path copy, branch, started and last active', async () => {
    await show(rec({ projectPath: 'C:\\projects\\pavchman', gitBranch: 'feat/export' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy project path' }))
    expect(window.sessionTray.copyText).toHaveBeenCalledWith('C:\\projects\\pavchman')
    expect(screen.getByText('feat/export')).toBeInTheDocument()
    expect(screen.getByText(/^Started .+, last active just now$/)).toBeInTheDocument()
  })

  it('a deep path and long branch truncate and carry the full text in title', async () => {
    const path = 'C:\\' + Array(40).fill('deep').join('\\') + '\\app'
    const branch = `feat/${'x'.repeat(200)}`
    await show(rec({ projectPath: path, gitBranch: branch }))
    for (const text of [path, branch]) {
      const el = screen.getByText(text)
      expect(el).toHaveClass('truncate')
      expect(el).toHaveAttribute('title', text)
    }
  })

  it('marks a missing project folder', async () => {
    await show(rec({ projectExists: false }))
    expect(screen.getByText('(missing)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume' })).toBeDisabled()
  })

  it('Continued in, in the subline, selects the successor', async () => {
    const onSelect = vi.fn()
    await show(rec({ continuedInId: B }), DETAILS, { continuedListed: true, onSelect })
    fireEvent.click(screen.getByRole('button', { name: 'Continued in' }))
    expect(onSelect).toHaveBeenCalledWith(B)
  })

  it('rename: pencil opens an input; Enter saves, Esc cancels', async () => {
    await show()
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
})

describe('DetailPanel id and command', () => {
  it('copies the session id and the resume command', async () => {
    await show()
    fireEvent.click(screen.getByRole('button', { name: 'Copy session ID' }))
    expect(window.sessionTray.copyText).toHaveBeenCalledWith(A)
    fireEvent.click(screen.getByRole('button', { name: 'Copy resume command' }))
    expect(window.sessionTray.copy).toHaveBeenCalledWith(A)
  })

  it('a long command truncates and carries the full text in its tooltip', async () => {
    const path = `C:\\${'deep\\'.repeat(40)}app`
    await show(rec({ projectPath: path }))
    const command = `cd '${path}'; claude --resume ${A}`
    const el = screen.getByText(command)
    expect(el).toHaveClass('truncate')
    await act(async () => { el.focus() })
    expect((await screen.findAllByText(command)).length).toBeGreaterThan(1)
  })
})

describe('DetailPanel summary', () => {
  it('Copy as prompt copies the handoff prompt and reads Copied', async () => {
    await show()
    fireEvent.click(screen.getByRole('button', { name: 'Copy as prompt' }))
    expect(window.sessionTray.copyText).toHaveBeenCalledWith(handoffPrompt({ title: 'Export feature', id: A }, DETAILS))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it.each([
    ['compact', 'from the compaction summary'],
    ['recap', "from Claude's recap"],
    ['extract', 'extracted from the conversation'],
  ] as const)('source %s → %s', async (source, note) => {
    await show(rec(), withHandoff({ source, summary: source === 'extract' ? null : 'We built it.' }))
    expect(within(screen.getByRole('region', { name: 'Summary' })).getByText(note)).toBeInTheDocument()
  })

  it('shows Goal, Last ask and Last answer for an extract', async () => {
    await show()
    const summary = screen.getByRole('region', { name: 'Summary' })
    expect(within(summary).getByText('Build the export feature')).toBeInTheDocument()
    expect(within(summary).getByText('Last answer')).toBeInTheDocument()
  })

  it('shows 3 files, then Show all N expands and Show less collapses', async () => {
    const files = Array.from({ length: 13 }, (_, i) => `src\\file${i}.ts`)
    await show(rec(), withHandoff({ files }))
    const summary = screen.getByRole('region', { name: 'Summary' })
    expect(within(summary).getAllByText(/^src\\file\d+\.ts$/)).toHaveLength(3)
    fireEvent.click(within(summary).getByRole('button', { name: 'Show all 13' }))
    expect(within(summary).getAllByText(/^src\\file\d+\.ts$/)).toHaveLength(13)
    fireEvent.click(within(summary).getByRole('button', { name: 'Show less' }))
    expect(within(summary).getAllByText(/^src\\file\d+\.ts$/)).toHaveLength(3)
  })

  it('shows a skeleton while details load', () => {
    window.sessionTray = mockApi()
    window.sessionTray.details = vi.fn(() => new Promise<null>(() => {}))
    window.sessionTray.pluggedIn = vi.fn(() => new Promise<null>(() => {}))
    rtlRender(panel(rec()))
    expect(screen.getByRole('status', { name: 'Loading summary' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Summary' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Messages' })).toBeInTheDocument()
    expect(within(screen.getByRole('tabpanel')).getByRole('status', { name: 'Loading messages' })).toBeInTheDocument()
  })

  it('without details there is no summary card, but figures and command stay', async () => {
    await show(rec(), null)
    expect(screen.getByText('messages')).toBeInTheDocument()
    expect(screen.getByText(`cd 'C:\\projects\\app'; claude --resume ${A}`)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Summary' })).toBeNull()
    expect(screen.queryByRole('status', { name: 'Loading summary' })).toBeNull()
    expect(within(screen.getByRole('tabpanel')).getByText('No messages to show')).toBeInTheDocument()
  })

  it("switching sessions never shows the previous session's handoff", async () => {
    window.sessionTray = mockApi()
    window.sessionTray.details = vi.fn(async (id: string) => (id === A ? DETAILS : new Promise<null>(() => {})))
    const { rerender } = rtlRender(panel(rec()))
    await screen.findByRole('region', { name: 'Summary' })
    rerender(panel(rec({ id: B, title: 'Other' })))
    expect(screen.queryByRole('region', { name: 'Summary' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Continue in…' })).toBeDisabled()
    await act(async () => {})
  })
})

describe('DetailPanel figures', () => {
  it('shows messages, context with its share, cost and active time', async () => {
    await show(rec({ contextTokens: 215_000 }))
    expect(screen.getByText('messages')).toBeInTheDocument()
    expect(screen.getByText('215k')).toBeInTheDocument()
    expect(screen.getByText('/ 1M')).toBeInTheDocument()
    expect(screen.getByText('context, 22%')).toBeInTheDocument()
    expect(screen.getByText('$4.82')).toBeInTheDocument()
    expect(screen.getByText('≈ API cost')).toBeInTheDocument()
    expect(screen.getByText('2h 41m')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('unknown context and cost show —', async () => {
    await show(rec({ contextTokens: null, costUSD: null, model: null }))
    expect(screen.getByText('context')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })
})

describe('DetailPanel tabs', () => {
  const tab = (name: string | RegExp) => screen.getByRole('tab', { name })
  const panelEl = () => screen.getByRole('tabpanel')
  const PRS = ['https://github.com/o/r/pull/15', 'https://example.com/review/9']

  it('shows tabs with counts; no Agents tab when there are none', async () => {
    await show(rec({ prUrls: PRS, subagentCount: 0 }))
    expect(tab('Messages 12')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Pull requests 2')).toBeInTheDocument()
    expect(tab('Info')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^Agents/ })).toBeNull()
    expect(screen.queryByRole('tab', { name: /^Plugged in/ })).toBeNull()
  })

  it('a remembered tab the session lacks falls back to Messages', async () => {
    await show(rec(), DETAILS, { tab: 'prs' })
    expect(screen.queryByRole('tab', { name: /^Pull requests/ })).toBeNull()
    expect(tab('Messages 12')).toHaveAttribute('aria-selected', 'true')
  })

  it('a remembered tab arriving late does not steal the selection', async () => {
    let resolve: (d: PluggedIn) => void = () => {}
    window.sessionTray = mockApi()
    window.sessionTray.details = vi.fn(async () => DETAILS)
    window.sessionTray.pluggedIn = vi.fn(() => new Promise<PluggedIn>(r => { resolve = r }))
    rtlRender(panel(rec(), { tab: 'plugged' }))
    await act(async () => {})
    expect(tab('Messages 12')).toHaveAttribute('aria-selected', 'true')
    await act(async () => resolve({ loadedAt: null, servers: [], plugins: [{ id: 'p@m', name: 'p', marketplace: 'm', version: null, scope: 'global', enabled: true }] }))
    expect(tab('Plugged in 1')).toHaveAttribute('aria-selected', 'false')
    expect(tab('Messages 12')).toHaveAttribute('aria-selected', 'true')
  })

  it('Messages shows the conversation with a caption', async () => {
    await show()
    expect(within(panelEl()).getByText('Last 2 of 12')).toBeInTheDocument()
    expect(within(panelEl()).queryByText('Edit src\\a.ts')).toBeNull()
  })

  it('Show tool calls sits on Messages only and is remembered in settings', async () => {
    const user = userEvent.setup()
    const { rerender } = await show(rec({ prUrls: PRS }))
    await user.click(screen.getByRole('switch', { name: 'Show tool calls' }))
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ peekTools: true })
    rerender(panel(rec({ prUrls: PRS }), { showTools: true }))
    expect(within(panelEl()).getByText('Edit src\\a.ts')).toBeInTheDocument()
    expect(screen.getByText('Last 3 of 12')).toBeInTheDocument()
    await user.click(tab('Pull requests 2'))
    expect(screen.queryByRole('switch', { name: 'Show tool calls' })).toBeNull()
  })

  it('Pull requests: short label, click opens, Copy link copies the url', async () => {
    const user = userEvent.setup()
    await show(rec({ prUrls: PRS }))
    await user.click(tab('Pull requests 2'))
    const p = panelEl()
    await user.click(within(p).getByRole('button', { name: 'o/r #15' }))
    expect(window.sessionTray.openUrl).toHaveBeenCalledWith(PRS[0])
    expect(within(p).getByRole('button', { name: PRS[1] })).toBeInTheDocument()
    fireEvent.click(within(p).getAllByRole('button', { name: 'Copy link' })[0])
    expect(window.sessionTray.copyText).toHaveBeenCalledWith(PRS[0])
  })

  it('lists agents of a live session, running first, finished as done', async () => {
    const user = userEvent.setup()
    await show(rec({ live: LIVE, agents: [
      { id: 'a', description: 'Code review', agentType: 'general-purpose', model: 'opus', startedAt: null, lastActivityAt: Date.now(), running: true },
      { id: 'b', description: 'Find parser', agentType: 'Explore', model: null, startedAt: null, lastActivityAt: Date.now() - 60_000, running: false },
      { id: 'c', description: 'Yesterday', agentType: 'Explore', model: null, startedAt: null, lastActivityAt: Date.now() - 86_400_000, running: false },
    ] }), null)
    await user.click(tab('Agents 3'))
    const p = panelEl()
    expect(within(p).getByText('1 running, 1 done, 1 done earlier')).toBeInTheDocument()
    expect(within(p).queryByText('Yesterday')).toBeNull()
    expect(within(p).getByText('opus')).toBeInTheDocument()
    expect(within(p).getByText('Explore · done')).toBeInTheDocument()
  })

  it('Show tool calls sits beside the tab list, not inside it', async () => {
    await show()
    const sw = screen.getByRole('switch', { name: 'Show tool calls' })
    expect(sw.closest('[role="tablist"]')).toBeNull()
  })

  it('an ended session counts the subagents that ran', async () => {
    const user = userEvent.setup()
    await show(rec({ subagentCount: 3 }))
    await user.click(tab('Agents 3'))
    expect(within(panelEl()).getByText('3 subagents ran in this session')).toBeInTheDocument()
  })

  it('Info lists surface, version, size, title source, id and pid when live', async () => {
    const user = userEvent.setup()
    await show(rec({ live: { ...LIVE, pid: 4242, name: 'worker' } }))
    await user.click(tab('Info'))
    const p = panelEl()
    for (const [k, v] of [['Surface', 'cli'], ['Claude Code version', '2.1.302'], ['File size', '2 KB'], ['Title from', 'ai'], ['Session ID', A], ['PID', '4242'], ['Live name', 'worker']]) {
      expect(within(p).getByText(k)).toBeInTheDocument()
      expect(within(p).getByText(v)).toBeInTheDocument()
    }
  })

  it('Info has no pid for an ended session', async () => {
    const user = userEvent.setup()
    await show()
    await user.click(tab('Info'))
    expect(within(panelEl()).queryByText('PID')).toBeNull()
  })

  it("Info shows the session's status line text, effort and thinking, marked as such", async () => {
    const user = userEvent.setup()
    const r = rec()
    await show(r, DETAILS, {}, mockApi(makePayload({ statuslineLinked: true, sessionExtras: { [r.id]: { text: 'Opus 5.5 | main', effort: 'high', thinking: true } } })))
    await user.click(tab('Info'))
    expect(within(panelEl()).getByLabelText('From your Claude Code status line')).toHaveTextContent('Opus 5.5 | main, effort high, thinking on')
  })

  it('no status line row when nothing is known for the session', async () => {
    const user = userEvent.setup()
    await show(rec(), DETAILS, {}, mockApi(makePayload()))
    await user.click(tab('Info'))
    expect(screen.queryByLabelText('From your Claude Code status line')).toBeNull()
  })
})
