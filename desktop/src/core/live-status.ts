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

export async function readLiveSessions(dir: string, isAlive: (pid: number) => boolean): Promise<Map<string, LiveInfo>> {
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
      if (!isAlive(obj.pid)) continue
      live.set(obj.sessionId, {
        pid: obj.pid,
        status: typeof obj.status === 'string' ? obj.status : 'unknown',
        name: typeof obj.name === 'string' ? obj.name : null,
        updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : 0,
      })
    } catch {
      // unreadable or malformed — skip
    }
  }
  return live
}
