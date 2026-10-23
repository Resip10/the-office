import { useState, type ReactNode } from 'react'
import type { SessionRecord } from '../../../desktop/src/core/types'
import { copyCommand } from '../../../desktop/src/core/commands'
import { handoffPrompt } from '../../../desktop/src/core/handoff-prompt'
import { relativeTime, stateOf } from '../lib/list'
import { contextWindow, formatBytes, formatDuration, formatTokens } from '../lib/format'
import { useDetails } from '../hooks/useDetails'
import { HandoffCard } from './HandoffCard'
import { PeekCard } from './PeekCard'
import { ContinueSheet } from './ContinueSheet'

interface Props {
  record: SessionRecord
  pinned: boolean
  continuedListed: boolean
  onSelect: (id: string) => void
  showTools?: boolean
}

const button =
  'inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[7px] border border-line-strong bg-control text-[12.5px] font-medium text-text-2 hover:text-text hover:border-muted disabled:opacity-40 disabled:cursor-not-allowed'
const primary =
  'inline-flex items-center h-[30px] px-3 rounded-[7px] bg-accent text-on-accent text-[12.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed'

const dateTime = (ts: number | null) =>
  ts === null ? '—' : new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

function Stat({ label, value, sub, first = false }: { label: string; value: ReactNode; sub: ReactNode; first?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 px-4 py-3.5 min-w-0 ${first ? '' : 'border-l border-line'}`}>
      <span className="font-mono text-[10.5px] uppercase tracking-[.08em] text-muted">{label}</span>
      <span className="font-mono text-xl tabular-nums">{value}</span>
      {sub}
    </div>
  )
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 pt-2.5 min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 truncate">{children ?? '—'}</dd>
    </div>
  )
}

export function DetailPanel({ record: r, pinned, continuedListed, onSelect, showTools = false }: Props) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const { details, loading } = useDetails(r.id, r.lastActivityAt)
  const state = stateOf(r)
  const command = copyCommand(r, window.sessionTray.platform)
  const window_ = contextWindow(r.model, r.contextTokens ?? 0)
  const subline = [r.projectPath, r.gitBranch, r.createdAt !== null ? `started ${dateTime(r.createdAt)}` : null].filter(Boolean).join('  ·  ')

  function copy() {
    window.sessionTray.copy(r.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div role="region" aria-label="Session details" className="flex-1 min-w-0 overflow-y-auto px-8 pt-7 pb-8 flex flex-col gap-5 [&>*]:shrink-0">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          {editing ? (
            <input
              autoFocus
              aria-label="Session name"
              defaultValue={r.title}
              onKeyDown={e => {
                if (e.key === 'Enter') { window.sessionTray.rename(r.id, e.currentTarget.value); setEditing(false) }
                if (e.key === 'Escape') setEditing(false)
              }}
              onBlur={() => setEditing(false)}
              className="min-w-0 flex-1 bg-sunken border border-line-strong rounded-md px-2 py-0.5 text-2xl font-semibold tracking-tight text-text outline-none"
            />
          ) : (
            <>
              <h1 className="m-0 text-2xl font-semibold tracking-tight text-balance">{r.title}</h1>
              <button
                aria-label="Rename"
                title="Rename"
                onClick={() => setEditing(true)}
                className="flex items-center justify-center w-[26px] h-[26px] rounded-md text-muted hover:text-text hover:bg-hover"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
              </button>
            </>
          )}
          {r.live && (
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${state === 'running' ? 'border-run-chip-border bg-run-chip-fill text-run' : state === 'waiting' ? 'border-line-strong text-wait' : 'border-line-strong text-text-2'}`}>
              {state}{r.live.waitingFor ? ` · ${r.live.waitingFor}` : ''} · pid {r.live.pid}{r.live.name ? ` · ${r.live.name}` : ''}
            </span>
          )}
        </div>
        <p className="m-0 font-mono text-xs text-muted break-all">{subline}{r.projectPath && !r.projectExists && ' (missing)'}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={primary}
          disabled={!r.projectExists}
          title={r.projectExists ? undefined : 'Project folder no longer exists'}
          onClick={() => window.sessionTray.resume(r.id)}
        >
          {state === 'running' ? 'Open another' : 'Resume'}
        </button>
        <button className={button} disabled={loading} onClick={() => setContinuing(true)}>Continue in…</button>
        <button className={button} onClick={() => window.sessionTray.reveal(r.id)}>Reveal file</button>
        <button className={button} onClick={() => window.sessionTray.togglePin(r.id)}>{pinned ? 'Unpin' : 'Pin'}</button>
        <button
          className={`${button} ml-auto`}
          disabled={r.live !== null}
          title={r.live ? 'Running sessions cannot be archived' : 'Hide from lists. Restore it from Cleanup → Archive.'}
          onClick={() => window.sessionTray.archive([r.id])}
        >
          Archive
        </button>
      </div>

      <div className="flex items-center gap-2.5 h-[38px] pl-3 pr-1.5 rounded-lg border border-line bg-sunken">
        <span className="font-mono text-xs text-accent-text" aria-hidden="true">$</span>
        <code className="flex-1 min-w-0 truncate font-mono text-xs text-text-2" title={command}>{command}</code>
        <button className={`${button} h-[26px]`} onClick={copy} aria-label="Copy">{copied ? 'Copied' : 'Copy'}</button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] rounded-[10px] border border-line bg-surface overflow-hidden">
        <Stat first label="Messages" value={r.messageCount} sub={<span className="font-mono text-[11px] text-muted">{r.subagentCount} subagents</span>} />
        <Stat
          label="Context"
          value={r.contextTokens === null ? '—' : <>{formatTokens(r.contextTokens)}{window_ && <span className="text-[13px] text-muted"> / {formatTokens(window_)}</span>}</>}
          sub={window_ && r.contextTokens !== null
            ? <span className="flex h-1 rounded-sm bg-line"><span className="rounded-sm bg-accent" style={{ width: `${Math.min(100, (r.contextTokens / window_) * 100)}%` }} /></span>
            : <span className="h-1" />}
        />
        <Stat label="≈ API cost" value={r.costUSD === null ? '—' : `$${r.costUSD.toFixed(2)}`} sub={<span className="font-mono text-[11px] text-muted truncate">{r.model ?? '—'}</span>} />
        <Stat
          label="Active"
          value={r.createdAt === null ? '—' : formatDuration(r.lastActivityAt - r.createdAt)}
          sub={<span className="font-mono text-[11px] text-muted">last {relativeTime(r.lastActivityAt, Date.now())}</span>}
        />
      </div>

      {continuedListed && r.continuedInId && (
        <button className="self-start text-sm text-accent-text hover:underline" onClick={() => onSelect(r.continuedInId as string)}>
          Continued in →
        </button>
      )}

      {details && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4 items-start">
          <HandoffCard handoff={details.handoff} onCopy={() => window.sessionTray.copyText(handoffPrompt(r, details))} />
          {details.peek.length > 0 && (
            <PeekCard
              items={showTools ? details.peek : details.conversation}
              total={details.messageTotal}
              showTools={showTools}
              onOpenTranscript={() => window.sessionTray.reveal(r.id)}
            />
          )}
        </div>
      )}

      {r.prUrls.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h2 className="m-0 font-mono text-[10.5px] font-normal uppercase tracking-[.08em] text-muted">Pull requests</h2>
          <ul className="m-0 p-0 list-none text-sm">
            {r.prUrls.map(url => (
              <li key={url}>
                <button className="text-accent-text hover:underline break-all text-left" onClick={() => window.sessionTray.openUrl(url)}>{url}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-2 pt-1.5 border-t border-line font-mono text-[11.5px]">
        <Meta label="Surface">{r.entrypoint}</Meta>
        <Meta label="Claude Code">{r.version}</Meta>
        <Meta label="File size">{formatBytes(r.fileSize)}</Meta>
        <Meta label="Title from">{r.titleSource}</Meta>
        <Meta label="Session id">{r.id}</Meta>
      </dl>

      {continuing && <ContinueSheet record={r} details={details} onClose={() => setContinuing(false)} />}
    </div>
  )
}
