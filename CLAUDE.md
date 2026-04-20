# the-office — Project Instructions

## What this is

Real-time observer dashboard for Claude Code agents. Think htop, but for AI workers.
Server receives Claude Code HTTP hooks → broadcasts via WebSocket → React frontend renders agent tree.

## Architecture at a glance

```
Claude Code hooks → POST :7777/api/events → Express server
                                            → ring buffer (500 events)
                                            → WebSocket broadcast
                                           ← React useReducer (agent state map)
```

- `server/` — Node.js + Express + ws. Receives hooks, relays to browser.
- `client/` — React 18 + Vite + Tailwind CSS v3. All state in useReducer.
- Root `package.json` — npm workspaces. `npm run dev` starts both with concurrently.

## Running

```bash
npm install        # install all workspaces
npm run dev        # start server (:7777) + client (:5173)
```

Mock mode (no server needed): `http://localhost:5173?mock=true`

## Key files

| File | Responsibility |
|---|---|
| `server/src/index.ts` | Express app + WebSocket server |
| `server/src/relay.ts` | Ring buffer + broadcast |
| `server/src/bootstrap.ts` | JSONL scanner, `parseJSONLSession` |
| `server/src/types.ts` | `HookEvent`, `AgentSnapshot` |
| `client/src/reducer.ts` | `dashboardReducer` — all state transitions |
| `client/src/hooks/useRelay.ts` | WebSocket connection + mock switch |
| `client/src/mock/generator.ts` | Mock scenario (2 projects, 5 agents) |
| `client/src/types.ts` | `AgentState`, `DashboardState`, `Action` |

## Status → color mapping

| Status | Color | When |
|---|---|---|
| starting | blue `#58a6ff` | SubagentStart, no tool yet |
| working | amber `#d29922` | PreToolUse received |
| idle | green `#3fb950` | Between tool calls |
| waiting | purple `#bc8cff` | Notification |
| done | gray `#6e7681` | SessionEnd / SubagentStop |
| error | red `#f85149` | PostToolUseFailure |

## Reducer rules

Every hook event maps to an agent state transition. The reducer is a pure function in `client/src/reducer.ts`. **Do not add side effects to the reducer.**

| Hook event | Status |
|---|---|
| SessionStart | idle |
| SubagentStart | starting |
| PreToolUse | working + push ToolCall(running) |
| PostToolUse | idle + complete ToolCall(success) |
| PostToolUseFailure | error + complete ToolCall(failure) |
| Notification | waiting |
| SubagentStop / SessionEnd | done |
| Stop | idle |

## Tests

```bash
npm test -w server   # Jest + ts-jest (relay, bootstrap)
npm test -w client   # Vitest (reducer)
```

All tests must pass before committing. The reducer is the most critical — test every state transition.

## Design decisions

- **No database.** All state in memory (ring buffer + React reducer). Page refresh re-bootstraps.
- **No file watching.** Bootstrap scans JSONL once per WebSocket connect.
- **Hook errors are silent.** POST /api/events always returns 200 — Claude Code must never be blocked.
- **`fast-glob` not chokidar** — bootstrap is a one-shot scan, not a file watcher.
- **`crypto.randomUUID()`** not nanoid — avoids ESM/CJS issues, Node 20+ built-in.

## Phase roadmap

- **Phase 1 (done):** Observer — agent tree, detail panel, event stream, JSONL bootstrap, mock mode
- **Phase 2 (Snapshot):** Read-only conversation snapshot in agent detail — initial task + latest assistant response, polled from session JSONL
- **Phase 3 (Distribution):** Claude Code plugin (auto-installs hooks + server), deployed client (Vercel), desktop app (Tauri/Electron TBD)
- **Phase 4 (The Office):** Visual floor-plan mode — agents as animated characters at desks, projects as rooms, toggle between list and office view
- **Phase 4+:** Generic adapter schema — LangChain, OpenAI Agents SDK, AutoGen support via thin HTTP adapters

## Ports

- Server: `localhost:7777` (fixed for Phase 1)
- Client dev server: `localhost:5173`

## Hook configuration (global, one-time setup)

See README.md for the full `~/.claude/settings.json` snippet.

## Development guidelines

### Think before coding

State assumptions explicitly before implementing. If multiple interpretations exist, surface them — don't pick silently. If something is unclear, stop and ask. This project has subtle invariants (pure reducer, silent hook errors, no DB) that are easy to break by assuming.

### Simplicity first

Minimum code that solves the problem. No abstractions for single-use code, no speculative flexibility, no error handling for impossible scenarios. Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical changes

Touch only what the task requires. Don't "improve" adjacent code, comments, or formatting. The reducer is especially sensitive — a stray side effect breaks everything silently. Every changed line should trace directly to the request.

### Goal-driven execution

For multi-step tasks, state a brief plan with verifiable outcomes before starting:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

"Fix the bug" → write a test that reproduces it, then make it pass. Tests must pass before and after any refactor.
