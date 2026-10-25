import type { SessionRecord } from '../../../../desktop/src/core/types'
import { formatDuration } from '../../lib/format'

const RECENT_DONE_MS = 10 * 60_000

// Count shown on the tab: the live session's agents, or the subagents an ended session ran.
export function agentCount(r: SessionRecord): number {
  return r.live ? r.agents.length : r.subagentCount
}

export function AgentsTab({ record: r }: { record: SessionRecord }) {
  if (!r.live) {
    const n = r.subagentCount
    return <p className="m-0 text-[13px] text-text-2">{n} subagent{n === 1 ? '' : 's'} ran in this session</p>
  }
  // Finished agents stay listed briefly, then only counted, so long sessions don't pile up.
  const now = Date.now()
  const agents = r.agents.filter(a => a.running || (a.lastActivityAt !== null && now - a.lastActivityAt < RECENT_DONE_MS))
  const doneEarlier = r.agents.length - agents.length

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-muted">
        {agents.filter(a => a.running).length} running, {agents.filter(a => !a.running).length} done
        {doneEarlier > 0 && `, ${doneEarlier} done earlier`}
      </span>
      <ul className="m-0 p-0 list-none font-mono text-[11.5px]">
        {agents.map(a => (
          <li key={a.id} className="flex gap-2 py-0.5">
            <span className={a.running ? 'text-run' : 'text-faint'} aria-hidden="true">{a.running ? '●' : '○'}</span>
            <span className={`flex-1 min-w-0 truncate ${a.running ? 'text-text' : 'text-muted'}`} title={a.description ?? undefined}>{a.description ?? 'Agent'}</span>
            <span className="shrink-0 text-muted">
              {[a.model ?? a.agentType, a.running ? (a.startedAt !== null ? formatDuration(now - a.startedAt) : null) : 'done'].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
