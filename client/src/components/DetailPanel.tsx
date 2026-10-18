import { useState, type ReactNode } from 'react'
import type { SessionRecord } from '../../../desktop/src/core/types'
import { copyCommand } from '../../../desktop/src/core/commands'
import { stateOf } from '../lib/list'
import { formatBytes, formatCost, formatTokens } from '../lib/format'
import { StateDot } from './StateDot'

interface Props {
  record: SessionRecord
  pinned: boolean
  continuedListed: boolean
  onSelect: (id: string) => void
}

const button =
  'px-3 py-1 rounded border border-border text-sm text-text-primary hover:border-text-muted disabled:opacity-40 disabled:cursor-not-allowed'

const dateTime = (ts: number | null) => (ts === null ? '—' : new Date(ts).toLocaleString())

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text-primary break-all">{children ?? '—'}</dd>
    </>
  )
}

export function DetailPanel({ record: r, pinned, continuedListed, onSelect }: Props) {
  const [copied, setCopied] = useState(false)
  const state = stateOf(r)
  const command = copyCommand(r)

  function copy() {
    window.sessionTray.copy(r.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-4 p-5 overflow-y-auto">
      <div>
        <h1 className="text-lg text-text-primary">{r.title}</h1>
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <StateDot state={state} /> {state}
          {r.live?.name && <span>· {r.live.name}</span>}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={button}
          disabled={!r.projectExists}
          title={r.projectExists ? undefined : 'Project folder no longer exists'}
          onClick={() => window.sessionTray.resume(r.id)}
        >
          {state === 'running' ? 'Open another' : 'Resume'}
        </button>
        <button className={button} onClick={() => window.sessionTray.reveal(r.id)}>Reveal file</button>
        <button className={button} onClick={() => window.sessionTray.togglePin(r.id)}>{pinned ? 'Unpin' : 'Pin'}</button>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 px-2 py-1 rounded bg-surface border border-border text-xs text-text-primary font-mono break-all">{command}</code>
        <button className={button} onClick={copy} aria-label="Copy">{copied ? 'Copied' : 'Copy'}</button>
      </div>

      {continuedListed && r.continuedInId && (
        <button className="self-start text-sm text-status-starting hover:underline" onClick={() => onSelect(r.continuedInId as string)}>
          Continued in →
        </button>
      )}

      {r.awaySummary && (
        <section>
          <h2 className="mb-1 text-xs uppercase tracking-wider text-text-muted">Recap</h2>
          <p className="text-sm text-text-primary whitespace-pre-wrap">{r.awaySummary}</p>
        </section>
      )}

      {r.lastPrompt && (
        <section>
          <h2 className="mb-1 text-xs uppercase tracking-wider text-text-muted">Last prompt</h2>
          <p className="text-sm text-text-primary whitespace-pre-wrap">{r.lastPrompt}</p>
        </section>
      )}

      {r.prUrls.length > 0 && (
        <section>
          <h2 className="mb-1 text-xs uppercase tracking-wider text-text-muted">Pull requests</h2>
          <ul className="text-sm">
            {r.prUrls.map(url => (
              <li key={url}>
                <button className="text-status-starting hover:underline break-all text-left" onClick={() => window.sessionTray.openUrl(url)}>{url}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
        <Field label="Project">{r.projectPath}{r.projectPath && !r.projectExists && ' (missing)'}</Field>
        <Field label="Branch">{r.gitBranch}</Field>
        <Field label="Started">{dateTime(r.createdAt)}</Field>
        <Field label="Last activity">{dateTime(r.lastActivityAt)}</Field>
        <Field label="Messages">{r.messageCount}</Field>
        <Field label="Subagents">{r.subagentCount}</Field>
        <Field label="Model">{r.model}</Field>
        <Field label="Context">{r.contextTokens !== null ? `${formatTokens(r.contextTokens)} tokens` : null}</Field>
        <Field label="≈ API cost">{r.costUSD !== null ? formatCost(r.costUSD) : null}</Field>
        <Field label="Title from">{r.titleSource}</Field>
        <Field label="Surface">{r.entrypoint}</Field>
        <Field label="Claude Code">{r.version}</Field>
        <Field label="File size">{formatBytes(r.fileSize)}</Field>
        <Field label="Session id">{r.id}</Field>
      </dl>
    </div>
  )
}
