import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { cleanText, parseStatusline, readStatusline } from '../statusline-data'

const FIX = join(__dirname, 'fixtures', 'statusline')
const read = (p: string) => readFileSync(join(FIX, p), 'utf8')

describe('parseStatusline', () => {
  it('reads limits, lines, cache, effort, PR and the printed text', () => {
    expect(parseStatusline(read('full/input.json'), read('full/output.txt'), 123)).toEqual({
      capturedAt: 123,
      fiveHour: { usedPct: 17, resetsAt: 1792794000_000 },
      sevenDay: { usedPct: 48.5, resetsAt: 1792990800_000 },
      linesAdded: 4104,
      linesRemoved: 227,
      cacheHitPct: 97,
      cacheColdAt: 1792789061_000,
      effort: 'medium',
      thinking: true,
      pr: { number: 13, url: 'https://github.com/acme/app/pull/13', reviewState: 'pending' },
      text: 'app on main · link  ctx 29%',
    })
  })

  it('malformed or missing fields are null; other limit types are ignored', () => {
    expect(parseStatusline(read('partial/input.json'), null, 1)).toEqual({
      capturedAt: 1, fiveHour: null, sevenDay: null, linesAdded: null, linesRemoved: null,
      cacheHitPct: null, cacheColdAt: null, effort: null, thinking: null, pr: null, text: null,
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
