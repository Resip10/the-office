import { getContextWindow } from '../model-limits'

describe('getContextWindow', () => {
  it('returns 200000 for claude-opus-4-7', () => {
    expect(getContextWindow('claude-opus-4-7')).toBe(200_000)
  })

  it('returns 200000 for claude-sonnet-4-6', () => {
    expect(getContextWindow('claude-sonnet-4-6')).toBe(200_000)
  })

  it('returns 200000 for claude-haiku-4-5', () => {
    expect(getContextWindow('claude-haiku-4-5')).toBe(200_000)
  })

  it('returns null for unknown model', () => {
    expect(getContextWindow('gpt-4o')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getContextWindow('')).toBeNull()
  })
})
