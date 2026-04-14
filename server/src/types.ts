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

export interface AgentSnapshot {
  sessionId: string
  agentName: string
  projectPath: string
  status: 'idle' | 'done'
  startedAt: number
  parentSessionId: string | null
}

export interface InitPayload {
  type: 'init'
  agents: AgentSnapshot[]
  recentEvents: HookEvent[]
}

export interface EventPayload {
  type: 'event'
  event: HookEvent
}

export type WSMessage = InitPayload | EventPayload
