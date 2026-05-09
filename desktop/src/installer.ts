import { readFileSync, writeFileSync, existsSync } from 'fs'

const HOOK_COMMAND =
  "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"

const HOOK_EVENTS = [
  'SessionStart', 'SessionEnd', 'SubagentStart', 'SubagentStop',
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Stop', 'Notification',
]

interface ClaudeSettings {
  hooks?: Record<string, Array<{ hooks: Array<{ type: string; command: string }> }>>
  [key: string]: unknown
}

export function installHooks(settingsPath: string): boolean {
  let settings: ClaudeSettings = {}

  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as ClaudeSettings
    } catch {
      return false
    }
  }

  if (!settings.hooks) settings.hooks = {}

  let changed = false
  for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) {
      settings.hooks[event] = [{ hooks: [{ type: 'command', command: HOOK_COMMAND }] }]
      changed = true
    }
  }

  if (changed) {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  }
  return true
}

export function uninstallHooks(settingsPath: string): boolean {
  if (!existsSync(settingsPath)) return false
  let settings: ClaudeSettings
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as ClaudeSettings
  } catch {
    return false
  }

  if (!settings.hooks) return true

  let changed = false
  for (const event of HOOK_EVENTS) {
    const matchers = settings.hooks[event]
    if (!matchers) continue
    const filtered = matchers.map(matcher => ({
      ...matcher,
      hooks: matcher.hooks.filter(h => h.command !== HOOK_COMMAND),
    })).filter(matcher => matcher.hooks.length > 0)

    if (filtered.length !== matchers.length || filtered.some((m, i) => m.hooks.length !== matchers[i].hooks.length)) {
      changed = true
    }
    if (filtered.length === 0) {
      delete settings.hooks[event]
    } else {
      settings.hooks[event] = filtered
    }
  }

  if (changed) {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  }
  return true
}

export function hasHooks(settingsPath: string): boolean {
  if (!existsSync(settingsPath)) return false
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as ClaudeSettings
    return Boolean(settings.hooks?.SessionStart)
  } catch {
    return false
  }
}
