import type { AgentState } from '../types'
import { ProjectGroup } from './ProjectGroup'

interface Props {
  agents: Map<string, AgentState>
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function AgentTree({ agents, selectedId, onSelect }: Props) {
  // Group agents by projectPath
  const groups = new Map<string, AgentState[]>()
  for (const agent of agents.values()) {
    const key = agent.projectPath || '(unknown)'
    const group = groups.get(key) ?? []
    group.push(agent)
    groups.set(key, group)
  }

  if (groups.size === 0) {
    return (
      <div className="p-3 text-xs text-text-muted">
        No agents yet.{' '}
        <span className="text-text-muted/60">Add hooks or open ?mock=true</span>
      </div>
    )
  }

  return (
    <div className="p-2">
      {Array.from(groups.entries()).map(([path, groupAgents]) => (
        <ProjectGroup
          key={path}
          projectPath={path}
          agents={groupAgents}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
