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
  // Edit/Write/MultiEdit/NotebookEdit tool uses in the main thread.
  editCount: number
}

export interface LiveInfo {
  pid: number
  status: string
  name: string | null
  updatedAt: number
  // Set while status is 'waiting', e.g. "input needed" (Claude Code 2.1.303+).
  waitingFor: string | null
  statusUpdatedAt: number | null
}

export interface SessionRecord extends Omit<TranscriptMeta, 'sessionId' | 'lastTimestamp' | 'titleSource'> {
  titleSource: TranscriptMeta['titleSource'] | 'app'
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
  names: Record<string, string>
  archived: string[]
  keptAt: Record<string, number>
  notifyTipDone: boolean
  settings: Settings
  hasWt: boolean
}

// What the window should show when it is opened from the popover.
export interface OpenWindowOptions {
  id?: string
  view?: 'cleanup'
}

export type ThemeId = 'carbon' | 'graphite' | 'midnight' | 'ink' | 'paper'
export type TerminalChoice = 'auto' | 'wt' | 'powershell' | 'terminal'
export const NOTIFY_AFTER_MIN = [1, 5, 15, 30] as const
export type NotifyAfterMin = typeof NOTIFY_AFTER_MIN[number]

export interface Settings {
  theme: ThemeId
  followSystem: boolean
  density: 'comfortable' | 'compact'
  pulse: boolean
  // Message peek also lists tool calls.
  peekTools: boolean
  terminal: TerminalChoice
  launchAtLogin: boolean
  // Notify when a session has been waiting for input this many minutes.
  notify: boolean
  notifyAfterMin: NotifyAfterMin
  // A threshold of null turns that rule off.
  stale: { idleDays: number | null; trivialMessages: number | null; missingFolder: boolean }
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'carbon',
  followSystem: false,
  density: 'comfortable',
  pulse: true,
  peekTools: false,
  terminal: 'auto',
  launchAtLogin: false,
  notify: false,
  notifyAfterMin: 5,
  stale: { idleDays: 30, trivialMessages: 3, missingFolder: true },
}

// App-owned state in userData/app-state.json.
export interface AppState {
  pins: string[]
  names: Record<string, string>
  archived: string[]
  keptAt: Record<string, number>
  // The "turn on notifications" tip was closed, or notifications were ever turned on.
  notifyTipDone: boolean
  settings: Settings
}

export interface Handoff {
  source: 'compact' | 'recap' | 'extract'
  summary: string | null
  goal: string | null
  lastAsk: string | null
  files: string[]
  branch: string | null
  lastAnswer: string | null
}

export interface PeekItem {
  role: 'user' | 'assistant' | 'tool'
  text: string
  ts: number | null
}

// Loaded on demand for one session (detail view, Continue in…).
export interface SessionDetails {
  handoff: Handoff
  peek: PeekItem[]
  // Last messages between the user and Claude only, without tool calls.
  conversation: PeekItem[]
  messageTotal: number
}
