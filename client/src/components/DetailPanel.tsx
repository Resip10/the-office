import { useEffect, useState } from 'react'
import type { PluggedIn, SessionRecord } from '../../../desktop/src/core/types'
import { handoffPrompt } from '../../../desktop/src/core/handoff-prompt'
import { useDetails } from '../hooks/useDetails'
import { ContinueSheet } from './ContinueSheet'
import { AgentsTab, agentCount } from './details/AgentsTab'
import { DetailHeader } from './details/DetailHeader'
import { DetailTabs, type TabSpec } from './details/DetailTabs'
import { Figures } from './details/Figures'
import { IdLines } from './details/IdLines'
import { InfoTab } from './details/InfoTab'
import { MessagesTab, ToolCallsSwitch } from './details/MessagesTab'
import { PluggedInTab } from './details/PluggedInTab'
import { PrsTab } from './details/PrsTab'
import { SummaryCard, SummarySkeleton } from './details/SummaryCard'
import type { DetailTab } from './details/types'

interface Props {
  record: SessionRecord
  pinned: boolean
  continuedListed: boolean
  onSelect: (id: string) => void
  showTools?: boolean
  tab: DetailTab
  onTabChange: (t: DetailTab) => void
}

// MCP servers and plugins for the session, read when the details open; tagged with the id like useDetails.
function usePluggedIn(id: string): PluggedIn | null {
  const [loaded, setLoaded] = useState<{ id: string; data: PluggedIn | null } | null>(null)
  useEffect(() => {
    let cancelled = false
    window.sessionTray.pluggedIn(id).then(
      data => { if (!cancelled) setLoaded({ id, data }) },
      () => { if (!cancelled) setLoaded({ id, data: null }) },
    )
    return () => { cancelled = true }
  }, [id])
  return loaded?.id === id ? loaded.data : null
}

export function DetailPanel({ record: r, pinned, continuedListed, onSelect, showTools = false, tab, onTabChange }: Props) {
  const [continuing, setContinuing] = useState(false)
  const { details, loading } = useDetails(r.id, r.lastActivityAt)
  const plugged = usePluggedIn(r.id)
  const pluggedCount = plugged ? plugged.servers.length + plugged.plugins.length : 0
  const agents = agentCount(r)

  const tabs: TabSpec[] = [
    { value: 'messages', label: 'Messages', count: details?.messageTotal, content: <MessagesTab details={details} loading={loading} showTools={showTools} /> },
    ...(agents > 0 ? [{ value: 'agents', label: 'Agents', count: agents, content: <AgentsTab record={r} /> } as const] : []),
    ...(r.prUrls.length > 0 ? [{ value: 'prs', label: 'Pull requests', count: r.prUrls.length, content: <PrsTab urls={r.prUrls} /> } as const] : []),
    ...(plugged && pluggedCount > 0 ? [{ value: 'plugged', label: 'Plugged in', count: pluggedCount, content: <PluggedInTab data={plugged} /> } as const] : []),
    { value: 'info', label: 'Info', content: <InfoTab record={r} /> },
  ]

  // A remembered tab this session lacks shows Messages; once fallen back, the tab arriving later
  // (e.g. Plugged in after its fetch) doesn't take the selection. Cleared by picking a tab.
  const [fellBackFor, setFellBackFor] = useState<string | null>(null)
  const missing = !tabs.some(t => t.value === tab)
  if (missing && fellBackFor !== r.id) setFellBackFor(r.id)
  const selected = missing || fellBackFor === r.id ? 'messages' : tab
  const select = (t: DetailTab) => { setFellBackFor(null); onTabChange(t) }

  return (
    <div role="region" aria-label="Session details" className="flex-1 min-w-0 overflow-y-auto px-8 pt-[34px] pb-8 flex flex-col gap-[22px]">
      <div className="shrink-0 flex flex-col gap-[22px]">
        <DetailHeader
          record={r}
          pinned={pinned}
          continuedListed={continuedListed}
          onSelect={onSelect}
          continueDisabled={loading}
          onContinue={() => setContinuing(true)}
        />

        <IdLines record={r} />

        {loading ? <SummarySkeleton /> : details && (
          <SummaryCard key={r.id} handoff={details.handoff} onCopy={() => window.sessionTray.copyText(handoffPrompt(r, details))} />
        )}

        <Figures record={r} />
      </div>

      <DetailTabs
        tabs={tabs}
        value={selected}
        onValueChange={select}
        aside={selected === 'messages' && <ToolCallsSwitch on={showTools} />}
      />

      {continuing && <ContinueSheet record={r} details={details} onClose={() => setContinuing(false)} />}
    </div>
  )
}
