import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { claudeLaunchFrom, continueInvocation, pruneHandoffs, windowsScript, writeHandoff, type ClaudeLaunch } from '../continue'

const PROMPT = 'He said "hi" & it\'s $HOME `tick` C:\\path\\ end\\\nline 2\nüñí "quoted\\"'
const FOLDER = "C:\\work\\Bob's app; x"
const FILE = "C:\\Users\\me\\App Data\\handoffs\\it's $x `y`.md"
const EXE: ClaudeLaunch = { kind: 'exe', path: 'C:\\Users\\me\\.local\\bin\\claude.exe' }
const NODE: ClaudeLaunch = { kind: 'node-script', path: 'C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js' }
const UNKNOWN: ClaudeLaunch = { kind: 'unknown' }

const decode = (b64: string) => Buffer.from(b64, 'base64').toString('utf16le')
const opts = (over: Partial<Parameters<typeof continueInvocation>[0]> = {}) =>
  ({ folder: FOLDER, promptFile: FILE, platform: 'win32' as NodeJS.Platform, terminal: 'auto' as const, hasWt: true, claude: EXE, ...over })

describe('continueInvocation (win32)', () => {
  it('wt: opens a tab in the folder running an encoded PowerShell script', () => {
    const inv = continueInvocation(opts())!
    expect(inv.file).toBe('wt.exe')
    expect(inv.args.slice(0, 2)).toEqual(['-d', "C:\\work\\Bob's app\\; x"])
    expect(inv.args.slice(2, 5)).toEqual(['powershell.exe', '-NoExit', '-EncodedCommand'])
    expect(inv.cwd).toBe(FOLDER)
  })

  it('powershell terminal (or no wt) goes through cmd start with only safe characters', () => {
    for (const inv of [continueInvocation(opts({ terminal: 'powershell' }))!, continueInvocation(opts({ hasWt: false }))!]) {
      expect(inv.file).toBe('cmd.exe')
      expect(inv.args.slice(0, 5)).toEqual(['/c', 'start', 'powershell.exe', '-NoExit', '-EncodedCommand'])
      for (const a of inv.args) expect(a).toMatch(/^[A-Za-z0-9+/=.\-]+$/)
    }
  })

  it('the prompt text never appears in the arguments, only the file path inside the script', () => {
    const inv = continueInvocation(opts())!
    const script = decode(inv.args[inv.args.length - 1])
    for (const a of inv.args) expect(a).not.toContain('He said')
    expect(script).toContain("[IO.File]::ReadAllText('C:\\Users\\me\\App Data\\handoffs\\it''s $x `y`.md')")
  })

  it('pins the call shape for each claude install kind', () => {
    expect(windowsScript(FILE, EXE)).toContain("& 'C:\\Users\\me\\.local\\bin\\claude.exe' $p")
    expect(windowsScript(FILE, NODE)).toContain("& 'node' 'C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js' $p")
    expect(windowsScript(FILE, UNKNOWN)).toContain('& claude $p')
  })

  it('returns null for an empty folder', () => {
    expect(continueInvocation(opts({ folder: '' }))).toBeNull()
  })
})

describe('claudeLaunchFrom', () => {
  it('an .exe is run directly', () => {
    expect(claudeLaunchFrom('C:\\Users\\me\\.local\\bin\\claude.exe', () => false)).toEqual({ kind: 'exe', path: 'C:\\Users\\me\\.local\\bin\\claude.exe' })
  })

  it('the npm .cmd shim is replaced by node + cli.js when present', () => {
    const cli = join('C:\\npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    expect(claudeLaunchFrom('C:\\npm\\claude.cmd', p => p === cli)).toEqual({ kind: 'node-script', path: cli })
    expect(claudeLaunchFrom('C:\\npm\\claude.cmd', () => false)).toEqual({ kind: 'unknown' })
  })

  it('scans every line of where output (npm lists the extensionless shim first)', () => {
    const cli = join('C:\\npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    const where = 'C:\\npm\\claude\r\nC:\\npm\\claude.cmd\r\n'
    expect(claudeLaunchFrom(where, p => p === cli)).toEqual({ kind: 'node-script', path: cli })
    expect(claudeLaunchFrom('C:\\npm\\claude\r\nC:\\Users\\me\\.local\\bin\\claude.exe\r\n', () => false))
      .toEqual({ kind: 'exe', path: 'C:\\Users\\me\\.local\\bin\\claude.exe' })
  })

  it('nothing found → unknown', () => {
    expect(claudeLaunchFrom(null, () => true)).toEqual({ kind: 'unknown' })
  })
})

describe('continueInvocation (darwin)', () => {
  it('runs claude with the file contents via Terminal', () => {
    const inv = continueInvocation(opts({ platform: 'darwin', folder: "/Users/me/Bob's app", promptFile: "/tmp/it's.md" }))!
    expect(inv.file).toBe('osascript')
    expect(inv.args[1]).toBe(
      `tell application "Terminal" to do script "cd '/Users/me/Bob'\\\\''s app'; claude \\"$(cat '/tmp/it'\\\\''s.md')\\""`,
    )
  })
})

const onWindows = process.platform === 'win32' ? it : it.skip

describe('Windows PowerShell 5.1 round trip', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'continue-')) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  onWindows('delivers the whole prompt as one argument', () => {
    const promptFile = join(dir, "it's $x.md")
    const out = join(dir, 'argv.json')
    const echo = join(dir, 'echo.js')
    writeFileSync(promptFile, PROMPT, 'utf8')
    writeFileSync(echo, `require('fs').writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.argv.slice(2)))`)
    const script = windowsScript(promptFile, { kind: 'node-script', path: echo })
    execFileSync('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')])
    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual([PROMPT])
  }, 30_000)

  onWindows('keeps a backslash before a final newline', () => {
    const tricky = 'ends with a path C:\\dir\\\n'
    const promptFile = join(dir, 'p.md')
    const out = join(dir, 'argv.json')
    const echo = join(dir, 'echo.js')
    writeFileSync(promptFile, tricky, 'utf8')
    writeFileSync(echo, `require('fs').writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.argv.slice(2)))`)
    const script = windowsScript(promptFile, { kind: 'node-script', path: echo })
    execFileSync('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')])
    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual([tricky])
  }, 30_000)
})

describe('handoff files', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'handoffs-')) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('writeHandoff writes the prompt and returns its path', async () => {
    const path = await writeHandoff(join(dir, 'handoffs'), '11111111-1111-4111-8111-111111111111', PROMPT, 1_700_000_000_000)
    expect(path).toBe(join(dir, 'handoffs', '11111111-1111-4111-8111-111111111111-1700000000000.md'))
    expect(readFileSync(path, 'utf8')).toBe(PROMPT)
  })

  it('pruneHandoffs deletes files older than 7 days', async () => {
    const now = Date.now()
    writeFileSync(join(dir, 'old.md'), 'x')
    writeFileSync(join(dir, 'new.md'), 'x')
    utimesSync(join(dir, 'old.md'), (now - 8 * 86_400_000) / 1000, (now - 8 * 86_400_000) / 1000)
    utimesSync(join(dir, 'new.md'), (now - 86_400_000) / 1000, (now - 86_400_000) / 1000)
    await pruneHandoffs(dir, now)
    expect(readdirSync(dir)).toEqual(['new.md'])
  })

  it('pruneHandoffs ignores a missing folder', async () => {
    await expect(pruneHandoffs(join(dir, 'nope'), Date.now())).resolves.toBeUndefined()
  })
})
