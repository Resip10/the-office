import { createReadStream } from 'fs'
import { readFile } from 'fs/promises'
import { basename, join } from 'path'
import { createInterface } from 'readline'
import type { McpServerInfo, PluggedIn, PluginInfo } from './types'

type Rec = Record<string, unknown>

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

async function readJson(path: string): Promise<Rec | null> {
  try {
    const obj = JSON.parse(await readFile(path, 'utf8')) as unknown
    return isRec(obj) ? obj : null
  } catch {
    return null
  }
}

// Claude Code turns a server name into the middle of mcp__<server>__<tool> this way.
export const toolKey = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '_')
// Session paths use backslashes, ~/.claude.json keys forward slashes; Windows paths ignore case.
const samePath = (a: string, b: string) => {
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')
  return process.platform === 'win32' ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b)
}

interface Loaded {
  at: number | null
  tools: Map<string, string[]>
  failed: Set<string>
  pending: Set<string>
}

// What the session loaded: its deferred_tools_delta records (Claude Code's tool search), folded in order.
// deferred_tools_record only lists tools whose schemas were fetched, so it is not a snapshot and is skipped.
export async function loadedServers(transcriptPath: string): Promise<Loaded | null> {
  const names = new Set<string>()
  let at: number | null = null
  let seen = false
  const failed = new Set<string>()
  const pending = new Set<string>()
  const serverNames = (v: unknown) =>
    (Array.isArray(v) ? v : []).map(x => toolKey(str(x) ?? str(isRec(x) ? x.name : null) ?? '')).filter(Boolean)
  try {
    const lines = createInterface({ input: createReadStream(transcriptPath, 'utf8'), crlfDelay: Infinity })
    for await (const line of lines) {
      if (!line.includes('deferred_tools_delta')) continue
      let obj: unknown
      try {
        obj = JSON.parse(line)
      } catch {
        continue
      }
      const a = isRec(obj) && isRec(obj.attachment) ? obj.attachment : null
      if (a?.type !== 'deferred_tools_delta') continue
      for (const n of Array.isArray(a.addedNames) ? a.addedNames : []) if (str(n)) names.add(n as string)
      for (const n of Array.isArray(a.removedNames) ? a.removedNames : []) names.delete(n as string)
      failed.clear(); serverNames(a.failedMcpServers).forEach(n => failed.add(n))
      pending.clear(); serverNames(a.pendingMcpServers).forEach(n => pending.add(n))
      if (!seen) {
        const ts = isRec(obj) ? Date.parse(String(obj.timestamp)) : NaN
        at = Number.isNaN(ts) ? null : ts
      }
      seen = true
    }
  } catch {
    return null
  }
  if (!seen) return null
  const tools = new Map<string, string[]>()
  for (const n of names) {
    const m = /^mcp__(.+?)__(.+)$/.exec(n)
    if (m) tools.set(m[1], [...(tools.get(m[1]) ?? []), m[2]])
  }
  return { at, tools, failed, pending }
}

// Command base name only: args, env, headers and URLs can hold secrets and are never read out.
function serverInfo(name: string, key: string, config: unknown, scope: McpServerInfo['scope'], source: string | null): McpServerInfo & { key: string } {
  const c = isRec(config) ? config : {}
  const command = str(c.command)
  const type = str(c.type) ?? (command ? 'stdio' : null)
  return { key, name, scope, source, type, command: command ? basename(command.replace(/\\/g, '/')).replace(/\.(cmd|exe|bat)$/i, '') : null, status: null }
}

// A plugin's .mcp.json is either { mcpServers: {...} } or the servers object itself.
const serversOf = (obj: Rec | null): Rec => (obj && isRec(obj.mcpServers) ? obj.mcpServers : obj && !('mcpServers' in obj) ? obj : {})

function status(key: string, loaded: Loaded | null): McpServerInfo['status'] {
  if (!loaded) return null
  if (loaded.failed.has(key)) return 'failed'
  if (loaded.pending.has(key)) return 'pending'
  const tools = loaded.tools.get(key)
  if (!tools) return 'not-loaded'
  return tools.every(t => /auth/i.test(t)) ? 'needs-auth' : 'connected'
}

// Plugins and MCP servers a session's project has access to, as configured now, with status from the session's start.
export async function readPluggedIn(opts: {
  claudeDir: string
  claudeJson: string
  projectPath: string | null
  transcriptPath: string
}): Promise<PluggedIn> {
  const { claudeDir, claudeJson, projectPath, transcriptPath } = opts
  const proj = projectPath
  const [userJson, settings, projSettings, localSettings, installed, mcpJson, loaded] = await Promise.all([
    readJson(claudeJson),
    readJson(join(claudeDir, 'settings.json')),
    proj ? readJson(join(proj, '.claude', 'settings.json')) : null,
    proj ? readJson(join(proj, '.claude', 'settings.local.json')) : null,
    readJson(join(claudeDir, 'plugins', 'installed_plugins.json')),
    proj ? readJson(join(proj, '.mcp.json')) : null,
    loadedServers(transcriptPath),
  ])

  // enabledPlugins: user < project < local.
  const enabled: Rec = {}
  for (const s of [settings, projSettings, localSettings]) if (s && isRec(s.enabledPlugins)) Object.assign(enabled, s.enabledPlugins)

  const plugins: (PluginInfo & { installPath: string | null })[] = []
  const all = installed && isRec(installed.plugins) ? installed.plugins : {}
  for (const [id, entries] of Object.entries(all)) {
    for (const e of Array.isArray(entries) ? entries : []) {
      if (!isRec(e)) continue
      const scope = e.scope === 'user' ? 'global' : e.scope === 'project' || e.scope === 'local' ? e.scope : null
      if (!scope) continue
      if (scope !== 'global' && !(proj && str(e.projectPath) && samePath(e.projectPath as string, proj))) continue
      const [name, marketplace = null] = id.split('@')
      plugins.push({ id, name, marketplace, version: str(e.version), scope, enabled: enabled[id] === true, installPath: str(e.installPath) })
    }
  }

  const servers: (McpServerInfo & { key: string })[] = []
  for (const [name, c] of Object.entries(userJson && isRec(userJson.mcpServers) ? userJson.mcpServers : {})) {
    servers.push(serverInfo(name, toolKey(name), c, 'global', null))
  }
  const projects = userJson && isRec(userJson.projects) ? userJson.projects : {}
  const projEntry = proj ? Object.entries(projects).find(([k]) => samePath(k, proj))?.[1] : undefined
  if (isRec(projEntry) && isRec(projEntry.mcpServers)) {
    for (const [name, c] of Object.entries(projEntry.mcpServers)) servers.push(serverInfo(name, toolKey(name), c, 'local', null))
  }
  for (const [name, c] of Object.entries(mcpJson && isRec(mcpJson.mcpServers) ? mcpJson.mcpServers : {})) {
    servers.push(serverInfo(name, toolKey(name), c, 'project', null))
  }
  for (const p of plugins) {
    if (!p.enabled || !p.installPath) continue
    const [own, manifest] = await Promise.all([
      readJson(join(p.installPath, '.mcp.json')),
      readJson(join(p.installPath, '.claude-plugin', 'plugin.json')),
    ])
    const defs = { ...serversOf(own), ...(manifest && isRec(manifest.mcpServers) ? manifest.mcpServers : {}) }
    for (const [name, c] of Object.entries(defs)) servers.push(serverInfo(name, toolKey(`plugin_${p.name}_${name}`), c, 'plugin', p.name))
  }

  // Loaded but not in any config: claude.ai connectors (live online, not on disk) or something we can't place.
  const known = new Set(servers.map(s => s.key))
  for (const key of loaded?.tools.keys() ?? []) {
    if (known.has(key)) continue
    const connector = key.startsWith('claude_ai_')
    servers.push({ key, name: connector ? key.slice('claude_ai_'.length).replace(/_/g, ' ') : key, scope: connector ? 'claude.ai' : 'session', source: null, type: null, command: null, status: null })
  }

  return {
    loadedAt: loaded?.at ?? null,
    servers: servers.map(({ key, ...s }) => ({ ...s, status: status(key, loaded) })),
    plugins: plugins.map(({ installPath: _installPath, ...p }) => p),
  }
}
