import { join } from 'path'
import { readLiveSessions, pidIsAlive, createPidChecker } from '../live-status'

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

describe('readLiveSessions procStart', () => {
  it('passes each file procStart (or null) to isAlive', async () => {
    const seen: Array<[number, string | null]> = []
    await readLiveSessions(DIR, (pid, procStart) => { seen.push([pid, procStart]); return true })
    expect(seen).toContainEqual([100, '134368218419058115'])
    expect(seen).toContainEqual([200, null])
  })
})

describe('createPidChecker', () => {
  const flush = () => new Promise(r => setImmediate(r))

  it('a pid that has died stays dead even if Windows reuses it later', async () => {
    let exists = false
    const isAlive = createPidChecker({ pidExists: () => exists, startTimeOf: async () => null })
    expect(isAlive(42, 'A')).toBe(false)
    exists = true
    expect(isAlive(42, 'A')).toBe(false)
  })

  it('a pid whose real start time differs from procStart is dead (reused before we saw it)', async () => {
    const isAlive = createPidChecker({ pidExists: () => true, startTimeOf: async () => '999' })
    expect(isAlive(7, '123')).toBe(true) // optimistic while the check runs
    await flush()
    expect(isAlive(7, '123')).toBe(false)
  })

  it('a pid whose start time matches stays alive, and is checked only once', async () => {
    const startTimeOf = jest.fn(async () => '123')
    const isAlive = createPidChecker({ pidExists: () => true, startTimeOf })
    isAlive(7, '123')
    await flush()
    expect(isAlive(7, '123')).toBe(true)
    expect(isAlive(7, '123')).toBe(true)
    expect(startTimeOf).toHaveBeenCalledTimes(1)
  })

  it('no procStart, or start time unavailable → falls back to pid existence', async () => {
    const isAlive = createPidChecker({ pidExists: () => true, startTimeOf: async () => null })
    expect(isAlive(1, null)).toBe(true)
    isAlive(2, '123')
    await flush()
    expect(isAlive(2, '123')).toBe(true)
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
