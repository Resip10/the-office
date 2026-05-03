import { createServer } from 'http'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { Relay } from './relay'
import { bootstrap } from './bootstrap'
import { readSnapshot } from './transcript'
import { startWatcher } from './watcher'
import type { HookEvent } from './types'

const app = express()
const relay = new Relay()
const terminatedSessions = new Set<string>()
const hookSessions = new Set<string>()

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/transcript/snapshot', async (req, res) => {
  const { path: filePath } = req.query as { path?: string }
  if (!filePath) return res.status(400).json({ error: 'path required' })
  try {
    const snapshot = await readSnapshot(filePath)
    res.json(snapshot)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'read failed'
    res.status(400).json({ error: message })
  }
})

app.post('/api/events', (req, res) => {
  const raw = req.body as Record<string, unknown>
  const event: HookEvent = {
    ...(raw as Omit<HookEvent, '_timestamp' | '_id'>),
    _timestamp: Date.now(),
    _id: crypto.randomUUID(),
  }
  if (event.hook_event_name === 'SessionEnd') {
    terminatedSessions.add(event.session_id)
  }
  hookSessions.add(event.session_id)
  relay.push(event)
  res.sendStatus(200)
})

// Signal the Electron main process to open the hooks-setup window.
// When not running as a utilityProcess (e.g. npm run dev), parentPort is undefined — no-op.
app.post('/api/hooks/setup', (_req, res) => {
  ;(process as NodeJS.Process & { parentPort?: { postMessage(v: unknown): void } })
    .parentPort?.postMessage({ type: 'open-hooks-setup' })
  res.sendStatus(200)
})

app.post('/api/hooks/remove', (_req, res) => {
  ;(process as NodeJS.Process & { parentPort?: { postMessage(v: unknown): void } })
    .parentPort?.postMessage({ type: 'open-hooks-remove' })
  res.sendStatus(200)
})

// In production (spawned by Electron), serve compiled React client as static files.
const staticDir = process.env.SERVE_STATIC
if (staticDir && existsSync(staticDir)) {
  app.use(express.static(staticDir))
  app.get('*', (_req, res) => {
    res.sendFile(join(staticDir, 'index.html'))
  })
}

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

function checkHooksInstalled(): boolean {
  const settingsPath = join(homedir(), '.claude', 'settings.json')
  if (!existsSync(settingsPath)) return false
  try {
    return readFileSync(settingsPath, 'utf8').includes('localhost:7777')
  } catch {
    return false
  }
}

wss.on('connection', async (ws) => {
  const agents = await bootstrap(terminatedSessions)
  const snapshots = agents.map(a => ({ ...a, hasHooks: false }))
  ws.send(JSON.stringify({
    type: 'init',
    agents: snapshots,
    recentEvents: relay.getRecent(),
    hooksInstalled: checkHooksInstalled(),
  }))
  relay.addClient(ws)
})

const PORT = 7777

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    process.stderr.write(`the-office: port ${PORT} is already in use\n`)
    process.stdout.write(`OFFICE_PORT_ERROR:port ${PORT} already in use\n`)
  } else {
    process.stderr.write(`the-office: ${err.message}\n`)
    process.stdout.write(`OFFICE_PORT_ERROR:${err.message}\n`)
  }
  process.exit(1)
})

server.listen(PORT, () => {
  console.log(`the-office server running on http://localhost:${PORT}`)
  process.stdout.write(`OFFICE_PORT:${PORT}\n`)
  startWatcher(relay, hookSessions)
})
