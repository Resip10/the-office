import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { HOOK_COMMAND, hasLegacyHooks, uninstallHooks } from '../legacy-hooks'

const HOOK_EVENTS = [
  'SessionStart', 'SessionEnd', 'SubagentStart', 'SubagentStop',
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Stop', 'Notification',
]
const legacy = { type: 'command', command: HOOK_COMMAND }
const other = { type: 'command', command: 'echo hello' }

let tmpDir: string
let settingsPath: string

// Settings as the old The Office installer left them.
function writeLegacySettings(extra: Record<string, unknown> = {}) {
  const hooks: Record<string, unknown> = {}
  for (const event of HOOK_EVENTS) hooks[event] = [{ hooks: [legacy] }]
  writeFileSync(settingsPath, JSON.stringify({ ...extra, hooks }, null, 2))
}

const readSettings = () => JSON.parse(readFileSync(settingsPath, 'utf8'))

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'legacy-hooks-'))
  settingsPath = join(tmpDir, 'settings.json')
})

afterEach(() => rmSync(tmpDir, { recursive: true, force: true }))

describe('hasLegacyHooks', () => {
  it('true when the old hook command is present', () => {
    writeLegacySettings()
    expect(hasLegacyHooks(settingsPath)).toBe(true)
  })

  it('false when only other hooks exist', () => {
    writeFileSync(settingsPath, JSON.stringify({ hooks: { SessionStart: [{ hooks: [other] }] } }))
    expect(hasLegacyHooks(settingsPath)).toBe(false)
  })

  it('false for missing file', () => {
    expect(hasLegacyHooks(settingsPath)).toBe(false)
  })

  it('hasLegacyHooks handles BOM and invalid JSON', () => {
    writeFileSync(settingsPath, '﻿' + JSON.stringify({ hooks: { Stop: [{ hooks: [legacy] }] } }))
    expect(hasLegacyHooks(settingsPath)).toBe(true)
    writeFileSync(settingsPath, '{oops')
    expect(hasLegacyHooks(settingsPath)).toBe(false)
  })
})

describe('uninstallHooks', () => {
  it('returns false when file does not exist', () => {
    expect(uninstallHooks(settingsPath)).toBe(false)
  })

  it('returns false and does not write when file contains invalid JSON', () => {
    writeFileSync(settingsPath, 'not json')
    expect(uninstallHooks(settingsPath)).toBe(false)
    expect(readFileSync(settingsPath, 'utf8')).toBe('not json')
  })

  it('removes all The Office hook entries and returns true', () => {
    writeLegacySettings({ theme: 'dark' })
    expect(uninstallHooks(settingsPath)).toBe(true)
    expect(readSettings()).toEqual({ theme: 'dark', hooks: {} })
    expect(hasLegacyHooks(settingsPath)).toBe(false)
  })

  it('does not remove other hooks', () => {
    writeFileSync(settingsPath, JSON.stringify({
      hooks: { SessionStart: [{ hooks: [legacy] }, { hooks: [other] }], Stop: [{ hooks: [legacy, other] }] },
    }))
    uninstallHooks(settingsPath)
    expect(readSettings().hooks).toEqual({
      SessionStart: [{ hooks: [other] }],
      Stop: [{ hooks: [other] }],
    })
  })

  it('handles a BOM-prefixed settings file', () => {
    writeFileSync(settingsPath, '﻿' + JSON.stringify({ hooks: { Stop: [{ hooks: [legacy] }] } }))
    expect(uninstallHooks(settingsPath)).toBe(true)
    expect(readSettings()).toEqual({ hooks: {} })
  })

  it('is idempotent — calling twice is safe', () => {
    writeLegacySettings()
    uninstallHooks(settingsPath)
    const first = readFileSync(settingsPath, 'utf8')
    expect(uninstallHooks(settingsPath)).toBe(true)
    expect(readFileSync(settingsPath, 'utf8')).toBe(first)
  })
})
