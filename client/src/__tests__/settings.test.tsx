import { fireEvent, render, screen, within } from '@testing-library/react'
import type { SessionsPayload } from '../../../desktop/src/core/types'
import { mockApi, makePayload } from './bridge'
import { Settings } from '../views/Settings'

function mockBridge(over: Partial<SessionsPayload> = {}) {
  window.sessionTray = mockApi(makePayload(over))
}

describe('Settings', () => {
  beforeEach(() => mockBridge())

  it('has a sidebar with the P1 sections', () => {
    render(<Settings />)
    const nav = screen.getByRole('navigation', { name: 'Settings sections' })
    for (const name of ['General', 'Appearance', 'Terminal', 'Cleanup']) {
      expect(within(nav).getByRole('button', { name })).toBeEnabled()
    }
  })

  it('Cleanup edits the idle threshold and turns rules off', () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Cleanup' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Idle days' }), { target: { value: '45' } })
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ stale: { idleDays: 45, trivialMessages: 3, missingFolder: true } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Idle days' }), { target: { value: '' } })
    expect(window.sessionTray.setSettings).toHaveBeenLastCalledWith({ stale: { idleDays: null, trivialMessages: 3, missingFolder: true } })
  })

  it('notifications are off by default; the delay picker offers 1, 5, 15 and 30 minutes', () => {
    render(<Settings />)
    const sw = screen.getByRole('switch', { name: 'Notify when a session needs input' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    const picker = screen.getByRole('combobox', { name: 'Notify after' })
    expect(picker).toBeDisabled()
    expect(within(picker).getAllByRole('option').map(o => o.textContent)).toEqual(['1 min', '5 min', '15 min', '30 min'])
    fireEvent.click(sw)
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ notify: true })
  })

  it('the delay picker saves minutes as a number', () => {
    mockBridge({ settings: { ...makePayload().settings, notify: true } })
    render(<Settings />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Notify after' }), { target: { value: '15' } })
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ notifyAfterMin: 15 })
  })

  it('Plan usage: not connected, with a line to copy into the status line', () => {
    render(<Settings />)
    expect(screen.getByText('Not connected')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copy line' }))
    expect(window.sessionTray.copyText).toHaveBeenCalledWith(expect.stringContaining('~/.session-tray/statusline.json'))
  })

  it('Plan usage: connected shows when it last updated', () => {
    mockBridge({ planUsage: { fiveHour: null, sevenDay: null, capturedAt: Date.now() - 5 * 60_000 } })
    render(<Settings />)
    expect(screen.getByText('Updated 5m ago')).toBeInTheDocument()
  })

  it('pulse switch turns the pulse off', () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Pulse running sessions' }))
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ pulse: false })
  })

  it('density segments set compact', () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }))
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ density: 'compact' })
  })

  it('launch at login switch', () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('switch', { name: 'Launch at login' }))
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ launchAtLogin: true })
  })

  it('terminal choice shows the command it will run', () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Terminal' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Open sessions in' }), { target: { value: 'powershell' } })
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ terminal: 'powershell' })
    expect(screen.getByText(/claude --resume/)).toBeInTheDocument()
  })

  it('terminal preview reflects whether Windows Terminal is installed', () => {
    mockBridge({ hasWt: false })
    const { unmount } = render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Terminal' }))
    expect(screen.getByText(/^cmd\.exe/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Windows Terminal (not installed)' })).toBeInTheDocument()
    unmount()

    mockBridge({ hasWt: true })
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Terminal' }))
    expect(screen.getByText(/^wt\.exe/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Windows Terminal' })).toBeInTheDocument()
  })

  it('offers five themes with Carbon as the default', () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    const group = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(within(group).getAllByRole('radio')).toHaveLength(5)
    expect(within(group).getByRole('radio', { name: 'Carbon' })).toHaveAttribute('aria-checked', 'true')
    expect(within(group).getByText('default')).toBeInTheDocument()
    fireEvent.click(within(group).getByRole('radio', { name: 'Midnight' }))
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ theme: 'midnight' })
  })

  it('follow system appearance switch', () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Follow system appearance' }))
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ followSystem: true })
  })
})
