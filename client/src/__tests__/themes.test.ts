import { DEFAULT_SETTINGS } from '../../../desktop/src/core/types'
import { applyTheme, bootTheme, contrast, effectiveTheme, THEMES, type ThemeId } from '../lib/themes'

describe('applyTheme', () => {
  it('sets Carbon tokens as CSS variables and data-theme', () => {
    const root = document.documentElement
    applyTheme(root, 'carbon')
    expect(root.style.getPropertyValue('--canvas')).toBe('#08080A')
    expect(root.style.getPropertyValue('--accent')).toBe('#F2F2F4')
    expect(root.dataset.theme).toBe('carbon')
  })
})

describe('bootTheme', () => {
  it('reads a known theme from the query, otherwise Carbon', () => {
    expect(bootTheme('?view=window&theme=paper')).toBe('paper')
    expect(bootTheme('?view=window')).toBe('carbon')
    expect(bootTheme('?theme=neon')).toBe('carbon')
    expect(bootTheme('?theme=toString')).toBe('carbon')
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

describe('all themes', () => {
  const ids = Object.keys(THEMES) as ThemeId[]

  it('has the five themes with distinct palettes', () => {
    expect(ids).toEqual(['carbon', 'graphite', 'midnight', 'ink', 'paper'])
    expect(new Set(ids.map(id => THEMES[id].tokens.accent)).size).toBe(5)
  })

  it.each(['carbon', 'graphite', 'midnight', 'ink', 'paper'] as ThemeId[])('%s has a waiting color unlike the accent and other states', id => {
    const t = THEMES[id].tokens
    expect(new Set([t.wait, t.accent, t.run, t.idle, t.other, t.ended]).size).toBe(6)
    expect(contrast(t.wait, t.raised)).toBeGreaterThanOrEqual(3)
  })

  it.each(['carbon', 'graphite', 'midnight', 'ink', 'paper'] as ThemeId[])('%s passes 4.5:1 for text, labels, secondary text and buttons', id => {
    const t = THEMES[id].tokens
    expect(contrast(t.text, t.canvas)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t.muted, t.raised)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['on-accent'], t.accent)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['text-2'], t.surface)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('effectiveTheme', () => {
  it('uses Paper while the system is light when following the system', () => {
    expect(effectiveTheme({ ...DEFAULT_SETTINGS, theme: 'ink', followSystem: true }, false)).toBe('paper')
    expect(effectiveTheme({ ...DEFAULT_SETTINGS, theme: 'ink', followSystem: true }, true)).toBe('ink')
    expect(effectiveTheme({ ...DEFAULT_SETTINGS, theme: 'ink', followSystem: false }, false)).toBe('ink')
  })
})
