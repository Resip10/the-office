import { existsSync } from 'fs'
import { access, readFile, rename, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import fg from 'fast-glob'
import { parseTranscript } from './claude-transcript'
import type { LiveInfo, SessionRecord, SubagentInfo, TranscriptMeta } from './types'

const folderExists = (path: string) => access(path).then(() => true, () => false)

export interface IndexCache {
  version: 2
  entries: Record<string, { mtimeMs: number; size: number; meta: TranscriptMeta }>
}

export async function scanClaude(opts: {
  projectsDir: string
  cache: IndexCache | null
  parse?: typeof parseTranscript
  pathExists?: (path: string) => Promise<boolean>
}): Promise<{ records: SessionRecord[]; cache: IndexCache; changed: boolean }> {
  const { projectsDir, parse = parseTranscript, pathExists = folderExists } = opts
  // Async and once per folder: an unreachable network path must not block the main process per record.
  const projectChecks = new Map<string, Promise<boolean>>()
  const projectExists = (path: string) => {
    if (!projectChecks.has(path)) projectChecks.set(path, pathExists(path))
    return projectChecks.get(path) as Promise<boolean>
  }
  const prev = opts.cache?.entries ?? {}
  const cache: IndexCache = { version: 2, entries: {} }
  let changed = opts.cache === null

  if (!existsSync(projectsDir)) return { records: [], cache, changed: changed || Object.keys(prev).length > 0 }

  const [transcripts, subagents] = await Promise.all([
    fg('*/*.jsonl', { cwd: projectsDir }),
    fg('*/*/subagents/*.jsonl', { cwd: projectsDir }),
  ])

  const subagentCounts = new Map<string, number>()
  for (const rel of subagents) {
    const id = rel.split('/')[1]
    subagentCounts.set(id, (subagentCounts.get(id) ?? 0) + 1)
  }

  const records: SessionRecord[] = []
  for (const rel of transcripts) {
    const filePath = join(projectsDir, rel)
    try {
      const { mtimeMs, size } = await stat(filePath)
      const hit = prev[filePath]
      const fresh = hit && hit.mtimeMs === mtimeMs && hit.size === size
      const meta = fresh ? hit.meta : await parse(filePath)
      if (!fresh) changed = true
      cache.entries[filePath] = { mtimeMs, size, meta }

      const { sessionId: _sessionId, lastTimestamp, ...rest } = meta
      records.push({
        ...rest,
        tool: 'claude',
        filePath,
        projectExists: meta.projectPath !== null && await projectExists(meta.projectPath),
        lastActivityAt: lastTimestamp ?? mtimeMs,
        fileSize: size,
        subagentCount: subagentCounts.get(meta.id) ?? 0,
        live: null,
        agents: [],
      })
    } catch {
      // vanished or unreadable between glob and read — skip
    }
  }

  records.sort((a, b) => b.lastActivityAt - a.lastActivityAt)
  // Every kept entry came from prev or a reparse, so a smaller count means files were deleted.
  if (Object.keys(cache.entries).length !== Object.keys(prev).length) changed = true
  return { records, cache, changed }
}

export function attachLive(records: SessionRecord[], live: Map<string, LiveInfo>): SessionRecord[] {
  return records.map(r => ({ ...r, live: live.get(r.id) ?? null }))
}

export function attachAgents(records: SessionRecord[], agents: Map<string, SubagentInfo[]>): SessionRecord[] {
  return records.map(r => (r.live && agents.has(r.id) ? { ...r, agents: agents.get(r.id) as SubagentInfo[] } : r))
}

export function applyNames(records: SessionRecord[], names: Record<string, string>): SessionRecord[] {
  return records.map(r => (names[r.id] ? { ...r, title: names[r.id], titleSource: 'app' } : r))
}

export async function loadCache(path: string): Promise<IndexCache | null> {
  try {
    const obj = JSON.parse(await readFile(path, 'utf8')) as IndexCache
    if (obj?.version !== 2 || typeof obj.entries !== 'object' || obj.entries === null) return null
    return obj
  } catch {
    return null
  }
}

export async function saveCache(path: string, cache: IndexCache): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(cache))
  await rename(tmp, path)
}
