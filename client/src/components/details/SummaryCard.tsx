import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Handoff } from '../../../../desktop/src/core/types'
import { CopyIcon, CheckIcon } from '../ui/icons'

const SOURCE_NOTE: Record<Handoff['source'], string> = {
  compact: 'from the compaction summary',
  recap: "from Claude's recap",
  extract: 'extracted from the conversation',
}

const SHOWN_FILES = 3
const card = 'flex flex-col gap-3 rounded-xl border border-line bg-surface px-5 pt-[18px] pb-4'
const prose = 'text-[15px] leading-[1.65] text-text max-w-[72ch]'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="pt-0.5 text-[12px] text-muted">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </>
  )
}

export function SummarySkeleton() {
  return (
    <div role="status" aria-label="Loading summary" className={card}>
      <span className="text-[13px] font-semibold">Summary</span>
      {['w-full', 'w-11/12', 'w-2/3'].map(w => <span key={w} aria-hidden="true" className={`h-3 rounded bg-line ${w}`} />)}
    </div>
  )
}

export function SummaryCard({ handoff: h, onCopy }: { handoff: Handoff; onCopy: () => void }) {
  const [allFiles, setAllFiles] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  const extract = h.source === 'extract' || h.summary === null
  const files = allFiles ? h.files : h.files.slice(0, SHOWN_FILES)

  const copy = () => {
    onCopy()
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section aria-label="Summary" className={card}>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold">Summary</span>
        <span className="text-[12px] text-muted">{SOURCE_NOTE[h.source]}</span>
        <button
          onClick={copy}
          className="focus-ring ml-auto inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-[7px] border border-line-strong bg-control text-[12px] font-medium text-text-2 hover:text-text"
        >
          {copied ? <CheckIcon width={13} height={13} /> : <CopyIcon width={13} height={13} />}
          {copied ? 'Copied' : 'Copy as prompt'}
        </button>
      </div>
      {!extract && <p className={`m-0 whitespace-pre-wrap line-clamp-[12] ${prose}`}>{h.summary}</p>}
      <dl className="m-0 grid grid-cols-[72px_minmax(0,1fr)] gap-x-3.5 gap-y-2.5">
        {extract && h.goal && <Field label="Goal"><span className={prose}>{h.goal}</span></Field>}
        {extract && h.lastAsk && <Field label="Last ask"><span className={prose}>“{h.lastAsk}”</span></Field>}
        {h.files.length > 0 && (
          <Field label="Files">
            <span className="flex flex-col gap-[3px] font-mono text-[12px] text-text-2">
              {files.map(f => <span key={f} className="truncate" title={f}>{f}</span>)}
              {h.files.length > SHOWN_FILES && (
                <button onClick={() => setAllFiles(!allFiles)} className="focus-ring self-start rounded font-sans text-muted hover:text-text">
                  {allFiles ? 'Show less' : `Show all ${h.files.length}`}
                </button>
              )}
            </span>
          </Field>
        )}
        {h.branch && <Field label="Branch"><span className="font-mono text-[12px] text-text-2">{h.branch}</span></Field>}
        {extract && h.lastAnswer && <Field label="Last answer"><span className={`line-clamp-4 ${prose}`}>{h.lastAnswer}</span></Field>}
      </dl>
    </section>
  )
}
