import { existsSync } from 'fs'
import { readFile, rename, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import fg from 'fast-glob'
import { parseTranscript } from './claude-transcript'
import type { LiveInfo, SessionRecord, TranscriptMeta } from './types'

export interface IndexCache {
  version: 1
  entries: Record<string, { mtimeMs: number; size: number; meta: TranscriptMeta }>
}

export async function scanClaude(opts: {
  projectsDir: string
  cache: IndexCache | null
  parse?: typeof parseTranscript
}): Promise<{ records: SessionRecord[]; cache: IndexCache }> {
  const { projectsDir, parse = parseTranscript } = opts
  const prev = opts.cache?.entries ?? {}
  const cache: IndexCache = { version: 1, entries: {} }

  if (!existsSync(projectsDir)) return { records: [], cache }

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
      const meta = hit && hit.mtimeMs === mtimeMs && hit.size === size ? hit.meta : await parse(filePath)
      cache.entries[filePath] = { mtimeMs, size, meta }

      const { sessionId: _sessionId, lastTimestamp, ...rest } = meta
      records.push({
        ...rest,
        tool: 'claude',
        filePath,
        projectExists: meta.projectPath !== null && existsSync(meta.projectPath),
        lastActivityAt: lastTimestamp ?? mtimeMs,
        fileSize: size,
        subagentCount: subagentCounts.get(meta.id) ?? 0,
        live: null,
      })
    } catch {
      // vanished or unreadable between glob and read — skip
    }
  }

  records.sort((a, b) => b.lastActivityAt - a.lastActivityAt)
  return { records, cache }
}

export function attachLive(records: SessionRecord[], live: Map<string, LiveInfo>): SessionRecord[] {
  return records.map(r => ({ ...r, live: live.get(r.id) ?? null }))
}

export async function loadCache(path: string): Promise<IndexCache | null> {
  try {
    const obj = JSON.parse(await readFile(path, 'utf8')) as IndexCache
    if (obj?.version !== 1 || typeof obj.entries !== 'object' || obj.entries === null) return null
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
