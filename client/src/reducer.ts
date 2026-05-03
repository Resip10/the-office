import type { DashboardState, Action, AgentState, AgentSnapshot, HookEvent, ToolCall } from './types'

export const initialState: DashboardState = {
  agents: new Map(),
  events: [],
  selectedAgentId: null,
  connected: false,
  hooksInstalled: false,
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
    hasHooks: snap.hasHooks,
    enrichment: null,
    waitingSince: null,
  }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/$/, '')
}

function deriveProjectPath(event: HookEvent): string {
  if (event.cwd) return normalizePath(event.cwd)
  if (!event.transcript_path) return ''
  const normalized = event.transcript_path.replace(/\\/g, '/')
  const projectsIdx = normalized.lastIndexOf('/projects/')
  const sessionsIdx = normalized.indexOf('/sessions/', projectsIdx)
  if (projectsIdx === -1 || sessionsIdx === -1) return normalized
  return normalized.slice(projectsIdx + '/projects/'.length, sessionsIdx)
}

function defaultAgent(event: HookEvent, agents: Map<string, AgentState>): AgentState {
  const key = event.agent_id ?? event.session_id
  const isSubagent = !!event.agent_id
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
    hasHooks: false,
    enrichment: null,
    waitingSince: null,
  }
}

function applyEvent(agents: Map<string, AgentState>, event: HookEvent): Map<string, AgentState> {
  const next = new Map(agents)
  const id = event.agent_id ?? event.session_id
  const ts = event._timestamp
  const existing = next.get(id) ?? defaultAgent(event, agents)

  const incomingPath = (event.agent_id ? event.agent_transcript_path : event.transcript_path) ?? undefined
  const transcriptPath = existing.transcriptPath ?? incomingPath

  switch (event.hook_event_name) {
    case 'SessionStart':
      next.set(id, {
        ...existing,
        transcriptPath,
        status: 'idle',
        projectPath: deriveProjectPath(event) || existing.projectPath,
        lastActivityAt: ts,
      })
      break

    case 'SubagentStart':
      next.set(id, {
        ...existing,
        transcriptPath,
        status: 'starting',
        agentName: event.agent_type ?? existing.agentName,
        agentType: event.agent_type ?? existing.agentType,
        parentSessionId: event.agent_id ? event.session_id : (event.parent_session_id ?? existing.parentSessionId),
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
        transcriptPath,
        status: 'working',
        currentTool: event.tool_name ?? null,
        currentToolInput: event.tool_input ?? null,
        toolHistory: [...existing.toolHistory, toolCall].slice(-MAX_TOOL_HISTORY),
        lastActivityAt: ts,
        waitingSince: null,
      })
      break
    }

    case 'PostToolUse': {
      const history = existing.toolHistory.map(t =>
        t.status === 'running' ? { ...t, status: 'success' as const, completedAt: ts } : t
      )
      next.set(id, {
        ...existing,
        transcriptPath,
        status: 'idle',
        currentTool: null,
        currentToolInput: null,
        toolHistory: history,
        lastActivityAt: ts,
        waitingSince: null,
      })
      break
    }

    case 'PostToolUseFailure': {
      const history = existing.toolHistory.map(t =>
        t.status === 'running' ? { ...t, status: 'failure' as const, completedAt: ts } : t
      )
      next.set(id, {
        ...existing,
        transcriptPath,
        status: 'error',
        currentTool: null,
        currentToolInput: null,
        toolHistory: history,
        lastActivityAt: ts,
        waitingSince: null,
      })
      break
    }

    case 'Notification':
      next.set(id, {
        ...existing,
        transcriptPath,
        status: 'waiting',
        lastActivityAt: ts,
        waitingSince: Date.now(),
      })
      break

    case 'SubagentStop':
    case 'SessionEnd':
      next.set(id, { ...existing, transcriptPath, status: 'done', lastActivityAt: ts, waitingSince: null })
      break

    case 'Stop':
      next.set(id, { ...existing, transcriptPath, status: 'idle', lastActivityAt: ts, waitingSince: null })
      break
  }

  // Any real hook event means this agent has hooks
  const updated = next.get(id)
  if (updated && !updated.hasHooks) {
    next.set(id, { ...updated, hasHooks: true })
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
      return { ...state, agents, events, hooksInstalled: action.hooksInstalled }
    }

    case 'EVENT': {
      const agents = applyEvent(state.agents, action.event)
      const events = [...state.events, action.event].slice(-MAX_EVENTS)
      const selectedAgentId = state.selectedAgentId && !agents.has(state.selectedAgentId)
        ? null
        : state.selectedAgentId
      return { ...state, agents, events, selectedAgentId }
    }

    case 'SESSION_DISCOVERED': {
      if (state.agents.has(action.agent.sessionId)) return state
      const agents = new Map(state.agents)
      agents.set(action.agent.sessionId, snapshotToAgent(action.agent))
      return { ...state, agents }
    }

    case 'ENRICH': {
      const existing = state.agents.get(action.sessionId)
      if (!existing) return state
      const agents = new Map(state.agents)
      const enrichment = existing.enrichment
        ? { ...action.data, inputTokens: Math.max(existing.enrichment.inputTokens, action.data.inputTokens) }
        : action.data
      agents.set(action.sessionId, { ...existing, enrichment })
      return { ...state, agents }
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
