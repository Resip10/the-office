/** @type {import('tailwindcss').Config} */
const TOKENS = [
  'canvas', 'sunken', 'surface', 'raised', 'control', 'selected', 'hover',
  'line', 'line-strong', 'text', 'text-2', 'muted', 'faint',
  'accent', 'on-accent', 'accent-text',
  'run', 'idle', 'other', 'ended', 'run-chip-border', 'run-chip-fill',
]

// Colors are CSS variables set by src/lib/themes.ts, so themes switch at runtime.
const tokenColors = Object.fromEntries(TOKENS.map(t => [t, `var(--${t})`]))

module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: tokenColors,
      fontFamily: {
        sans: ['"Geist Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
