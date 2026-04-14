export type AgentStatus = 'starting' | 'idle' | 'working' | 'waiting' | 'done' | 'error'

export interface ToolCall {
  id: string
  toolName: string
  input: unknown
  startedAt: number
  completedAt: number | null
  status: 'running' | 'success' | 'failure'
}

export interface AgentState {
  sessionId: string
  agentName: string
  status: AgentStatus
  parentSessionId: string | null
  currentTool: string | null
  currentToolInput: unknown | null
  toolHistory: ToolCall[]
  startedAt: number
  lastActivityAt: number
  projectPath: string
}

export interface AgentSnapshot {
  sessionId: string
  agentName: string
  projectPath: string
  status: 'idle' | 'done'
  startedAt: number
  parentSessionId: string | null
}

export interface HookEvent {
  session_id: string
  hook_event_name: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  tool_output?: Record<string, unknown>
  transcript_path?: string
  parent_session_id?: string
  cwd?: string
  _timestamp: number
  _id: string
}

export interface DashboardState {
  agents: Map<string, AgentState>
  events: HookEvent[]
  selectedAgentId: string | null
  connected: boolean
}

export type Action =
  | { type: 'INIT'; agents: AgentSnapshot[]; recentEvents: HookEvent[] }
  | { type: 'EVENT'; event: HookEvent }
  | { type: 'SELECT_AGENT'; sessionId: string | null }
  | { type: 'CONNECTED'; connected: boolean }
  | { type: 'CLEAR' }
