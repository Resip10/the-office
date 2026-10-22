import { useListState } from '../hooks/useListState'
import { FilterBar } from '../components/FilterBar'
import { LegacyHooksBanner } from '../components/LegacyHooksBanner'
import { SessionList } from '../components/SessionList'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function Popover() {
  const s = useListState()

  return (
    <div className="flex flex-col h-full bg-raised text-text font-sans border border-line rounded-[14px] overflow-hidden">
      <FilterBar filters={s.filters} onChange={s.setFilters} projects={s.projects} />
      {s.legacyHooks && <LegacyHooksBanner />}
      <div className="flex-1 overflow-y-auto bg-raised">
        <SessionList
          sections={s.sections}
          pins={s.pins}
          listedIds={s.listedIds}
          now={s.now}
          totalCount={s.loading ? null : s.records.length}
          selectedId={s.selectedId}
          onSelect={s.select}
          variant="popover"
        />
      </div>
      <div className="flex items-center gap-2.5 px-3.5 py-2 border-t border-line bg-surface font-mono text-[11px] text-muted">
        {!s.loading && <span>{plural(s.records.length, 'session')} · {plural(s.projects.length, 'project')}</span>}
        <button className="ml-auto text-text-2 hover:text-text" onClick={() => window.sessionTray.openWindow()}>
          Open window
        </button>
      </div>
    </div>
  )
}
