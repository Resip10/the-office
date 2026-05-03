import { useEffect, useState } from 'react'
import type { AgentState, AgentStatus } from '../types'

const STATUS_DOT: Record<AgentStatus, string> = {
  starting: '◐',
  working:  '●',
  idle:     '●',
  waiting:  '●',
  done:     '○',
  error:    '✕',
}

const STATUS_COLOR: Record<AgentStatus, string> = {
  starting: 'text-status-starting',
  working:  'text-status-working',
  idle:     'text-status-idle',
  waiting:  'text-status-waiting',
  done:     'text-status-done',
  error:    'text-status-error',
}

const STALE_MS = 30 * 60 * 1000

interface Props {
  agent: AgentState
  depth: number
  selected: boolean
  onClick: () => void
  isTeammate?: boolean
  showId?: boolean
}

function formatWaiting(since: number): string {
  const s = Math.floor((Date.now() - since) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

export function AgentNode({ agent, depth, selected, onClick, isTeammate = false, showId = false }: Props) {
  const indent = depth * 20
  const [, setTick] = useState(0)

  const isStale = (agent.status === 'idle' || agent.status === 'done') &&
    Date.now() - agent.lastActivityAt > STALE_MS

  useEffect(() => {
    if (agent.status === 'done' || agent.status === 'error') return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [agent.status])

  function elapsed(): string {
    const s = Math.floor((Date.now() - agent.startedAt) / 1000)
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m`
  }

  const staleTitle = isStale
    ? `No activity for ${Math.floor((Date.now() - agent.lastActivityAt) / 60000)} min`
    : undefined

  return (
    <button
      onClick={onClick}
      title={staleTitle}
      className={`w-full text-left flex items-start gap-1.5 px-2 py-1 text-xs rounded hover:bg-surface transition-colors ${
        selected ? 'bg-surface border-l-2 border-status-idle' : ''
      } ${isStale ? 'opacity-60' : ''}`}
      style={{ paddingLeft: `${8 + indent}px` }}
    >
      <span className={`shrink-0 mt-0.5 ${STATUS_COLOR[agent.status]}`}>
        {STATUS_DOT[agent.status]}
      </span>
      <span className="flex flex-col min-w-0 flex-1">
        <span className="truncate flex items-center gap-1">
          <span className="text-text-primary">{agent.agentName}</span>
          {isTeammate && (
            <span className="text-[9px] text-text-muted border border-border rounded px-1">teammate</span>
          )}
          {(agent.parentSessionId || showId) && (
            <span className="text-text-muted ml-1">· {agent.sessionId.slice(0, 6)}</span>
          )}
        </span>
        {agent.status === 'waiting' && agent.waitingSince !== null ? (
          <span className="text-status-waiting truncate">waiting {formatWaiting(agent.waitingSince)}</span>
        ) : agent.currentTool ? (
          <span className="text-text-muted truncate">→{agent.currentTool}</span>
        ) : null}
      </span>
      <span className="text-text-muted ml-auto shrink-0">
        {agent.status !== 'done' && agent.status !== 'error' ? elapsed() : ''}
      </span>
    </button>
  )
}
