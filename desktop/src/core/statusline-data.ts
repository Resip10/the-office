import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import type { LimitWindow, SessionExtras, StatuslineSnapshot } from './types'

// What Claude Code last passed to the user's status line, saved by the connected status line command
// (see statusline-link.ts) as input.json, plus what the script printed (output.txt). Fail soft throughout.

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const TEXT_MAX = 200
const SESSION_ID = /^[0-9a-f-]{36}$/

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
  const sessionId = str(obj.session_id)
  return {
    capturedAt,
    sessionId: sessionId && SESSION_ID.test(sessionId) ? sessionId : null,
    fiveHour: limitWindow(limits.five_hour),
    sevenDay: limitWindow(limits.seven_day),
    effort: isRec(obj.effort) ? str(obj.effort.level) : null,
    thinking: isRec(obj.thinking) && typeof obj.thinking.enabled === 'boolean' ? obj.thinking.enabled : null,
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

// Keeps the latest effort and thinking per session as status line refreshes come in.
export function rememberExtras(prev: Record<string, SessionExtras>, s: StatuslineSnapshot | null): Record<string, SessionExtras> {
  if (!s?.sessionId || (s.effort === null && s.thinking === null)) return prev
  const old = prev[s.sessionId]
  if (old && old.effort === s.effort && old.thinking === s.thinking) return prev
  return { ...prev, [s.sessionId]: { effort: s.effort, thinking: s.thinking } }
}
