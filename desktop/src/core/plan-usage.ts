import { readFile, stat } from 'fs/promises'
import type { LimitWindow, PlanUsage } from './types'

// Plan limits are only handed to the status line command, so the user's status line saves that JSON
// to a file we read (see Settings → Plan usage). Fail soft: anything unexpected is null.

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

function limitWindow(v: unknown): LimitWindow | null {
  if (!isRec(v) || typeof v.used_percentage !== 'number' || !Number.isFinite(v.used_percentage)) return null
  return {
    usedPct: v.used_percentage,
    resetsAt: typeof v.resets_at === 'number' && Number.isFinite(v.resets_at) ? v.resets_at * 1000 : null,
  }
}

export function parsePlanUsage(text: string, capturedAt: number): PlanUsage | null {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRec(obj)) return null
  const limits = isRec(obj.rate_limits) ? obj.rate_limits : {}
  return { fiveHour: limitWindow(limits.five_hour), sevenDay: limitWindow(limits.seven_day), capturedAt }
}

export async function readPlanUsage(path: string): Promise<PlanUsage | null> {
  try {
    const st = await stat(path)
    return parsePlanUsage(await readFile(path, 'utf8'), st.mtimeMs)
  } catch {
    return null
  }
}
