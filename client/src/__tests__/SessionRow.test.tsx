import { vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { SessionRecord } from '../../../desktop/src/core/types'
import { SessionRow } from '../components/SessionRow'
import { mockApi } from './bridge'

const NOW = new Date(2026, 9, 19, 15, 0).getTime()
const ID = '0c29cf4c-54bc-4ff4-9393-82f33c39613d'

function rec(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    tool: 'claude', id: ID, filePath: `C:\\x\\${ID}.jsonl`, title: 'Leaderboards feature', titleSource: 'ai',
    projectPath: 'C:\\projects\\pavchman', projectExists: true, gitBranch: 'main', entrypoint: 'cli', version: '2.1.302',
    createdAt: NOW - 86_400_000, lastActivityAt: NOW - 2 * 3_600_000, messageCount: 42, fileSize: 1000,
    contextTokens: 157_000, model: 'claude-opus-5-5', costUSD: 1.25, prUrls: [], lastPrompt: null, awaySummary: null,
    continuedInId: null, editCount: 0, subagentCount: 0, live: null, ...over,
  }
}

const api = mockApi()

beforeEach(() => {
  vi.clearAllMocks()
  window.sessionTray = api
})

const renderRow = (over: Partial<SessionRecord> = {}, props: Partial<Parameters<typeof SessionRow>[0]> = {}) =>
  render(<SessionRow record={rec(over)} pinned={false} now={NOW} continuedListed={false} onSelect={vi.fn()} {...props} />)

describe('SessionRow', () => {
  it('renders title, project · branch and relative time', () => {
    renderRow()
    expect(screen.getByText('Leaderboards feature')).toBeInTheDocument()
    expect(screen.getByText('pavchman · main')).toBeInTheDocument()
    expect(screen.getByText('2h ago')).toBeInTheDocument()
    expect(screen.getByText('42 msg')).toBeInTheDocument()
  })

  it('disables Resume when the project folder is gone', () => {
    renderRow({ projectExists: false })
    const resume = screen.getByRole('button', { name: 'Resume' })
    expect(resume).toBeDisabled()
    expect(resume).toHaveAttribute('title', 'Project folder no longer exists')
  })

  it("labels Resume 'Open another' when the session is running", () => {
    renderRow({ live: { pid: 1, status: 'busy', name: null, updatedAt: NOW } })
    expect(screen.getByRole('button', { name: 'Open another' })).toBeEnabled()
  })

  it('Resume, Copy and Pin call the bridge with the session id', () => {
    renderRow()
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }))
    expect(api.resume).toHaveBeenCalledWith(ID)
    expect(api.copy).toHaveBeenCalledWith(ID)
    expect(api.togglePin).toHaveBeenCalledWith(ID)
  })

  it("pinned rows offer 'Unpin' with a pressed, filled pin", () => {
    renderRow({}, { pinned: true })
    const unpin = screen.getByRole('button', { name: 'Unpin' })
    expect(unpin).toHaveAttribute('aria-pressed', 'true')
    expect(unpin.querySelector('svg')).toHaveAttribute('fill', 'currentColor')
  })

  it('unpinned rows show an outline pin, not pressed', () => {
    renderRow()
    const pin = screen.getByRole('button', { name: 'Pin' })
    expect(pin).toHaveAttribute('aria-pressed', 'false')
    expect(pin.querySelector('svg')).toHaveAttribute('fill', 'none')
  })

  it("shows 'Continued in →' and dims the row when the successor is listed", () => {
    const onSelect = vi.fn()
    const succ = '22222222-2222-4222-8222-222222222222'
    const { container } = renderRow({ continuedInId: succ }, { continuedListed: true, onSelect })
    expect(container.firstChild).toHaveClass('opacity-60')
    fireEvent.click(screen.getByRole('button', { name: 'Continued in →' }))
    expect(onSelect).toHaveBeenCalledWith(succ)
  })

  it('no continued link when the successor is not listed', () => {
    renderRow({ continuedInId: '22222222-2222-4222-8222-222222222222' }, { continuedListed: false })
    expect(screen.queryByRole('button', { name: 'Continued in →' })).toBeNull()
  })

  it('window rows add model, ≈ API cost and context', () => {
    renderRow({}, { variant: 'window' })
    expect(screen.getByText('claude-opus-5-5 · ≈ $1.25 · 157k ctx')).toBeInTheDocument()
  })

  it('popover rows offer Peek, which opens the window on that session', () => {
    renderRow({}, { variant: 'popover' })
    fireEvent.click(screen.getByRole('button', { name: 'Peek' }))
    expect(api.openWindow).toHaveBeenCalledWith({ id: ID })
  })

  it('window rows have no Peek', () => {
    renderRow({}, { variant: 'window' })
    expect(screen.queryByRole('button', { name: 'Peek' })).toBeNull()
  })

  it('a running dot pulses only when pulse is on', () => {
    const { container, rerender } = renderRow({ live: { pid: 1, status: 'busy', name: null, updatedAt: NOW } })
    expect(container.querySelector('[title="running"]')).toHaveClass('pulse')
    rerender(<SessionRow record={rec({ live: { pid: 1, status: 'busy', name: null, updatedAt: NOW } })} pinned={false} now={NOW} continuedListed={false} onSelect={vi.fn()} pulse={false} />)
    expect(container.querySelector('[title="running"]')).not.toHaveClass('pulse')
  })
})
