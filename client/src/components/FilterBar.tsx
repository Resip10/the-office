import type { Filters, TimeRange } from '../lib/list'
import { projectName } from '../lib/list'

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  projects: string[]
}

const RANGES: Array<[TimeRange, string]> = [['today', 'Today'], ['7d', '7d'], ['30d', '30d'], ['all', 'All']]

const chip = (active: boolean) =>
  `px-2 py-0.5 rounded text-xs border ${active ? 'border-status-starting text-text-primary' : 'border-border text-text-muted hover:text-text-primary'}`

export function FilterBar({ filters, onChange, projects }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })

  return (
    <div className="flex flex-col gap-2 p-3 border-b border-border">
      <input
        autoFocus
        type="search"
        value={filters.query}
        onChange={e => set({ query: e.target.value })}
        placeholder="Search title, project, branch, prompt…"
        className="w-full px-2 py-1 rounded bg-canvas border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-status-starting"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {RANGES.map(([range, label]) => (
          <button key={range} className={chip(filters.range === range)} onClick={() => set({ range })}>{label}</button>
        ))}
        <button className={chip(filters.runningOnly)} onClick={() => set({ runningOnly: !filters.runningOnly })}>Running</button>
        <select
          value={filters.project ?? ''}
          onChange={e => set({ project: e.target.value || null })}
          className="ml-auto max-w-[45%] px-1 py-0.5 rounded bg-canvas border border-border text-xs text-text-muted"
        >
          <option value="">All projects</option>
          {projects.map(p => <option key={p} value={p}>{projectName(p)}</option>)}
        </select>
      </div>
    </div>
  )
}
