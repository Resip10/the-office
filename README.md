# the-office

**htop for AI agents.** Real-time dashboard for observing Claude Code agents across all your projects.

![Status: Phase 1 — Observer](https://img.shields.io/badge/status-Phase%201%20Observer-blue)

---

## What it does

- **Live agent tree** — see every Claude Code agent on your machine, grouped by project, with parent/child hierarchy
- **Agent detail** — click any agent to see its current tool, tool history with timing, and duration
- **Event stream** — live feed of every hook event as it fires
- **JSONL bootstrap** — dashboard populates immediately on open, even for sessions that started before the dashboard
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

If the server isn't running, hooks fail silently — Claude Code is unaffected.

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

On WebSocket connect, server scans `~/.claude/projects/**/sessions/*.jsonl` (last 4h) and sends bootstrapped agent state alongside the ring buffer. Page refresh always gives fresh data.

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
