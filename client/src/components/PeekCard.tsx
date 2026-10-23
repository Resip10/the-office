import type { PeekItem } from '../../../desktop/src/core/types'

const LABEL: Record<PeekItem['role'], string> = { user: 'you', assistant: 'claude', tool: 'tool' }

interface Props {
  items: PeekItem[]
  total: number
  showTools: boolean
  onOpenTranscript: () => void
}

export function PeekCard({ items: peek, total, showTools, onOpenTranscript }: Props) {
  return (
    <section aria-label="Messages" className="flex flex-col rounded-[10px] border border-line bg-surface">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
        <span className="font-mono text-[10.5px] uppercase tracking-[.08em] text-text">Messages</span>
        <span className="font-mono text-[10.5px] text-muted">last {peek.length} of {total}</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10.5px] text-muted">
          <button
            role="switch"
            aria-checked={showTools}
            aria-label="Show tools"
            onClick={() => window.sessionTray.setSettings({ peekTools: !showTools })}
            className={`flex w-7 h-4 p-0.5 rounded-full shrink-0 ${showTools ? 'bg-accent justify-end' : 'bg-line-strong justify-start'}`}
          >
            <span className={`w-3 h-3 rounded-full ${showTools ? 'bg-on-accent' : 'bg-muted'}`} />
          </button>
          tools
        </span>
        <button
          onClick={onOpenTranscript}
          className="h-6 px-2 rounded-md border border-line-strong bg-control text-[11.5px] font-medium text-text-2 hover:text-text"
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
