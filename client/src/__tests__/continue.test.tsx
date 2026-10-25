import { vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SessionDetails, SessionRecord } from '../../../desktop/src/core/types'
import { handoffPrompt } from '../../../desktop/src/core/handoff-prompt'
import { ContinueSheet } from '../components/ContinueSheet'
import { mockApi } from './bridge'

const A = '11111111-1111-4111-8111-111111111111'

function rec(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    tool: 'claude', id: A, filePath: `C:\\x\\${A}.jsonl`, title: 'Export feature', titleSource: 'ai',
    projectPath: 'C:\\projects\\app', projectExists: true, gitBranch: 'main', entrypoint: 'cli', version: '2.1.302',
    createdAt: 0, lastActivityAt: 0, messageCount: 12, fileSize: 2048, contextTokens: null,
    model: null, costUSD: null, prUrls: [], lastPrompt: null, awaySummary: null, continuedInId: null, editCount: 2,
    subagentCount: 0, live: null, agents: [], ...over,
  }
}

const DETAILS: SessionDetails = {
  handoff: { source: 'extract', summary: null, goal: 'Build it', lastAsk: 'Add CSV', files: [], branch: 'main', lastAnswer: 'Done.' },
  peek: [],
  conversation: [],
  lastUser: null,
  messageTotal: 12,
}

function setup(over: Partial<SessionRecord> = {}) {
  window.sessionTray = mockApi()
  const onClose = vi.fn()
  render(<ContinueSheet record={rec(over)} details={DETAILS} onClose={onClose} />)
  return { onClose }
}

describe('ContinueSheet', () => {
  it('prefills the first message with the handoff prompt and shows a token estimate', () => {
    setup()
    const prompt = handoffPrompt(rec(), DETAILS)
    expect(screen.getByRole('textbox', { name: 'First message' })).toHaveValue(prompt)
    expect(screen.getByText(`~${Math.round(prompt.length / 4)} tokens`)).toBeInTheDocument()
  })

  it('opens a terminal with the edited prompt', () => {
    const { onClose } = setup()
    fireEvent.change(screen.getByRole('textbox', { name: 'First message' }), { target: { value: 'Edited' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open in terminal' }))
    expect(window.sessionTray.continueIn).toHaveBeenCalledWith(A, { folder: 'C:\\projects\\app', prompt: 'Edited', target: 'claude' })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the command for Claude Code, hides it for Clipboard only', () => {
    setup()
    expect(screen.getByText(/claude "Continuing from session/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Clipboard only/ }))
    expect(screen.queryByText(/claude "Continuing from session/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(window.sessionTray.continueIn).toHaveBeenCalledWith(A, expect.objectContaining({ target: 'clipboard' }))
  })

  it('a missing project folder must be replaced before opening', async () => {
    setup({ projectExists: false })
    const open = screen.getByRole('button', { name: 'Open in terminal' })
    expect(open).toBeDisabled()
    window.sessionTray.pickFolder = vi.fn(async () => 'D:\\elsewhere')
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    await waitFor(() => expect(open).toBeEnabled())
    fireEvent.click(open)
    expect(window.sessionTray.continueIn).toHaveBeenCalledWith(A, expect.objectContaining({ folder: 'D:\\elsewhere' }))
  })

  it('Cancel closes without launching', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(window.sessionTray.continueIn).not.toHaveBeenCalled()
  })
})
