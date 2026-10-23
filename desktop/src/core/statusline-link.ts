import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { StatusLink } from './types'

export type { StatusLink }

// Claude Code passes plan limits and other session data only to the status line command. "Connect" wraps that
// command in ~/.claude/settings.json so each refresh also saves its input JSON and printed text into Session Tray's
// folder; "Disconnect" puts the original back. Besides removing the old hooks, this is the only write to ~/.claude,
// and it only happens on an explicit click.

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

export type ConnectResult = { ok: true; link: StatusLink } | { ok: false; reason: 'unreadable' | 'unsupported' }

// Claude Code runs the command through Git Bash on Windows, which needs forward slashes.
const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
const slashes = (p: string) => p.replace(/\\/g, '/')

export function linkCommand(original: string | null, dir: string): string {
  const d = slashes(dir)
  const [json, jsonTmp, text, textTmp] = ['input.json', 'input.json.tmp', 'output.txt', 'output.txt.tmp'].map(f => sh(`${d}/${f}`))
  // Errors are silenced, and the command ends with `true`, so the status line keeps working even if
  // Session Tray's folder is gone.
  if (original === null) return `cat 2>/dev/null > ${jsonTmp}; mv -f ${jsonTmp} ${json} 2>/dev/null; true`
  // Newlines around the original keep a trailing comment from swallowing the closing brace.
  return `tee ${jsonTmp} 2>/dev/null | {\n${original}\n} | tee ${textTmp} 2>/dev/null; mv -f ${jsonTmp} ${json} 2>/dev/null; mv -f ${textTmp} ${text} 2>/dev/null; true`
}

// undefined: unreadable. A missing file is an empty object.
function readSettings(path: string): Rec | undefined {
  if (!existsSync(path)) return {}
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''))
    return isRec(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function writeSettings(path: string, settings: Rec): void {
  // Claude Code reads this file too; never leave it half-written.
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(settings, null, 2))
  renameSync(tmp, path)
}

export function connectStatusLine(settingsPath: string, dir: string): ConnectResult {
  const settings = readSettings(settingsPath)
  if (!settings) return { ok: false, reason: 'unreadable' }
  const current = settings.statusLine
  const isCommand = isRec(current) && current.type === 'command' && typeof current.command === 'string'
  if (current !== undefined && !isCommand) return { ok: false, reason: 'unsupported' }
  const original = isCommand ? (current as Rec) : null
  const command = linkCommand(original ? (original.command as string) : null, dir)
  writeSettings(settingsPath, { ...settings, statusLine: { ...(original ?? { type: 'command' }), command } })
  return { ok: true, link: { original, command } }
}

export function isLinked(settingsPath: string, link: StatusLink): boolean {
  const current = readSettings(settingsPath)?.statusLine
  return isRec(current) && current.command === link.command
}

// 'changed': the user replaced our command since; it is left alone.
export function disconnectStatusLine(settingsPath: string, link: StatusLink): 'restored' | 'changed' | 'unreadable' {
  const settings = readSettings(settingsPath)
  if (!settings) return 'unreadable'
  if (!isLinked(settingsPath, link)) return 'changed'
  const { statusLine: _ours, ...rest } = settings
  writeSettings(settingsPath, link.original ? { ...rest, statusLine: link.original } : rest)
  return 'restored'
}

// Windows only: Claude Code runs status lines through Git Bash when it is installed, otherwise PowerShell,
// which can't run the wrapped command. `where git` lists git.exe under <Git>\cmd; bash.exe lives in <Git>\bin.
export function gitBashFrom(whereGitOutput: string | null, envPath: string | undefined, fileExists: (p: string) => boolean): boolean {
  if (envPath && fileExists(envPath)) return true
  const gits = (whereGitOutput ?? '').split(/\r?\n/).map(p => p.trim()).filter(p => /git\.exe$/i.test(p))
  return gits.some(git => fileExists(join(dirname(dirname(git)), 'bin', 'bash.exe')))
}
