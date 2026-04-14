import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { Relay } from './relay'
import { bootstrap } from './bootstrap'
import type { HookEvent } from './types'

const PORT = 7777

const app = express()
const relay = new Relay()

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/events', (req, res) => {
  const raw = req.body as Record<string, unknown>
  const event: HookEvent = {
    ...(raw as Omit<HookEvent, '_timestamp' | '_id'>),
    _timestamp: Date.now(),
    _id: crypto.randomUUID(),
  }
  relay.push(event)
  res.sendStatus(200)
})

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', async (ws) => {
  const agents = await bootstrap()
  ws.send(JSON.stringify({
    type: 'init',
    agents,
    recentEvents: relay.getRecent(),
  }))
  relay.addClient(ws)
})

server.listen(PORT, () => {
  console.log(`the-office server running on http://localhost:${PORT}`)
})
