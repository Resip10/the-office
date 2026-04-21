import { createServer } from 'net'
import { findFreePort } from '../port-pool'

function occupyPort(port: number): Promise<import('net').Server> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(port, () => resolve(srv))
    srv.on('error', reject)
  })
}

describe('findFreePort', () => {
  it('returns the start port when it is free', async () => {
    const port = await findFreePort(19700, 5)
    expect(port).toBe(19700)
  })

  it('skips occupied ports and returns the next free one', async () => {
    const srv = await occupyPort(19710)
    try {
      const port = await findFreePort(19710, 5)
      expect(port).toBe(19711)
    } finally {
      await new Promise<void>((r) => srv.close(() => r()))
    }
  })

  it('returns null when all ports in range are occupied', async () => {
    const servers: import('net').Server[] = []
    for (let p = 19720; p <= 19722; p++) {
      servers.push(await occupyPort(p))
    }
    try {
      const port = await findFreePort(19720, 3)
      expect(port).toBeNull()
    } finally {
      await Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r()))))
    }
  })
})
