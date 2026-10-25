import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { AGENT_QUIET_MS, readSubagents } from '../subagents'
import { attachAgents } from '../scanner'
import type { SessionRecord, SubagentInfo } from '../types'

let root: string
let transcript: string
let subDir: string
const NOW = Date.now()

function agent(id: string, meta: Record<string, unknown> | string, mtimeMs: number | null = NOW) {
  writeFileSync(join(subDir, `agent-${id}.meta.json`), typeof meta === 'string' ? meta : JSON.stringify(meta))
  if (mtimeMs === null) return
  const file = join(subDir, `agent-${id}.jsonl`)
  writeFileSync(file, '{"type":"user"}\n')
  utimesSync(file, mtimeMs / 1000, mtimeMs / 1000)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'subagents-'))
  transcript = join(root, 'abc.jsonl')
  writeFileSync(transcript, '')
  subDir = join(root, 'abc', 'subagents')
  mkdirSync(subDir, { recursive: true })
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('readSubagents', () => {
  it('reads task, type and model; running until finished', async () => {
    agent('a1', { agentType: 'general-purpose', description: 'Whole-branch code review', model: 'opus' })
    agent('b2', { agentType: 'Explore', description: 'Find parser', finished: true })
    const agents = await readSubagents(transcript, NOW)
    expect(agents).toEqual([
      expect.objectContaining({ id: 'a1', description: 'Whole-branch code review', agentType: 'general-purpose', model: 'opus', running: true }),
      expect.objectContaining({ id: 'b2', description: 'Find parser', agentType: 'Explore', model: null, running: false }),
    ])
  })

  it('stops counting a silent unfinished agent as running', async () => {
    agent('old', { description: 'Crashed' }, NOW - AGENT_QUIET_MS - 1000)
    agent('new', { description: 'Busy' }, NOW - AGENT_QUIET_MS + 60_000)
    const agents = await readSubagents(transcript, NOW)
    expect(agents.map(a => [a.id, a.running])).toEqual([['new', true], ['old', false]])
    expect(agents[1].lastActivityAt).toBeCloseTo(NOW - AGENT_QUIET_MS - 1000, -3)
  })

  it('is not running without a transcript', async () => {
    agent('x', { description: 'Starting' }, null)
    expect((await readSubagents(transcript, NOW))[0]).toMatchObject({ running: false, startedAt: null, lastActivityAt: null })
  })

  it('fails soft: no folder, bad JSON, odd values, other files', async () => {
    expect(await readSubagents(join(root, 'missing.jsonl'), NOW)).toEqual([])
    agent('bad', '{not json')
    agent('odd', { description: 42, agentType: '  ', finished: 'yes' })
    writeFileSync(join(subDir, 'notes.txt'), 'hi')
    const agents = await readSubagents(transcript, NOW)
    expect(agents).toEqual([expect.objectContaining({ id: 'odd', description: null, agentType: null, running: true })])
  })
})

describe('attachAgents', () => {
  const base = { id: 's1', live: null, agents: [] } as unknown as SessionRecord
  const list: SubagentInfo[] = [{ id: 'a', description: 'T', agentType: null, model: null, startedAt: null, lastActivityAt: null, running: true }]

  it('attaches to live records only', () => {
    const live = { ...base, live: { pid: 1 } } as unknown as SessionRecord
    expect(attachAgents([live], new Map([['s1', list]]))[0].agents).toBe(list)
    expect(attachAgents([base], new Map([['s1', list]]))[0].agents).toEqual([])
  })
})
