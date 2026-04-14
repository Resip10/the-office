import type { ToolCall } from '../types'

const ICON: Record<ToolCall['status'], string> = {
  running: '●',
  success: '✓',
  failure: '✕',
}

const ICON_COLOR: Record<ToolCall['status'], string> = {
  running: 'text-status-working',
  success: 'text-status-idle',
  failure: 'text-status-error',
}

function formatDuration(startedAt: number, completedAt: number | null): string {
  if (!completedAt) return '...'
  const ms = completedAt - startedAt
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

interface Props {
  toolHistory: ToolCall[]
}

export function ToolHistory({ toolHistory }: Props) {
  if (toolHistory.length === 0) {
    return <div className="text-xs text-text-muted italic">No tool calls yet</div>
  }

  return (
    <div className="space-y-0.5">
      {[...toolHistory].reverse().map(call => (
        <div key={call.id} className="flex items-baseline gap-2 text-xs py-0.5">
          <span className={`shrink-0 ${ICON_COLOR[call.status]}`}>{ICON[call.status]}</span>
          <span className="text-text-primary truncate flex-1">{call.toolName}</span>
          {typeof call.input === 'object' && call.input !== null ? (
            <span className="text-text-muted truncate max-w-32">
              {String(Object.values(call.input as Record<string, unknown>)[0] ?? '')}
            </span>
          ) : null}
          <span className="text-text-muted shrink-0">{formatDuration(call.startedAt, call.completedAt)}</span>
        </div>
      ))}
    </div>
  )
}
