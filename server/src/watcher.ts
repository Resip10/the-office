import { watch, FSWatcher } from 'chokidar'
import { readFileSync, statSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { Relay } from './relay'
import type { EnrichmentData, AgentSnapshot } from './types'
import { parseJSONLSession } from './bootstrap'
import { inferEvents } from './jsonl-status'

export function extractEnrichment(lines: string[]): EnrichmentData | null {
  let model = ''
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let cacheWriteTokens = 0
  let costUSD = 0
  let turnDurationMs = 0
  let isSidechain = false
  let found = false

  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>

      if (typeof obj.isSidechain === 'boolean') isSidechain = obj.isSidechain
      if (typeof obj.costUSD === 'number') { costUSD = obj.costUSD; found = true }
      if (typeof obj.turn_duration === 'number') { turnDurationMs = obj.turn_duration; found = true }

      const msg = obj.message as Record<string, unknown> | undefined
      if (msg && typeof msg.model === 'string') {
        model = msg.model
        found = true
        const usage = msg.usage as Record<string, unknown> | undefined
        if (usage) {
          if (typeof usage.input_tokens === 'number') inputTokens = usage.input_tokens
          if (typeof usage.output_tokens === 'number') outputTokens = usage.output_tokens
          if (typeof usage.cache_read_input_tokens === 'number') cacheReadTokens = usage.cache_read_input_tokens
          if (typeof usage.cache_creation_input_tokens === 'number') cacheWriteTokens = usage.cache_creation_input_tokens
        }
      }
    } catch {
      // skip malformed line
    }
  }

  if (!found) return null
  return { model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, costUSD, turnDurationMs, isSidechain }
}

interface FileState {
  offset: number
  partial: string
  sessionId: string | null
}

export function startWatcher(relay: Relay, hookSessions: Set<string>): FSWatcher {
  const claudeDir = join(homedir(), '.claude', 'projects')
  const fileState = new Map<string, FileState>()
  const seenSessions = new Set<string>()

  const watcher = watch('**/*.jsonl', {
    cwd: claudeDir,
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  })

  watcher.on('add', (relPath) => {
    const fullPath = join(claudeDir, relPath)
    try {
      const content = readFileSync(fullPath, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)
      const size = statSync(fullPath).size

      const snapshot = parseJSONLSession(fullPath, lines)
      if (snapshot) {
        fileState.set(fullPath, { offset: size, partial: '', sessionId: snapshot.sessionId })

        if (!seenSessions.has(snapshot.sessionId)) {
          seenSessions.add(snapshot.sessionId)
          const fullSnapshot: AgentSnapshot = { ...snapshot, hasHooks: false }
          relay.broadcastRaw({ type: 'session_discovered', payload: fullSnapshot })
        }

        const enrich = extractEnrichment(lines)
        if (enrich) {
          relay.broadcastRaw({ type: 'enrich', sessionId: snapshot.sessionId, data: enrich })
        }
      } else {
        fileState.set(fullPath, { offset: size, partial: '', sessionId: null })
      }
    } catch {
      // unreadable file — skip silently
    }
  })

  watcher.on('change', (relPath) => {
    const fullPath = join(claudeDir, relPath)
    const state = fileState.get(fullPath)
    if (!state?.sessionId) return

    try {
      const size = statSync(fullPath).size
      if (size <= state.offset) return

      const fd = readFileSync(fullPath)
      const newBytes = fd.slice(state.offset)
      const newText = state.partial + newBytes.toString('utf-8')
      state.offset = size

      const lastNewline = newText.lastIndexOf('\n')
      if (lastNewline === -1) {
        state.partial = newText
        return
      }

      const complete = newText.slice(0, lastNewline)
      state.partial = newText.slice(lastNewline + 1)

      const newLines = complete.split('\n').filter(Boolean)
      if (newLines.length === 0) return

      if (!hookSessions.has(state.sessionId)) {
        const syntheticEvents = inferEvents(state.sessionId, newLines)
        for (const ev of syntheticEvents) {
          relay.push(ev)
        }
      }

      const enrich = extractEnrichment(newLines)
      if (enrich) {
        relay.broadcastRaw({ type: 'enrich', sessionId: state.sessionId, data: enrich })
      }
    } catch {
      // skip silently
    }
  })

  return watcher
}
