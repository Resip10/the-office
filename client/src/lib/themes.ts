import type { Settings, ThemeId } from '../../../desktop/src/core/types'

export type { ThemeId }

export const TOKEN_NAMES = [
  'canvas', 'sunken', 'surface', 'raised', 'control', 'selected', 'hover',
  'line', 'line-strong', 'text', 'text-2', 'muted', 'faint',
  'accent', 'on-accent', 'accent-text',
  'run', 'idle', 'other', 'ended', 'run-chip-border', 'run-chip-fill', 'wait',
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
  wait: '#FF6B7A',
  'run-chip-border': '#4D3812',
  'run-chip-fill': '#1F170A',
}

const graphite: Tokens = {
  canvas: '#0B0C0E',
  sunken: '#0F1012',
  surface: '#111215',
  raised: '#141518',
  control: '#17191C',
  selected: '#1D2024',
  hover: '#191C1F',
  line: '#2A2C31',
  'line-strong': '#383A3E',
  text: '#ECEDEE',
  'text-2': '#C5C7CB',
  muted: '#8A8E96',
  faint: '#6B6F77',
  accent: '#C3D47A',
  'on-accent': '#14160E',
  'accent-text': '#C3D47A',
  run: '#E6AA46',
  idle: '#5BC77A',
  other: '#BF8CFF',
  ended: '#6B6F77',
  wait: '#EE7482',
  'run-chip-border': '#4D3B1F',
  'run-chip-fill': '#211C14',
}

const midnight: Tokens = {
  canvas: '#0A0D12',
  sunken: '#0D1116',
  surface: '#0F131A',
  raised: '#11161D',
  control: '#141A22',
  selected: '#18202A',
  hover: '#151C25',
  line: '#243040',
  'line-strong': '#323D4D',
  text: '#E8EEF5',
  'text-2': '#C3CBD6',
  muted: '#8C97A8',
  faint: '#5E6878',
  accent: '#6FA8FF',
  'on-accent': '#06101F',
  'accent-text': '#8DBAFF',
  run: '#F0B04A',
  idle: '#4FCB86',
  other: '#C39BFF',
  ended: '#5E6878',
  wait: '#FF7D8C',
  'run-chip-border': '#4F3E23',
  'run-chip-fill': '#211D18',
}

const ink: Tokens = {
  canvas: '#080C0E',
  sunken: '#0B1012',
  surface: '#0D1215',
  raised: '#0F1518',
  control: '#121A1E',
  selected: '#162026',
  hover: '#131C20',
  line: '#23323A',
  'line-strong': '#313F47',
  text: '#E4EEF0',
  'text-2': '#BFCCCF',
  muted: '#87989E',
  faint: '#5D6B70',
  accent: '#5CCFE0',
  'on-accent': '#04161A',
  'accent-text': '#7ED9E7',
  run: '#F0AE48',
  idle: '#56C77E',
  other: '#C09AF5',
  ended: '#5D6B70',
  wait: '#F47C88',
  'run-chip-border': '#4E3D1F',
  'run-chip-fill': '#1F1C14',
}

const paper: Tokens = {
  canvas: '#F3F3F1',
  sunken: '#F7F7F5',
  surface: '#FAFAF9',
  raised: '#FFFFFF',
  control: '#FFFFFF',
  selected: '#EEF0FB',
  hover: '#F5F6FD',
  line: '#DEDEDA',
  'line-strong': '#CBCBC7',
  text: '#1C1C1E',
  'text-2': '#3A3A3D',
  muted: '#66666C',
  faint: '#9A9AA0',
  accent: '#4B57D1',
  'on-accent': '#FFFFFF',
  'accent-text': '#4B57D1',
  run: '#B9700A',
  idle: '#1E8E4A',
  other: '#7A4FD1',
  ended: '#9A9AA0',
  wait: '#C4314B',
  'run-chip-border': '#E2CCAC',
  'run-chip-fill': '#EDE6DA',
}

export const THEMES: Record<ThemeId, Theme> = {
  carbon: { name: 'Carbon', tag: 'default', tokens: carbon },
  graphite: { name: 'Graphite', tag: 'olive', tokens: graphite },
  midnight: { name: 'Midnight', tag: 'blue', tokens: midnight },
  ink: { name: 'Ink', tag: 'cyan', tokens: ink },
  paper: { name: 'Paper', tag: 'light', tokens: paper },
}

// Paper while the OS is light, when the user follows the system; otherwise their pick.
export function effectiveTheme(settings: Pick<Settings, 'theme' | 'followSystem'>, systemDark: boolean): ThemeId {
  return settings.followSystem && !systemDark ? 'paper' : settings.theme
}

// Main passes the theme in the window URL so the first paint is already in it.
export function bootTheme(search: string): ThemeId {
  const id = new URLSearchParams(search).get('theme')
  return id && Object.prototype.hasOwnProperty.call(THEMES, id) ? (id as ThemeId) : 'carbon'
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
