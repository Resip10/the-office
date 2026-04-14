import type { HookEvent } from '../types'

interface Props {
  event: HookEvent
}

function projectLabel(event: HookEvent): string {
  if (event.cwd) return event.cwd.replace(/\\/g, '/').split('/').pop() ?? ''
  if (event.transcript_path) {
    const norm = event.transcript_path.replace(/\\/g, '/')
    const parts = norm.split('/')
    const sessIdx = parts.indexOf('sessions')
    if (sessIdx > 0) return parts[sessIdx - 1] ?? ''
  }
  return event.session_id.slice(0, 8)
}

export function EventRow({ event }: Props) {
  return (
    <div className="flex items-baseline gap-3 py-0.5 text-[11px] font-mono hover:bg-surface px-2 rounded">
      <span className="text-text-muted shrink-0 tabular-nums">
        {new Date(event._timestamp).toLocaleTimeString()}
      </span>
      <span className="text-status-starting shrink-0 truncate max-w-24" title={event.session_id}>
        {projectLabel(event)}
      </span>
      <span className="text-text-muted shrink-0">{event.hook_event_name}</span>
      {event.tool_name && (
        <span className="text-text-primary shrink-0">{event.tool_name}</span>
      )}
      {event.tool_input && typeof event.tool_input === 'object' && (
        <span className="text-text-muted truncate">
          {String(Object.values(event.tool_input)[0] ?? '')}
        </span>
      )}
    </div>
  )
}
