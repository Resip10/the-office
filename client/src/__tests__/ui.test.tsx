import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyButton } from '../components/ui/copy-button'
import { Tooltip, TooltipProvider } from '../components/ui/tooltip'

describe('ui primitives', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('CopyButton copies, shows Copied, then resets', () => {
    vi.useFakeTimers()
    const onCopy = vi.fn()
    render(<TooltipProvider><CopyButton label="Copy session ID" onCopy={onCopy} /></TooltipProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Copy session ID' }))
    expect(onCopy).toHaveBeenCalledOnce()
    expect(screen.getAllByText('Copied').length).toBeGreaterThan(0)
    act(() => { vi.advanceTimersByTime(1500) })
    expect(screen.queryByText('Copied')).toBeNull()
  })

  it('CopyButton unmounted mid-feedback leaves no pending update', () => {
    vi.useFakeTimers()
    const err = vi.spyOn(console, 'error')
    const { unmount } = render(<TooltipProvider><CopyButton onCopy={() => {}} /></TooltipProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    unmount()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(err).not.toHaveBeenCalled()
  })

  it('Tooltip shows its content on focus', async () => {
    render(<TooltipProvider><Tooltip content="Full path"><button>p</button></Tooltip></TooltipProvider>)
    await userEvent.tab()
    expect(await screen.findAllByText('Full path')).not.toHaveLength(0)
  })
})
