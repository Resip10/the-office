import userEvent from '@testing-library/user-event'
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
    for (const name of ['General', 'Appearance', 'Overview', 'Terminal', 'Cleanup']) {
      expect(within(nav).getByRole('button', { name })).toBeEnabled()
    }
  })

  it('Cleanup edits the idle threshold and turns rules off', () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Cleanup' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Idle days' }), { target: { value: '45' } })
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ stale: { idleDays: 45, trivialMessages: 3, missingFolder: true } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Idle days' }), { target: { value: '' } })
    expect(window.sessionTray.setSettings).toHaveBeenLastCalledWith({ stale: { idleDays: null, trivialMessages: 3, missingFolder: true } })
  })

  it('notifications are off by default; the delay picker offers 1, 5, 15 and 30 minutes', () => {
    render(<Settings />)
    const sw = screen.getByRole('switch', { name: 'Notify when a session needs input' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    const picker = screen.getByRole('combobox', { name: 'Notify after' })
    expect(picker).toBeDisabled()
    fireEvent.click(sw)
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ notify: true })
  })

  it('the delay picker offers 1, 5, 15 and 30 minutes and saves minutes as a number', async () => {
    const user = userEvent.setup()
    mockBridge({ settings: { ...makePayload().settings, notify: true } })
    render(<Settings />)
    await user.click(screen.getByRole('combobox', { name: 'Notify after' }))
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['1 min', '5 min', '15 min', '30 min'])
    await user.click(screen.getByRole('option', { name: '15 min' }))
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ notifyAfterMin: 15 })
  })

  it('Overview lists both groups; toggling an item saves the list', () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }))
    const sw = screen.getByRole('switch', { name: '≈ Cost today' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ overview: ['running', 'costWeek', 'limits', 'costToday'] })
    fireEvent.click(screen.getByRole('switch', { name: 'Running and waiting' }))
    expect(window.sessionTray.setSettings).toHaveBeenLastCalledWith({ overview: ['costWeek', 'limits'] })
  })

  it('Overview: not connected explains Connect in plain words, greys status line items, and links the guide', async () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }))
    expect(screen.getByText(/your status line keeps working and looks the same/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing is sent anywhere/i)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Plan limits' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Status line guide' }))
    expect(window.sessionTray.openUrl).toHaveBeenCalledWith('https://code.claude.com/docs/en/statusline')
    fireEvent.click(screen.getByRole('button', { name: 'Connect status line' }))
    expect(window.sessionTray.connectStatusLine).toHaveBeenCalled()
  })

  it('Overview: connected shows when it last updated and offers Disconnect', () => {
    mockBridge({ statuslineLinked: true, statusline: { capturedAt: Date.now() - 5 * 60_000, sessionId: null, fiveHour: null, sevenDay: null, effort: null, thinking: null, text: null } })
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }))
    expect(screen.getByText('Connected · updated 5m ago')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Plan limits' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(window.sessionTray.disconnectStatusLine).toHaveBeenCalled()
  })

  it('Overview: without Git Bash on Windows, Connect is unavailable and says why', () => {
    mockBridge({ canLinkStatusline: false })
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }))
    expect(screen.getByRole('button', { name: 'Connect status line' })).toBeDisabled()
    expect(screen.getByText(/needs Git Bash/i)).toBeInTheDocument()
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

  it('terminal choice shows the command it will run', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Terminal' }))
    await user.click(screen.getByRole('combobox', { name: 'Open sessions in' }))
    await user.click(screen.getByRole('option', { name: /PowerShell/i }))
    expect(window.sessionTray.setSettings).toHaveBeenCalledWith({ terminal: 'powershell' })
    expect(screen.getByText(/claude --resume/)).toBeInTheDocument()
  })

  it('terminal preview reflects whether Windows Terminal is installed', async () => {
    const user = userEvent.setup()
    mockBridge({ hasWt: false })
    const { unmount } = render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Terminal' }))
    expect(screen.getByText(/^cmd\.exe/)).toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: 'Open sessions in' }))
    expect(screen.getByRole('option', { name: 'Windows Terminal (not installed)' })).toBeInTheDocument()
    unmount()

    mockBridge({ hasWt: true })
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Terminal' }))
    expect(screen.getByText(/^wt\.exe/)).toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: 'Open sessions in' }))
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
