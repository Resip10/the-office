import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadedServers, readPluggedIn } from '../plugged-in'

const SESSION = join(__dirname, 'fixtures', 'plugged-in', 'session.jsonl')

let root: string
let claudeDir: string
let claudeJson: string
let proj: string
let other: string

const write = (path: string, obj: unknown) => {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, typeof obj === 'string' ? obj : JSON.stringify(obj))
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'plugged-'))
  claudeDir = join(root, '.claude')
  claudeJson = join(root, '.claude.json')
  proj = join(root, 'app')
  other = join(root, 'other')
  const toolsDir = join(root, 'plugins', 'tools')
  const offDir = join(root, 'plugins', 'off')

  write(claudeJson, {
    mcpServers: { 'my-db': { type: 'stdio', command: 'C:\\tools\\db-server.exe', args: ['--token', 'SECRET'], env: { KEY: 'SECRET' } } },
    projects: {
      [proj.replace(/\\/g, '/')]: { mcpServers: { slow: { type: 'http', url: 'https://x.test/?key=SECRET', headers: { Authorization: 'SECRET' } } } },
      [other.replace(/\\/g, '/')]: { mcpServers: { elsewhere: { command: 'npx' } } },
    },
  })
  write(join(proj, '.mcp.json'), { mcpServers: { broken: { command: 'node' }, idle: { command: 'npx' } } })
  write(join(claudeDir, 'settings.json'), { enabledPlugins: { 'tools@market': true, 'off@market': true } })
  write(join(proj, '.claude', 'settings.local.json'), { enabledPlugins: { 'off@market': false } })
  write(join(claudeDir, 'plugins', 'installed_plugins.json'), {
    version: 2,
    plugins: {
      'tools@market': [{ scope: 'user', installPath: toolsDir, version: '1.2.0' }],
      'off@market': [{ scope: 'project', projectPath: proj, installPath: offDir, version: '0.1.0' }],
      'mine@market': [{ scope: 'local', projectPath: other, installPath: offDir, version: '9' }],
    },
  })
  write(join(toolsDir, '.mcp.json'), { search: { command: 'uvx' } })
  write(join(offDir, '.mcp.json'), { mcpServers: { never: { command: 'npx' } } })
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

const read = (over: { projectPath?: string | null; transcriptPath?: string } = {}) =>
  readPluggedIn({ claudeDir, claudeJson, projectPath: proj, transcriptPath: SESSION, ...over })

describe('loadedServers', () => {
  it('folds deltas: added, removed, failed and pending; first record time', async () => {
    const l = await loadedServers(SESSION)
    expect(l?.at).toBe(Date.parse('2026-10-24T09:00:01.000Z'))
    expect([...(l?.tools.keys() ?? [])].sort()).toEqual(['claude_ai_Google_Drive', 'claude_ai_Linear', 'my-db', 'plugin_tools_search'])
    expect([...(l?.failed ?? [])]).toEqual(['broken'])
    expect([...(l?.pending ?? [])]).toEqual(['slow'])
  })

  it('null without any record or file', async () => {
    const plain = join(root, 'plain.jsonl')
    writeFileSync(plain, '{"type":"user"}\n')
    expect(await loadedServers(plain)).toBeNull()
    expect(await loadedServers(join(root, 'missing.jsonl'))).toBeNull()
  })
})

describe('readPluggedIn', () => {
  it('lists servers by scope with status from the session', async () => {
    const p = await read()
    const by = Object.fromEntries(p.servers.map(s => [s.name, s]))
    expect(p.loadedAt).toBe(Date.parse('2026-10-24T09:00:01.000Z'))
    expect(by['my-db']).toMatchObject({ scope: 'global', type: 'stdio', command: 'db-server', status: 'connected' })
    expect(by.slow).toMatchObject({ scope: 'local', type: 'http', command: null, status: 'pending' })
    expect(by.broken).toMatchObject({ scope: 'project', status: 'failed' })
    expect(by.idle).toMatchObject({ scope: 'project', status: 'not-loaded' })
    expect(by.search).toMatchObject({ scope: 'plugin', source: 'tools', command: 'uvx', status: 'connected' })
    expect(by.Linear).toMatchObject({ scope: 'claude.ai', status: 'connected' })
    expect(by['Google Drive']).toMatchObject({ scope: 'claude.ai', status: 'needs-auth' })
    // other project's server, removed tool, disabled plugin's server
    expect(by.elsewhere).toBeUndefined()
    expect(by.old).toBeUndefined()
    expect(by.never).toBeUndefined()
  })

  it('never carries args, env, headers or URLs', async () => {
    expect(JSON.stringify(await read())).not.toMatch(/SECRET|x\.test|args|env|headers|url/i)
  })

  it('plugins: global plus this project only; enabled merged user < project < local', async () => {
    const { plugins } = await read()
    expect(plugins).toEqual([
      { id: 'tools@market', name: 'tools', marketplace: 'market', version: '1.2.0', scope: 'global', enabled: true },
      { id: 'off@market', name: 'off', marketplace: 'market', version: '0.1.0', scope: 'project', enabled: false },
    ])
  })

  it('without a session record: list only, no status', async () => {
    const plain = join(root, 'plain.jsonl')
    writeFileSync(plain, '{"type":"user"}\n')
    const p = await read({ transcriptPath: plain })
    expect(p.loadedAt).toBeNull()
    expect(p.servers.every(s => s.status === null)).toBe(true)
    expect(p.servers.some(s => s.scope === 'claude.ai')).toBe(false)
  })

  it('fails soft on missing and broken files', async () => {
    writeFileSync(claudeJson, '{broken')
    const p = await readPluggedIn({ claudeDir: join(root, 'nope'), claudeJson, projectPath: null, transcriptPath: SESSION })
    expect(p.plugins).toEqual([])
    expect(p.servers.map(s => s.scope).sort()).toEqual(['claude.ai', 'claude.ai', 'session', 'session'])
  })
})
