export type ThemeId = 'carbon' | 'graphite' | 'midnight' | 'ink' | 'paper'

export const TOKEN_NAMES = [
  'canvas', 'sunken', 'surface', 'raised', 'control', 'selected', 'hover',
  'line', 'line-strong', 'text', 'text-2', 'muted', 'faint',
  'accent', 'on-accent', 'accent-text',
  'run', 'idle', 'other', 'ended', 'run-chip-border', 'run-chip-fill',
] as const

export type TokenName = typeof TOKEN_NAMES[number]
export type Tokens = Record<TokenName, string>

export interface Theme {
  name: string
  tag: string
  tokens: Tokens
}

const carbon: Tokens = {
  canvas: '#08080A',
  sunken: '#0C0C0E',
  surface: '#0F0F11',
  raised: '#121214',
  control: '#18181B',
  selected: '#1C1C1F',
  hover: '#19191C',
  line: '#252529',
  'line-strong': '#2E2E33',
  text: '#F2F2F4',
  'text-2': '#CACACF',
  muted: '#8E8E95',
  faint: '#636369',
  accent: '#F2F2F4',
  'on-accent': '#0B0B0D',
  'accent-text': '#F2F2F4',
  run: '#FFB340',
  idle: '#32D74B',
  other: '#BF8CFF',
  ended: '#636369',
  'run-chip-border': '#4D3812',
  'run-chip-fill': '#1F170A',
}

// Task 12 fills the other themes; until then they render as Carbon.
export const THEMES: Record<ThemeId, Theme> = {
  carbon: { name: 'Carbon', tag: 'default', tokens: carbon },
  graphite: { name: 'Graphite', tag: 'olive', tokens: carbon },
  midnight: { name: 'Midnight', tag: 'blue', tokens: carbon },
  ink: { name: 'Ink', tag: 'cyan', tokens: carbon },
  paper: { name: 'Paper', tag: 'light', tokens: carbon },
}

export function applyTheme(root: HTMLElement, id: ThemeId): void {
  const tokens = (THEMES[id] ?? THEMES.carbon).tokens
  for (const name of TOKEN_NAMES) root.style.setProperty(`--${name}`, tokens[name])
  root.dataset.theme = id
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

// WCAG 2 contrast ratio between two #RRGGBB colors.
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
