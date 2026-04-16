# the-office

**htop for AI agents.** Real-time dashboard for observing Claude Code agents across all your projects.

![Status: Phase 1 — Observer](https://img.shields.io/badge/status-Phase%201%20Observer-blue)

---

## What it does

- **Live agent tree** — every Claude Code agent on your machine, grouped by project; subagents appear nested under their parent
- **Agent detail** — click any agent to see its current tool, tool history with timing, and duration
- **Event stream** — live feed of every hook event as it fires
- **JSONL bootstrap** — on connect, the server scans recent session files so the dashboard is populated immediately, even for sessions that started before the dashboard opened
- **Refresh button** — reconnects WebSocket and re-bootstraps from disk; done agents are cleared automatically
- **Mock mode** — develop and demo without Claude Code running (`?mock=true`)

## Setup

### 1. Install dependencies

```bash
git clone <repo>
cd the-office
npm install
```

### 2. Configure Claude Code hooks (one-time)

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart":  [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "SessionEnd":    [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "SubagentStart": [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "SubagentStop":  [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "PreToolUse":    [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "PostToolUse":   [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "Stop":          [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "Notification":  [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}]
  }
}
```

**Why this is safe to add:** The command uses `curl -s` (silent, no output) with `-d @-` (reads stdin, which Claude Code pipes the event JSON into), and ends with `2>/dev/null || true`. This means:
- If the server isn't running, `curl` fails but `|| true` forces exit code 0 — Claude Code never sees an error
- `-s` and `2>/dev/null` suppress all output so nothing leaks into Claude's context
- The hook never blocks or interrupts Claude Code regardless of server state

### 3. Start the dashboard

```bash
npm run dev
```

Open `http://localhost:5173`.

## Mock mode

No Claude Code required:

```
http://localhost:5173?mock=true
```

Simulates two projects, five agents, ~25 events looping every ~20 seconds.

## Architecture

```
Claude Code hooks
      │ HTTP POST :7777/api/events
      ▼
  Express server (server/)
      │ stamp _id + _timestamp → ring buffer (500) → broadcast
      ▼
  React frontend (client/)
      │ useReducer: HookEvent → AgentState transitions
      ▼
  AgentTree / AgentDetail / EventStream
```

On WebSocket connect, the server scans `~/.claude/projects/**/*.jsonl` (last 4h), deduplicates by `sessionId`, skips done sessions, and sends the result alongside the ring buffer. The frontend uses `agent_id` (from `SubagentStart`) as the map key for subagents so they nest correctly under their parent in the tree. Refreshing the page or clicking Refresh re-runs this bootstrap.

## Development

```bash
npm run dev          # start both server and client
npm test -w server   # server tests (Jest)
npm test -w client   # client tests (Vitest)
```

## Roadmap

- **Phase 2:** Kill agents, view full conversations, spawn agents from dashboard
- **Phase 3:** Claude Code plugin (auto-installs hooks + server), deployed client (Vercel), desktop app (Tauri/Electron)
- **Phase 3+:** Generic adapter schema — support LangChain, OpenAI Agents SDK, AutoGen and any agent framework via thin HTTP adapters
