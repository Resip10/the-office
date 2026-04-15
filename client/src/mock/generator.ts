import type { Dispatch } from 'react'
import type { Action, HookEvent, AgentSnapshot } from '../types'

const P1 = '/home/user/my-project'
const P2 = '/home/user/other-project'

// Root sessions (separate Claude Code processes)
const S_MAIN = 'mock-session-main-0001'
const S_OTHER = 'mock-session-other-0004'

// Subagent agent_ids (within their parent sessions)
const A_REVIEWER = 'mock-agent-reviewer-0002'
const A_EXPLORER = 'mock-agent-explorer-0003'
const A_WRITER = 'mock-agent-writer-0005'

let _seq = 0
function makeEvent(session_id: string, hook_event_name: string, extras: Partial<HookEvent> = {}): HookEvent {
  return {
    session_id,
    hook_event_name,
    _timestamp: Date.now(),
    _id: `mock-${++_seq}`,
    ...extras,
  }
}

const INITIAL_SNAPSHOTS: AgentSnapshot[] = [
  { sessionId: S_MAIN, agentName: 'main', projectPath: P1, status: 'idle', startedAt: Date.now() - 30000, parentSessionId: null },
]

type EventFactory = () => HookEvent

const SCENARIO: EventFactory[] = [
  // Reviewer subagent starts in S_MAIN
  () => makeEvent(S_MAIN, 'SubagentStart', { agent_id: A_REVIEWER, agent_type: 'code-reviewer', cwd: P1 }),
  () => makeEvent(S_MAIN, 'PreToolUse', { agent_id: A_REVIEWER, tool_name: 'Read', tool_input: { file_path: 'src/app.tsx' } }),
  // Second root session starts
  () => makeEvent(S_OTHER, 'SessionStart', { cwd: P2, transcript_path: `${P2}/.sessions/m.jsonl` }),
  () => makeEvent(S_MAIN, 'PostToolUse', { agent_id: A_REVIEWER, tool_name: 'Read' }),
  () => makeEvent(S_OTHER, 'PreToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' } }),
  () => makeEvent(S_MAIN, 'PreToolUse', { agent_id: A_REVIEWER, tool_name: 'Grep', tool_input: { pattern: 'useState', path: 'src/' } }),
  // Explorer subagent starts in S_MAIN
  () => makeEvent(S_MAIN, 'SubagentStart', { agent_id: A_EXPLORER, agent_type: 'Explore', cwd: P1 }),
  () => makeEvent(S_OTHER, 'PostToolUse', { tool_name: 'Bash' }),
  () => makeEvent(S_MAIN, 'PostToolUse', { agent_id: A_REVIEWER, tool_name: 'Grep' }),
  () => makeEvent(S_MAIN, 'PreToolUse', { agent_id: A_EXPLORER, tool_name: 'Read', tool_input: { file_path: 'src/index.ts' } }),
  () => makeEvent(S_MAIN, 'Notification'),
  () => makeEvent(S_MAIN, 'PostToolUse', { agent_id: A_EXPLORER, tool_name: 'Read' }),
  // Writer subagent starts in S_OTHER
  () => makeEvent(S_OTHER, 'SubagentStart', { agent_id: A_WRITER, agent_type: 'general-purpose', cwd: P2 }),
  () => makeEvent(S_MAIN, 'SubagentStop', { agent_id: A_EXPLORER }),
  () => makeEvent(S_MAIN, 'PreToolUse', { agent_id: A_REVIEWER, tool_name: 'Write', tool_input: { file_path: 'src/output.ts' } }),
  () => makeEvent(S_OTHER, 'PreToolUse', { agent_id: A_WRITER, tool_name: 'Read', tool_input: { file_path: 'docs/spec.md' } }),
  () => makeEvent(S_MAIN, 'PostToolUse', { agent_id: A_REVIEWER, tool_name: 'Write' }),
  () => makeEvent(S_OTHER, 'PostToolUse', { agent_id: A_WRITER, tool_name: 'Read' }),
  () => makeEvent(S_MAIN, 'SubagentStop', { agent_id: A_REVIEWER }),
  () => makeEvent(S_OTHER, 'SubagentStop', { agent_id: A_WRITER }),
  () => makeEvent(S_OTHER, 'Stop'),
  () => makeEvent(S_MAIN, 'Stop'),
]

const DELAYS = [600, 800, 400, 500, 700, 600, 500, 400, 300, 700, 900, 400, 500, 600, 700, 500, 400, 600, 800, 700, 500, 600]

export function startMockGenerator(dispatch: Dispatch<Action>): () => void {
  const timers: ReturnType<typeof setTimeout>[] = []

  dispatch({ type: 'INIT', agents: INITIAL_SNAPSHOTS, recentEvents: [] })
  dispatch({ type: 'CONNECTED', connected: true })
  dispatch({ type: 'EVENT', event: makeEvent(S_MAIN, 'SessionStart', { cwd: P1, transcript_path: `${P1}/.sessions/main.jsonl` }) })

  function scheduleRound(baseDelay: number): void {
    let cumulative = baseDelay
    SCENARIO.forEach((factory, i) => {
      cumulative += DELAYS[i % DELAYS.length]
      const t = setTimeout(() => {
        dispatch({ type: 'EVENT', event: factory() })
        if (i === SCENARIO.length - 1) {
          scheduleRound(cumulative + 2000)
        }
      }, cumulative)
      timers.push(t)
    })
  }

  scheduleRound(300)
  return () => timers.forEach(clearTimeout)
}
