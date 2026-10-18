import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadAppState, togglePin } from '../app-state'

let dir: string
let path: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'app-state-'))
  path = join(dir, 'app-state.json')
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('loadAppState', () => {
  it('missing file → no pins', async () => {
    expect(await loadAppState(path)).toEqual({ pins: [] })
  })

  it('garbage → no pins', async () => {
    writeFileSync(path, '{oops')
    expect(await loadAppState(path)).toEqual({ pins: [] })
  })

  it('keeps only string pins', async () => {
    writeFileSync(path, JSON.stringify({ pins: ['a', 3, null, 'b'] }))
    expect(await loadAppState(path)).toEqual({ pins: ['a', 'b'] })
  })
})

describe('togglePin', () => {
  it('adds then removes', async () => {
    expect(await togglePin(path, 'a')).toEqual({ pins: ['a'] })
    expect(await togglePin(path, 'b')).toEqual({ pins: ['a', 'b'] })
    expect(await togglePin(path, 'a')).toEqual({ pins: ['b'] })
    expect(await loadAppState(path)).toEqual({ pins: ['b'] })
  })

  it('writes via temp file and leaves none behind', async () => {
    await togglePin(path, 'a')
    await togglePin(path, 'b')
    expect(readdirSync(dir)).toEqual(['app-state.json'])
  })
})
