import { createServer } from 'net'

export function findFreePort(start: number, count: number): Promise<number | null> {
  return new Promise((resolve) => {
    let attempts = 0
    function tryPort(port: number) {
      if (attempts >= count) { resolve(null); return }
      const srv = createServer()
      srv.listen(port, () => srv.close(() => resolve(port)))
      srv.on('error', () => { attempts++; tryPort(port + 1) })
    }
    tryPort(start)
  })
}
