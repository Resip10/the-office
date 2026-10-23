import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { cleanText, parseStatusline, readStatusline, rememberExtras } from '../statusline-data'

const FIX = join(__dirname, 'fixtures', 'statusline')
const read = (p: string) => readFileSync(join(FIX, p), 'utf8')

describe('parseStatusline', () => {
  it('reads the session, limits, effort, thinking and the printed text', () => {
    expect(parseStatusline(read('full/input.json'), read('full/output.txt'), 123)).toEqual({
      capturedAt: 123,
      sessionId: '11111111-1111-4111-8111-111111111111',
      fiveHour: { usedPct: 17, resetsAt: 1792794000_000 },
      sevenDay: { usedPct: 48.5, resetsAt: 1792990800_000 },
      effort: 'medium',
      thinking: true,
      text: 'app on main · link  ctx 29%',
    })
  })

  it('malformed or missing fields are null; other limit types are ignored', () => {
    expect(parseStatusline(read('partial/input.json'), null, 1)).toEqual({
      capturedAt: 1, sessionId: null, fiveHour: null, sevenDay: null, effort: null, thinking: null, text: null,
    })
  })

  it('garbage → null', () => {
    expect(parseStatusline(read('garbage/input.json'), null, 1)).toBeNull()
    expect(parseStatusline('[1]', null, 1)).toBeNull()
  })
})

describe('cleanText', () => {
  it('drops colors and links, joins lines, caps the length', () => {
    expect(cleanText('\u001b[1mbold\u001b[0m\r\n\r\nnext')).toBe('bold · next')
    expect(cleanText('   \n ')).toBeNull()
    expect(cleanText('x'.repeat(500))).toHaveLength(200)
  })
})

describe('readStatusline', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'statusline-data-')) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('missing input → null', async () => {
    expect(await readStatusline(dir)).toBeNull()
  })

  it('uses the input file time; output is optional', async () => {
    writeFileSync(join(dir, 'input.json'), read('full/input.json'))
    utimesSync(join(dir, 'input.json'), 1_700_000_000, 1_700_000_000)
    const s = await readStatusline(dir)
    expect(s?.capturedAt).toBe(1_700_000_000_000)
    expect(s?.text).toBeNull()
  })
})

describe('rememberExtras', () => {
  const ID = '11111111-1111-4111-8111-111111111111'
  const snap = (over = {}) => ({ capturedAt: 1, sessionId: ID, fiveHour: null, sevenDay: null, effort: 'high', thinking: true, text: 'Opus | main', ...over })

  it('keeps the latest text, effort and thinking per session', () => {
    const one = rememberExtras({}, snap())
    expect(one).toEqual({ [ID]: { text: 'Opus | main', effort: 'high', thinking: true } })
    expect(rememberExtras(one, snap({ effort: 'low', text: 'Opus | dev' }))[ID]).toEqual({ text: 'Opus | dev', effort: 'low', thinking: true })
  })

  it('unchanged, unknown session or nothing known → same object', () => {
    const one = rememberExtras({}, snap())
    expect(rememberExtras(one, snap())).toBe(one)
    expect(rememberExtras(one, snap({ sessionId: null }))).toBe(one)
    expect(rememberExtras(one, snap({ effort: null, thinking: null, text: null }))).toBe(one)
    expect(rememberExtras(one, null)).toBe(one)
  })
})
