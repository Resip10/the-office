import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import type { SubagentInfo } from './types'

// A subagent that never wrote `finished` (crashed, killed) stops counting as running after this much silence.
export const AGENT_QUIET_MS = 10 * 60_000

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

// Subagents of one session: <transcript without .jsonl>/subagents/agent-<id>.meta.json + agent-<id>.jsonl.
export async function readSubagents(transcriptPath: string, now: number): Promise<SubagentInfo[]> {
  const dir = join(transcriptPath.replace(/\.jsonl$/, ''), 'subagents')
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const agents: SubagentInfo[] = []
  for (const name of names) {
    const m = /^agent-(.+)\.meta\.json$/.exec(name)
    if (!m) continue
    try {
      const meta = JSON.parse(await readFile(join(dir, name), 'utf8')) as Record<string, unknown>
      if (typeof meta !== 'object' || meta === null) continue
      const file = await stat(join(dir, `agent-${m[1]}.jsonl`)).catch(() => null)
      agents.push({
        id: m[1],
        description: str(meta.description),
        agentType: str(meta.agentType),
        model: str(meta.model),
        startedAt: file && file.birthtimeMs > 0 ? file.birthtimeMs : null,
        lastActivityAt: file?.mtimeMs ?? null,
        running: meta.finished !== true && file !== null && now - file.mtimeMs < AGENT_QUIET_MS,
      })
    } catch {
      // half-written or unreadable meta — skip
    }
  }
  // Running first, newest first within each group.
  return agents.sort((a, b) => Number(b.running) - Number(a.running) || (b.startedAt ?? 0) - (a.startedAt ?? 0))
}
