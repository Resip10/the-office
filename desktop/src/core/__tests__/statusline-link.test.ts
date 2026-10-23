import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { connectStatusLine, disconnectStatusLine, gitBashFrom, isLinked, linkCommand } from '../statusline-link'

let dir: string
let settingsPath: string
let dataDir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'statusline-link-'))
  settingsPath = join(dir, 'settings.json')
  dataDir = join(dir, 'Session Tray', 'statusline')
  mkdirSync(dataDir, { recursive: true })
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const readSettings = () => JSON.parse(readFileSync(settingsPath, 'utf8'))

describe('linkCommand', () => {
  it('passes the input to the original command and saves input and output, with forward slashes', () => {
    const cmd = linkCommand('bash ~/.claude/statusline.sh', 'C:\\Users\\me\\AppData\\Roaming\\Session Tray\\statusline')
    expect(cmd).toContain("tee 'C:/Users/me/AppData/Roaming/Session Tray/statusline/input.json.tmp'")
    expect(cmd).toContain('bash ~/.claude/statusline.sh')
    expect(cmd).not.toContain('\\')
  })

  it('without an original command it only saves the input', () => {
    expect(linkCommand(null, '/data')).toBe("cat 2>/dev/null > '/data/input.json.tmp'; mv -f '/data/input.json.tmp' '/data/input.json' 2>/dev/null; true")
  })

  it('quotes single quotes in the folder', () => {
    expect(linkCommand(null, "/it's")).toContain("'/it'\\''s/input.json.tmp'")
  })
})

describe('connectStatusLine', () => {
  it('wraps an existing command, keeping its other fields, and remembers the original', () => {
    const original = { type: 'command', command: 'bash ~/sl.sh', padding: 2 }
    writeFileSync(settingsPath, JSON.stringify({ model: 'opus', statusLine: original }, null, 2))
    const r = connectStatusLine(settingsPath, dataDir)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.link.original).toEqual(original)
    const s = readSettings()
    expect(s.model).toBe('opus')
    expect(s.statusLine).toEqual({ type: 'command', command: r.link.command, padding: 2 })
    expect(isLinked(settingsPath, r.link)).toBe(true)
  })

  it('adds a status line when there is none, and creates settings.json when missing', () => {
    const r = connectStatusLine(settingsPath, dataDir)
    expect(r.ok && r.link.original).toBeNull()
    expect(readSettings().statusLine.type).toBe('command')
  })

  it('refuses settings it cannot read, or a status line that is not a command', () => {
    writeFileSync(settingsPath, '{oops')
    expect(connectStatusLine(settingsPath, dataDir)).toEqual({ ok: false, reason: 'unreadable' })
    expect(readFileSync(settingsPath, 'utf8')).toBe('{oops')
    writeFileSync(settingsPath, JSON.stringify({ statusLine: { type: 'static', text: 'hi' } }))
    expect(connectStatusLine(settingsPath, dataDir)).toEqual({ ok: false, reason: 'unsupported' })
  })
})

describe('disconnectStatusLine', () => {
  it('puts the original back exactly', () => {
    const original = { type: 'command', command: 'bash ~/sl.sh', padding: 2 }
    writeFileSync(settingsPath, JSON.stringify({ statusLine: original }))
    const r = connectStatusLine(settingsPath, dataDir)
    if (!r.ok) throw new Error('connect failed')
    expect(disconnectStatusLine(settingsPath, r.link)).toBe('restored')
    expect(readSettings().statusLine).toEqual(original)
  })

  it('removes the status line it added', () => {
    writeFileSync(settingsPath, JSON.stringify({ model: 'opus' }))
    const r = connectStatusLine(settingsPath, dataDir)
    if (!r.ok) throw new Error('connect failed')
    expect(disconnectStatusLine(settingsPath, r.link)).toBe('restored')
    expect(readSettings()).toEqual({ model: 'opus' })
  })

  it('leaves a status line the user changed since', () => {
    writeFileSync(settingsPath, JSON.stringify({ statusLine: { type: 'command', command: 'a' } }))
    const r = connectStatusLine(settingsPath, dataDir)
    if (!r.ok) throw new Error('connect failed')
    writeFileSync(settingsPath, JSON.stringify({ statusLine: { type: 'command', command: 'mine now' } }))
    expect(isLinked(settingsPath, r.link)).toBe(false)
    expect(disconnectStatusLine(settingsPath, r.link)).toBe('changed')
    expect(readSettings().statusLine.command).toBe('mine now')
  })
})

describe('gitBashFrom', () => {
  it('finds bash.exe next to git, preferring CLAUDE_CODE_GIT_BASH_PATH', () => {
    const exists = (p: string) => p.replace(/\\/g, '/') === 'C:/Program Files/Git/bin/bash.exe' || p === 'D:/bash.exe'
    expect(gitBashFrom('C:\\Program Files\\Git\\cmd\\git.exe\r\n', undefined, exists)).toBe(true)
    expect(gitBashFrom('C:\\Other\\git.exe', undefined, exists)).toBe(false)
    expect(gitBashFrom(null, 'D:/bash.exe', exists)).toBe(true)
    expect(gitBashFrom(null, undefined, exists)).toBe(false)
  })
})

// Runs the real command through bash, as Claude Code does, when bash is available.
const bash = (() => { try { execFileSync('bash', ['-c', 'true']); return true } catch { return false } })()
;(bash ? describe : describe.skip)('the command in bash', () => {
  it('prints what the original prints and saves input and output', () => {
    const cmd = linkCommand('cat | tr a-z A-Z', dataDir)
    const out = execFileSync('bash', ['-c', cmd], { input: '{"x":"hi"}' }).toString()
    expect(out).toBe('{"X":"HI"}')
    expect(readFileSync(join(dataDir, 'input.json'), 'utf8')).toBe('{"x":"hi"}')
    expect(readFileSync(join(dataDir, 'output.txt'), 'utf8')).toBe('{"X":"HI"}')
  })

  it('an original ending in a comment still works', () => {
    const cmd = linkCommand('echo ok # trailing comment', dataDir)
    expect(execFileSync('bash', ['-c', cmd], { input: '{}' }).toString()).toBe('ok\n')
  })

  it('keeps printing when Session Tray’s folder is gone', () => {
    const cmd = linkCommand('echo still here', join(dir, 'removed'))
    expect(execFileSync('bash', ['-c', cmd], { input: '{}' }).toString()).toBe('still here\n')
    expect(existsSync(join(dir, 'removed'))).toBe(false)
  })
})
