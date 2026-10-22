import { fireEvent, render, screen, within } from '@testing-library/react'
import type { SessionsPayload } from '../../../desktop/src/core/types'
import { mockApi, makePayload } from './bridge'
import { Settings } from '../views/Settings'

function mockBridge(over: Partial<SessionsPayload> = {}) {
  window.sessionTray = mockApi(makePayload(over))
}

describe('Settings', () => {
  beforeEach(() => mockBridge())

  it('has a sidebar with the P1 sections; Cleanup is disabled for now', () => {
    render(<Settings />)
    const nav = screen.getByRole('navigation', { name: 'Settings sections' })
    for (const name of ['General', 'Appearance', 'Terminal']) {
      expect(within(nav).getByRole('button', { name })).toBeEnabled()
    }
    expect(within(nav).getByRole('button', { name: 'Cleanup' })).toBeDisabled()
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
})
