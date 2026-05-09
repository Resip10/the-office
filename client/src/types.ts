export type AgentStatus = 'starting' | 'idle' | 'working' | 'waiting' | 'done' | 'error'

export interface ToolCall {
  id: string
  toolName: string
  input: unknown
  startedAt: number
  completedAt: number | null
  status: 'running' | 'success' | 'failure'
}

export interface EnrichmentData {
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUSD: number
  turnDurationMs: number
  isSidechain: boolean
}

export interface AgentState {
  sessionId: string
  agentName: string
  agentType?: string
  status: AgentStatus
  parentSessionId: string | null
  currentTool: string | null
  currentToolInput: unknown | null
  toolHistory: ToolCall[]
  startedAt: number
  lastActivityAt: number
  projectPath: string
  transcriptPath?: string
  hasHooks: boolean
  enrichment: EnrichmentData | null
  waitingSince: number | null
}

export interface AgentSnapshot {
  sessionId: string
  agentName: string
  projectPath: string
  status: 'idle' | 'done'
  startedAt: number
  parentSessionId: string | null
  hasHooks: boolean
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
  hooksInstalled: boolean
}

export type Action =
  | { type: 'INIT'; agents: AgentSnapshot[]; recentEvents: HookEvent[]; hooksInstalled: boolean }
  | { type: 'EVENT'; event: HookEvent }
  | { type: 'SESSION_DISCOVERED'; agent: AgentSnapshot }
  | { type: 'ENRICH'; sessionId: string; data: EnrichmentData }
  | { type: 'SELECT_AGENT'; sessionId: string | null }
  | { type: 'CONNECTED'; connected: boolean }
  | { type: 'CLEAR' }
