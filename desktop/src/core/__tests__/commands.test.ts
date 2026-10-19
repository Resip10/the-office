import { copyCommand, resumeInvocation } from '../commands'

const ID = '0c29cf4c-54bc-4ff4-9393-82f33c39613d'
const PATH = 'C:\\work\\my app'

describe('copyCommand', () => {
  it('cds into the single-quoted project path and resumes', () => {
    expect(copyCommand({ id: ID, projectPath: PATH }, 'win32')).toBe(`cd 'C:\\work\\my app'; claude --resume ${ID}`)
  })

  it('keeps non-ASCII paths verbatim', () => {
    expect(copyCommand({ id: ID, projectPath: 'C:\\Users\\Ігар\\праект' }, 'win32'))
      .toBe(`cd 'C:\\Users\\Ігар\\праект'; claude --resume ${ID}`)
  })

  it('$ and backtick in the path stay literal (no shell expansion)', () => {
    expect(copyCommand({ id: ID, projectPath: 'C:\\work\\$money`s' }, 'win32'))
      .toBe(`cd 'C:\\work\\$money\`s'; claude --resume ${ID}`)
  })

  it("win32 doubles ' for PowerShell", () => {
    expect(copyCommand({ id: ID, projectPath: "C:\\Bob's app" }, 'win32')).toBe(`cd 'C:\\Bob''s app'; claude --resume ${ID}`)
  })

  it("darwin escapes ' for bash/zsh", () => {
    expect(copyCommand({ id: ID, projectPath: "/Users/Bob's app" }, 'darwin')).toBe(`cd '/Users/Bob'\\''s app'; claude --resume ${ID}`)
  })

  it('omits cd when project path is unknown', () => {
    expect(copyCommand({ id: ID, projectPath: null }, 'win32')).toBe(`claude --resume ${ID}`)
  })
})

describe('resumeInvocation', () => {
  it('win32 with wt opens a Windows Terminal tab running powershell in the project', () => {
    expect(resumeInvocation({ id: ID, projectPath: PATH }, 'win32', true)).toEqual({
      file: 'wt.exe',
      args: ['-d', PATH, 'powershell.exe', '-NoExit', '-Command', `claude --resume ${ID}`],
      cwd: PATH,
    })
  })

  it('win32 with wt escapes ; in the path (wt command separator)', () => {
    const inv = resumeInvocation({ id: ID, projectPath: 'C:\\a;b' }, 'win32', true)
    expect(inv?.args[1]).toBe('C:\\a\\;b')
    expect(inv?.cwd).toBe('C:\\a;b')
  })

  // A detached powershell gets no console on Windows and silently does nothing;
  // `start` gives it a new console window.
  it('win32 without wt opens a powershell console in the project via cmd start', () => {
    expect(resumeInvocation({ id: ID, projectPath: PATH }, 'win32', false)).toEqual({
      file: 'cmd.exe',
      args: ['/c', 'start', 'powershell.exe', '-NoExit', '-Command', `claude --resume ${ID}`],
      cwd: PATH,
    })
  })

  it('darwin uses osascript with a single-quoted, escaped path', () => {
    const inv = resumeInvocation({ id: ID, projectPath: `/Users/me/Bob's "app"` }, 'darwin', false)
    expect(inv?.file).toBe('osascript')
    expect(inv?.args).toEqual([
      '-e', `tell application "Terminal" to do script "cd '/Users/me/Bob'\\\\''s \\"app\\"'; claude --resume ${ID}"`,
      '-e', 'tell application "Terminal" to activate',
    ])
  })

  it('returns null for invalid id', () => {
    expect(resumeInvocation({ id: 'abc; rm -rf /', projectPath: PATH }, 'win32', true)).toBeNull()
    expect(resumeInvocation({ id: `${ID}; calc`, projectPath: PATH }, 'win32', false)).toBeNull()
  })

  it('returns null when project path is unknown', () => {
    expect(resumeInvocation({ id: ID, projectPath: null }, 'win32', true)).toBeNull()
  })

  it('returns null on unsupported platforms', () => {
    expect(resumeInvocation({ id: ID, projectPath: '/home/me/app' }, 'linux', false)).toBeNull()
  })
})
