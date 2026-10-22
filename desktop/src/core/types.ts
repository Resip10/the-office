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

export type ThemeId = 'carbon' | 'graphite' | 'midnight' | 'ink' | 'paper'
export type TerminalChoice = 'auto' | 'wt' | 'powershell' | 'terminal'

export interface Settings {
  theme: ThemeId
  followSystem: boolean
  density: 'comfortable' | 'compact'
  pulse: boolean
  terminal: TerminalChoice
  launchAtLogin: boolean
  // A threshold of null turns that rule off.
  stale: { idleDays: number | null; trivialMessages: number | null; missingFolder: boolean }
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'carbon',
  followSystem: false,
  density: 'comfortable',
  pulse: true,
  terminal: 'auto',
  launchAtLogin: false,
  stale: { idleDays: 30, trivialMessages: 3, missingFolder: true },
}

// App-owned state in userData/app-state.json.
export interface AppState {
  pins: string[]
  names: Record<string, string>
  archived: string[]
  keptAt: Record<string, number>
  settings: Settings
}
