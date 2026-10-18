const COLORS: Record<string, string> = {
  running: '#d29922',
  idle: '#3fb950',
  ended: '#6e7681',
}
const OTHER = '#bc8cff'

export function StateDot({ state }: { state: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: COLORS[state] ?? OTHER }}
      title={state}
    />
  )
}
