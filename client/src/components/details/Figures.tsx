import type { ReactNode } from 'react'
import type { SessionRecord } from '../../../../desktop/src/core/types'
import { contextWindow, ctxPercent, formatDuration, formatTokens } from '../../lib/format'
import { Tooltip } from '../ui/tooltip'

function Figure({ value, caption }: { value: ReactNode; caption: string }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="font-mono text-[18px] tabular-nums">{value}</span>
      <span className="text-[12px] text-muted">{caption}</span>
    </div>
  )
}

// Four bare figures: messages, context, ≈ API cost (model in its tooltip), active duration.
export function Figures({ record: r }: { record: SessionRecord }) {
  const window_ = r.contextTokens === null ? null : contextWindow(r.model, r.contextTokens)
  const pct = ctxPercent(r.model, r.contextTokens)
  const cost = <Figure value={r.costUSD === null ? '—' : `$${r.costUSD.toFixed(2)}`} caption="≈ API cost" />

  return (
    <div className="flex flex-wrap gap-x-10 gap-y-3">
      <Figure value={r.messageCount} caption="messages" />
      <Figure
        value={r.contextTokens === null ? '—' : <>{formatTokens(r.contextTokens)}{window_ && <span className="text-[13px] text-muted"> / {formatTokens(window_)}</span>}</>}
        caption={pct === null ? 'context' : `context, ${pct}%`}
      />
      {r.model ? <Tooltip content={r.model}><div tabIndex={0} className="focus-ring rounded">{cost}</div></Tooltip> : cost}
      <Figure value={r.createdAt === null ? '—' : formatDuration(r.lastActivityAt - r.createdAt)} caption="active" />
    </div>
  )
}
