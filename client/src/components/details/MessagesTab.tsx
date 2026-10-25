import type { PeekItem, SessionDetails } from '../../../../desktop/src/core/types'

const LABEL: Record<PeekItem['role'], string> = { user: 'You', assistant: 'Claude', tool: 'Tool' }

// Right side of the tab bar while Messages is open; same `peekTools` setting as before.
export function ToolCallsSwitch({ on }: { on: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => window.sessionTray.setSettings({ peekTools: !on })}
      className="focus-ring flex items-center gap-2 rounded-md px-1 text-[12.5px] text-text-2 hover:text-text"
    >
      <span aria-hidden="true" className={`flex w-7 h-4 p-0.5 rounded-full shrink-0 ${on ? 'bg-accent justify-end' : 'bg-line-strong justify-start'}`}>
        <span className={`w-3 h-3 rounded-full ${on ? 'bg-on-accent' : 'bg-muted'}`} />
      </span>
      Show tool calls
    </button>
  )
}

export function MessagesTab({ details, loading, showTools }: { details: SessionDetails | null; loading: boolean; showTools: boolean }) {
  if (loading) {
    return (
      <div role="status" aria-label="Loading messages" className="flex flex-col gap-3 py-1.5">
        {['w-1/2', 'w-5/6', 'w-2/3'].map(w => <span key={w} aria-hidden="true" className={`h-3 rounded bg-line ${w}`} />)}
      </div>
    )
  }
  const items = details ? (showTools ? details.peek : details.conversation) : []
  if (!details || items.length === 0) return <p className="m-0 text-[13px] text-muted">No messages to show</p>

  return (
    <div className="flex flex-col gap-2">
      <ol className="m-0 p-0 list-none flex flex-col gap-3 text-[13px] leading-normal">
        {items.map((item, i) => (
          <li key={i} className="grid grid-cols-[56px_minmax(0,1fr)] gap-2.5">
            <span className={`pt-0.5 text-[12px] ${item.role === 'user' ? 'text-text' : 'text-muted'}`}>
              {LABEL[item.role]}
            </span>
            {item.role === 'tool'
              ? <span className="min-w-0 truncate font-mono text-xs text-muted">{item.text}</span>
              : <span className={`min-w-0 line-clamp-2 ${item.role === 'assistant' ? 'text-text-2' : 'text-text'}`}>{item.text}</span>}
          </li>
        ))}
      </ol>
      <span className="pt-1.5 text-[12px] text-muted">Last {items.length} of {details.messageTotal}</span>
    </div>
  )
}
