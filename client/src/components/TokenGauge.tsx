import type { EnrichmentData } from '../types'
import { getContextWindow } from '../model-limits'

interface Props {
  enrichment: EnrichmentData
  compact?: boolean
}

function fmtK(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

function fmtNum(n: number): string {
  return n.toLocaleString()
}

export function TokenGauge({ enrichment, compact = false }: Props) {
  const contextWindow = getContextWindow(enrichment.model)
  const fillPct = contextWindow ? Math.min(100, (enrichment.inputTokens / contextWindow) * 100) : null

  if (compact) {
    const label = contextWindow
      ? `${fmtK(enrichment.inputTokens)} / ${fmtK(contextWindow)}`
      : `${fmtK(enrichment.inputTokens)} tokens`

    return (
      <div className="flex items-center gap-1.5 mt-0.5" title={fillPct ? `Context: ${fillPct.toFixed(1)}%` : undefined}>
        {fillPct !== null && (
          <div className="w-16 h-1 bg-border rounded-full overflow-hidden shrink-0">
            <div
              className="h-full rounded-full bg-status-starting"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        )}
        <span className="text-text-muted text-[10px]">{label}</span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5 text-[11px]">
      {enrichment.model && (
        <div className="flex gap-2">
          <span className="text-text-muted w-16 shrink-0">Model</span>
          <span className="text-text-primary font-mono">{enrichment.model}</span>
        </div>
      )}
      <div className="flex gap-2 items-center">
        <span className="text-text-muted w-16 shrink-0">Context</span>
        <div className="flex items-center gap-2 flex-1">
          {fillPct !== null && (
            <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden shrink-0">
              <div
                className="h-full rounded-full bg-status-starting"
                style={{ width: `${fillPct}%` }}
              />
            </div>
          )}
          <span className="text-text-primary">
            {fmtNum(enrichment.inputTokens)}
            {contextWindow ? ` / ${fmtNum(contextWindow)} tokens (${fillPct!.toFixed(0)}%)` : ' tokens'}
          </span>
        </div>
      </div>
      {enrichment.outputTokens > 0 && (
        <div className="flex gap-2">
          <span className="text-text-muted w-16 shrink-0">Output</span>
          <span className="text-text-primary">{fmtNum(enrichment.outputTokens)} tokens generated</span>
        </div>
      )}
      {(enrichment.cacheReadTokens > 0 || enrichment.cacheWriteTokens > 0) && (
        <div className="flex gap-2">
          <span className="text-text-muted w-16 shrink-0">Cache</span>
          <span className="text-text-primary">
            {fmtNum(enrichment.cacheReadTokens)} read / {fmtNum(enrichment.cacheWriteTokens)} written
          </span>
        </div>
      )}
      {enrichment.costUSD > 0 && (
        <div className="flex gap-2">
          <span className="text-text-muted w-16 shrink-0">Cost</span>
          <span className="text-text-primary">${enrichment.costUSD.toFixed(3)} this session</span>
        </div>
      )}
      {enrichment.turnDurationMs > 0 && (
        <div className="flex gap-2">
          <span className="text-text-muted w-16 shrink-0">Last turn</span>
          <span className="text-text-primary">{(enrichment.turnDurationMs / 1000).toFixed(1)}s</span>
        </div>
      )}
    </div>
  )
}
