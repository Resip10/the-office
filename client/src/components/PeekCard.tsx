import type { PeekItem } from '../../../desktop/src/core/types'

const LABEL: Record<PeekItem['role'], string> = { user: 'you', assistant: 'claude', tool: 'tool' }

export function PeekCard({ peek, total, onOpenTranscript }: { peek: PeekItem[]; total: number; onOpenTranscript: () => void }) {
  return (
    <section aria-label="Messages" className="flex flex-col rounded-[10px] border border-line bg-surface">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
        <span className="font-mono text-[10.5px] uppercase tracking-[.08em] text-text">Messages</span>
        <span className="font-mono text-[10.5px] text-muted">last {peek.length} of {total}</span>
        <button
          onClick={onOpenTranscript}
          className="ml-auto h-6 px-2 rounded-md border border-line-strong bg-control text-[11.5px] font-medium text-text-2 hover:text-text"
        >
          Open transcript
        </button>
      </div>
      <ol className="m-0 p-0 list-none px-4 py-3.5 flex flex-col gap-3 text-[13px] leading-normal">
        {peek.map((item, i) => (
          <li key={i} className="flex gap-2.5">
            <span className={`w-11 shrink-0 pt-0.5 font-mono text-[10.5px] uppercase tracking-[.08em] ${item.role === 'user' ? 'text-accent-text' : 'text-muted'}`}>
              {LABEL[item.role]}
            </span>
            {item.role === 'tool'
              ? <span className="min-w-0 truncate font-mono text-xs text-muted">{item.text}</span>
              : <span className={`min-w-0 line-clamp-2 ${item.role === 'assistant' ? 'text-text-2' : 'text-text'}`}>{item.text}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
