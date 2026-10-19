import { createReadStream } from 'fs'
import { basename } from 'path'
import { createInterface } from 'readline'
import type { TranscriptMeta } from './types'

const TITLE_MAX = 120
const NON_PROMPT_PREFIXES = ['<command-', '<local-command-', '<system-reminder>']

type Rec = Record<string, unknown>

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

function promptText(content: unknown): string | null {
  const candidates = typeof content === 'string'
    ? [content]
    : Array.isArray(content)
      ? content.filter((b: Rec) => b?.type === 'text').map((b: Rec) => String(b.text ?? ''))
      : []
  for (const text of candidates) {
    const clean = text.replace(/\s+/g, ' ').trim()
    if (clean && !NON_PROMPT_PREFIXES.some(p => clean.startsWith(p))) return clean.slice(0, TITLE_MAX)
  }
  return null
}

export async function parseTranscript(filePath: string): Promise<TranscriptMeta> {
  const meta: TranscriptMeta = {
    id: basename(filePath, '.jsonl'),
    sessionId: null,
    title: '—',
    titleSource: 'none',
    projectPath: null,
    gitBranch: null,
    entrypoint: null,
    version: null,
    createdAt: null,
    lastTimestamp: null,
    messageCount: 0,
    contextTokens: null,
    model: null,
    costUSD: null,
    prUrls: [],
    lastPrompt: null,
    awaySummary: null,
    continuedInId: null,
  }
  let customTitle: string | null = null
  let agentName: string | null = null
  let aiTitle: string | null = null
  let firstPrompt: string | null = null

  const lines = createInterface({ input: createReadStream(filePath, 'utf8'), crlfDelay: Infinity })
  for await (const line of lines) {
    let obj: Rec
    try {
      obj = JSON.parse(line) as Rec
    } catch {
      continue
    }
    if (!obj || typeof obj !== 'object') continue

    meta.sessionId ??= str(obj.sessionId)
    meta.projectPath ??= str(obj.cwd)
    meta.gitBranch = str(obj.gitBranch) ?? meta.gitBranch
    meta.entrypoint = str(obj.entrypoint) ?? meta.entrypoint
    meta.version = str(obj.version) ?? meta.version

    const ts = typeof obj.timestamp === 'string' ? Date.parse(obj.timestamp) : NaN
    if (!isNaN(ts)) {
      meta.createdAt ??= ts
      meta.lastTimestamp = ts
    }

    switch (obj.type) {
      case 'custom-title': customTitle = str(obj.customTitle) ?? customTitle; break
      case 'agent-name': agentName = str(obj.agentName) ?? agentName; break
      case 'ai-title': aiTitle = str(obj.aiTitle) ?? aiTitle; break
      case 'last-prompt': meta.lastPrompt = str(obj.lastPrompt) ?? meta.lastPrompt; break
      case 'continued-in': meta.continuedInId = str(obj.continuedInSessionId) ?? meta.continuedInId; break
      case 'pr-link': {
        const url = str(obj.prUrl)
        if (url && !meta.prUrls.includes(url)) meta.prUrls.push(url)
        break
      }
      case 'cost-state':
        if (typeof obj.totalCostUSD === 'number') meta.costUSD = obj.totalCostUSD
        break
      case 'system':
        if (obj.subtype === 'away_summary') meta.awaySummary = str(obj.content) ?? meta.awaySummary
        break
      case 'user':
      case 'assistant': {
        if (obj.isMeta === true || obj.isSidechain === true) break
        meta.messageCount++
        const msg = (obj.message ?? {}) as Rec
        if (obj.type === 'user') {
          // After compaction the first user record is Claude's summary, not something the user typed.
          if (obj.isCompactSummary !== true) firstPrompt ??= promptText(msg.content)
        } else {
          meta.model = str(msg.model) ?? meta.model
          const usage = msg.usage as Rec | undefined
          if (usage && typeof usage.input_tokens === 'number') {
            meta.contextTokens = usage.input_tokens +
              (Number(usage.cache_read_input_tokens) || 0) +
              (Number(usage.cache_creation_input_tokens) || 0)
          }
        }
        break
      }
    }
  }

  const titles: Array<[string | null, TranscriptMeta['titleSource']]> = [
    [customTitle, 'custom'], [agentName, 'agent'], [aiTitle, 'ai'], [firstPrompt, 'prompt'],
  ]
  const picked = titles.find(([t]) => t !== null)
  if (picked) {
    meta.title = picked[0] as string
    meta.titleSource = picked[1]
  }
  return meta
}
