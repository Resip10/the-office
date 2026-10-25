import { useState, type ReactNode } from 'react'
import type { SessionRecord } from '../../../desktop/src/core/types'
import { handoffPrompt } from '../../../desktop/src/core/handoff-prompt'
import { formatBytes, formatDuration } from '../lib/format'
import { useAppState } from '../hooks/useAppState'
import { useDetails } from '../hooks/useDetails'
import { PeekCard } from './PeekCard'
import { ContinueSheet } from './ContinueSheet'
import { PluggedInCard } from './PluggedInCard'
import { DetailHeader } from './details/DetailHeader'
import { Figures } from './details/Figures'
import { IdLines } from './details/IdLines'
import { SummaryCard, SummarySkeleton } from './details/SummaryCard'
import type { DetailTab } from './details/types'

const RECENT_DONE_MS = 10 * 60_000

interface Props {
  record: SessionRecord
  pinned: boolean
  continuedListed: boolean
  onSelect: (id: string) => void
  showTools?: boolean
  tab: DetailTab
  onTabChange: (t: DetailTab) => void
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 pt-2.5 min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 truncate">{children ?? '—'}</dd>
    </div>
  )
}

// Tabs (Task 5) will use `tab` / `onTabChange`; passed through unused for now.
export function DetailPanel({ record: r, pinned, continuedListed, onSelect, showTools = false }: Props) {
  const [continuing, setContinuing] = useState(false)
  const { details, loading } = useDetails(r.id, r.lastActivityAt)
  // Finished agents stay listed briefly, then only counted, so long sessions don't pile up.
  const now = Date.now()
  const agents = r.agents.filter(a => a.running || (a.lastActivityAt !== null && now - a.lastActivityAt < RECENT_DONE_MS))
  const doneEarlier = r.agents.length - agents.length
  // Only the status line knows these; shown when it has refreshed for this session while connected.
  const extras = useAppState().sessionExtras[r.id]
  const extrasText = extras && [
    extras.text,
    extras.effort && `effort ${extras.effort}`,
    extras.thinking !== null && `thinking ${extras.thinking ? 'on' : 'off'}`,
  ].filter(Boolean).join(' · ')

  return (
    <div role="region" aria-label="Session details" className="flex-1 min-w-0 overflow-y-auto px-8 pt-[34px] pb-8 flex flex-col gap-[22px] [&>*]:shrink-0">
      <DetailHeader
        record={r}
        pinned={pinned}
        continuedListed={continuedListed}
        onSelect={onSelect}
        continueDisabled={loading}
        onContinue={() => setContinuing(true)}
      />

      <IdLines record={r} />

      {loading ? <SummarySkeleton /> : details && (
        <SummaryCard key={r.id} handoff={details.handoff} onCopy={() => window.sessionTray.copyText(handoffPrompt(r, details))} />
      )}

      <Figures record={r} />

      {extrasText && (
        <div aria-label="From your Claude Code status line" title={`From your Claude Code status line: ${extrasText}`} className="flex items-center gap-2 min-w-0 -mt-2 font-mono text-[11px] text-muted">
          <span aria-hidden="true" className="shrink-0 px-1 rounded border border-line-strong text-[10px] text-faint">&gt;_</span>
          <span className="truncate">{extrasText}</span>
        </div>
      )}

      {details && details.peek.length > 0 && (
        <PeekCard
          items={showTools ? details.peek : details.conversation}
          total={details.messageTotal}
          showTools={showTools}
          onOpenTranscript={() => window.sessionTray.reveal(r.id)}
        />
      )}

      {agents.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h2 className="m-0 text-[12px] font-normal text-muted">
            Agents · {agents.filter(a => a.running).length} running · {agents.filter(a => !a.running).length} done
            {doneEarlier > 0 && ` · ${doneEarlier} done earlier`}
          </h2>
          <ul className="m-0 p-0 list-none font-mono text-[11.5px]">
            {agents.map(a => (
              <li key={a.id} className="flex gap-2 py-0.5">
                <span className={a.running ? 'text-run' : 'text-faint'} aria-hidden="true">{a.running ? '●' : '○'}</span>
                <span className={`flex-1 min-w-0 truncate ${a.running ? 'text-text' : 'text-muted'}`} title={a.description ?? undefined}>{a.description ?? 'Agent'}</span>
                <span className="shrink-0 text-muted">
                  {[a.model ?? a.agentType, a.running ? (a.startedAt !== null ? formatDuration(Date.now() - a.startedAt) : null) : 'done'].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.prUrls.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h2 className="m-0 text-[12px] font-normal text-muted">Pull requests</h2>
          <ul className="m-0 p-0 list-none text-sm">
            {r.prUrls.map(url => (
              <li key={url}>
                <button className="text-accent-text hover:underline break-all text-left" onClick={() => window.sessionTray.openUrl(url)}>{url}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PluggedInCard id={r.id} />

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
