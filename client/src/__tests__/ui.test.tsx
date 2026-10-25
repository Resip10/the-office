import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyButton } from '../components/ui/copy-button'
import { Stepper } from '../components/ui/stepper'
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

  it('Stepper maps typed text to a positive integer or null', () => {
    const onChange = vi.fn()
    render(<Stepper label="Idle days" value={30} onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Idle days' })
    fireEvent.change(input, { target: { value: '45' } })
    expect(onChange).toHaveBeenLastCalledWith(45)
    for (const v of ['', 'abc', '0', '-5']) {
      fireEvent.change(input, { target: { value: v } })
      expect(onChange).toHaveBeenLastCalledWith(null)
    }
  })

  it('Stepper buttons step, and Decrease at min turns it Off', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Stepper label="Idle days" value={1} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Idle days' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
    rerender(<Stepper label="Idle days" value={null} onChange={onChange} />)
    expect(screen.getByRole('textbox', { name: 'Idle days' })).toHaveAttribute('placeholder', 'Off')
    fireEvent.click(screen.getByRole('button', { name: 'Increase Idle days' }))
    expect(onChange).toHaveBeenLastCalledWith(1)
    rerender(<Stepper label="Idle days" value={30} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Increase Idle days' }))
    expect(onChange).toHaveBeenLastCalledWith(31)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Idle days' }))
    expect(onChange).toHaveBeenLastCalledWith(29)
  })
})
