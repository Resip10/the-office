import type { SessionRecord, TerminalChoice } from './types'

type Target = Pick<SessionRecord, 'id' | 'projectPath'>

export interface Invocation {
  file: string
  args: string[]
  cwd: string
}

const SESSION_ID = /^[0-9a-f-]{36}$/

// Single quotes keep $ and backticks literal; only the quote itself is escaped, differently per shell.
export function copyCommand(r: Target, platform: NodeJS.Platform): string {
  const resume = `claude --resume ${r.id}`
  if (!r.projectPath) return resume
  const quoted = platform === 'win32'
    ? `'${r.projectPath.replace(/'/g, "''")}'`
    : `'${r.projectPath.replace(/'/g, `'\\''`)}'`
  return `cd ${quoted}; ${resume}`
}

export function resumeInvocation(r: Target, platform: NodeJS.Platform, terminal: TerminalChoice, hasWt: boolean): Invocation | null {
  if (!SESSION_ID.test(r.id) || !r.projectPath) return null
  const cwd = r.projectPath
  const resume = `claude --resume ${r.id}`

  if (platform === 'win32') {
    // Run claude inside powershell so the window stays open after claude exits.
    const shell = ['powershell.exe', '-NoExit', '-Command', resume]
    // A detached powershell gets no console and silently does nothing; `start` opens a new console window.
    if (!hasWt || terminal === 'powershell') return { file: 'cmd.exe', args: ['/c', 'start', ...shell], cwd }
    // `;` separates commands in wt's command line.
    return { file: 'wt.exe', args: ['-d', cwd.replace(/;/g, '\\;'), ...shell], cwd }
  }

  if (platform === 'darwin') {
    const shellPath = `'${cwd.replace(/'/g, `'\\''`)}'`
    const script = `cd ${shellPath}; ${resume}`.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return {
      file: 'osascript',
      args: ['-e', `tell application "Terminal" to do script "${script}"`, '-e', 'tell application "Terminal" to activate'],
      cwd,
    }
  }

  return null
}

// One-line form of an invocation, for showing the user what will run.
export function describeInvocation(inv: Invocation): string {
  return [inv.file, ...inv.args].map(a => (/\s/.test(a) ? `"${a}"` : a)).join(' ')
}
