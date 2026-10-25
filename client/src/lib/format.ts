export function formatTokens(n: number): string {
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${Math.round(n / 1_000)}k`
  return `${Number((n / 1_000_000).toFixed(1))}M`
}

// Claude Code's own estimate at API prices — not what a subscription plan pays.
export function formatCost(usd: number): string {
  return `≈ $${usd.toFixed(2)}`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}

const LARGE_WINDOW = 1_000_000
const DEFAULT_WINDOW = 200_000

// Context window for the stat strip's bar. Transcripts don't record it, so it is inferred from
// the model id; null when the model is unknown. Never smaller than the tokens already in use.
export function contextWindow(model: string | null, tokens: number): number | null {
  if (!model) return null
  const large = /\[1m\]/i.test(model) || /^claude-(opus|sonnet|fable)-5/i.test(model)
  const window = large ? LARGE_WINDOW : DEFAULT_WINDOW
  return tokens > window ? LARGE_WINDOW : window
}

// Context used as a whole-number share of the model's window; null when either is unknown.
export function ctxPercent(model: string | null, tokens: number | null): number | null {
  if (tokens === null) return null
  const window = contextWindow(model, tokens)
  return window === null ? null : Math.round((tokens / window) * 100)
}
