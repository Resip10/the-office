export interface TranscriptMeta {
  id: string
  sessionId: string | null
  title: string
  titleSource: 'custom' | 'agent' | 'ai' | 'prompt' | 'none'
  projectPath: string | null
  gitBranch: string | null
  entrypoint: string | null
  version: string | null
  createdAt: number | null
  lastTimestamp: number | null
  messageCount: number
  contextTokens: number | null
  model: string | null
  costUSD: number | null
  prUrls: string[]
  lastPrompt: string | null
  awaySummary: string | null
  continuedInId: string | null
}

export interface LiveInfo {
  pid: number
  status: string
  name: string | null
  updatedAt: number
}

export interface SessionRecord extends Omit<TranscriptMeta, 'sessionId' | 'lastTimestamp'> {
  tool: 'claude'
  filePath: string
  projectExists: boolean
  lastActivityAt: number
  fileSize: number
  subagentCount: number
  live: LiveInfo | null
}

export interface SessionsPayload {
  records: SessionRecord[]
  pins: string[]
  legacyHooks: boolean
}

// What the window should show when it is opened from the popover.
export interface OpenWindowOptions {
  id?: string
  view?: 'cleanup'
}
