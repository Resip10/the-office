import type { WebSocket } from 'ws'
import type { HookEvent } from './types'

const BUFFER_SIZE = 500

export class Relay {
  private buffer: HookEvent[] = []
  private clients: Set<WebSocket> = new Set()

  push(event: HookEvent): void {
    this.buffer.push(event)
    if (this.buffer.length > BUFFER_SIZE) {
      this.buffer.shift()
    }
    this.broadcast({ type: 'event', event })
  }

  getRecent(): HookEvent[] {
    return [...this.buffer]
  }

  addClient(ws: WebSocket): void {
    this.clients.add(ws)
    ws.on('close', () => this.clients.delete(ws))
  }

  private broadcast(msg: unknown): void {
    const data = JSON.stringify(msg)
    for (const client of this.clients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(data)
      }
    }
  }
}
