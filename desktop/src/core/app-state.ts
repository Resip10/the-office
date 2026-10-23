import { readFile, rename, writeFile } from 'fs/promises'
import { DEFAULT_SETTINGS, NOTIFY_AFTER_MIN, type AppState, type NotifyAfterMin, type Settings } from './types'

type Rec = Record<string, unknown>

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const threshold = (v: unknown, fallback: number | null) =>
  v === null ? null : Number.isInteger(v) && (v as number) > 0 ? (v as number) : fallback

function record<T>(v: unknown, valid: (x: unknown) => x is T): Record<string, T> {
  if (!isRec(v)) return {}
  return Object.fromEntries(Object.entries(v).filter(([, x]) => valid(x))) as Record<string, T>
}

// Unknown or invalid fields fall back to the defaults, field by field.
export function settingsFrom(v: unknown): Settings {
  const s = isRec(v) ? v : {}
  const d = DEFAULT_SETTINGS
  const stale = isRec(s.stale) ? s.stale : {}
  return {
    theme: oneOf(s.theme, ['carbon', 'graphite', 'midnight', 'ink', 'paper'], d.theme),
    followSystem: bool(s.followSystem, d.followSystem),
    density: oneOf(s.density, ['comfortable', 'compact'], d.density),
    pulse: bool(s.pulse, d.pulse),
    peekTools: bool(s.peekTools, d.peekTools),
    terminal: oneOf(s.terminal, ['auto', 'wt', 'powershell', 'terminal'], d.terminal),
    launchAtLogin: bool(s.launchAtLogin, d.launchAtLogin),
    notify: bool(s.notify, d.notify),
    notifyAfterMin: NOTIFY_AFTER_MIN.includes(s.notifyAfterMin as NotifyAfterMin) ? s.notifyAfterMin as NotifyAfterMin : d.notifyAfterMin,
    stale: {
      idleDays: threshold(stale.idleDays, d.stale.idleDays),
      trivialMessages: threshold(stale.trivialMessages, d.stale.trivialMessages),
      missingFolder: bool(stale.missingFolder, d.stale.missingFolder),
    },
  }
}

export async function loadAppState(path: string): Promise<AppState> {
  let obj: Rec = {}
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
    if (isRec(parsed)) obj = parsed
  } catch {
    // missing or corrupt: defaults
  }
  return {
    pins: strings(obj.pins),
    names: record(obj.names, (x): x is string => typeof x === 'string'),
    archived: strings(obj.archived),
    keptAt: record(obj.keptAt, (x): x is number => typeof x === 'number' && Number.isFinite(x)),
    notifyTipDone: bool(obj.notifyTipDone, false),
    settings: settingsFrom(obj.settings),
  }
}

// Serialise updates per file so two quick changes can't overwrite each other.
const queues = new Map<string, Promise<unknown>>()

// A failed write resolves to the state on disk, so the UI shows what was actually saved.
export function updateAppState(path: string, fn: (s: AppState) => AppState): Promise<AppState> {
  const run = (queues.get(path) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const current = await loadAppState(path)
    const next = fn(current)
    const tmp = `${path}.tmp`
    try {
      await writeFile(tmp, JSON.stringify(next, null, 2))
      await rename(tmp, path)
      return next
    } catch {
      return current
    }
  })
  queues.set(path, run)
  return run
}

export function togglePin(path: string, id: string): Promise<AppState> {
  return updateAppState(path, s => ({
    ...s,
    pins: s.pins.includes(id) ? s.pins.filter(p => p !== id) : [...s.pins, id],
  }))
}

const NAME_MAX = 200

// App-owned display name; empty or null removes it.
export function setName(state: AppState, id: string, name: string | null): AppState {
  const names = { ...state.names }
  const clean = (name ?? '').trim().slice(0, NAME_MAX)
  if (clean) names[id] = clean
  else delete names[id]
  return { ...state, names }
}

export function archive(state: AppState, ids: string[]): AppState {
  return { ...state, archived: [...state.archived, ...ids.filter((id, i) => !state.archived.includes(id) && ids.indexOf(id) === i)] }
}

export function restore(state: AppState, ids: string[]): AppState {
  return { ...state, archived: state.archived.filter(id => !ids.includes(id)) }
}

// Marks sessions as reviewed in Cleanup; see stale.ts for how long that holds.
export function keep(state: AppState, ids: string[], now: number): AppState {
  return { ...state, keptAt: { ...state.keptAt, ...Object.fromEntries(ids.map(id => [id, now])) } }
}

export function applySettings(state: AppState, patch: object): AppState {
  const settings = settingsFrom({ ...state.settings, ...patch })
  return { ...state, settings, notifyTipDone: state.notifyTipDone || settings.notify }
}

export function dismissNotifyTip(state: AppState): AppState {
  return { ...state, notifyTipDone: true }
}
