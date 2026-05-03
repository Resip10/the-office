import type { HookEvent } from './types'

export function inferEvents(sessionId: string, lines: string[]): HookEvent[] {
  let lastToolName: string | null = null
  let lastStatus: 'working' | 'idle' | null = null

  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>

      if (obj.type === 'assistant') {
        const msg = obj.message as { content?: unknown[] } | undefined
        for (const item of (msg?.content ?? [])) {
          const block = item as { type?: string; name?: string }
          if (block.type === 'tool_use') {
            lastToolName = block.name ?? 'unknown'
            lastStatus = 'working'
          }
        }
      }

      if (obj.type === 'user') {
        const msg = obj.message as { content?: unknown[] } | undefined
        for (const item of (msg?.content ?? [])) {
          const block = item as { type?: string }
          if (block.type === 'tool_result') {
            lastStatus = 'idle'
            lastToolName = null
          }
        }
      }

      if (typeof obj.turn_duration === 'number') {
        lastStatus = 'idle'
        lastToolName = null
      }
    } catch {
      // skip malformed line
    }
  }

  if (lastStatus === null) return []

  const ts = Date.now()
  const id = crypto.randomUUID()

  if (lastStatus === 'working' && lastToolName) {
    return [{
      session_id: sessionId,
      hook_event_name: 'PreToolUse',
      tool_name: lastToolName,
      _timestamp: ts,
      _id: id,
    }]
  }

  return [{
    session_id: sessionId,
    hook_event_name: 'PostToolUse',
    _timestamp: ts,
    _id: id,
  }]
}
