import { useEffect, useMemo, useRef, useState } from 'react'
import { buildSections, staleList, type Filters } from '../lib/list'
import { DEFAULT_SETTINGS, type SessionsPayload } from '../../../desktop/src/core/types'
import { useNow, useSessions } from './useSessions'

const EMPTY: SessionsPayload = { records: [], pins: [], legacyHooks: false, names: {}, archived: [], keptAt: {}, settings: DEFAULT_SETTINGS, hasWt: false }
const DEFAULT_FILTERS: Filters = { query: '', range: '7d', project: null, runningOnly: false }

// Everything both views share: data, filters, sections and the selected session.
export function useListState() {
  const payload = useSessions()
  const { records, pins, legacyHooks } = payload ?? EMPTY
  const settings = payload?.settings ?? DEFAULT_SETTINGS
  const archived = payload?.archived ?? EMPTY.archived
  const keptAt = payload?.keptAt ?? EMPTY.keptAt
  const [mode, setMode] = useState<'sessions' | 'cleanup'>('sessions')
  const loading = payload === null
  const now = useNow()
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const archivedSet = useMemo(() => new Set(archived), [archived])
  const sections = useMemo(() => buildSections(records, pins, filters, now, archivedSet), [records, pins, filters, now, archivedSet])
  const stale = useMemo(() => staleList(records, { pins, archived, keptAt, settings }, now), [records, pins, archived, keptAt, settings, now])
  const listedIds = useMemo(() => new Set(records.map(r => r.id)), [records])
  const projects = useMemo(
    () => [...new Set(records.map(r => r.projectPath).filter((p): p is string => p !== null))].sort(),
    [records],
  )
  const selected = records.find(r => r.id === selectedId) ?? null

  function select(id: string) {
    const visible = [...sections.running, ...sections.pinned, ...sections.recent].some(r => r.id === id)
    if (!visible) setFilters({ ...DEFAULT_FILTERS, range: 'all' })
    setSelectedId(id)
    setMode('sessions')
    requestAnimationFrame(() => document.querySelector(`[data-session-id="${id}"]`)?.scrollIntoView?.({ block: 'nearest' }))
  }

  // Main asks the window to show a session (Peek from the popover).
  const selectRef = useRef(select)
  selectRef.current = select
  useEffect(() => window.sessionTray?.onOpen?.(opts => {
    if (opts.id) selectRef.current(opts.id)
    if (opts.view === 'cleanup') setMode('cleanup')
  }), [])

  return { records, pins, legacyHooks, settings, archived, stale, mode, setMode, loading, now, filters, setFilters, sections, listedIds, projects, selected, selectedId, select }
}
