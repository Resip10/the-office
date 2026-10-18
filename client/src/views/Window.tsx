import { useListState } from '../hooks/useListState'
import { DetailPanel } from '../components/DetailPanel'
import { FilterBar } from '../components/FilterBar'
import { LegacyHooksBanner } from '../components/LegacyHooksBanner'
import { SessionList } from '../components/SessionList'

export function Window() {
  const s = useListState()

  return (
    <div className="flex flex-col h-full bg-canvas text-text-primary font-sans">
      {s.legacyHooks && <LegacyHooksBanner />}
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col w-[440px] shrink-0 border-r border-border">
          <FilterBar filters={s.filters} onChange={s.setFilters} projects={s.projects} />
          <div className="flex-1 overflow-y-auto">
            <SessionList
              sections={s.sections}
              pins={s.pins}
              listedIds={s.listedIds}
              now={s.now}
              totalCount={s.records.length}
              selectedId={s.selectedId}
              onSelect={s.select}
              wide
            />
          </div>
        </div>
        <div className="flex-1 min-w-0 flex">
          {s.selected ? (
            <DetailPanel
              record={s.selected}
              pinned={s.pins.includes(s.selected.id)}
              continuedListed={s.selected.continuedInId !== null && s.listedIds.has(s.selected.continuedInId)}
              onSelect={s.select}
            />
          ) : (
            <p className="m-auto text-sm text-text-muted">Select a session to see details</p>
          )}
        </div>
      </div>
    </div>
  )
}
