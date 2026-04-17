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
  sessionId: string       // unique map key: session_id for root agents, agent_id for subagents
  agentName: string
  agentType?: string      // e.g. 'general-purpose', 'Explore' — present on subagents
  status: AgentStatus
  parentSessionId: string | null  // null for root agents; root's session_id for subagents
  currentTool: string | null
  currentToolInput: unknown | null
  toolHistory: ToolCall[]
  startedAt: number
  lastActivityAt: number
  projectPath: string
  transcriptPath?: string  // absolute path to JSONL session file on the server
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
  agent_id?: string
  agent_type?: string
  agent_transcript_path?: string
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
