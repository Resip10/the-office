import { createReadStream } from 'fs'
import { access } from 'fs/promises'
import { createInterface } from 'readline'
import { EDIT_TOOLS, NON_PROMPT_PREFIXES } from './claude-transcript'
import type { PeekItem, SessionDetails } from './types'

type Rec = Record<string, unknown>

const PEEK_SIZE = 6
const ASK_MAX = 500
const ANSWER_MAX = 600

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

// Text the user actually typed: string content or text blocks, minus command/reminder wrappers.
function typedText(content: unknown): string | null {
  const parts = typeof content === 'string'
    ? [content]
    : Array.isArray(content) ? content.filter(b => isRec(b) && b.type === 'text').map(b => String((b as Rec).text ?? '')) : []
  for (const text of parts) {
    const clean = text.trim()
    if (clean && !NON_PROMPT_PREFIXES.some(p => clean.startsWith(p))) return clean
  }
  return null
}

export function toolTarget(_name: string, input: unknown): string {
  if (!isRec(input)) return ''
  if (typeof input.file_path === 'string') return input.file_path
  if (typeof input.command === 'string') return input.command.split('\n')[0]
  if (typeof input.pattern === 'string') return input.pattern
  return ''
}

function relativeTo(projectPath: string | null, file: string): string {
  if (!projectPath) return file
  const root = projectPath.replace(/[\\/]+$/, '')
  const sameRoot = file.slice(0, root.length).toLowerCase() === root.toLowerCase()
  return sameRoot && /[\\/]/.test(file.charAt(root.length)) ? file.slice(root.length + 1) : file
}

export async function parseDetails(filePath: string, projectPath: string | null): Promise<SessionDetails | null> {
  try {
    await access(filePath)
  } catch {
    return null
  }

  let compactSummary: string | null = null
  let recap: string | null = null
  let goal: string | null = null
  let lastTyped: string | null = null
  let lastPromptRecord: string | null = null
  let branch: string | null = null
  let lastAnswer: string | null = null
  const files: string[] = [] // most recent last while streaming
  const peek: PeekItem[] = []
  let messageTotal = 0

  const push = (item: PeekItem) => {
    peek.push(item)
    if (peek.length > PEEK_SIZE) peek.shift()
  }

  try {
    const lines = createInterface({ input: createReadStream(filePath, 'utf8'), crlfDelay: Infinity })
    for await (const line of lines) {
      let obj: unknown
      try {
        obj = JSON.parse(line)
      } catch {
        continue
      }
      if (!isRec(obj)) continue
      branch = str(obj.gitBranch) ?? branch
      const ts = typeof obj.timestamp === 'string' ? Date.parse(obj.timestamp) : NaN
      const at = isNaN(ts) ? null : ts

      if (obj.type === 'last-prompt') lastPromptRecord = str(obj.lastPrompt) ?? lastPromptRecord
      if (obj.type === 'system' && obj.subtype === 'away_summary') recap = str(obj.content) ?? recap
      if (obj.type !== 'user' && obj.type !== 'assistant') continue
      if (obj.isMeta === true || obj.isSidechain === true) continue
      messageTotal++
      const content = isRec(obj.message) ? obj.message.content : undefined

      if (obj.type === 'user') {
        if (obj.isCompactSummary === true) {
          compactSummary = typedText(content) ?? compactSummary
          continue
        }
        const text = typedText(content)
        if (text) {
          goal ??= text.slice(0, ASK_MAX)
          lastTyped = text
          push({ role: 'user', text, ts: at })
        }
        continue
      }

      const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : Array.isArray(content) ? content : []
      for (const block of blocks) {
        if (!isRec(block)) continue
        if (block.type === 'text' && str(block.text)) {
          lastAnswer = (block.text as string).trim()
          push({ role: 'assistant', text: lastAnswer, ts: at })
        } else if (block.type === 'tool_use') {
          const name = str(block.name)
          const target = name ? toolTarget(name, block.input) : ''
          push({ role: 'tool', text: name ? [name, target].filter(Boolean).join(' ') : 'tool', ts: at })
          if (name && EDIT_TOOLS.has(name) && isRec(block.input) && typeof block.input.file_path === 'string') {
            files.push(relativeTo(projectPath, block.input.file_path))
          }
        }
      }
    }
  } catch {
    return null
  }

  const source = compactSummary ? 'compact' : recap ? 'recap' : 'extract'
  const lastAsk = lastPromptRecord ?? lastTyped
  return {
    handoff: {
      source,
      summary: compactSummary ?? recap,
      goal,
      lastAsk: lastAsk ? lastAsk.slice(0, ASK_MAX) : null,
      files: [...new Set([...files].reverse())],
      branch,
      lastAnswer: lastAnswer ? lastAnswer.slice(0, ANSWER_MAX) : null,
    },
    peek,
    messageTotal,
  }
}

// Pure, so the renderer can import it too.
export { handoffPrompt } from './handoff-prompt'
