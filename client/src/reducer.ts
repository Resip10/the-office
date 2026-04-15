import type { DashboardState, Action, AgentState, AgentSnapshot, HookEvent, ToolCall } from './types'

export const initialState: DashboardState = {
  agents: new Map(),
  events: [],
  selectedAgentId: null,
  connected: false,
}

const MAX_EVENTS = 5000
const MAX_TOOL_HISTORY = 50

function snapshotToAgent(snap: AgentSnapshot): AgentState {
  return {
    sessionId: snap.sessionId,
    agentName: snap.agentName,
    agentType: undefined,
    status: snap.status === 'done' ? 'done' : 'idle',
    parentSessionId: snap.parentSessionId,
    currentTool: null,
    currentToolInput: null,
    toolHistory: [],
    startedAt: snap.startedAt,
    lastActivityAt: snap.startedAt,
    projectPath: snap.projectPath,
  }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/$/, '')
}

function deriveProjectPath(event: HookEvent): string {
  if (event.cwd) return normalizePath(event.cwd)
  if (!event.transcript_path) return ''
  // transcript_path: ~/.claude/projects/<encoded>/sessions/<file>.jsonl
  // Extract the part between the last 'projects/' and '/sessions/'
  const normalized = event.transcript_path.replace(/\\/g, '/')
  const projectsIdx = normalized.lastIndexOf('/projects/')
  const sessionsIdx = normalized.indexOf('/sessions/', projectsIdx)
  if (projectsIdx === -1 || sessionsIdx === -1) return normalized
  return normalized.slice(projectsIdx + '/projects/'.length, sessionsIdx)
}

function defaultAgent(event: HookEvent, agents: Map<string, AgentState>): AgentState {
  const key = event.agent_id ?? event.session_id
  const isSubagent = !!event.agent_id
  // Subagents always use parent's projectPath so they appear in the same group
  const projectPath = isSubagent
    ? (agents.get(event.session_id)?.projectPath ?? deriveProjectPath(event))
    : deriveProjectPath(event)
  return {
    sessionId: key,
    agentName: event.agent_type ?? key.slice(0, 8),
    agentType: event.agent_type,
    status: 'idle',
    parentSessionId: isSubagent ? event.session_id : (event.parent_session_id ?? null),
    currentTool: null,
    currentToolInput: null,
    toolHistory: [],
    startedAt: event._timestamp,
    lastActivityAt: event._timestamp,
    projectPath,
  }
}

function applyEvent(agents: Map<string, AgentState>, event: HookEvent): Map<string, AgentState> {
  const next = new Map(agents)
  const id = event.agent_id ?? event.session_id
  const ts = event._timestamp
  const existing = next.get(id) ?? defaultAgent(event, agents)

  switch (event.hook_event_name) {
    case 'SessionStart':
      next.set(id, {
        ...existing,
        status: 'idle',
        projectPath: deriveProjectPath(event) || existing.projectPath,
        lastActivityAt: ts,
      })
      break

    case 'SubagentStart':
      next.set(id, {
        ...existing,
        status: 'starting',
        agentName: event.agent_type ?? existing.agentName,
        agentType: event.agent_type ?? existing.agentType,
        parentSessionId: event.agent_id ? event.session_id : (event.parent_session_id ?? existing.parentSessionId),
        // Always inherit parent's projectPath so subagent stays in the same group
        projectPath: existing.projectPath || next.get(event.session_id)?.projectPath || deriveProjectPath(event),
        lastActivityAt: ts,
      })
      break

    case 'PreToolUse': {
      const toolCall: ToolCall = {
        id: `${id}-${ts}`,
        toolName: event.tool_name ?? 'unknown',
        input: event.tool_input ?? null,
        startedAt: ts,
        completedAt: null,
        status: 'running',
      }
      next.set(id, {
        ...existing,
        status: 'working',
        currentTool: event.tool_name ?? null,
        currentToolInput: event.tool_input ?? null,
        toolHistory: [...existing.toolHistory, toolCall].slice(-MAX_TOOL_HISTORY),
        lastActivityAt: ts,
      })
      break
    }

    case 'PostToolUse': {
      const history = existing.toolHistory.map(t =>
        t.status === 'running' ? { ...t, status: 'success' as const, completedAt: ts } : t
      )
      next.set(id, {
        ...existing,
        status: 'idle',
        currentTool: null,
        currentToolInput: null,
        toolHistory: history,
        lastActivityAt: ts,
      })
      break
    }

    case 'PostToolUseFailure': {
      const history = existing.toolHistory.map(t =>
        t.status === 'running' ? { ...t, status: 'failure' as const, completedAt: ts } : t
      )
      next.set(id, {
        ...existing,
        status: 'error',
        currentTool: null,
        currentToolInput: null,
        toolHistory: history,
        lastActivityAt: ts,
      })
      break
    }

    case 'Notification':
      next.set(id, { ...existing, status: 'waiting', lastActivityAt: ts })
      break

    case 'SubagentStop':
    case 'SessionEnd':
      next.delete(id)
      break

    case 'Stop':
      next.set(id, { ...existing, status: 'idle', lastActivityAt: ts })
      break
  }

  return next
}

export function dashboardReducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case 'INIT': {
      let agents = new Map<string, AgentState>()
      for (const snap of action.agents) {
        agents.set(snap.sessionId, snapshotToAgent(snap))
      }
      for (const ev of action.recentEvents) {
        agents = applyEvent(agents, ev)
      }
      const events = action.recentEvents.slice(-MAX_EVENTS)
      return { ...state, agents, events }
    }

    case 'EVENT': {
      const agents = applyEvent(state.agents, action.event)
      const events = [...state.events, action.event].slice(-MAX_EVENTS)
      // If the selected agent was just removed, deselect it
      const selectedAgentId = state.selectedAgentId && !agents.has(state.selectedAgentId)
        ? null
        : state.selectedAgentId
      return { ...state, agents, events, selectedAgentId }
    }

    case 'SELECT_AGENT':
      return { ...state, selectedAgentId: action.sessionId }

    case 'CONNECTED':
      return { ...state, connected: action.connected }

    case 'CLEAR':
      return { ...initialState, connected: state.connected }

    default:
      return state
  }
}
