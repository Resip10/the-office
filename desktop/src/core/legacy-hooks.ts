import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'

// Exact command the old The Office installer wrote into ~/.claude/settings.json.
export const HOOK_COMMAND =
  "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"

interface ClaudeSettings {
  hooks?: Record<string, Array<{ hooks: Array<{ type: string; command: string }> }>>
  [key: string]: unknown
}

function readSettings(settingsPath: string): ClaudeSettings | null {
  if (!existsSync(settingsPath)) return null
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8').replace(/^﻿/, '')) as ClaudeSettings
  } catch {
    return null
  }
}

export function hasLegacyHooks(settingsPath: string): boolean {
  const settings = readSettings(settingsPath)
  return Object.values(settings?.hooks ?? {}).some(matchers =>
    Array.isArray(matchers) && matchers.some(m => m?.hooks?.some(h => h?.command === HOOK_COMMAND)))
}

export function uninstallHooks(settingsPath: string): boolean {
  const settings = readSettings(settingsPath)
  if (!settings) return false
  if (!settings.hooks) return true

  let changed = false
  for (const [event, matchers] of Object.entries(settings.hooks)) {
    if (!Array.isArray(matchers)) continue
    // Matchers without a hooks array are not ours; keep them as they are.
    const filtered = matchers
      .map(matcher => Array.isArray(matcher?.hooks)
        ? { ...matcher, hooks: matcher.hooks.filter(h => h?.command !== HOOK_COMMAND) }
        : matcher)
      .filter(matcher => !Array.isArray(matcher?.hooks) || matcher.hooks.length > 0)

    if (JSON.stringify(filtered) !== JSON.stringify(matchers)) changed = true
    if (filtered.length === 0) delete settings.hooks[event]
    else settings.hooks[event] = filtered
  }

  if (changed) {
    // Claude Code reads this file too; never leave it half-written.
    const tmp = `${settingsPath}.tmp`
    writeFileSync(tmp, JSON.stringify(settings, null, 2))
    renameSync(tmp, settingsPath)
  }
  return true
}
