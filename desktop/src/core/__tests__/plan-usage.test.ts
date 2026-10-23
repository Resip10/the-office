import { readFileSync, utimesSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { parsePlanUsage, readPlanUsage } from '../plan-usage'

const FIX = join(__dirname, 'fixtures', 'statusline')
const fixture = (name: string) => readFileSync(join(FIX, name), 'utf8')

describe('parsePlanUsage', () => {
  it('reads the 5-hour and weekly windows, reset times in ms', () => {
    expect(parsePlanUsage(fixture('full.json'), 123)).toEqual({
      fiveHour: { usedPct: 11, resetsAt: 1792794000_000 },
      sevenDay: { usedPct: 47.5, resetsAt: 1792990800_000 },
      capturedAt: 123,
    })
  })

  it('a missing or malformed window is null; other limit types are ignored', () => {
    expect(parsePlanUsage(fixture('partial.json'), 1)).toEqual({ fiveHour: null, sevenDay: null, capturedAt: 1 })
  })

  it('no rate limits (API key, no profile scope) → both null', () => {
    expect(parsePlanUsage(fixture('no-limits.json'), 1)).toEqual({ fiveHour: null, sevenDay: null, capturedAt: 1 })
  })

  it('a window without a reset time keeps its percentage', () => {
    const text = JSON.stringify({ rate_limits: { five_hour: { used_percentage: 5 } } })
    expect(parsePlanUsage(text, 1)?.fiveHour).toEqual({ usedPct: 5, resetsAt: null })
  })

  it('garbage → null', () => {
    expect(parsePlanUsage('{oops', 1)).toBeNull()
    expect(parsePlanUsage('[1,2]', 1)).toBeNull()
    expect(parsePlanUsage('', 1)).toBeNull()
  })
})

describe('readPlanUsage', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'plan-usage-')) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('missing file → null', async () => {
    expect(await readPlanUsage(join(dir, 'statusline.json'))).toBeNull()
  })

  it('uses the file mtime as capturedAt', async () => {
    const path = join(dir, 'statusline.json')
    writeFileSync(path, fixture('full.json'))
    utimesSync(path, 1_700_000_000, 1_700_000_000)
    expect((await readPlanUsage(path))?.capturedAt).toBe(1_700_000_000_000)
  })
})
