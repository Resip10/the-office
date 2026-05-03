import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { installHooks, hasHooks, uninstallHooks } from '../installer'

const HOOK_EVENTS = [
  'SessionStart', 'SessionEnd', 'SubagentStart', 'SubagentStop',
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Stop', 'Notification',
]

let tmpDir: string
let settingsPath: string

beforeEach(() => {
  tmpDir = join(tmpdir(), `installer-test-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
  settingsPath = join(tmpDir, 'settings.json')
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('installHooks', () => {
  it('creates settings.json with all hook events when file does not exist', () => {
    const result = installHooks(settingsPath)
    expect(result).toBe(true)
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    for (const event of HOOK_EVENTS) {
      expect(settings.hooks[event]).toBeDefined()
      expect(settings.hooks[event][0].hooks[0].type).toBe('command')
    }
  })

  it('adds hooks to existing settings without disturbing other fields', () => {
    writeFileSync(settingsPath, JSON.stringify({ theme: 'dark', someOtherKey: 42 }, null, 2))
    installHooks(settingsPath)
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    expect(settings.theme).toBe('dark')
    expect(settings.someOtherKey).toBe(42)
    expect(settings.hooks.SessionStart).toBeDefined()
  })

  it('is idempotent — calling twice does not duplicate or overwrite hooks', () => {
    installHooks(settingsPath)
    const first = readFileSync(settingsPath, 'utf8')
    installHooks(settingsPath)
    const second = readFileSync(settingsPath, 'utf8')
    expect(first).toBe(second)
  })

  it('returns false when the settings file contains invalid JSON', () => {
    writeFileSync(settingsPath, 'not valid json')
    const result = installHooks(settingsPath)
    expect(result).toBe(false)
  })
})

describe('uninstallHooks', () => {
  it('returns false when file does not exist', () => {
    expect(uninstallHooks(settingsPath)).toBe(false)
  })

  it('returns false when file contains invalid JSON', () => {
    writeFileSync(settingsPath, 'not json')
    expect(uninstallHooks(settingsPath)).toBe(false)
  })

  it('removes all The Office hook entries and returns true', () => {
    installHooks(settingsPath)
    const result = uninstallHooks(settingsPath)
    expect(result).toBe(true)
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    expect(settings.hooks).toEqual({})
  })

  it('does not remove other hooks', () => {
    const other = { type: 'command', command: 'echo hello' }
    writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        SessionStart: [{ hooks: [other] }],
      },
    }, null, 2))
    installHooks(settingsPath)
    uninstallHooks(settingsPath)
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    // The Office hook removed; other hook stays
    expect(settings.hooks.SessionStart[0].hooks).toEqual([other])
  })

  it('deletes empty hook arrays after removal', () => {
    installHooks(settingsPath)
    uninstallHooks(settingsPath)
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    for (const key of Object.keys(settings.hooks ?? {})) {
      expect(settings.hooks[key].length).toBeGreaterThan(0)
    }
  })

  it('is idempotent — calling twice is safe', () => {
    installHooks(settingsPath)
    uninstallHooks(settingsPath)
    expect(() => uninstallHooks(settingsPath)).not.toThrow()
  })
})

describe('hasHooks', () => {
  it('returns false when file does not exist', () => {
    expect(hasHooks(settingsPath)).toBe(false)
  })

  it('returns false when hooks are not configured', () => {
    writeFileSync(settingsPath, JSON.stringify({ theme: 'dark' }, null, 2))
    expect(hasHooks(settingsPath)).toBe(false)
  })

  it('returns true after installHooks has run', () => {
    installHooks(settingsPath)
    expect(hasHooks(settingsPath)).toBe(true)
  })
})
