import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import type { LiveInfo } from './types'

export function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // EPERM: process exists but belongs to another user
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

// Windows reuses pids, so a session file left by a crashed Claude can point at an unrelated process.
// Each (pid, procStart) is checked once against the real process start time; once dead, always dead.
export function createPidChecker(deps: {
  pidExists: (pid: number) => boolean
  startTimeOf: (pid: number) => Promise<string | null>
}): (pid: number, procStart: string | null) => boolean {
  const dead = new Set<string>()
  const checked = new Set<string>()
  return (pid, procStart) => {
    const key = `${pid}:${procStart}`
    if (dead.has(key)) return false
    if (!deps.pidExists(pid)) { dead.add(key); return false }
    if (procStart !== null && !checked.has(key)) {
      checked.add(key)
      deps.startTimeOf(pid)
        .then(actual => { if (actual !== null && actual !== procStart) dead.add(key) })
        .catch(() => {})
    }
    return true
  }
}

export async function readLiveSessions(dir: string, isAlive: (pid: number, procStart: string | null) => boolean): Promise<Map<string, LiveInfo>> {
  const live = new Map<string, LiveInfo>()
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return live
  }

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const obj = JSON.parse(await readFile(join(dir, file), 'utf8')) as Record<string, unknown>
      if (typeof obj.sessionId !== 'string' || typeof obj.pid !== 'number') continue
      if (!isAlive(obj.pid, typeof obj.procStart === 'string' ? obj.procStart : null)) continue
      live.set(obj.sessionId, {
        pid: obj.pid,
        status: typeof obj.status === 'string' ? obj.status : 'unknown',
        name: typeof obj.name === 'string' ? obj.name : null,
        updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : 0,
        waitingFor: typeof obj.waitingFor === 'string' ? obj.waitingFor : null,
        statusUpdatedAt: typeof obj.statusUpdatedAt === 'number' ? obj.statusUpdatedAt : null,
      })
    } catch {
      // unreadable or malformed — skip
    }
  }
  return live
}
