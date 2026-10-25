import type { SessionRecord } from '../../../desktop/src/core/types'
import type { Sections } from '../lib/list'
import { SessionRow } from './SessionRow'

interface Props {
  sections: Sections
  pins: string[]
  listedIds: Set<string>
  now: number
  totalCount: number | null // null while the first scan is running
  selectedId: string | null
  onSelect: (id: string) => void
  variant?: 'popover' | 'window'
  pulse?: boolean
  compact?: boolean
}

const TITLES: Array<[keyof Sections, string]> = [['running', 'Running'], ['pinned', 'Pinned'], ['recent', 'Recent']]

export function SessionList({ sections, pins, listedIds, now, totalCount, selectedId, onSelect, variant, pulse, compact }: Props) {
  if (totalCount === null) {
    return <p className="p-4 text-sm text-muted">Scanning…</p>
  }
  if (totalCount === 0) {
    return <p className="p-4 text-sm text-muted">No Claude Code sessions found in ~/.claude/projects</p>
  }
  if (TITLES.every(([key]) => sections[key].length === 0)) {
    return <p className="p-4 text-sm text-muted">No sessions match these filters.</p>
  }

  const row = (r: SessionRecord) => (
    <SessionRow
      key={r.id}
      record={r}
      pinned={pins.includes(r.id)}
      now={now}
      continuedListed={r.continuedInId !== null && listedIds.has(r.continuedInId)}
      selected={r.id === selectedId}
      onSelect={onSelect}
      variant={variant}
      pulse={pulse}
      compact={compact}
    />
  )

  return (
    <div className="flex flex-col pb-1.5">
      {TITLES.filter(([key]) => sections[key].length > 0).map(([key, title]) => (
        <section key={key} className="flex flex-col gap-0.5">
          <h2 className="sticky top-0 z-10 flex justify-between px-[18px] pt-3 pb-1 bg-inherit font-normal text-[12px] text-muted">
            {title}<span className="tabular-nums">{sections[key].length}</span>
          </h2>
          {sections[key].map(row)}
        </section>
      ))}
    </div>
  )
}
