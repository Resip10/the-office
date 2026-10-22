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
  variant?: 'popover' | 'window'
  pulse?: boolean
  compact?: boolean
}

const actionClass =
  'inline-flex items-center gap-1 h-6 px-2 rounded-md border border-line-strong bg-control text-[11.5px] font-medium text-text-2 hover:text-text disabled:opacity-40 disabled:hover:text-text-2 disabled:cursor-not-allowed'
const primaryClass =
  'inline-flex items-center h-6 px-2 rounded-md bg-accent text-on-accent text-[11.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed'

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3z" />
    </svg>
  )
}

export function SessionRow({ record: r, pinned, now, continuedListed, onSelect, selected = false, variant = 'popover', pulse = true, compact = false }: Props) {
  const [copied, setCopied] = useState(false)
  const state = stateOf(r)
  const running = state === 'running'
  const continued = continuedListed && r.continuedInId !== null
  const location = [projectName(r.projectPath), r.gitBranch].filter(Boolean).join(' · ')
  const extras = [
    r.model,
    r.costUSD !== null ? formatCost(r.costUSD) : null,
    r.contextTokens !== null ? `${formatTokens(r.contextTokens)} ctx` : null,
  ].filter(Boolean).join(' · ')
  const when = r.live ? state : relativeTime(r.lastActivityAt, now)
  const whenColor = running ? 'text-run' : state === 'idle' ? 'text-idle' : r.live ? 'text-other' : 'text-muted'

  function copy() {
    window.sessionTray.copy(r.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      data-session-id={r.id}
      onClick={() => onSelect(r.id)}
      className={`group flex gap-2.5 mx-1.5 px-3 ${compact ? 'py-1.5' : 'py-2'} rounded-lg cursor-default ${selected ? 'bg-selected ring-1 ring-inset ring-line-strong' : 'hover:bg-hover'} ${continued ? 'opacity-60' : ''}`}
    >
      <span className="pt-1.5"><StateDot state={state} pulse={pulse} /></span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <span className="flex-1 truncate text-[13.5px] font-medium text-text" title={r.title}>{r.title}</span>
          <span className={`shrink-0 font-mono text-[11px] tabular-nums ${whenColor}`}>{when}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
          <span className="flex-1 truncate">{location}</span>
          {!compact && <span className="shrink-0 tabular-nums">{r.messageCount} msg</span>}
          {continued && (
            <button
              className="shrink-0 text-accent-text hover:underline"
              onClick={e => { e.stopPropagation(); onSelect(r.continuedInId as string) }}
            >
              Continued in →
            </button>
          )}
        </div>
        {variant === 'window' && extras && <div className="font-mono text-[11px] text-muted truncate">{extras}</div>}
        <div
          className={`${selected ? 'flex' : 'hidden'} group-hover:flex group-focus-within:flex gap-1.5 pt-1.5`}
          onClick={e => e.stopPropagation()}
        >
          <button
            className={primaryClass}
            disabled={!r.projectExists}
            title={r.projectExists ? undefined : 'Project folder no longer exists'}
            onClick={() => window.sessionTray.resume(r.id)}
          >
            {running ? 'Open another' : 'Resume'}
          </button>
          <button className={actionClass} onClick={copy} aria-label="Copy">{copied ? 'Copied' : 'Copy'}</button>
          {variant === 'popover' && (
            <button className={actionClass} onClick={() => window.sessionTray.openWindow({ id: r.id })}>Peek</button>
          )}
          <button
            className={`${actionClass} ml-auto px-1.5`}
            aria-label={pinned ? 'Unpin' : 'Pin'}
            onClick={() => window.sessionTray.togglePin(r.id)}
          >
            <PinIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
