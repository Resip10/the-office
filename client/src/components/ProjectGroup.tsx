import { useState } from 'react'
import type { AgentState } from '../types'
import { AgentNode } from './AgentNode'

interface Props {
  projectPath: string
  agents: AgentState[]    // already sorted: root first, then children by parentSessionId
  selectedId: string | null
  onSelect: (id: string) => void
}

function getDisplayName(projectPath: string): string {
  if (!projectPath) return '(unknown project)'
  return projectPath.replace(/\\/g, '/').split('/').pop() ?? projectPath
}

function getDepth(agent: AgentState, allAgents: AgentState[]): number {
  if (!agent.parentSessionId) return 0
  const parent = allAgents.find(a => a.sessionId === agent.parentSessionId)
  if (!parent) return 1
  return 1 + getDepth(parent, allAgents)
}

export function ProjectGroup({ projectPath, agents, selectedId, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const nameCounts = new Map<string, number>()
  for (const a of agents) {
    nameCounts.set(a.agentName, (nameCounts.get(a.agentName) ?? 0) + 1)
  }

  const rootAgentCount = agents.filter(a => a.parentSessionId === null).length

  return (
    <div className="mb-1">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-1 px-2 py-1 text-xs text-status-starting hover:text-text-primary transition-colors"
      >
        <span>{collapsed ? '▸' : '▾'}</span>
        <span className="truncate">{getDisplayName(projectPath)}/</span>
        <span className="text-text-muted ml-auto shrink-0">{agents.length}</span>
      </button>
      {!collapsed && agents.map(agent => (
        <AgentNode
          key={agent.sessionId}
          agent={agent}
          depth={getDepth(agent, agents)}
          selected={agent.sessionId === selectedId}
          onClick={() => onSelect(agent.sessionId)}
          showId={(nameCounts.get(agent.agentName) ?? 0) > 1}
          isTeammate={agent.parentSessionId === null && rootAgentCount >= 2}
        />
      ))}
    </div>
  )
}
