import { join } from 'path'
import { handoffPrompt, parseDetails, toolTarget } from '../details'
import type { SessionDetails } from '../types'

const P1 = join(__dirname, 'fixtures', 'p1')
const APP = 'C:\\work\\app'
const details = (name: string) => parseDetails(join(P1, `${name}.jsonl`), APP)

const EMPTY: SessionDetails = {
  handoff: { source: 'extract', summary: null, goal: null, lastAsk: null, files: [], branch: null, lastAnswer: null },
  peek: [],
  conversation: [],
  messageTotal: 0,
}

describe('parseDetails', () => {
  it('extracts goal, last ask, files and last answer', async () => {
    const d = await details('edits')
    expect(d?.handoff.source).toBe('extract')
    expect(d?.handoff.goal).toBe('Build the export feature')
    expect(d?.handoff.lastAsk).toBe('Now add CSV too')
    expect(d?.handoff.files).toEqual(['src\\a.ts', 'src\\b.ts'])
    expect(d?.handoff.branch).toBe('feat/x')
    expect(d?.handoff.lastAnswer?.length).toBe(600)
    expect(d?.handoff.lastAnswer?.startsWith('Done. ')).toBe(true)
  })

  it('peek keeps the last 6 items, tools as one line', async () => {
    const d = await details('edits')
    expect(d?.peek).toHaveLength(6)
    expect(d?.peek.map(p => p.role)).toEqual(['tool', 'tool', 'user', 'tool', 'tool', 'assistant'])
    expect(d?.peek[4]).toMatchObject({ role: 'tool', text: 'Bash npm test' })
    expect(d?.peek[2]).toMatchObject({ role: 'user', text: 'Now add CSV too' })
    expect(d?.messageTotal).toBe(11)
  })

  it('keeps a separate conversation-only peek of the last 6 user/assistant messages', async () => {
    const d = await details('edits')
    expect(d?.conversation.map(p => p.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(d?.conversation[2]).toMatchObject({ role: 'user', text: 'Now add CSV too' })
  })

  it('prefers the compaction summary and keeps it out of the peek', async () => {
    const d = await details('compacted')
    expect(d?.handoff.source).toBe('compact')
    expect(d?.handoff.summary).toContain('Summary: we built X')
    expect(d?.peek.some(p => p.text.includes('Summary: we built X'))).toBe(false)
  })

  it("falls back to the recap, without Claude Code's settings hint", async () => {
    const d = await details('recap')
    expect(d?.handoff.source).toBe('recap')
    expect(d?.handoff.summary).toBe('Recap: docs written')
  })

  it('returns null for a missing file', async () => {
    expect(await parseDetails(join(P1, 'nope.jsonl'), APP)).toBeNull()
  })

  it('malformed tool blocks do not throw and fall back to the tool name', async () => {
    const d = await details('malformed-tools')
    const tools = d?.peek.filter(p => p.role === 'tool').map(p => p.text)
    expect(tools).toEqual(['Edit', 'Write', 'Edit', 'tool'])
    expect(d?.handoff.files).toEqual([])
  })
})

describe('toolTarget', () => {
  it('prefers file_path, then the first command line, then pattern', () => {
    expect(toolTarget('Edit', { file_path: 'a.ts', command: 'x' })).toBe('a.ts')
    expect(toolTarget('Bash', { command: 'npm test\nnpm run lint' })).toBe('npm test')
    expect(toolTarget('Grep', { pattern: 'TODO' })).toBe('TODO')
    expect(toolTarget('Task', 'str')).toBe('')
  })
})

describe('handoffPrompt', () => {
  const ID = '88888888-8888-4888-8888-888888888888'

  it('extract source lists every field', () => {
    const d: SessionDetails = {
      ...EMPTY,
      handoff: { source: 'extract', summary: null, goal: 'Build it', lastAsk: 'Add CSV', files: ['src\\a.ts'], branch: 'main', lastAnswer: 'Done.' },
    }
    const text = handoffPrompt({ title: 'T', id: ID }, d)
    expect(text.startsWith('Continuing from session "T" (88888888).')).toBe(true)
    expect(text).toContain('Goal: Build it')
    expect(text).toContain('Branch: main')
    expect(text).toContain('Files touched:\n- src\\a.ts')
    expect(text).toContain('Last request: "Add CSV"')
    expect(text).toContain('Where it stopped: Done.')
    expect(text.endsWith('Pick up from there.')).toBe(true)
  })

  it('summary sources drop Goal and Where it stopped', () => {
    const d: SessionDetails = {
      ...EMPTY,
      handoff: { source: 'compact', summary: 'We built X.', goal: 'Build it', lastAsk: 'Add CSV', files: ['a.ts'], branch: 'main', lastAnswer: 'Done.' },
    }
    const text = handoffPrompt({ title: 'T', id: ID }, d)
    expect(text).toContain('We built X.')
    expect(text).toContain('Branch: main')
    expect(text).toContain('Files touched:')
    expect(text).toContain('Last request:')
    expect(text).not.toContain('Goal:')
    expect(text).not.toContain('Where it stopped:')
  })

  it('leaves out lines with no value and never prints null', () => {
    const text = handoffPrompt({ title: 'T', id: ID }, EMPTY)
    expect(text).not.toContain('Branch:')
    expect(text).not.toContain('Files touched:')
    expect(text).not.toMatch(/null|undefined|—/)
  })
})
