import type { SessionRecord } from './types'

type Target = Pick<SessionRecord, 'id' | 'projectPath'>

export interface Invocation {
  file: string
  args: string[]
  cwd: string
}

const SESSION_ID = /^[0-9a-f-]{36}$/

export function copyCommand(r: Target): string {
  const resume = `claude --resume ${r.id}`
  return r.projectPath ? `cd "${r.projectPath}"; ${resume}` : resume
}

export function resumeInvocation(r: Target, platform: NodeJS.Platform, hasWt: boolean): Invocation | null {
  if (!SESSION_ID.test(r.id) || !r.projectPath) return null
  const cwd = r.projectPath
  const resume = `claude --resume ${r.id}`

  if (platform === 'win32') {
    // Run claude inside powershell so the window stays open after claude exits.
    const shell = ['powershell.exe', '-NoExit', '-Command', resume]
    if (!hasWt) return { file: shell[0], args: shell.slice(1), cwd }
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
