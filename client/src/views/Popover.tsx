import { useListState } from '../hooks/useListState'
import { FilterBar } from '../components/FilterBar'
import { LegacyHooksBanner } from '../components/LegacyHooksBanner'
import { NotifyTip } from '../components/NotifyTip'
import { OverviewLine } from '../components/OverviewLine'
import { SessionList } from '../components/SessionList'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function Popover() {
  const s = useListState()
  const listed = s.records.filter(r => !s.archived.includes(r.id)).length

  return (
    <div className="flex flex-col h-full bg-raised text-text font-sans border border-line rounded-[14px] overflow-hidden">
      <FilterBar filters={s.filters} onChange={s.setFilters} projects={s.projects} />
      {s.legacyHooks && <LegacyHooksBanner />}
      {s.notifyTip && <NotifyTip />}
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
          pulse={s.settings.pulse}
          compact={s.settings.density === 'compact'}
        />
      </div>
      <OverviewLine records={s.records} items={s.settings.overview} statusline={s.statusline} now={s.now} showEdit className="px-3.5 py-1.5 border-t border-line bg-surface" />
      <div className="flex items-center gap-2.5 px-3.5 py-2 border-t border-line bg-surface font-mono text-[11px] text-muted">
        {!s.loading && <span>{plural(listed, 'session')} · {plural(s.projects.length, 'project')}</span>}
        {s.stale.length > 0 && (
          <button className="focus-ring text-accent-text hover:underline" onClick={() => window.sessionTray.openWindow({ view: 'cleanup' })}>
            {s.stale.length} stale
          </button>
        )}
        <button className="focus-ring ml-auto text-text-2 hover:text-text" onClick={() => window.sessionTray.openWindow()}>
          Open window
        </button>
      </div>
    </div>
  )
}
