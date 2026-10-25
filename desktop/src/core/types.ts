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
  // Read only while the session is live; empty otherwise.
  agents: SubagentInfo[]
}

// One subagent from its meta file (subagents/agent-<id>.meta.json).
export interface SubagentInfo {
  id: string
  // The task Claude gave it, e.g. "Whole-branch code review".
  description: string | null
  agentType: string | null
  // Only when launched with an explicit model.
  model: string | null
  // Transcript file creation time; null where the OS doesn't record it.
  startedAt: number | null
  // Transcript file mtime; null without a transcript.
  lastActivityAt: number | null
  // Not finished and its transcript changed in the last AGENT_QUIET_MS.
  running: boolean
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
  // What Claude Code last passed to the connected status line; null until connected and refreshed.
  statusline: StatuslineSnapshot | null
  // Our command is in ~/.claude/settings.json right now.
  statuslineLinked: boolean
  // False on Windows without Git Bash, where Claude Code runs status lines through PowerShell.
  canLinkStatusline: boolean
  // Latest status line text, effort and thinking per session id, from refreshes while connected.
  sessionExtras: Record<string, SessionExtras>
}

// One plan limit from Claude Code's status line input; resetsAt in ms.
export interface LimitWindow {
  usedPct: number
  resetsAt: number | null
}

export interface StatuslineSnapshot {
  // When the status line last saved it (file mtime).
  capturedAt: number
  // The session that refreshed the status line; text, effort and thinking belong to it.
  sessionId: string | null
  fiveHour: LimitWindow | null
  sevenDay: LimitWindow | null
  effort: string | null
  thinking: boolean | null
  // What the user's script printed, without colors.
  text: string | null
}

// Per-session details only the status line knows; shown quietly in the session detail when known.
export interface SessionExtras {
  // What the status line printed for this session, without colors.
  text: string | null
  effort: string | null
  thinking: boolean | null
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
// Overview line items: the app's own first, then ones that need the connected status line.
export const OVERVIEW_APP_ITEMS = ['running', 'costToday', 'costWeek', 'sessionsToday'] as const
export const OVERVIEW_STATUSLINE_ITEMS = ['limits'] as const
export type OverviewItem = typeof OVERVIEW_APP_ITEMS[number] | typeof OVERVIEW_STATUSLINE_ITEMS[number]

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
  // Items in the overview line, in display order.
  overview: OverviewItem[]
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
  overview: ['running', 'costWeek', 'limits'],
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
  // Set while Session Tray's command wraps the Claude Code status line (statusline-link.ts).
  statusLink: StatusLink | null
  settings: Settings
}

export interface StatusLink {
  // The statusLine entry before Connect; null when there was none.
  original: Record<string, unknown> | null
  // The command Connect wrote; Disconnect only restores while it is still there.
  command: string
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

// What a session's project has access to, read on demand (core/plugged-in.ts). Never holds args, env, headers or URLs.
export interface PluggedIn {
  // When the session first recorded its loaded tools; null when it never did (no status then).
  loadedAt: number | null
  servers: McpServerInfo[]
  plugins: PluginInfo[]
}

export interface McpServerInfo {
  name: string
  // global: ~/.claude.json; local: its per-project entry; project: the repo's .mcp.json.
  scope: 'global' | 'local' | 'project' | 'plugin' | 'claude.ai' | 'session'
  // Plugin name for scope 'plugin'.
  source: string | null
  type: string | null
  // Base name of a stdio command, e.g. "npx".
  command: string | null
  // From the session's start; null when the session has no record of loaded tools.
  status: 'connected' | 'needs-auth' | 'failed' | 'pending' | 'not-loaded' | null
}

export interface PluginInfo {
  id: string
  name: string
  marketplace: string | null
  version: string | null
  scope: 'global' | 'project' | 'local'
  enabled: boolean
}

// Loaded on demand for one session (detail view, Continue in…).
export interface SessionDetails {
  handoff: Handoff
  peek: PeekItem[]
  // Last messages between the user and Claude only, without tool calls.
  conversation: PeekItem[]
  // The latest message the user typed; shown above the peek when it has scrolled out of it.
  lastUser: PeekItem | null
  messageTotal: number
}
