import { join } from 'path'
import { readLiveSessions, pidIsAlive } from '../live-status'

const DIR = join(__dirname, 'fixtures', 'sessions')
const allAlive = () => true

describe('readLiveSessions', () => {
  it('maps sessionId to live info', async () => {
    const live = await readLiveSessions(DIR, allAlive)
    expect(live.get('11111111-1111-4111-8111-111111111111')).toEqual({
      pid: 100, status: 'busy', name: 'app-1c', updatedAt: 1792348470184,
    })
  })

  it('drops entries whose pid is dead', async () => {
    const live = await readLiveSessions(DIR, pid => pid !== 200)
    expect(live.has('44444444-4444-4444-8444-444444444444')).toBe(false)
    expect(live.has('11111111-1111-4111-8111-111111111111')).toBe(true)
  })

  it('ignores non-json files and malformed json', async () => {
    const live = await readLiveSessions(DIR, allAlive)
    expect(live.size).toBe(3)
  })

  it('missing dir returns empty map', async () => {
    const live = await readLiveSessions(join(DIR, 'nope'), allAlive)
    expect(live.size).toBe(0)
  })

  it("status missing → 'unknown'", async () => {
    const live = await readLiveSessions(DIR, allAlive)
    expect(live.get('55555555-5555-4555-8555-555555555555')?.status).toBe('unknown')
  })
})

describe('pidIsAlive', () => {
  it('is true for the current process', () => {
    expect(pidIsAlive(process.pid)).toBe(true)
  })

  it('is false for a pid that does not exist', () => {
    expect(pidIsAlive(2 ** 22 + 12345)).toBe(false)
  })
})
