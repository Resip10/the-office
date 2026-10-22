import { vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { SessionDetails, SessionRecord } from '../../../desktop/src/core/types'
import { handoffPrompt } from '../../../desktop/src/core/handoff-prompt'
import { DetailPanel } from '../components/DetailPanel'
import { mockApi } from './bridge'

const NOW = Date.now()
const A = '11111111-1111-4111-8111-111111111111'

function rec(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    tool: 'claude', id: A, filePath: `C:\\x\\${A}.jsonl`, title: 'Export feature', titleSource: 'ai',
    projectPath: 'C:\\projects\\app', projectExists: true, gitBranch: 'main', entrypoint: 'cli', version: '2.1.302',
    createdAt: NOW - 9_672_000, lastActivityAt: NOW - 12_000, messageCount: 12, fileSize: 2048, contextTokens: 118_000,
    model: 'claude-opus-5-5', costUSD: 4.82, prUrls: [], lastPrompt: null, awaySummary: null, continuedInId: null, editCount: 2,
    subagentCount: 3, live: null, ...over,
  }
}

const DETAILS: SessionDetails = {
  handoff: { source: 'extract', summary: null, goal: 'Build the export feature', lastAsk: 'Add CSV', files: ['src\\a.ts'], branch: 'main', lastAnswer: 'Done.' },
  peek: [
    { role: 'user', text: 'Add CSV', ts: null },
    { role: 'tool', text: 'Edit src\\a.ts', ts: null },
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
    expect(within(peek).getByText('last 3 of 12')).toBeInTheDocument()
    expect(within(peek).getByText('Edit src\\a.ts')).toBeInTheDocument()
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
})
