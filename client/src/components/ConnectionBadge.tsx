interface Props {
  connected: boolean
}

export function ConnectionBadge({ connected }: Props) {
  return (
    <span className={`text-xs flex items-center gap-1.5 ${connected ? 'text-status-idle' : 'text-status-error'}`}>
      <span className="text-[10px]">●</span>
      {connected ? 'connected' : 'disconnected'}
    </span>
  )
}
