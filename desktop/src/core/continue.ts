import { mkdir, readdir, stat, unlink, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { Invocation } from './commands'
import type { TerminalChoice } from './types'

// How to start `claude` on Windows. The npm shim (claude.cmd) cuts arguments at the first
// newline, so for npm installs we run its cli.js with node directly.
export type ClaudeLaunch =
  | { kind: 'exe'; path: string }
  | { kind: 'node-script'; path: string }
  | { kind: 'unknown' }

const HANDOFF_MAX_AGE_MS = 7 * 86_400_000

const psQuote = (s: string) => `'${s.replace(/'/g, "''")}'`

export function claudeLaunchFrom(wherePath: string | null, fileExists: (p: string) => boolean): ClaudeLaunch {
  if (!wherePath) return { kind: 'unknown' }
  if (/\.exe$/i.test(wherePath)) return { kind: 'exe', path: wherePath }
  if (/\.cmd$/i.test(wherePath)) {
    const script = join(dirname(wherePath), 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    if (fileExists(script)) return { kind: 'node-script', path: script }
  }
  return { kind: 'unknown' }
}

// PowerShell script that reads the prompt file and passes it to claude as one argument.
// Windows PowerShell 5.1 passes native arguments without escaping embedded quotes, so the
// script escapes them itself (MSVC rules: \" for a quote, double the backslashes before a quote
// and at the end, where 5.1 adds its own closing quote).
export function windowsScript(promptFile: string, claude: ClaudeLaunch): string {
  const call = claude.kind === 'exe'
    ? `& ${psQuote(claude.path)} $p`
    : claude.kind === 'node-script'
      ? `& 'node' ${psQuote(claude.path)} $p`
      : '& claude $p'
  return [
    `$p = [IO.File]::ReadAllText(${psQuote(promptFile)})`,
    `$p = $p -replace '(\\\\*)"', '$1$1\\"' -replace '(\\\\+)$', '$1$1'`,
    call,
  ].join('\n')
}

export function continueInvocation(opts: {
  folder: string
  promptFile: string
  platform: NodeJS.Platform
  terminal: TerminalChoice
  hasWt: boolean
  claude: ClaudeLaunch
}): Invocation | null {
  const { folder, promptFile, platform, terminal, hasWt, claude } = opts
  if (!folder) return null

  if (platform === 'win32') {
    // Base64 keeps the script clear of wt's `;` separator and cmd's metacharacters.
    const encoded = Buffer.from(windowsScript(promptFile, claude), 'utf16le').toString('base64')
    const shell = ['powershell.exe', '-NoExit', '-EncodedCommand', encoded]
    if (!hasWt || terminal === 'powershell') return { file: 'cmd.exe', args: ['/c', 'start', ...shell], cwd: folder }
    return { file: 'wt.exe', args: ['-d', folder.replace(/;/g, '\\;'), ...shell], cwd: folder }
  }

  if (platform === 'darwin') {
    const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
    const script = `cd ${sh(folder)}; claude "$(cat ${sh(promptFile)})"`.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return {
      file: 'osascript',
      args: ['-e', `tell application "Terminal" to do script "${script}"`, '-e', 'tell application "Terminal" to activate'],
      cwd: folder,
    }
  }

  return null
}

export async function writeHandoff(dir: string, id: string, prompt: string, now: number): Promise<string> {
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${id}-${now}.md`)
  await writeFile(path, prompt, 'utf8')
  return path
}

export async function pruneHandoffs(dir: string, now: number, maxAgeMs = HANDOFF_MAX_AGE_MS): Promise<void> {
  const names = await readdir(dir).catch(() => [] as string[])
  await Promise.all(names.map(async name => {
    const path = join(dir, name)
    const st = await stat(path).catch(() => null)
    if (st?.isFile() && now - st.mtimeMs > maxAgeMs) await unlink(path).catch(() => {})
  }))
}
