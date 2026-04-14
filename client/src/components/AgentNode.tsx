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

interface Props {
  agent: AgentState
  depth: number
  selected: boolean
  onClick: () => void
}

export function AgentNode({ agent, depth, selected, onClick }: Props) {
  const indent = depth * 12
  const [, setTick] = useState(0)

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

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-1.5 px-2 py-1 text-xs rounded hover:bg-surface transition-colors ${
        selected ? 'bg-surface border-l-2 border-status-idle' : ''
      }`}
      style={{ paddingLeft: `${8 + indent}px` }}
    >
      <span className={`shrink-0 mt-0.5 ${STATUS_COLOR[agent.status]}`}>
        {STATUS_DOT[agent.status]}
      </span>
      <span className="flex flex-col min-w-0 flex-1">
        <span className="text-text-primary truncate">{agent.agentName}</span>
        {agent.currentTool && (
          <span className="text-text-muted truncate">→{agent.currentTool}</span>
        )}
      </span>
      <span className="text-text-muted ml-auto shrink-0">
        {agent.status !== 'done' && agent.status !== 'error' ? elapsed() : ''}
      </span>
    </button>
  )
}
