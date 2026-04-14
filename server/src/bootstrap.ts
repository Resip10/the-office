import { readFile, stat } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import fg from 'fast-glob'
import type { AgentSnapshot } from './types'

const FOUR_HOURS = 4 * 60 * 60 * 1000

export async function bootstrap(): Promise<AgentSnapshot[]> {
  const claudeDir = join(homedir(), '.claude', 'projects')

  let files: string[]
  try {
    files = await fg('**/sessions/*.jsonl', { cwd: claudeDir, absolute: true })
  } catch {
    return []
  }

  const cutoff = Date.now() - FOUR_HOURS
  const snapshots: AgentSnapshot[] = []

  for (const file of files) {
    try {
      const info = await stat(file)
      if (info.mtimeMs < cutoff) continue
      const content = await readFile(file, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)
      const snapshot = parseJSONLSession(file, lines)
      if (snapshot) snapshots.push(snapshot)
    } catch {
      // unreadable or locked file — skip silently
    }
  }

  return snapshots
}

export function parseJSONLSession(filePath: string, lines: string[]): AgentSnapshot | null {
  let sessionId: string | null = null
  let projectPath = ''
  let startedAt = Date.now()
  let isDone = false
  let parentSessionId: string | null = null

  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>

      if (obj.type === 'system' && obj.subtype === 'init') {
        const data = (typeof obj.data === 'object' && obj.data !== null ? obj.data : obj) as Record<string, unknown>
        sessionId = (data.session_id as string | undefined) ?? null
        projectPath = (data.cwd as string | undefined) ?? ''
        if (typeof obj.timestamp === 'number') startedAt = obj.timestamp
      }

      if (typeof obj.parent_session_id === 'string') {
        parentSessionId = obj.parent_session_id
      }

      if (obj.type === 'result') {
        isDone = true
      }
    } catch {
      // malformed line — skip
    }
  }

  if (!sessionId) return null

  // Derive agent name from filename: "code-reviewer-abc123.jsonl" → "code-reviewer"
  const filename = (filePath.split(/[\\/]/).pop() ?? '').replace(/\.jsonl$/, '')
  const agentName = (filename.endsWith('-' + sessionId)
    ? filename.slice(0, -(sessionId.length + 1))
    : filename.replace(/-[a-f0-9]{8,}.*$/, '').replace(/-[0-9a-f-]{36}$/, '')) || sessionId.slice(0, 8)

  return {
    sessionId,
    agentName,
    projectPath,
    status: isDone ? 'done' : 'idle',
    startedAt,
    parentSessionId,
  }
}
