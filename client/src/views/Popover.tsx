import { useListState } from '../hooks/useListState'
import { FilterBar } from '../components/FilterBar'
import { LegacyHooksBanner } from '../components/LegacyHooksBanner'
import { SessionList } from '../components/SessionList'

export function Popover() {
  const s = useListState()

  return (
    <div className="flex flex-col h-full bg-canvas text-text-primary font-sans border border-border">
      <FilterBar filters={s.filters} onChange={s.setFilters} projects={s.projects} />
      {s.legacyHooks && <LegacyHooksBanner />}
      <div className="flex-1 overflow-y-auto">
        <SessionList
          sections={s.sections}
          pins={s.pins}
          listedIds={s.listedIds}
          now={s.now}
          totalCount={s.records.length}
          selectedId={s.selectedId}
          onSelect={s.select}
        />
      </div>
      <div className="flex justify-end px-3 py-2 border-t border-border">
        <button className="text-xs text-text-muted hover:text-text-primary" onClick={() => window.sessionTray.openWindow()}>
          Open window
        </button>
      </div>
    </div>
  )
}
