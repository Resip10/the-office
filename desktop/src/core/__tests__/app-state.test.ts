import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadAppState, setName, togglePin, updateAppState } from '../app-state'
import { DEFAULT_SETTINGS, type AppState } from '../types'

let dir: string
let path: string

const EMPTY: AppState = { pins: [], names: {}, archived: [], keptAt: {}, settings: DEFAULT_SETTINGS }

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
