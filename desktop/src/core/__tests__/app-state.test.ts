import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { applySettings, archive, dismissNotifyTip, keep, loadAppState, restore, setName, settingsFrom, togglePin, updateAppState } from '../app-state'
import { DEFAULT_SETTINGS, type AppState } from '../types'

let dir: string
let path: string

const EMPTY: AppState = { pins: [], names: {}, archived: [], keptAt: {}, notifyTipDone: false, statusLink: null, settings: DEFAULT_SETTINGS }

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'app-state-'))
  path = join(dir, 'app-state.json')
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('loadAppState', () => {
  it('missing file → defaults', async () => {
    expect(await loadAppState(path)).toEqual(EMPTY)
  })

  it('garbage → defaults', async () => {
    writeFileSync(path, '{oops')
    expect(await loadAppState(path)).toEqual(EMPTY)
  })

  it('keeps only string pins', async () => {
    writeFileSync(path, JSON.stringify({ pins: ['a', 3, null, 'b'] }))
    expect((await loadAppState(path)).pins).toEqual(['a', 'b'])
  })

  it('loads the v1 shape with every new field defaulted', async () => {
    writeFileSync(path, JSON.stringify({ pins: ['a'] }))
    expect(await loadAppState(path)).toEqual({ ...EMPTY, pins: ['a'] })
  })

  it('merges partial settings over the defaults', async () => {
    writeFileSync(path, JSON.stringify({ settings: { theme: 'ink' } }))
    expect((await loadAppState(path)).settings).toEqual({ ...DEFAULT_SETTINGS, theme: 'ink' })
  })

  it('falls back field by field on invalid values', async () => {
    writeFileSync(path, JSON.stringify({
      names: [1],
      archived: ['x', 2],
      keptAt: { a: 5, b: 'no' },
      settings: { theme: 'neon', density: 'compact', pulse: 'yes', stale: { idleDays: -3, trivialMessages: null, missingFolder: false } },
    }))
    const s = await loadAppState(path)
    expect(s.names).toEqual({})
    expect(s.archived).toEqual(['x'])
    expect(s.keptAt).toEqual({ a: 5 })
    expect(s.settings.theme).toBe('carbon')
    expect(s.settings.density).toBe('compact')
    expect(s.settings.pulse).toBe(true)
    expect(s.settings.peekTools).toBe(false)
    expect(s.settings.stale).toEqual({ idleDays: 30, trivialMessages: null, missingFolder: false })
  })
})

describe('updateAppState', () => {
  it('two concurrent updates both land', async () => {
    await Promise.all([
      updateAppState(path, s => ({ ...s, pins: [...s.pins, 'a'] })),
      updateAppState(path, s => ({ ...s, pins: [...s.pins, 'b'] })),
    ])
    expect((await loadAppState(path)).pins.sort()).toEqual(['a', 'b'])
  })

  it('a failed write resolves to what is on disk instead of rejecting', async () => {
    writeFileSync(path, JSON.stringify({ pins: ['a'] }))
    const unwritable = join(dir, 'missing-dir', 'app-state.json')
    await expect(updateAppState(unwritable, s => ({ ...s, pins: ['b'] }))).resolves.toEqual(EMPTY)
    await expect(updateAppState(path, s => ({ ...s, pins: [...s.pins, 'b'] }))).resolves.toEqual({ ...EMPTY, pins: ['a', 'b'] })
  })
})

describe('togglePin', () => {
  it('adds then removes', async () => {
    expect((await togglePin(path, 'a')).pins).toEqual(['a'])
    expect((await togglePin(path, 'b')).pins).toEqual(['a', 'b'])
    expect((await togglePin(path, 'a')).pins).toEqual(['b'])
    expect((await loadAppState(path)).pins).toEqual(['b'])
  })

  it('keeps other state when toggling', async () => {
    writeFileSync(path, JSON.stringify({ pins: [], names: { a: 'Mine' } }))
    await togglePin(path, 'a')
    expect((await loadAppState(path)).names).toEqual({ a: 'Mine' })
  })

  it('writes via temp file and leaves none behind', async () => {
    await togglePin(path, 'a')
    await togglePin(path, 'b')
    expect(readdirSync(dir)).toEqual(['app-state.json'])
  })
})

describe('setName', () => {
  it('stores a trimmed name', () => {
    expect(setName(EMPTY, 'a', '  Mine  ').names).toEqual({ a: 'Mine' })
  })

  it('whitespace or null clears the name', () => {
    const named = setName(EMPTY, 'a', 'Mine')
    expect(setName(named, 'a', '   ').names).toEqual({})
    expect(setName(named, 'a', null).names).toEqual({})
  })

  it('cuts long names to 200 characters', () => {
    expect(setName(EMPTY, 'a', 'x'.repeat(500)).names.a).toHaveLength(200)
  })
})

describe('archive / restore / keep', () => {
  it('archive adds ids once', () => {
    const s = archive(archive(EMPTY, ['a', 'b']), ['b', 'c'])
    expect(s.archived).toEqual(['a', 'b', 'c'])
  })

  it('restore removes ids', () => {
    expect(restore(archive(EMPTY, ['a', 'b']), ['a']).archived).toEqual(['b'])
  })

  it('keep stamps each id with now', () => {
    expect(keep(EMPTY, ['a', 'b'], 123).keptAt).toEqual({ a: 123, b: 123 })
  })
})

describe('notifications', () => {
  it('are off by default with a 5 minute threshold', () => {
    expect(DEFAULT_SETTINGS.notify).toBe(false)
    expect(DEFAULT_SETTINGS.notifyAfterMin).toBe(5)
  })

  it('threshold accepts only 1, 5, 15 or 30 minutes', () => {
    expect(settingsFrom({ notifyAfterMin: 15 }).notifyAfterMin).toBe(15)
    expect(settingsFrom({ notifyAfterMin: 7 }).notifyAfterMin).toBe(5)
    expect(settingsFrom({ notifyAfterMin: '1' }).notifyAfterMin).toBe(5)
  })

  it('loads notifyTipDone, defaulting to false', async () => {
    writeFileSync(path, JSON.stringify({ notifyTipDone: true }))
    expect((await loadAppState(path)).notifyTipDone).toBe(true)
    writeFileSync(path, JSON.stringify({ notifyTipDone: 'yes' }))
    expect((await loadAppState(path)).notifyTipDone).toBe(false)
  })

  it('turning notifications on retires the tip for good', () => {
    const on = applySettings(EMPTY, { notify: true })
    expect(on.settings.notify).toBe(true)
    expect(on.notifyTipDone).toBe(true)
    expect(applySettings(on, { notify: false }).notifyTipDone).toBe(true)
    expect(applySettings(EMPTY, { theme: 'ink' }).notifyTipDone).toBe(false)
  })

  it('dismissing the tip retires it', () => {
    expect(dismissNotifyTip(EMPTY).notifyTipDone).toBe(true)
  })
})

describe('stats and status link', () => {
  it('stats keep known ids once, in order; anything else falls back to the default', () => {
    expect(settingsFrom({ stats: ['limits', 'nope', 'running', 'limits'] }).stats).toEqual(['limits', 'running'])
    expect(settingsFrom({ stats: [] }).stats).toEqual([])
    expect(settingsFrom({ stats: 'running' }).stats).toEqual(DEFAULT_SETTINGS.stats)
  })

  it('loads a status link only when its command is a string', async () => {
    const link = { original: { type: 'command', command: 'bash sl.sh' }, command: 'tee x | { bash sl.sh; }' }
    writeFileSync(path, JSON.stringify({ statusLink: link }))
    expect((await loadAppState(path)).statusLink).toEqual(link)
    writeFileSync(path, JSON.stringify({ statusLink: { original: null, command: 'cat > x' } }))
    expect((await loadAppState(path)).statusLink).toEqual({ original: null, command: 'cat > x' })
    writeFileSync(path, JSON.stringify({ statusLink: { original: 'x', command: 5 } }))
    expect((await loadAppState(path)).statusLink).toBeNull()
  })
})
