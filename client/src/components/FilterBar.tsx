import { useEffect, useRef } from 'react'
import type { Filters, TimeRange } from '../lib/list'
import { projectName } from '../lib/list'

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  projects: string[]
}

const RANGES: Array<[TimeRange, string]> = [['today', 'Today'], ['7d', '7d'], ['30d', '30d'], ['all', 'All']]

const segment = (active: boolean) =>
  `px-2.5 py-1 rounded-[5px] text-[11.5px] font-medium ${active ? 'bg-line-strong text-text shadow-sm' : 'text-muted hover:text-text'}`

export function FilterBar({ filters, onChange, projects }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const searchRef = useRef<HTMLInputElement>(null)

  // The popover window is reused, so autoFocus only fires on the first open.
  useEffect(() => {
    const focusSearch = () => searchRef.current?.focus()
    window.addEventListener('focus', focusSearch)
    return () => window.removeEventListener('focus', focusSearch)
  }, [])

  return (
    <div className="flex flex-col gap-2.5 p-3 border-b border-line">
      <label className="flex items-center gap-2 h-8 px-2.5 rounded-lg bg-sunken border border-line focus-within:border-line-strong">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted shrink-0" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={searchRef}
          autoFocus
          type="search"
          value={filters.query}
          onChange={e => set({ query: e.target.value })}
          placeholder="Search sessions, projects, branches"
          className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-text placeholder:text-muted"
        />
        <kbd className="font-mono text-[10.5px] text-muted border border-line-strong rounded px-1.5">esc</kbd>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Time range" className="flex gap-0.5 p-0.5 rounded-[7px] bg-sunken border border-line">
          {RANGES.map(([range, label]) => (
            <button key={range} aria-pressed={filters.range === range} className={segment(filters.range === range)} onClick={() => set({ range })}>{label}</button>
          ))}
        </div>
        <button
          aria-pressed={filters.runningOnly}
          className={`px-2.5 h-7 rounded-md border text-[11.5px] font-medium ${filters.runningOnly ? 'border-run-chip-border bg-run-chip-fill text-run' : 'border-line-strong bg-control text-text-2 hover:text-text'}`}
          onClick={() => set({ runningOnly: !filters.runningOnly })}
        >
          Running
        </button>
        <select
          aria-label="Project"
          value={filters.project ?? ''}
          onChange={e => set({ project: e.target.value || null })}
          className="ml-auto max-w-[40%] h-7 px-2 rounded-md bg-control border border-line-strong text-[11.5px] text-text-2"
        >
          <option value="">All projects</option>
          {projects.map(p => <option key={p} value={p}>{projectName(p)}</option>)}
        </select>
      </div>
    </div>
  )
}
