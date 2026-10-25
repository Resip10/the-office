import { contextWindow, ctxPercent, formatBytes, formatCost, formatDuration, formatTokens } from '../lib/format'

describe('formatTokens', () => {
  it.each([[0, '0'], [950, '950'], [1_000, '1k'], [157_721, '158k'], [1_000_000, '1M'], [1_250_000, '1.3M']])('%d → %s', (n, s) => {
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

describe('formatDuration', () => {
  it.each([[9_660_000, '2h 41m'], [720_000, '12m'], [45_000, '45s'], [0, '0s']])('%d → %s', (ms, s) => {
    expect(formatDuration(ms)).toBe(s)
  })
})

describe('contextWindow', () => {
  it('is 1M for Claude 5 Opus/Sonnet/Fable and [1m] variants, 200k otherwise, null when unknown', () => {
    expect(contextWindow('claude-opus-5-5', 100_000)).toBe(1_000_000)
    expect(contextWindow('claude-sonnet-5-5', 100_000)).toBe(1_000_000)
    expect(contextWindow('claude-fable-5-1', 100_000)).toBe(1_000_000)
    expect(contextWindow('claude-sonnet-4-5[1m]', 100_000)).toBe(1_000_000)
    expect(contextWindow('claude-haiku-5-5', 100_000)).toBe(200_000)
    expect(contextWindow('claude-sonnet-4-5', 100_000)).toBe(200_000)
    expect(contextWindow(null, 100_000)).toBeNull()
  })

  it('never reports a window smaller than the tokens in use', () => {
    expect(contextWindow('claude-sonnet-4-5', 451_000)).toBe(1_000_000)
  })
})

describe('ctxPercent', () => {
  it('context used as a share of the model window, rounded; null when unknown', () => {
    expect(ctxPercent('claude-opus-5-5', 250_000)).toBe(25)
    expect(ctxPercent('claude-sonnet-4-5', 180_000)).toBe(90)
    expect(ctxPercent(null, 5_000)).toBeNull()
    expect(ctxPercent('claude-opus-5-5', null)).toBeNull()
  })
})
