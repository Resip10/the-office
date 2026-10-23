import type { SessionRecord, OverviewItem, StatuslineSnapshot } from '../../../desktop/src/core/types'
import { statuslineParts, usageStale, type StatPart } from '../../../desktop/src/core/usage-text'
import { relativeTime } from '../lib/list'
import { appOverviewParts } from '../lib/overview'

interface Props {
  records: SessionRecord[]
  items: OverviewItem[]
  // Only passed while the status line is connected.
  statusline: StatuslineSnapshot | null
  now: number
  showEdit?: boolean
  className?: string
}

function Part({ part }: { part: StatPart }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0 whitespace-nowrap">
      {part.label && <span className="text-faint">{part.label}</span>}
      <span className={`truncate ${part.warn ? 'text-run' : 'text-text-2'}`}>{part.text}</span>
    </span>
  )
}

// The app's own items first; items from the user's Claude Code status line sit in a marked group after them.
export function OverviewLine({ records, items, statusline, now, showEdit = false, className = '' }: Props) {
  const app = appOverviewParts(records, items, now)
  const fromStatusline = statusline ? statuslineParts(statusline, items, now) : []
  const stale = statusline ? usageStale(statusline, now) : null

  return (
    <div aria-label="Overview" className={`flex items-center gap-3 min-w-0 overflow-hidden font-mono text-[11px] text-muted ${className}`}>
      {app.map((p, i) => <Part key={i} part={p} />)}
      {statusline && fromStatusline.length > 0 && (
        <div
          role="group"
          aria-label="From your Claude Code status line"
          title={`From your Claude Code status line · updated ${relativeTime(statusline.capturedAt, now)}`}
          className={`flex items-center gap-3 min-w-0 ${app.length > 0 ? 'pl-3 border-l border-line' : ''}`}
        >
          <span aria-hidden="true" className="shrink-0 px-1 rounded border border-line-strong text-[10px] text-faint">&gt;_</span>
          {fromStatusline.map((p, i) => <Part key={i} part={p} />)}
          {stale && <span className="shrink-0 text-faint whitespace-nowrap">{stale}</span>}
        </div>
      )}
      {showEdit && (
        <button
          aria-label="Edit overview"
          title="Choose what shows here"
          onClick={() => window.sessionTray.openSettings('overview')}
          className="ml-auto shrink-0 flex items-center justify-center w-5 h-5 rounded text-faint hover:text-text hover:bg-hover"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      )}
    </div>
  )
}
