import { applyTheme, contrast, THEMES } from '../lib/themes'

describe('applyTheme', () => {
  it('sets Carbon tokens as CSS variables and data-theme', () => {
    const root = document.documentElement
    applyTheme(root, 'carbon')
    expect(root.style.getPropertyValue('--canvas')).toBe('#08080A')
    expect(root.style.getPropertyValue('--accent')).toBe('#F2F2F4')
    expect(root.dataset.theme).toBe('carbon')
  })
})

describe('contrast', () => {
  it('is 21 for black on white and 1 for equal colors', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contrast('#123456', '#123456')).toBeCloseTo(1, 5)
  })

  it('Carbon text, labels and primary button pass 4.5:1', () => {
    const t = THEMES.carbon.tokens
    expect(contrast(t.text, t.canvas)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t.muted, t.raised)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['on-accent'], t.accent)).toBeGreaterThanOrEqual(4.5)
  })
})
