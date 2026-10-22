import { cpSync, mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync, appendFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { parseTranscript } from '../claude-transcript'
import { scanClaude, attachLive, loadCache, saveCache, type IndexCache } from '../scanner'
import type { LiveInfo, SessionRecord } from '../types'

const FIXTURES = join(__dirname, 'fixtures', 'projects')
const TITLED = '11111111-1111-4111-8111-111111111111'
const NO_SESSION = '33333333-3333-4333-8333-333333333333'
const LOCAL = '77777777-7777-4777-8777-777777777777'

let root: string
let projectsDir: string
let appDir: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'scanner-'))
  projectsDir = join(root, 'projects')
  cpSync(FIXTURES, projectsDir, { recursive: true })

  // subagent transcripts of TITLED: counted, never listed
  const subDir = join(projectsDir, 'C--work-app', TITLED, 'subagents')
  mkdirSync(subDir, { recursive: true })
  writeFileSync(join(subDir, 'agent-a1.jsonl'), '{"type":"user","sessionId":"x"}\n')
  writeFileSync(join(subDir, 'agent-b2.jsonl'), '{"type":"user","sessionId":"x"}\n')

  // a session whose project folder exists
  appDir = join(root, 'app')
  mkdirSync(appDir)
  mkdirSync(join(projectsDir, 'C--local-app'))
  writeFileSync(join(projectsDir, 'C--local-app', `${LOCAL}.jsonl`),
    JSON.stringify({ type: 'user', sessionId: LOCAL, cwd: appDir, timestamp: '2026-10-05T10:00:00.000Z', message: { content: 'hi' } }) + '\n')
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

const byId = (records: SessionRecord[], id: string) => records.find(r => r.id === id)

describe('scanClaude', () => {
  it('lists only top-level <project>/<uuid>.jsonl, not subagents/', async () => {
    const { records } = await scanClaude({ projectsDir, cache: null })
    expect(records).toHaveLength(7)
    expect(records.every(r => !r.filePath.includes('subagents'))).toBe(true)
    expect(records.every(r => r.tool === 'claude')).toBe(true)
  })

  it('subagentCount = number of <uuid>/subagents/*.jsonl', async () => {
    const { records } = await scanClaude({ projectsDir, cache: null })
    expect(byId(records, TITLED)?.subagentCount).toBe(2)
    expect(byId(records, LOCAL)?.subagentCount).toBe(0)
  })

  it('reuses cached meta when mtime and size unchanged', async () => {
    const first = await scanClaude({ projectsDir, cache: null })
    const parse = jest.fn(parseTranscript)
    const second = await scanClaude({ projectsDir, cache: first.cache, parse })
    expect(parse).not.toHaveBeenCalled()
    expect(second.records).toEqual(first.records)
  })

  it('reports changed only when the cache differs from the one passed in', async () => {
    const first = await scanClaude({ projectsDir, cache: null })
    expect(first.changed).toBe(true)
    const second = await scanClaude({ projectsDir, cache: first.cache })
    expect(second.changed).toBe(false)
    appendFileSync(join(projectsDir, 'C--local-app', `${LOCAL}.jsonl`), '{"type":"mode"}\n')
    expect((await scanClaude({ projectsDir, cache: second.cache })).changed).toBe(true)
    unlinkSync(join(projectsDir, 'C--local-app', `${LOCAL}.jsonl`))
    expect((await scanClaude({ projectsDir, cache: second.cache })).changed).toBe(true)
  })

  it('reparses changed file', async () => {
    const first = await scanClaude({ projectsDir, cache: null })
    const file = join(projectsDir, 'C--local-app', `${LOCAL}.jsonl`)
    appendFileSync(file, JSON.stringify({ type: 'custom-title', customTitle: 'Renamed', sessionId: LOCAL }) + '\n')
    const parse = jest.fn(parseTranscript)
    const second = await scanClaude({ projectsDir, cache: first.cache, parse })
    expect(parse).toHaveBeenCalledTimes(1)
    expect(byId(second.records, LOCAL)?.title).toBe('Renamed')
  })

  it('drops cache entries for deleted files', async () => {
    const first = await scanClaude({ projectsDir, cache: null })
    const file = join(projectsDir, 'C--local-app', `${LOCAL}.jsonl`)
    unlinkSync(file)
    const second = await scanClaude({ projectsDir, cache: first.cache })
    expect(byId(second.records, LOCAL)).toBeUndefined()
    expect(second.cache.entries[file]).toBeUndefined()
  })

  it('projectExists false when cwd folder missing', async () => {
    const { records } = await scanClaude({ projectsDir, cache: null })
    expect(byId(records, TITLED)?.projectExists).toBe(false)
    expect(byId(records, NO_SESSION)?.projectExists).toBe(false)
    expect(byId(records, LOCAL)?.projectExists).toBe(true)
  })

  it('checks each distinct project folder once per scan, asynchronously', async () => {
    const pathExists = jest.fn(async (p: string) => p === appDir)
    const { records } = await scanClaude({ projectsDir, cache: null, pathExists })
    expect(pathExists.mock.calls.map(([p]) => p).sort()).toEqual([appDir, 'C:\\work\\app'].sort())
    expect(byId(records, LOCAL)?.projectExists).toBe(true)
    expect(byId(records, TITLED)?.projectExists).toBe(false)
  })

  it('lastActivityAt = lastTimestamp ?? file mtime', async () => {
    const file = join(projectsDir, 'C--work-app', `${NO_SESSION}.jsonl`)
    const mtime = new Date('2026-09-09T09:09:09.000Z')
    utimesSync(file, mtime, mtime)
    const { records } = await scanClaude({ projectsDir, cache: null })
    expect(byId(records, TITLED)?.lastActivityAt).toBe(Date.parse('2026-10-01T10:07:30.000Z'))
    expect(byId(records, NO_SESSION)?.lastActivityAt).toBe(mtime.getTime())
    expect(byId(records, NO_SESSION)?.fileSize).toBe(statSync(file).size)
  })

  it('missing projects dir returns empty list', async () => {
    const { records } = await scanClaude({ projectsDir: join(root, 'nope'), cache: null })
    expect(records).toEqual([])
  })
})

describe('attachLive', () => {
  it('sets live by sessionId, null otherwise', async () => {
    const { records } = await scanClaude({ projectsDir, cache: null })
    const info: LiveInfo = { pid: 1, status: 'busy', name: 'app-1c', updatedAt: 5 }
    const out = attachLive(records, new Map([[TITLED, info]]))
    expect(byId(out, TITLED)?.live).toEqual(info)
    expect(byId(out, LOCAL)?.live).toBeNull()
  })
})

describe('loadCache / saveCache', () => {
  it('round-trips and leaves no temp file', async () => {
    const { cache } = await scanClaude({ projectsDir, cache: null })
    const path = join(root, 'index-v2.json')
    await saveCache(path, cache)
    await saveCache(path, cache)
    expect(await loadCache(path)).toEqual(cache)
    expect(() => statSync(`${path}.tmp`)).toThrow()
  })

  it('loadCache returns null for version 1 or garbage', async () => {
    const v1 = join(root, 'v1.json')
    writeFileSync(v1, JSON.stringify({ version: 1, entries: {} }))
    const junk = join(root, 'junk.json')
    writeFileSync(junk, '{oops')
    expect(await loadCache(v1)).toBeNull()
    expect(await loadCache(junk)).toBeNull()
    expect(await loadCache(join(root, 'missing.json'))).toBeNull()
  })

  it('accepts a valid empty cache', async () => {
    const path = join(root, 'empty.json')
    const empty: IndexCache = { version: 2, entries: {} }
    writeFileSync(path, JSON.stringify(empty))
    expect(await loadCache(path)).toEqual(empty)
  })
})
