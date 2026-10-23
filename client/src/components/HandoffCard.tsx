import type { ReactNode } from 'react'
import type { Handoff } from '../../../desktop/src/core/types'

const SOURCE_TAG: Record<Handoff['source'], string> = {
  compact: 'compaction summary',
  recap: 'recap',
  extract: 'extracted',
}

const SHOWN_FILES = 3

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="pt-0.5 font-mono text-[10.5px] uppercase tracking-[.08em] text-muted">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </>
  )
}

export function HandoffCard({ handoff: h, onCopy }: { handoff: Handoff; onCopy: () => void }) {
  const extract = h.source === 'extract' || h.summary === null
  const extraFiles = h.files.length - SHOWN_FILES

  return (
    <section aria-label="Handoff" className="flex flex-col rounded-[10px] border border-line bg-surface">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
        <span className="font-mono text-[10.5px] uppercase tracking-[.08em] text-text">Handoff</span>
        <span className="font-mono text-[10.5px] text-muted border border-line-strong rounded px-1.5">{SOURCE_TAG[h.source]}</span>
        <button
          onClick={onCopy}
          className="ml-auto h-6 px-2 rounded-md border border-line-strong bg-control text-[11.5px] font-medium text-text-2 hover:text-text"
        >
          Copy as prompt
        </button>
      </div>
      {!extract && <p className="m-0 px-4 pt-3.5 text-[13px] leading-relaxed text-text-2 whitespace-pre-wrap line-clamp-[12]">{h.summary}</p>}
      <dl className="m-0 px-4 py-3.5 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3.5 gap-y-3 text-[13px] leading-normal">
        {extract && h.goal && <Field label="Goal">{h.goal}</Field>}
        {extract && h.lastAsk && <Field label="Last ask">“{h.lastAsk}”</Field>}
        {h.files.length > 0 && (
          <Field label="Files">
            <span className="flex flex-col gap-0.5 font-mono text-xs text-text-2">
              {h.files.slice(0, SHOWN_FILES).map(f => <span key={f} className="truncate" title={f}>{f}</span>)}
              {extraFiles > 0 && <span className="text-muted">+{extraFiles} more</span>}
            </span>
          </Field>
        )}
        {h.branch && <Field label="Branch"><span className="font-mono text-xs">{h.branch}</span></Field>}
        {extract && h.lastAnswer && <Field label="Last answer"><span className="text-text-2 line-clamp-4">{h.lastAnswer}</span></Field>}
      </dl>
    </section>
  )
}
