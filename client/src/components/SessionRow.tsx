import { useState } from 'react'
import type { SessionRecord } from '../../../desktop/src/core/types'
import { projectName, relativeTime, stateOf } from '../lib/list'
import { formatCost, formatTokens } from '../lib/format'
import { StateDot } from './StateDot'

interface Props {
  record: SessionRecord
  pinned: boolean
  now: number
  continuedListed: boolean
  onSelect: (id: string) => void
  selected?: boolean
  wide?: boolean
}

const actionClass =
  'px-2 py-0.5 rounded border border-border text-xs text-text-muted hover:text-text-primary hover:border-text-muted disabled:opacity-40 disabled:hover:text-text-muted disabled:cursor-not-allowed'

export function SessionRow({ record: r, pinned, now, continuedListed, onSelect, selected = false, wide = false }: Props) {
  const [copied, setCopied] = useState(false)
  const running = stateOf(r) === 'running'
  const continued = continuedListed && r.continuedInId !== null
  const location = [projectName(r.projectPath), r.gitBranch].filter(Boolean).join(' · ')
  const extras = [
    r.model,
    r.costUSD !== null ? formatCost(r.costUSD) : null,
    r.contextTokens !== null ? `${formatTokens(r.contextTokens)} ctx` : null,
  ].filter(Boolean).join(' · ')

  function copy() {
    window.sessionTray.copy(r.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      data-session-id={r.id}
      onClick={() => onSelect(r.id)}
      className={`group px-3 py-2 border-b border-border cursor-default ${selected ? 'bg-surface' : 'hover:bg-surface'} ${continued ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2">
        <StateDot state={stateOf(r)} />
        <span className="flex-1 truncate text-sm text-text-primary" title={r.title}>{r.title}</span>
        <span className="shrink-0 text-xs text-text-muted">{relativeTime(r.lastActivityAt, now)}</span>
      </div>
      <div className="flex items-center gap-2 pl-4 text-xs text-text-muted">
        <span className="truncate">{location}</span>
        <span className="shrink-0">{r.messageCount} msgs</span>
        {continued && (
          <button
            className="shrink-0 text-status-starting hover:underline"
            onClick={e => { e.stopPropagation(); onSelect(r.continuedInId as string) }}
          >
            Continued in →
          </button>
        )}
      </div>
      {wide && extras && <div className="pl-4 text-xs text-text-muted truncate">{extras}</div>}
      <div
        className="hidden group-hover:flex group-focus-within:flex gap-1.5 pl-4 pt-1.5"
        onClick={e => e.stopPropagation()}
      >
        <button
          className={actionClass}
          disabled={!r.projectExists}
          title={r.projectExists ? undefined : 'Project folder no longer exists'}
          onClick={() => window.sessionTray.resume(r.id)}
        >
          {running ? 'Open another' : 'Resume'}
        </button>
        <button className={actionClass} onClick={copy} aria-label="Copy">{copied ? 'Copied' : 'Copy'}</button>
        <button className={actionClass} onClick={() => window.sessionTray.togglePin(r.id)}>{pinned ? 'Unpin' : 'Pin'}</button>
      </div>
    </div>
  )
}
