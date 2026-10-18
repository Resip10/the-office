import { useMemo, useState } from 'react'
import { buildSections, type Filters } from '../lib/list'
import { useNow, useSessions } from './useSessions'

const DEFAULT_FILTERS: Filters = { query: '', range: '7d', project: null, runningOnly: false }

// Everything both views share: data, filters, sections and the selected session.
export function useListState() {
  const { records, pins, legacyHooks } = useSessions()
  const now = useNow()
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sections = useMemo(() => buildSections(records, pins, filters, now), [records, pins, filters, now])
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
    requestAnimationFrame(() => document.querySelector(`[data-session-id="${id}"]`)?.scrollIntoView?.({ block: 'nearest' }))
  }

  return { records, pins, legacyHooks, now, filters, setFilters, sections, listedIds, projects, selected, selectedId, select }
}
