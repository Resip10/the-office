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

export interface AgentSnapshot {
  sessionId: string
  agentName: string
  projectPath: string
  status: 'idle' | 'done'
  startedAt: number
  parentSessionId: string | null
  hasHooks: boolean
}

export interface InitPayload {
  type: 'init'
  agents: AgentSnapshot[]
  recentEvents: HookEvent[]
  hooksInstalled: boolean
}

export interface EventPayload {
  type: 'event'
  event: HookEvent
}

export interface SessionDiscoveredPayload {
  type: 'session_discovered'
  payload: AgentSnapshot
}

export interface EnrichPayload {
  type: 'enrich'
  sessionId: string
  data: EnrichmentData
}

export type WSMessage = InitPayload | EventPayload | SessionDiscoveredPayload | EnrichPayload
