import { useEffect, useState } from 'react'
import { useListState } from '../hooks/useListState'
import { DetailPanel } from '../components/DetailPanel'
import type { DetailTab } from '../components/details/types'
import { FilterBar } from '../components/FilterBar'
import { LegacyHooksBanner } from '../components/LegacyHooksBanner'
import { NotifyTip } from '../components/NotifyTip'
import { OverviewLine } from '../components/OverviewLine'
import { SessionList } from '../components/SessionList'
import { Cleanup } from './Cleanup'

export function Window() {
  const s = useListState()
  const [detailTab, setDetailTab] = useState<DetailTab>('messages')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); window.sessionTray.openSettings() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex flex-col h-full bg-canvas text-text font-sans">
      <div className="flex items-center gap-3.5 h-[46px] shrink-0 px-3.5 border-b border-line bg-surface">
        <span className="text-[13px] font-semibold">Session Tray</span>
        <button
          aria-pressed={s.mode === 'cleanup'}
          onClick={() => s.setMode(s.mode === 'cleanup' ? 'sessions' : 'cleanup')}
          className={`focus-ring h-7 px-2.5 rounded-md text-xs font-medium ${s.mode === 'cleanup' ? 'bg-selected text-text ring-1 ring-inset ring-line-strong' : 'text-muted hover:text-text hover:bg-hover'}`}
        >
          Clean up{s.stale.length > 0 ? ` · ${s.stale.length}` : ''}
        </button>
        <OverviewLine records={s.records} items={s.settings.overview} statusline={s.statusline} now={s.now} className="ml-auto justify-end" />
        <button
          aria-label="Settings"
          title="Settings"
          onClick={() => window.sessionTray.openSettings()}
          className={`focus-ring flex items-center justify-center w-7 h-7 rounded-md text-muted hover:text-text hover:bg-hover`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
      {s.legacyHooks && <LegacyHooksBanner />}
      {s.notifyTip && <NotifyTip />}
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col w-[360px] shrink-0 border-r border-line bg-sunken">
          <FilterBar filters={s.filters} onChange={s.setFilters} projects={s.projects} />
          <div className="flex-1 overflow-y-auto bg-sunken">
            <SessionList
              sections={s.sections}
              pins={s.pins}
              listedIds={s.listedIds}
              now={s.now}
              totalCount={s.loading ? null : s.records.length}
              selectedId={s.selectedId}
              onSelect={s.select}
              pulse={s.settings.pulse}
              compact={s.settings.density === 'compact'}
              variant="window"
            />
          </div>
        </div>
        <div className="flex-1 min-w-0 flex">
          {s.mode === 'cleanup' ? (
            <Cleanup />
          ) : s.selected ? (
            <DetailPanel
              key={s.selected.id}
              record={s.selected}
              pinned={s.pins.includes(s.selected.id)}
              continuedListed={s.selected.continuedInId !== null && s.listedIds.has(s.selected.continuedInId)}
              onSelect={s.select}
              showTools={s.settings.peekTools}
              tab={detailTab}
              onTabChange={setDetailTab}
            />
          ) : (
            <p className="m-auto text-sm text-muted">Select a session to see details</p>
          )}
        </div>
      </div>
    </div>
  )
}
