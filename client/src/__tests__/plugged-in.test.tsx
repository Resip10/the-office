import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { PluggedIn } from '../../../desktop/src/core/types'
import { PluggedInCard } from '../components/PluggedInCard'
import { mockApi } from './bridge'

const DATA: PluggedIn = {
  loadedAt: Date.now() - 5 * 60_000,
  servers: [
    { name: 'Linear', scope: 'claude.ai', source: null, type: null, command: null, status: 'connected' },
    { name: 'Google Drive', scope: 'claude.ai', source: null, type: null, command: null, status: 'needs-auth' },
    { name: 'search', scope: 'plugin', source: 'tools', type: 'stdio', command: 'uvx', status: 'not-loaded' },
  ],
  plugins: [
    { id: 'superpowers@official', name: 'superpowers', marketplace: 'official', version: '7.0.0', scope: 'global', enabled: true },
    { id: 'off@m', name: 'off', marketplace: 'm', version: null, scope: 'project', enabled: false },
  ],
}

function setup(data: PluggedIn | null) {
  window.sessionTray = mockApi()
  window.sessionTray.pluggedIn = vi.fn(async () => data)
  render(<PluggedInCard id="s1" />)
}

describe('PluggedInCard', () => {
  it('lists servers with scope and status, plugins with scope, and the not-live note', async () => {
    setup(DATA)
    const section = await screen.findByRole('region', { name: 'Plugged in' })
    expect(section).toHaveTextContent('Linear')
    expect(section).toHaveTextContent('needs auth')
    expect(section).toHaveTextContent('plugin · tools')
    expect(section).toHaveTextContent('not loaded')
    expect(section).toHaveTextContent('superpowers 7.0.0')
    expect(section).toHaveTextContent('plugin · off')
    expect(section).toHaveTextContent('Not live: status as loaded when this session started (5m ago)')
  })

  it('says when there is no status record', async () => {
    setup({ ...DATA, loadedAt: null, servers: DATA.servers.map(s => ({ ...s, status: null })) })
    expect(await screen.findByText(/No status: this session has no record/)).toBeInTheDocument()
    expect(screen.queryByText('connected')).toBeNull()
  })

  it('renders nothing when empty or unavailable', async () => {
    setup(null)
    await Promise.resolve()
    expect(screen.queryByRole('region', { name: 'Plugged in' })).toBeNull()
  })
})
