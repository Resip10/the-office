import { vi } from 'vitest'
import { useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PluggedIn, SessionRecord } from '../../../desktop/src/core/types'
import { DetailPanel } from '../components/DetailPanel'
import type { DetailTab } from '../components/details/types'
import { TooltipProvider } from '../components/ui/tooltip'
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

const ID = '11111111-1111-4111-8111-111111111111'
const REC: SessionRecord = {
  tool: 'claude', id: ID, filePath: `C:\\x\\${ID}.jsonl`, title: 'Plugged', titleSource: 'ai',
  projectPath: 'C:\\projects\\app', projectExists: true, gitBranch: 'main', entrypoint: 'cli', version: '2.1.302',
  createdAt: Date.now() - 60_000, lastActivityAt: Date.now(), messageCount: 1, fileSize: 10, contextTokens: null,
  model: null, costUSD: null, prUrls: [], lastPrompt: null, awaySummary: null, continuedInId: null, editCount: 0,
  subagentCount: 0, live: null, agents: [],
}

function Harness() {
  const [tab, setTab] = useState<DetailTab>('messages')
  return <DetailPanel record={REC} pinned={false} continuedListed={false} onSelect={vi.fn()} tab={tab} onTabChange={setTab} />
}

async function setup(data: PluggedIn | null) {
  window.sessionTray = mockApi()
  window.sessionTray.pluggedIn = vi.fn(async () => data)
  render(<TooltipProvider><Harness /></TooltipProvider>)
  await act(async () => {})
}

async function openTab() {
  await userEvent.setup().click(screen.getByRole('tab', { name: /^Plugged in/ }))
  return screen.getByRole('tabpanel')
}

describe('Plugged in tab', () => {
  it('counts servers and plugins on the tab', async () => {
    await setup(DATA)
    expect(screen.getByRole('tab', { name: 'Plugged in 5' })).toBeInTheDocument()
    expect(window.sessionTray.pluggedIn).toHaveBeenCalledWith(ID)
  })

  it('lists servers with scope and status, plugins with scope, and the not-live note', async () => {
    await setup(DATA)
    const panel = await openTab()
    expect(panel).toHaveTextContent('Linear')
    expect(panel).toHaveTextContent('needs auth')
    expect(panel).toHaveTextContent('plugin · tools')
    expect(panel).toHaveTextContent('not loaded')
    expect(panel).toHaveTextContent('superpowers 7.0.0')
    expect(panel).toHaveTextContent('plugin · off')
    expect(panel).toHaveTextContent('Not live: status as loaded when this session started (5m ago)')
  })

  it('says when there is no status record', async () => {
    await setup({ ...DATA, loadedAt: null, servers: DATA.servers.map(s => ({ ...s, status: null })) })
    const panel = await openTab()
    expect(panel).toHaveTextContent(/No status: this session has no record/)
    expect(panel).not.toHaveTextContent('connected')
  })

  it.each([
    ['unavailable', null],
    ['empty', { loadedAt: null, servers: [], plugins: [] }],
  ])('no tab when %s', async (_, data) => {
    await setup(data)
    expect(screen.queryByRole('tab', { name: /^Plugged in/ })).toBeNull()
  })
})
