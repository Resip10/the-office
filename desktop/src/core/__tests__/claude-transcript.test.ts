import { join } from 'path'
import { parseTranscript } from '../claude-transcript'

const DIR = join(__dirname, 'fixtures', 'projects', 'C--work-app')
const TITLED = '11111111-1111-4111-8111-111111111111'
const NO_SESSION = '33333333-3333-4333-8333-333333333333'
const AI_TITLED = '44444444-4444-4444-8444-444444444444'
const PROMPT_ONLY = '55555555-5555-4555-8555-555555555555'
const BROKEN = '66666666-6666-4666-8666-666666666666'

const parse = (id: string) => parseTranscript(join(DIR, `${id}.jsonl`))

describe('parseTranscript', () => {
  it('prefers custom title over agent-name and ai-title', async () => {
    const meta = await parse(TITLED)
    expect(meta.title).toBe('My login task')
    expect(meta.titleSource).toBe('custom')
  })

  it('uses latest ai-title when no custom/agent title', async () => {
    const meta = await parse(AI_TITLED)
    expect(meta.title).toBe('Build fix and CI cache')
    expect(meta.titleSource).toBe('ai')
  })

  it('falls back to first real user prompt, trimmed to 120 chars', async () => {
    const meta = await parse(PROMPT_ONLY)
    expect(meta.titleSource).toBe('prompt')
    expect(meta.title.startsWith('Refactor the payment module')).toBe(true)
    expect(meta.title.length).toBe(120)
    expect(meta.title).not.toMatch(/\s{2,}/)
  })

  it('takes identity and location fields', async () => {
    const meta = await parse(TITLED)
    expect(meta.id).toBe(TITLED)
    expect(meta.sessionId).toBe(TITLED)
    expect(meta.projectPath).toBe('C:\\work\\app')
    expect(meta.entrypoint).toBe('cli')
  })

  it('takes gitBranch and version from last record', async () => {
    const meta = await parse(TITLED)
    expect(meta.gitBranch).toBe('feat/x')
    expect(meta.version).toBe('2.1.302')
  })

  it('takes first and last timestamps', async () => {
    const meta = await parse(TITLED)
    expect(meta.createdAt).toBe(Date.parse('2026-10-01T10:00:00.000Z'))
    expect(meta.lastTimestamp).toBe(Date.parse('2026-10-01T10:07:30.000Z'))
  })

  it('takes cost from last cost-state and usage/model from last assistant', async () => {
    const meta = await parse(TITLED)
    expect(meta.costUSD).toBe(1.25)
    expect(meta.contextTokens).toBe(20 + 3000 + 100)
    expect(meta.model).toBe('claude-sonnet-5-5')
  })

  it('collects prUrls, lastPrompt, awaySummary, continuedInId', async () => {
    const meta = await parse(TITLED)
    expect(meta.prUrls).toEqual([
      'https://github.com/acme/app/pull/1',
      'https://github.com/acme/app/pull/2',
    ])
    expect(meta.lastPrompt).toBe('Now add tests')
    expect(meta.awaySummary).toBe('Login page done; tests added on feat/x.')
    expect(meta.continuedInId).toBe('22222222-2222-4222-8222-222222222222')
  })

  it('counts user+assistant records excluding isMeta and isSidechain', async () => {
    const meta = await parse(TITLED)
    expect(meta.messageCount).toBe(4)
  })

  it('ignores truncated last line and malformed lines', async () => {
    const meta = await parse(BROKEN)
    expect(meta.messageCount).toBe(2)
    expect(meta.model).toBe('claude-haiku-5-5')
    expect(meta.contextTokens).toBeNull()
    expect(meta.lastTimestamp).toBe(Date.parse('2026-10-04T12:00:05.000Z'))
    expect(meta.title).toBe('Hello')
  })

  it('no sessionId still returns record', async () => {
    const meta = await parse(NO_SESSION)
    expect(meta.id).toBe(NO_SESSION)
    expect(meta.sessionId).toBeNull()
    expect(meta.title).toBe('—')
    expect(meta.titleSource).toBe('none')
    expect(meta.projectPath).toBeNull()
    expect(meta.createdAt).toBeNull()
    expect(meta.costUSD).toBeNull()
    expect(meta.prUrls).toEqual([])
    expect(meta.messageCount).toBe(0)
  })
})
