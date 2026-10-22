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
      colors: {
        ...tokenColors,
        // v1 names, removed in Task 2 once no component uses them.
        border: 'var(--line)',
        'text-primary': 'var(--text)',
        'text-muted': 'var(--muted)',
        'status-idle': 'var(--idle)',
        'status-working': 'var(--run)',
        'status-starting': 'var(--accent-text)',
        'status-waiting': 'var(--other)',
        'status-done': 'var(--ended)',
        'status-error': '#f85149',
      },
      fontFamily: {
        sans: ['"Geist Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
