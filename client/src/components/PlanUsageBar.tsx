import type { PlanUsage } from '../../../desktop/src/core/types'
import { usageParts, usageStale } from '../../../desktop/src/core/usage-text'

// Plan limits from the user's status line snapshot; amber from 80%.
export function PlanUsageBar({ usage, now, className = '' }: { usage: PlanUsage; now: number; className?: string }) {
  const parts = usageParts(usage, now)
  if (parts.length === 0) return null
  const stale = usageStale(usage, now)
  return (
    <div aria-label="Plan usage" className={`flex items-center gap-3 font-mono text-[11px] text-muted ${className}`}>
      {parts.map(p => (
        <span key={p.label} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-faint">{p.label}</span>
          <span className={p.warn ? 'text-run' : 'text-text-2'}>{p.text}</span>
        </span>
      ))}
      {stale && <span className="text-faint whitespace-nowrap">{stale}</span>}
    </div>
  )
}
