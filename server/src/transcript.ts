import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { normalize } from 'path'

export interface TranscriptSnapshot {
  firstPrompt: string | null
  latestUser: string | null
  latestAssistant: string | null
  messageCount: number
}

type Block = { type: string; [key: string]: unknown }

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return (content as Block[])
    .filter(b => b.type === 'text')
    .map(b => String(b.text ?? ''))
    .join('')
}

function isPureToolResult(content: unknown): boolean {
  if (!Array.isArray(content) || (content as Block[]).length === 0) return false
  return (content as Block[]).every(b => b.type === 'tool_result')
}

export function extractSnapshot(lines: string[]): TranscriptSnapshot {
  let firstPrompt: string | null = null
  let latestUser: string | null = null
  let latestAssistant: string | null = null
  let messageCount = 0

  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>
      if (obj.type !== 'user' && obj.type !== 'assistant') continue

      const msg = obj.message as Record<string, unknown> | undefined
      if (!msg) continue

      const rawContent = msg.content

      if (obj.type === 'user') {
        if (isPureToolResult(rawContent)) continue
        messageCount++
        const text = extractText(rawContent)
        if (text) {
          if (firstPrompt === null) firstPrompt = text
          latestUser = text
        }
      } else {
        const text = extractText(rawContent)
        if (text) {
          latestAssistant = text
          messageCount++
        }
      }
    } catch {
      // malformed line — skip
    }
  }

  return { firstPrompt, latestUser, latestAssistant, messageCount }
}

export async function readSnapshot(filePath: string): Promise<TranscriptSnapshot> {
  // Security: path must be inside ~/.claude to prevent path traversal
  const claudeDir = normalize(homedir() + '/.claude')
  const normalized = normalize(filePath)
  if (!normalized.startsWith(claudeDir)) {
    throw new Error('Path outside allowed directory')
  }

  const content = await readFile(normalized, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)
  return extractSnapshot(lines)
}
