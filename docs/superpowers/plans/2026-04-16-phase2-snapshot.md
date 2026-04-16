# Phase 2 (Snapshot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a "what's it doing right now" snapshot inside the existing Info panel — the agent's initial task (first user message) and its latest response (last assistant text), plus a message count. No new tabs, no scrolling, no pagination.

**Architecture:** Server gets a new `transcript.ts` module and a `GET /api/transcript/snapshot` endpoint that reads the session JSONL, extracts two strings and a count, and returns them. The client stores `transcriptPath` in `AgentState` (captured from hook events), a new `useTranscriptSnapshot` hook polls the endpoint every 3 s while the agent is active, and `AgentDetail` renders the result as two small labeled sections.

**Tech Stack:** existing stack only — no new dependencies.

---

## File Map

```
the-office/
├── server/src/
│   ├── transcript.ts                     NEW — JSONL reader, extractSnapshot()
│   ├── index.ts                          MOD — GET /api/transcript/snapshot
│   └── __tests__/
│       └── transcript.test.ts            NEW — unit tests for extractSnapshot
└── client/src/
    ├── types.ts                          MOD — transcriptPath?: string on AgentState
    ├── reducer.ts                        MOD — capture transcript_path from events
    ├── hooks/
    │   └── useTranscriptSnapshot.ts      NEW — fetch + poll snapshot
    ├── components/
    │   └── AgentDetail.tsx               MOD — ConversationSnapshot section
    └── __tests__/
        └── reducer.test.ts               MOD — transcriptPath capture tests
```

---

## Task 1: Store transcriptPath in AgentState

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/reducer.ts`
- Modify: `client/src/__tests__/reducer.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `client/src/__tests__/reducer.test.ts` after existing tests:

```typescript
describe('transcriptPath capture', () => {
  it('stores transcript_path from SessionStart', () => {
    const event: HookEvent = {
      session_id: 'sess-1',
      hook_event_name: 'SessionStart',
      transcript_path: '/home/user/.claude/projects/foo/sess-1.jsonl',
      cwd: '/home/user/foo',
      _timestamp: 1000,
      _id: 'e1',
    }
    const s1 = dashboardReducer(initialState, { type: 'EVENT', event })
    expect(s1.agents.get('sess-1')?.transcriptPath).toBe(
      '/home/user/.claude/projects/foo/sess-1.jsonl'
    )
  })

  it('does not overwrite transcriptPath once set', () => {
    const e1: HookEvent = {
      session_id: 'sess-1',
      hook_event_name: 'SessionStart',
      transcript_path: '/path/first.jsonl',
      _timestamp: 1000,
      _id: 'e1',
    }
    const e2: HookEvent = {
      session_id: 'sess-1',
      hook_event_name: 'PreToolUse',
      transcript_path: '/path/second.jsonl',
      tool_name: 'Read',
      _timestamp: 2000,
      _id: 'e2',
    }
    const s1 = dashboardReducer(initialState, { type: 'EVENT', event: e1 })
    const s2 = dashboardReducer(s1, { type: 'EVENT', event: e2 })
    expect(s2.agents.get('sess-1')?.transcriptPath).toBe('/path/first.jsonl')
  })

  it('stores agent_transcript_path for subagents', () => {
    const event: HookEvent = {
      session_id: 'sess-1',
      hook_event_name: 'SubagentStart',
      agent_id: 'agent-abc',
      agent_transcript_path: '/home/.claude/projects/foo/sess-1/subagents/agent-abc.jsonl',
      cwd: '/home/user/foo',
      _timestamp: 1000,
      _id: 'e1',
    }
    const s1 = dashboardReducer(initialState, { type: 'EVENT', event })
    expect(s1.agents.get('agent-abc')?.transcriptPath).toBe(
      '/home/.claude/projects/foo/sess-1/subagents/agent-abc.jsonl'
    )
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -w client -- --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `transcriptPath` does not exist on `AgentState`.

- [ ] **Step 3: Add transcriptPath to AgentState in client/src/types.ts**

```typescript
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
  transcriptPath?: string   // absolute path to JSONL session file on the server
}
```

- [ ] **Step 4: Capture transcriptPath in reducer.ts**

In `client/src/reducer.ts`, inside `applyEvent`, add path extraction before the switch and spread it into every `next.set` call:

```typescript
function applyEvent(agents: Map<string, AgentState>, event: HookEvent): Map<string, AgentState> {
  const next = new Map(agents)
  const id = event.agent_id ?? event.session_id
  const ts = event._timestamp
  const existing = next.get(id) ?? defaultAgent(event, agents)

  // First value wins — subagents carry agent_transcript_path, root sessions carry transcript_path
  const incomingPath = (event.agent_id ? event.agent_transcript_path : event.transcript_path) ?? undefined
  const transcriptPath = existing.transcriptPath ?? incomingPath

  switch (event.hook_event_name) {
    case 'SessionStart':
      next.set(id, {
        ...existing,
        transcriptPath,
        status: 'idle',
        projectPath: deriveProjectPath(event) || existing.projectPath,
        lastActivityAt: ts,
      })
      break

    case 'SubagentStart':
      next.set(id, {
        ...existing,
        transcriptPath,
        status: 'starting',
        agentName: event.agent_type ?? existing.agentName,
        agentType: event.agent_type ?? existing.agentType,
        parentSessionId: event.agent_id ? event.session_id : (event.parent_session_id ?? existing.parentSessionId),
        projectPath: existing.projectPath || next.get(event.session_id)?.projectPath || deriveProjectPath(event),
        lastActivityAt: ts,
      })
      break

    case 'PreToolUse': {
      const toolCall: ToolCall = {
        id: `${id}-${ts}`,
        toolName: event.tool_name ?? 'unknown',
        input: event.tool_input ?? null,
        startedAt: ts,
        completedAt: null,
        status: 'running',
      }
      next.set(id, {
        ...existing,
        transcriptPath,
        status: 'working',
        currentTool: event.tool_name ?? null,
        currentToolInput: event.tool_input ?? null,
        toolHistory: [...existing.toolHistory, toolCall].slice(-MAX_TOOL_HISTORY),
        lastActivityAt: ts,
      })
      break
    }

    case 'PostToolUse': {
      const history = existing.toolHistory.map(t =>
        t.status === 'running' ? { ...t, status: 'success' as const, completedAt: ts } : t
      )
      next.set(id, {
        ...existing,
        transcriptPath,
        status: 'idle',
        currentTool: null,
        currentToolInput: null,
        toolHistory: history,
        lastActivityAt: ts,
      })
      break
    }

    case 'PostToolUseFailure': {
      const history = existing.toolHistory.map(t =>
        t.status === 'running' ? { ...t, status: 'failure' as const, completedAt: ts } : t
      )
      next.set(id, {
        ...existing,
        transcriptPath,
        status: 'error',
        currentTool: null,
        currentToolInput: null,
        toolHistory: history,
        lastActivityAt: ts,
      })
      break
    }

    case 'Notification':
      next.set(id, { ...existing, transcriptPath, status: 'waiting', lastActivityAt: ts })
      break

    case 'SubagentStop':
    case 'SessionEnd':
      next.delete(id)
      break

    case 'Stop':
      next.set(id, { ...existing, transcriptPath, status: 'idle', lastActivityAt: ts })
      break
  }

  return next
}
```

- [ ] **Step 5: Run — expect pass**

```bash
npm test -w client -- --reporter=verbose 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/types.ts client/src/reducer.ts client/src/__tests__/reducer.test.ts
git commit -m "feat: capture transcriptPath in AgentState from hook events"
```

---

## Task 2: Server transcript snapshot endpoint

**Files:**
- Create: `server/src/transcript.ts`
- Create: `server/src/__tests__/transcript.test.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `server/src/__tests__/transcript.test.ts`:

```typescript
import { extractSnapshot } from '../transcript'

describe('extractSnapshot', () => {
  it('extracts first user text and last assistant text', () => {
    const lines = [
      JSON.stringify({ type: 'user', message: { content: 'Fix the bug in reducer.ts' } }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'I will look at the file.' }] } }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Done. The bug was on line 42.' }] } }),
    ]
    const result = extractSnapshot(lines)
    expect(result.firstPrompt).toBe('Fix the bug in reducer.ts')
    expect(result.latestAssistant).toBe('Done. The bug was on line 42.')
    expect(result.messageCount).toBe(3)
  })

  it('skips pure tool_result user messages for firstPrompt', () => {
    const lines = [
      JSON.stringify({
        type: 'user',
        message: { content: [{ type: 'tool_result', content: 'output', tool_use_id: 'tu-1' }] },
      }),
      JSON.stringify({ type: 'user', message: { content: 'Actually do this instead' } }),
    ]
    const result = extractSnapshot(lines)
    expect(result.firstPrompt).toBe('Actually do this instead')
  })

  it('skips tool_result user messages in messageCount', () => {
    const lines = [
      JSON.stringify({ type: 'user', message: { content: 'Hello' } }),
      JSON.stringify({
        type: 'user',
        message: { content: [{ type: 'tool_result', content: 'output', tool_use_id: 'tu-1' }] },
      }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hi' }] } }),
    ]
    const result = extractSnapshot(lines)
    expect(result.messageCount).toBe(2)
  })

  it('extracts text from content block arrays for assistant', () => {
    const lines = [
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Let me check that.' },
            { type: 'tool_use', name: 'Read', input: { file_path: 'foo.ts' } },
          ],
        },
      }),
    ]
    const result = extractSnapshot(lines)
    expect(result.latestAssistant).toBe('Let me check that.')
  })

  it('returns nulls for empty transcript', () => {
    const result = extractSnapshot([])
    expect(result).toEqual({ firstPrompt: null, latestAssistant: null, messageCount: 0 })
  })

  it('ignores system, summary, result lines in messageCount', () => {
    const lines = [
      JSON.stringify({ type: 'system', subtype: 'init', sessionId: 'x' }),
      JSON.stringify({ type: 'user', message: { content: 'Go' } }),
      JSON.stringify({ type: 'summary', summary: 'done' }),
    ]
    expect(extractSnapshot(lines).messageCount).toBe(1)
  })

  it('skips malformed lines without throwing', () => {
    const lines = ['not json', '{}', JSON.stringify({ type: 'user', message: { content: 'OK' } })]
    expect(() => extractSnapshot(lines)).not.toThrow()
    expect(extractSnapshot(lines).firstPrompt).toBe('OK')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -w server -- --testPathPattern=transcript 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create server/src/transcript.ts**

```typescript
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { normalize } from 'path'

export interface TranscriptSnapshot {
  firstPrompt: string | null     // first real user message text
  latestAssistant: string | null // last assistant text paragraph
  messageCount: number           // human-turn + assistant-turn count (no tool_results)
}

type Block = { type: string; [key: string]: unknown }

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return (content as Block[])
    .filter(b => b.type === 'text')
    .map(b => String(b.text ?? ''))
    .join('')
}

function isPureToolResult(content: unknown): boolean {
  if (!Array.isArray(content) || (content as Block[]).length === 0) return false
  return (content as Block[]).every(b => b.type === 'tool_result')
}

export function extractSnapshot(lines: string[]): TranscriptSnapshot {
  let firstPrompt: string | null = null
  let latestAssistant: string | null = null
  let messageCount = 0

  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>
      if (obj.type !== 'user' && obj.type !== 'assistant') continue

      const msg = obj.message as Record<string, unknown> | undefined
      if (!msg) continue

      const rawContent = msg.content

      if (obj.type === 'user') {
        if (isPureToolResult(rawContent)) continue
        messageCount++
        if (firstPrompt === null) {
          const text = extractText(rawContent)
          if (text) firstPrompt = text
        }
      } else {
        // assistant
        const text = extractText(rawContent)
        if (text) {
          latestAssistant = text
          messageCount++
        }
      }
    } catch {
      // malformed line — skip
    }
  }

  return { firstPrompt, latestAssistant, messageCount }
}

export async function readSnapshot(filePath: string): Promise<TranscriptSnapshot> {
  // Security: path must be inside ~/.claude to prevent path traversal
  const claudeDir = normalize(homedir() + '/.claude')
  const normalized = normalize(filePath)
  if (!normalized.startsWith(claudeDir)) {
    throw new Error('Path outside allowed directory')
  }

  const content = await readFile(normalized, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)
  return extractSnapshot(lines)
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -w server -- --testPathPattern=transcript 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 5: Add GET /api/transcript/snapshot to index.ts**

Add after the `/health` route in `server/src/index.ts`:

```typescript
import { readSnapshot } from './transcript'

app.get('/api/transcript/snapshot', async (req, res) => {
  const { path: filePath } = req.query as { path?: string }
  if (!filePath) return res.status(400).json({ error: 'path required' })
  try {
    const snapshot = await readSnapshot(filePath)
    res.json(snapshot)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'read failed'
    res.status(400).json({ error: message })
  }
})
```

- [ ] **Step 6: Run all server tests**

```bash
npm test -w server 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/transcript.ts server/src/__tests__/transcript.test.ts server/src/index.ts
git commit -m "feat: extractSnapshot and GET /api/transcript/snapshot endpoint"
```

---

## Task 3: ConversationSnapshot section in AgentDetail

**Files:**
- Create: `client/src/hooks/useTranscriptSnapshot.ts`
- Modify: `client/src/components/AgentDetail.tsx`

- [ ] **Step 1: Create useTranscriptSnapshot.ts**

```typescript
// client/src/hooks/useTranscriptSnapshot.ts
import { useState, useEffect, useRef } from 'react'

export interface TranscriptSnapshot {
  firstPrompt: string | null
  latestAssistant: string | null
  messageCount: number
}

const POLL_MS = 3000

export function useTranscriptSnapshot(
  transcriptPath: string | undefined,
  active: boolean
): TranscriptSnapshot | null {
  const [snapshot, setSnapshot] = useState<TranscriptSnapshot | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMock = new URLSearchParams(window.location.search).has('mock')

  useEffect(() => {
    if (isMock || !transcriptPath) {
      setSnapshot(null)
      return
    }

    let cancelled = false

    async function load() {
      try {
        const res = await window.fetch(
          `/api/transcript/snapshot?path=${encodeURIComponent(transcriptPath!)}`
        )
        if (res.ok && !cancelled) {
          setSnapshot((await res.json()) as TranscriptSnapshot)
        }
      } catch {
        // server unreachable — keep previous snapshot
      }
    }

    function scheduleNext() {
      if (!active || cancelled) return
      timerRef.current = setTimeout(async () => {
        await load()
        scheduleNext()
      }, POLL_MS)
    }

    load().then(scheduleNext)

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [transcriptPath, active, isMock])

  return snapshot
}
```

- [ ] **Step 2: Add ConversationSnapshot section to AgentDetail.tsx**

Replace the full contents of `client/src/components/AgentDetail.tsx`:

```typescript
import type { AgentState } from '../types'
import { ToolHistory } from './ToolHistory'
import { useTranscriptSnapshot } from '../hooks/useTranscriptSnapshot'

function formatDuration(startedAt: number): string {
  const s = Math.floor((Date.now() - startedAt) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + '…'
}

interface Props {
  agent: AgentState | null
}

export function AgentDetail({ agent }: Props) {
  const isActive = !!agent && agent.status !== 'done'
  const snapshot = useTranscriptSnapshot(agent?.transcriptPath, isActive)

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs">
        Select an agent to see details
      </div>
    )
  }

  return (
    <div className="p-4 text-xs space-y-4">
      {/* Header */}
      <div>
        <div className="text-text-primary text-sm font-semibold">{agent.agentName}</div>
        <div className="text-text-muted mt-0.5">{agent.projectPath || '—'}</div>
      </div>

      {/* Status row */}
      <div className="flex flex-wrap gap-4">
        <div>
          <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Status</div>
          <div className="text-text-primary">{agent.status}</div>
        </div>
        {agent.currentTool && (
          <div>
            <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Tool</div>
            <div className="text-status-working">{agent.currentTool}</div>
          </div>
        )}
        {agent.agentType && (
          <div>
            <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Type</div>
            <div className="text-text-primary">{agent.agentType}</div>
          </div>
        )}
        {agent.parentSessionId && (
          <div>
            <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Parent</div>
            <div className="text-text-primary font-mono">{agent.parentSessionId.slice(0, 12)}</div>
          </div>
        )}
        <div>
          <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Duration</div>
          <div className="text-text-primary">{formatDuration(agent.startedAt)}</div>
        </div>
      </div>

      {/* Conversation snapshot */}
      {snapshot && (snapshot.firstPrompt || snapshot.latestAssistant) && (
        <div className="space-y-2">
          <div className="text-text-muted uppercase tracking-wider text-[10px]">
            Conversation
            {snapshot.messageCount > 0 && (
              <span className="ml-2 normal-case">{snapshot.messageCount} messages</span>
            )}
          </div>
          {snapshot.firstPrompt && (
            <div className="bg-surface rounded p-2 border border-border">
              <div className="text-[10px] text-text-muted mb-0.5">Task</div>
              <div className="text-text-primary leading-relaxed">
                {truncate(snapshot.firstPrompt, 160)}
              </div>
            </div>
          )}
          {snapshot.latestAssistant && (
            <div className="bg-canvas rounded p-2 border border-border/40">
              <div className="text-[10px] text-text-muted mb-0.5">Latest</div>
              <div className="text-text-primary leading-relaxed">
                {truncate(snapshot.latestAssistant, 220)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current tool input */}
      {typeof agent.currentToolInput === 'object' && agent.currentToolInput !== null ? (
        <div>
          <div className="text-text-muted uppercase tracking-wider text-[10px] mb-1">Tool Input</div>
          <pre className="text-text-muted bg-surface rounded p-2 overflow-x-auto text-[10px] whitespace-pre-wrap break-all">
            {JSON.stringify(agent.currentToolInput, null, 2)}
          </pre>
        </div>
      ) : null}

      {/* Tool history */}
      <div>
        <div className="text-text-muted uppercase tracking-wider text-[10px] mb-1">
          Tool History ({agent.toolHistory.length})
        </div>
        <ToolHistory toolHistory={agent.toolHistory} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:5173`. Start or observe an active Claude Code session. Select the agent in the tree. Verify:
- "Conversation — N messages" label appears once the transcript loads
- "Task" card shows the first user prompt, truncated at 160 chars
- "Latest" card shows the most recent assistant text, truncated at 220 chars
- The section is absent while `snapshot` is null (no path yet) and absent for mock mode

Open `http://localhost:5173?mock=true` — snapshot section should not appear (mock has no server).

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useTranscriptSnapshot.ts client/src/components/AgentDetail.tsx
git commit -m "feat: conversation snapshot (task + latest message) in AgentDetail Info panel"
```

---

## Self-review

### Spec coverage

| Requirement | Task |
|---|---|
| Show initial task (first user message) | Tasks 2–3 |
| Show latest assistant response | Tasks 2–3 |
| Show message count | Tasks 2–3 |
| Truncate long content | Task 3 |
| Poll while agent is active, stop when done | Task 3 |
| Mock mode unaffected | Task 3 |
| Path traversal prevention | Task 2 |

### Constraints

- **Snapshot only on agents with a transcriptPath.** Agents bootstrapped from JSONL get their path from `AgentSnapshot`. Agents arriving via live hook events get it from `transcript_path` / `agent_transcript_path`. Agents that never sent a hook carrying a path (edge case: very brief sessions) will show no snapshot — graceful, no error.
- **messageCount excludes tool_result user messages.** This reflects actual human ↔ assistant exchange pairs, not internal tool machinery.
- **Polling stops when agent is removed from the map** (SessionEnd/SubagentStop). React cleans up the effect naturally because the component unmounts or `active` becomes false.
