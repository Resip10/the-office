/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0d1117',
        surface: '#161b22',
        border: '#30363d',
        'text-primary': '#f0f6fc',
        'text-muted': '#8b949e',
        'status-idle': '#3fb950',
        'status-working': '#d29922',
        'status-starting': '#58a6ff',
        'status-waiting': '#bc8cff',
        'status-done': '#6e7681',
        'status-error': '#f85149',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
