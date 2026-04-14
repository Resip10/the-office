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
    files = await fg('**/*.jsonl', { cwd: claudeDir, absolute: true })
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

      // Real Claude Code JSONL format: sessionId and cwd are top-level fields
      if (typeof obj.sessionId === 'string' && !sessionId) {
        sessionId = obj.sessionId
      }
      if (typeof obj.cwd === 'string' && !projectPath) {
        projectPath = obj.cwd.replace(/\\/g, '/')
      }
      if (typeof obj.timestamp === 'string' && startedAt === Date.now()) {
        const t = new Date(obj.timestamp).getTime()
        if (!isNaN(t)) startedAt = t
      }

      // Subagent parent link
      if (typeof obj.parentSessionId === 'string' && !parentSessionId) {
        parentSessionId = obj.parentSessionId
      }

      // Session is done when a summary/result entry appears
      if (obj.type === 'summary' || obj.type === 'result') {
        isDone = true
      }

      // Legacy format fallback (type: system, subtype: init)
      if (obj.type === 'system' && obj.subtype === 'init') {
        const data = (typeof obj.data === 'object' && obj.data !== null ? obj.data : obj) as Record<string, unknown>
        if (!sessionId) sessionId = (data.session_id as string | undefined) ?? null
        if (!projectPath) projectPath = ((data.cwd as string | undefined) ?? '').replace(/\\/g, '/')
      }
    } catch {
      // malformed line — skip
    }
  }

  if (!sessionId) return null

  // Derive agent name:
  // - subagent files: "agent-<hex>.jsonl" → use parent folder (session UUID) as context, name = "agent"
  // - main session files: filename IS the session UUID → use encoded project folder name
  const parts = filePath.replace(/\\/g, '/').split('/')
  const filename = (parts.pop() ?? '').replace(/\.jsonl$/, '')
  const parentFolder = parts.pop() ?? ''           // session UUID or "subagents"
  const projectFolder = parentFolder === 'subagents' ? (parts.pop() ?? '') : parentFolder

  let agentName: string
  if (filename.startsWith('agent-')) {
    // subagent: derive name from the agent- prefix, strip hex suffix
    agentName = filename.replace(/-[0-9a-f]{16,}$/, '') || 'agent'
  } else if (filename === sessionId) {
    // main session: name from encoded project folder (C--projects-the-office → the-office)
    agentName = projectFolder.replace(/^[A-Z]--/, '').replace(/^projects-/, '') || sessionId.slice(0, 8)
  } else {
    agentName = filename.replace(/-[a-f0-9]{8,}.*$/, '') || sessionId.slice(0, 8)
  }

  return {
    sessionId,
    agentName,
    projectPath,
    status: isDone ? 'done' : 'idle',
    startedAt,
    parentSessionId,
  }
}
