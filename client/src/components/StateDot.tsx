const COLORS: Record<string, string> = {
  running: 'bg-run',
  idle: 'bg-idle',
  ended: 'bg-ended',
}

export function StateDot({ state, pulse = false }: { state: string; pulse?: boolean }) {
  return (
    <span
      className={`inline-block w-[7px] h-[7px] rounded-full shrink-0 ${COLORS[state] ?? 'bg-other'} ${pulse && state === 'running' ? 'pulse' : ''}`}
      title={state}
    />
  )
}
