import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import type { LimitWindow, StatuslineSnapshot } from './types'

// What Claude Code last passed to the user's status line, saved by the connected status line command
// (see statusline-link.ts) as input.json, plus what the script printed (output.txt). Fail soft throughout.

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const TEXT_MAX = 200

function limitWindow(v: unknown): LimitWindow | null {
  if (!isRec(v)) return null
  const usedPct = num(v.used_percentage)
  if (usedPct === null) return null
  const resets = num(v.resets_at)
  return { usedPct, resetsAt: resets === null ? null : resets * 1000 }
}

// The status line's printed text without colors or hyperlinks, lines joined.
export function cleanText(raw: string): string | null {
  const plain = raw
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
  const lines = plain.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  return lines.length ? lines.join(' · ').slice(0, TEXT_MAX) : null
}

export function parseStatusline(input: string, output: string | null, capturedAt: number): StatuslineSnapshot | null {
  let obj: unknown
  try {
    obj = JSON.parse(input)
  } catch {
    return null
  }
  if (!isRec(obj)) return null
  const limits = isRec(obj.rate_limits) ? obj.rate_limits : {}
  const cost = isRec(obj.cost) ? obj.cost : {}
  const cache = isRec(obj.prompt_cache) ? obj.prompt_cache : {}
  const hit = num(cache.hit_ratio)
  const cold = num(cache.expires_at)
  const pr = isRec(obj.pr) && num(obj.pr.number) !== null && str(obj.pr.url)
    ? { number: obj.pr.number as number, url: obj.pr.url as string, reviewState: str(obj.pr.review_state) }
    : null
  return {
    capturedAt,
    fiveHour: limitWindow(limits.five_hour),
    sevenDay: limitWindow(limits.seven_day),
    linesAdded: num(cost.total_lines_added),
    linesRemoved: num(cost.total_lines_removed),
    cacheHitPct: hit === null ? null : Math.round(hit * 100),
    cacheColdAt: cold === null ? null : cold * 1000,
    effort: isRec(obj.effort) ? str(obj.effort.level) : null,
    thinking: isRec(obj.thinking) && typeof obj.thinking.enabled === 'boolean' ? obj.thinking.enabled : null,
    pr,
    text: output === null ? null : cleanText(output),
  }
}

export async function readStatusline(dir: string): Promise<StatuslineSnapshot | null> {
  try {
    const inputPath = join(dir, 'input.json')
    const st = await stat(inputPath)
    const output = await readFile(join(dir, 'output.txt'), 'utf8').catch(() => null)
    return parseStatusline(await readFile(inputPath, 'utf8'), output, st.mtimeMs)
  } catch {
    return null
  }
}
