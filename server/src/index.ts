import { createServer } from 'http'
import { existsSync } from 'fs'
import { join } from 'path'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { Relay } from './relay'
import { bootstrap } from './bootstrap'
import { readSnapshot } from './transcript'
import { findFreePort } from './port-pool'
import type { HookEvent } from './types'

const app = express()
const relay = new Relay()
const terminatedSessions = new Set<string>()

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
  relay.push(event)
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

wss.on('connection', async (ws) => {
  const agents = await bootstrap(terminatedSessions)
  ws.send(JSON.stringify({
    type: 'init',
    agents,
    recentEvents: relay.getRecent(),
  }))
  relay.addClient(ws)
})

async function start() {
  const port = await findFreePort(7777, 10)
  if (port === null) {
    process.stderr.write('the-office: all ports 7777-7786 are occupied\n')
    process.stdout.write('OFFICE_PORT_ERROR:all ports occupied\n')
    process.exit(1)
  }
  server.listen(port, () => {
    console.log(`the-office server running on http://localhost:${port}`)
    process.stdout.write(`OFFICE_PORT:${port}\n`)
  })
}

start()
