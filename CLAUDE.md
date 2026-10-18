# Session Tray — Project Instructions

## What this is

A tray app that lists every local Claude Code session so you can find one, see what it was about, and resume it in one click.
Electron main reads Claude Code's own files → pushes session records over IPC → React renders a tray popover and a bigger window.
(Repo is still named `the-office`; the hook-driven observer and office view were replaced on 2026-10-19.)

## Architecture at a glance

```
~/.claude/projects/<project>/<uuid>.jsonl ─┐
~/.claude/sessions/<pid>.json ─────────────┤→ Electron main (desktop/src)
                                           │     core/: parse, scan + cache, live status, commands, pins
                                           │     IPC: sessions:update / sessions:get, session:*, app:*
                                           └→ Renderer (client/src): ?view=popover | ?view=window
```

- `desktop/` — Electron main + preload. `src/core/` is pure Node, unit-tested, no Electron imports.
- `client/` — React 18 + Vite + Tailwind CSS v3. Loaded by Electron (Vite dev server in dev, `resources/client/dist` when packaged).
- Root `package.json` — npm workspaces (`client`, `desktop`). `npm run dev` starts Vite + Electron.

## Running

```bash
npm install
npm run dev        # Vite :5173 + Electron tray app
npm run build      # client + desktop
npm run package    # build + electron-builder (installer in desktop/dist-electron)
```

## Key files

| File | Responsibility |
|---|---|
| `desktop/src/main.ts` | Tray, popover/window, polling, IPC handlers |
| `desktop/src/preload.ts` | `window.sessionTray` bridge |
| `desktop/src/core/claude-transcript.ts` | `parseTranscript` — one JSONL → `TranscriptMeta` (streaming) |
| `desktop/src/core/scanner.ts` | `scanClaude` + mtime/size cache, `attachLive` |
| `desktop/src/core/live-status.ts` | `readLiveSessions` from `~/.claude/sessions` |
| `desktop/src/core/commands.ts` | `copyCommand`, `resumeInvocation` (wt / powershell / osascript) |
| `desktop/src/core/app-state.ts` | Pins in `userData/app-state.json` |
| `desktop/src/core/legacy-hooks.ts` | Detect/remove the old `localhost:7777` hooks |
| `desktop/src/core/types.ts` | `SessionRecord`, `LiveInfo`, `SessionsPayload` (shared with client) |
| `client/src/lib/list.ts` | `buildSections`, filters, `relativeTime` |
| `client/src/views/Popover.tsx`, `Window.tsx` | The two layouts |

## Session state

| Source | Shown as | Dot |
|---|---|---|
| live status `busy` | running | amber `#d29922` |
| live status `idle` | idle | green `#3fb950` |
| other live status | raw value | purple `#bc8cff` |
| no live entry (pid gone) | ended | gray `#6e7681` |

Sections: Running (any live session) > Pinned > Recent. The time filter applies to Recent only.

## Tests

```bash
npm test -w desktop  # Jest + ts-jest — core/ against fixture transcripts
npm test -w client   # Vitest — list logic, formatters, row and view rendering
```

All tests must pass before committing. Parser changes need a fixture under `desktop/src/core/__tests__/fixtures/`.

## Design decisions

- **Read-only on `~/.claude`.** The only write is removing the old hooks, on an explicit click.
- **No server, no port, no hooks.** Live status comes from `~/.claude/sessions/<pid>.json`.
- **Fail soft.** Unknown records are ignored, unknown values show as "—"; `core/` never throws on bad input.
- **Disposable cache.** `userData/index-v1.json`; deleting it costs one cold scan.
- **Cost is an estimate.** `costUSD` is Claude Code's API-price figure, labelled "≈ API cost".
- **Run actions through the CLI.** Resume = `claude --resume <id>` in the project folder; ids validated first.

## Roadmap

- **v1 (done):** list, metadata, search/filters, copy + resume, pins, legacy-hook removal
- **P1:** handoff summary, Continue in…, stale detection + archive, message peek, rename
- **P2:** waiting-for-input badge, git hints, token/cost totals, tags and notes
- **P3:** Codex adapter, LLM summaries, global hotkey, full-text search

Spec: `docs/superpowers/specs/2026-10-18-session-tray-design.md`. Product vision: `docs/product/session-tray-plan.md`.

## Development guidelines

### Think before coding

State assumptions explicitly before implementing. If multiple interpretations exist, surface them — don't pick silently. If something is unclear, stop and ask. This project has subtle invariants (read-only on ~/.claude, fail-soft parsing, no server or port) that are easy to break by assuming.

### Simplicity first

Minimum code that solves the problem. No abstractions for single-use code, no speculative flexibility, no error handling for impossible scenarios. Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical changes

Touch only what the task requires. Don't "improve" adjacent code, comments, or formatting. The transcript parser is especially sensitive — a wrong assumption about the JSONL format breaks every row silently. Every changed line should trace directly to the request.

### Goal-driven execution

For multi-step tasks, state a brief plan with verifiable outcomes before starting:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

"Fix the bug" → write a test that reproduces it, then make it pass. Tests must pass before and after any refactor.
