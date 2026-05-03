# the-office

**htop for AI agents.** Real-time dashboard for observing Claude Code agents across all your projects.

![Status: Phase 3.5 — Resilience & Enrichment](https://img.shields.io/badge/status-Phase%203.5%20Resilience-blue)

---

## What it does

- **Live agent tree** — every Claude Code agent on your machine, grouped by project; subagents nested under their parent
- **Works without hooks** — JSONL file watcher discovers agents and infers status automatically (~500ms lag); hooks give real-time updates
- **Token & cost panel** — model, context window fill %, input/output/cache tokens, cost, and turn duration per agent
- **Agent detail** — current tool, tool history with timing, and conversation snapshot (initial task / latest ask / latest response)
- **Event stream** — live feed of every hook event as it fires
- **Mock mode** — develop and demo without Claude Code running (`?mock=true`)

## Download

Grab the latest installer from [Releases](https://github.com/Resip10/the-office/releases):

- **Windows** — `The-Office-Setup-x.x.x.exe`
- **macOS** — `The-Office-x.x.x-arm64.dmg`
- **Linux** — `The-Office-x.x.x.AppImage`

On first launch the app lives in your system tray. Use the tray menu to install or remove Claude Code hooks — the dashboard works without them via JSONL file watching. Updates are applied in the background.

## Dev setup

```bash
git clone https://github.com/Resip10/the-office.git
cd the-office
npm install
npm run dev        # server :7777 + client :5173
```

### Configure hooks manually (dev only)

Add to `~/.claude/settings.json` — the desktop app does this automatically for non-dev users:

```json
{
  "hooks": {
    "SessionStart":        [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "SessionEnd":          [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "SubagentStart":       [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "SubagentStop":        [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "PreToolUse":          [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "PostToolUse":         [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "Stop":                [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "Notification":        [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "PostToolUseFailure":  [{"hooks": [{"type": "command", "command": "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}]
  }
}
```

The hook uses `curl -s` + `|| true` so a stopped server never blocks or errors Claude Code.

## Architecture

```
Claude Code hooks (optional)
      │ HTTP POST :7777/api/events
      ▼
  Express server ──── chokidar JSONL watcher
      │                     │ discovers agents + extracts enrichment
      │ ring buffer (500) ◄─┘
      ▼
  WebSocket broadcast
      ▼
  React frontend (client/)
      │ useReducer: HookEvent / SESSION_DISCOVERED / ENRICH → AgentState
      ▼
  AgentTree / AgentDetail / EventStream
```

Two ingestion paths feed the relay: hook events (real-time) and the JSONL watcher (polling fallback). On WebSocket connect the server bootstraps agents from recent session files. Refreshing or clicking Refresh re-runs bootstrap.

## Development

```bash
npm run dev          # start server :7777 + client :5173
npm run dev:desktop  # start Electron tray (dev mode, points at Vite)
npm test -w server   # server tests (Jest)
npm test -w client   # client tests (Vitest)
npm test -w desktop  # desktop tests (Jest)
```

## Roadmap

- **Phase 1 (done):** Observer — live agent tree, detail panel, event stream, JSONL bootstrap, mock mode
- **Phase 2 (done):** Conversation snapshot — initial task, latest ask, latest response polled from session JSONL
- **Phase 3 (done):** Desktop app — Electron tray (macOS/Windows/Linux), auto-installs hooks, auto-updates via GitHub Releases
- **Phase 3.5 (done):** Resilience & enrichment — hookless mode via JSONL file watching, token/cost/model metadata, hooks management UI
- **Phase 4 (The Office):** Visual floor-plan mode — agents as animated characters at desks, projects as rooms, toggle between list and office view
- **Phase 4+:** Generic adapter schema — LangChain, OpenAI Agents SDK, AutoGen support via thin HTTP adapters
