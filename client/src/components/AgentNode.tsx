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
      <span className="flex flex-col min-w-0">
        <span className="text-text-primary truncate">{agent.agentName}</span>
        {agent.currentTool && (
          <span className="text-text-muted truncate">→{agent.currentTool}</span>
        )}
      </span>
    </button>
  )
}
