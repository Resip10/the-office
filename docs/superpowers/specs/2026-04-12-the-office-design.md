# the-office — Design Spec
**Date:** 2026-04-12
**Status:** Approved
**Phase:** 1 (Observer)

---

## 1. Vision

**"htop for AI agents."**

A real-time dashboard that sits alongside your terminal. You see every Claude Code agent across every project on your machine — what they're doing, what tools they're calling, how they relate to each other. When something goes wrong, you reach in.

**You don't start work here. You watch work and intervene when needed.**

### Phase 1 (this spec): Observer
- Live dashboard showing all Claude Code agents on your machine
- Agent tree with status, current tool, parent/child relationships
- Full agent detail panel with tool history
- Event stream (live, auto-scroll)
- Bootstrap from JSONL on connect — dashboard is populated immediately
- Mock mode for development and demo (`?mock=true`)

### Phase 2 (future): Control
- Kill agents from the dashboard
- View full conversation per agent
- Spawn a quick agent into any project

### Phase 3 (future): Distribution
- Deployed client (Vercel/Netlify) + local server
- Desktop app (Tauri or Electron — decide at Phase 3)

---

## 2. Architecture

```
Claude Code hooks
      │ HTTP POST /api/events
      ▼
  Express server (localhost:7777)
      │ stamp _id + _timestamp
      │ push to ring buffer (500 events)
      │ broadcast to all WS clients
      ▼
  React frontend (useReducer)
      │ EVENT → update AgentState map
      ▼
  UI re-renders (AgentTree, AgentDetail, EventStream)
```

**On WebSocket connect:**
```
server → scan ~/.claude/projects/**/sessions/*.jsonl (last 4h)
       → parse → AgentSnapshot[]
       → send { type: 'init', agents: AgentSnapshot[], recentEvents: HookEvent[] }
client → dispatch INIT → seed agent map → replay buffered events
```

**Key decisions:**
- No database — all state in memory (ring buffer + React reducer)
- No file watcher — page refresh re-bootstraps from JSONL
- Server and client are independent npm workspace packages
- `server/` + `client/` split keeps Tauri/Electron migration trivial later

---

## 3. Tech Stack

| Component | Technology | Why |
|---|---|---|
| Server | Node.js + TypeScript + Express | Universal, clean routing, one extra dep over raw Node |
| WebSocket | `ws` package | Standard, reliable |
| Frontend | React 18 + Vite + TypeScript | Fast dev, hot reload |
| Styling | Tailwind CSS v3 | Rapid UI, dark theme support |
| State | `useReducer` | No external deps, event→state pattern |
| JSONL bootstrap | `fast-glob` (one-shot scan) | Cross-platform glob, no file watching overhead |
| Monorepo | npm workspaces + `concurrently` | Single `npm run dev` starts both |

---

## 4. Project Structure

```
the-office/
├── package.json               # root: workspaces ["server","client"], dev script
├── .gitignore
├── server/
│   ├── package.json           # express, ws, cors, nanoid, fast-glob
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           # Express app + WebSocket server (~120 LOC)
│       ├── relay.ts           # ring buffer + broadcast logic (~50 LOC)
│       ├── bootstrap.ts       # JSONL scanner/parser (~80 LOC)
│       └── types.ts           # server-side types
└── client/
    ├── package.json           # react, vite, tailwindcss
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx            # layout, useReducer, useRelay
        ├── types.ts           # shared types
        ├── reducer.ts         # dashboardReducer
        ├── hooks/
        │   └── useRelay.ts    # WebSocket + reconnect + mock switch
        ├── components/
        │   ├── AgentTree.tsx
        │   ├── AgentNode.tsx
        │   ├── ProjectGroup.tsx
        │   ├── AgentDetail.tsx
        │   ├── ToolHistory.tsx
        │   ├── EventStream.tsx
        │   ├── EventRow.tsx
        │   └── ConnectionBadge.tsx
        └── mock/
            └── generator.ts   # scripted scenario, two projects, 5 agents
```

---

## 5. Server API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/events` | Receive hook events from Claude Code. Always returns `200 OK`. |
| `GET` | `/health` | Connection badge ping. Returns `200 OK`. |
| `WS` | `/ws` | WebSocket upgrade. On connect: sends `init` payload (bootstrap + ring buffer). |

**Phase 2 additions (not in this spec):**
- `POST /api/agents/:sessionId/kill`
- `GET /api/agents/:sessionId/conversation`
- `POST /api/agents/spawn`

---

## 6. Data Model

### HookEvent (from Claude Code hooks)
```typescript
interface HookEvent {
  session_id: string
  hook_event_name: string       // 'PreToolUse' | 'PostToolUse' | 'SubagentStart' | etc.
  tool_name?: string
  tool_input?: Record<string, unknown>
  tool_output?: Record<string, unknown>
  transcript_path?: string
  _timestamp: number            // added by server
  _id: string                   // added by server (nanoid)
}
```

### AgentState (frontend reducer)
```typescript
interface AgentState {
  sessionId: string
  agentName: string
  status: AgentStatus
  parentSessionId: string | null
  currentTool: string | null
  currentToolInput: unknown | null
  toolHistory: ToolCall[]        // capped at 50 per agent
  startedAt: number
  lastActivityAt: number
  projectPath: string            // derived from transcript_path or hook cwd
}

type AgentStatus = 'starting' | 'idle' | 'working' | 'waiting' | 'done' | 'error'

interface ToolCall {
  id: string
  toolName: string
  input: unknown
  startedAt: number
  completedAt: number | null
  status: 'running' | 'success' | 'failure'
}
```

### DashboardState
```typescript
interface DashboardState {
  agents: Map<string, AgentState>
  events: HookEvent[]            // capped at 5000
  selectedAgentId: string | null
  connected: boolean
}
```

### AgentSnapshot (from bootstrap, sent in INIT payload)
```typescript
interface AgentSnapshot {
  sessionId: string
  agentName: string             // from system init event in JSONL, or derived from session filename
  projectPath: string           // from cwd in system init event
  status: AgentStatus           // inferred: 'done' if Stop/SessionEnd seen, else 'idle'
  startedAt: number             // timestamp of first JSONL line
  parentSessionId: string | null
}
```

### Reducer Actions
```typescript
type Action =
  | { type: 'INIT'; agents: AgentSnapshot[]; recentEvents: HookEvent[] }
  | { type: 'EVENT'; event: HookEvent }
  | { type: 'SELECT_AGENT'; sessionId: string | null }
  | { type: 'CONNECTED'; connected: boolean }
  | { type: 'CLEAR' }
```

---

## 7. Reducer Logic

| Hook event | Status | Other mutations |
|---|---|---|
| `SessionStart` | `idle` | upsert agent, set `projectPath` |
| `SubagentStart` | `starting` | upsert agent, set `parentSessionId` |
| `PreToolUse` | `working` | set `currentTool` + `currentToolInput`, push `ToolCall(running)` |
| `PostToolUse` | `idle` | clear `currentTool`, complete `ToolCall(success)` |
| `PostToolUseFailure` | `error` | complete `ToolCall(failure)` |
| `Notification` | `waiting` | — |
| `SubagentStop` | `done` | — |
| `Stop` | `idle` | — |
| `SessionEnd` | `done` | — |

**`INIT` handling:** Seed the agent map from `AgentSnapshot[]`, then replay `recentEvents` through the same transition table. Late-joining clients converge to correct state.

---

## 8. Frontend Layout

```
┌──────────────────────────────────────────────────────────┐
│  The Office                     ● connected    [Clear All]│
├────────────────────┬─────────────────────────────────────┤
│                    │                                     │
│   Agent Tree       │   Agent Detail Panel                │
│                    │                                     │
│  my-project/       │   Name: code-reviewer               │
│  ● main (idle)     │   Status: ● working                │
│  ├─ ● review   ◄───┤   Tool: Read  src/app.tsx           │
│  │    →Read        │   Parent: main                      │
│  └─ ○ explore      │   Project: ~/my-project             │
│       done         │   Duration: 2m 15s                  │
│                    │                                     │
│  other-project/    │   ── Tool History ──                │
│  ● main (working)  │   Read package.json    ✓ 0.2s       │
│    →Bash           │   Grep "useState"      ✓ 0.1s       │
│                    │   Read src/utils.ts    ● running    │
└────────────────────┴─────────────────────────────────────┤
│  Event Stream (live, auto-scroll, pause on scroll-up)    │
│  12:03:01 my-project    PreToolUse   review  Read        │
│  12:03:02 other-project PreToolUse   main    Bash        │
└──────────────────────────────────────────────────────────┘
```

**Visual style:** Dark Terminal
- Background: `#0d1117`, surfaces: `#161b22`, borders: `#30363d`
- Text: `#f0f6fc`, muted: `#8b949e`
- Monospace font for agent names, tool names, paths
- Status dots: green (idle), amber (working), blue (starting), purple (waiting), gray (done), red (error)

---

## 9. Status Indicators

| Status | Color | Dot | When |
|---|---|---|---|
| `starting` | blue | ◐ | SubagentStart received, no tool call yet |
| `working` | amber | ● | PreToolUse received, awaiting PostToolUse |
| `idle` | green | ● | Alive, between tool calls |
| `waiting` | purple | ● | Notification / PermissionRequest |
| `done` | gray | ○ | SubagentStop / SessionEnd |
| `error` | red | ✕ | PostToolUseFailure |

---

## 10. Bootstrap (JSONL)

On each WebSocket connection:
1. Resolve `~/.claude/projects/` via `os.homedir()` — cross-platform
2. Glob `**/sessions/*.jsonl`, filter to files modified in last 4 hours
3. Parse each file line-by-line, best-effort (skip malformed lines)
4. Extract: `session_id`, agent name, project path, last known status, start time
5. Return `AgentSnapshot[]` — included in the `init` payload alongside ring buffer
6. If `~/.claude/projects/` doesn't exist: return `[]` gracefully

No file watching. Page refresh always triggers a fresh scan.

---

## 11. Mock Mode

`http://localhost:5173?mock=true` — activates when URL contains `mock=true`.

`useRelay.ts` detects the param and imports `mock/generator.ts` instead of opening a WebSocket. The generator dispatches `INIT` then fires `EVENT` actions on a timer, simulating:
- Two projects (`my-project`, `other-project`)
- 5 agents with parent/child relationships
- ~30 events over 15 seconds (loop)

Identical to live mode from the reducer's perspective — same action types, same state shape.

---

## 12. Hook Configuration

Add to `~/.claude/settings.json` (global — all projects, all sessions):

```json
{
  "hooks": {
    "SessionStart":  [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "SessionEnd":    [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "SubagentStart": [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "SubagentStop":  [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "PreToolUse":    [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "PostToolUse":   [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "Stop":          [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "Notification":  [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}]
  }
}
```

Hooks fail silently — if the server isn't running, Claude Code is unaffected.

---

## 13. Build Order (Phase 1)

Strictly sequential. Each step must work before moving on.

| Step | What | Done when |
|---|---|---|
| 1 | Scaffold monorepo (workspaces, tsconfigs, Vite, Tailwind) | `npm run dev` starts both without errors |
| 2 | Types (`server/src/types.ts`, `client/src/types.ts`) | All interfaces defined, no TS errors |
| 3 | Server relay (`index.ts` + `relay.ts`) | `curl POST /api/events` → echoed back via WS |
| 4 | Reducer (`reducer.ts`) | All transitions correct, testable in isolation |
| 5 | Mock generator (`mock/generator.ts`) | Fires realistic event sequence |
| 6 | App shell + mock mode (`App.tsx`) | `?mock=true` shows agents appearing |
| 7 | Agent tree (`AgentTree`, `AgentNode`, `ProjectGroup`) | Tree renders, click selects agent |
| 8 | Agent detail (`AgentDetail`, `ToolHistory`) | Selected agent shows full info + tool history |
| 9 | Event stream (`EventStream`, `EventRow`) | Auto-scrolls, pauses on scroll-up |
| 10 | WebSocket hook (`useRelay.ts`) | Live mode connects, receives real hook events |
| 11 | Bootstrap (`bootstrap.ts`) | On connect, existing sessions appear immediately |
| 12 | Polish: `ConnectionBadge`, `Clear All`, error states, durations | Dashboard feels complete |
| 13 | README: setup, usage, hook config, mock mode, architecture | New user can get running in < 5 min |

---

## 14. Success Criteria (Phase 1)

- [ ] `npm run dev` starts both server and client with one command
- [ ] `?mock=true` works without server or Claude Code — agents appear and animate
- [ ] Real hook events appear in dashboard within ~100ms of Claude Code firing them
- [ ] Agent tree grouped by project, correct parent/child indentation
- [ ] Status dots update live as agents work
- [ ] Clicking an agent shows detail panel with tool history and timing
- [ ] Event stream auto-scrolls; pauses when user scrolls up
- [ ] Dashboard opens with existing sessions already populated (JSONL bootstrap)
- [ ] Page refresh re-bootstraps correctly
- [ ] If server is down, Claude Code works fine (hooks fail silently)
- [ ] Works on macOS, Linux, and Windows

---

## 15. Out of Scope (Phase 1)

- Kill agent
- View conversation
- Spawn agent
- Cost / token tracking
- Install script for hooks (documented in README only)
- Desktop app packaging
- File watching (chokidar used for one-shot glob scan only)
