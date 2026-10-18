import { formatBytes, formatCost, formatTokens } from '../lib/format'

describe('formatTokens', () => {
  it.each([[0, '0'], [950, '950'], [1_000, '1k'], [157_721, '158k'], [1_250_000, '1.3M']])('%d → %s', (n, s) => {
    expect(formatTokens(n)).toBe(s)
  })
})

describe('formatCost', () => {
  it('prefixes ≈ to mark the API-price estimate', () => {
    expect(formatCost(1.25)).toBe('≈ $1.25')
    expect(formatCost(0.004)).toBe('≈ $0.00')
  })
})

describe('formatBytes', () => {
  it.each([[512, '512 B'], [23_552, '23 KB'], [7_534_776, '7.2 MB']])('%d → %s', (n, s) => {
    expect(formatBytes(n)).toBe(s)
  })
})
