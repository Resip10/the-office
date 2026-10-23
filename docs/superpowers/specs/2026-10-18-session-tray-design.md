# Session Tray — Design Spec
**Date:** 2026-10-18
**Status:** v1 implemented and released as v0.2.0 (2026-10-19; plan `docs/superpowers/plans/2026-10-18-session-tray-v1.md`). P1 implemented per `2026-10-22-p1-design.md`.
**Supersedes:** Phase 4 office view (`2026-05-14-phase4-office-view-design.md`) and the hook-driven observer direction of Phases 1–3.5
**Product doc:** `docs/product/session-tray-plan.md` (the full product vision; this spec scopes and grounds it)

---

## 1. Intent

The app pivots from entertainment ("htop for agents", office floor-plan) to daily use: a small tray app that lists every local Claude Code session so you can find one, see what it was about, and get back into it with one click — without opening an agent or a terminal first.

The big window is, for now, the same list as the tray popover with more room and a detail panel. No separate product.

## 2. Goals, non-goals, anti-goals

**Goals (v1 = P0 MVP)**
1. Every local Claude Code session listed, across all projects and surfaces (CLI, IDE, desktop Code tab).
2. Per-row metadata: title, project, git branch, last activity, size, live state.
3. Search and filters.
4. Copy resume command; resume in terminal with one click.
5. Pin sessions (app-owned).
6. Remove the legacy `curl :7777` hooks the old app installed.

**Non-goals for v1** (kept in roadmap, §9): Codex and other agents, handoff summaries, stale detection / archive, rename, tags, notes, git awareness, LLM summaries, global hotkey, full-text search.

**Non-goals, permanent:** cloud sessions; chat-app conversations; chatting inside the app; custom transcript converters.

**Anti-goals (failure even if it works):**
- Writing to `~/.claude` outside an explicit user action. The app must never edit transcripts or session files.
- Requiring hooks or any change to the user's Claude Code config to function.
- A slow tray: popover must open instantly from cached data, even with 50+ MB of transcripts.
- Crashing or showing an empty list when the transcript format changes. Unknown → "—".

## 3. Findings that shape the design (audit of current app, 2026-10-18, Claude Code 2.1.302)

| Finding | Consequence |
|---|---|
| Claude Code writes `~/.claude/sessions/<pid>.json` per running process: `pid, sessionId, cwd, startedAt, version, kind (interactive/…), entrypoint (cli/…), name, nameSource, status ("busy"/…), updatedAt` | Live state without hooks. Hook installer is obsolete. |
| `claude agents --json` prints the same active list | Optional cross-check; not needed for v1 (spawning a CLI every poll is too heavy). |
| Transcript records carry far more metadata than the current parser reads: `ai-title`, `agent-name`, `custom-title` (via `/rename`), `last-prompt`, `gitBranch`, `version`, `entrypoint`, `pr-link`, `cost-state` (totalCostUSD, lines added/removed, modelUsage), `system:turn_duration` (+ `messageCount`), `system:away_summary` (built-in recap), `continued-in`, user records with `isCompactSummary` | Rich rows for free. `away_summary` / compact summary are the P1 handoff source. |
| Current bootstrap only reads the last 4h and drops finished sessions | Opposite of a history browser. Replace. |
| Express + WebSocket on fixed port 7777 + chokidar exist only to relay hooks to a browser | Delete. Electron main reads files and sends to renderer over IPC. |
| User's `~/.claude/settings.json` still has 9 legacy `curl … localhost:7777` hooks | One-click removal (reuse `uninstallHooks`). |
| `cleanupPeriodDays` unset → Claude deletes old transcripts by default; CLI has `claude purge`, `claude rm` | Cleanup in later phases goes through Claude's own setting/CLI first. |
| Largest local transcript 7.5 MB, total 54 MB, ~40 files | Must cache parsed metadata; reparse only changed files. |
| No `~/.codex` on this machine | Codex deferred. |

## 4. Architecture

```
~/.claude/projects/**/<uuid>.jsonl ──┐
~/.claude/sessions/<pid>.json ───────┤  Electron main process
                                     │   core/ (pure, Node-only, unit-tested)
                                     │     claude-adapter: transcript → SessionRecord
                                     │     live-status: sessions/*.json → Map<sessionId, Live>
                                     │     index: cache by (path, mtime, size) in userData
                                     │   app-state: pins (userData/app-state.json)
                                     │   actions: copy command, resume in terminal, reveal file
                                     │        │ IPC (preload, contextIsolation)
                                     ▼        ▼
                          Renderer (React + Tailwind, built by Vite)
                            ├── popover window (frameless, anchored to tray)
                            └── main window (list + detail panel)
```

**Decided (by user):** Claude Code only for v1; Codex later as a second adapter producing the same record.

**My calls (builder may revisit with reason):**
- No server, no port, no WebSocket. Delete `server/` workspace, `express`, `ws`, `cors`, `chokidar`.
- Workspaces: `desktop/` (main, preload, `src/core/`) and `client/` (renderer). Root `npm run dev` runs Vite + Electron pointed at the Vite dev URL.
- One renderer bundle, two entry modes via query string: `?view=popover` and `?view=window`. Same components, different layout.
- Keep repo name and `appId: com.the-office.app` (preserves auto-update for existing installs); change `productName` to **Session Tray**. No install-folder/shortcut migration: if NSIS keeps the old folder or shortcut name on update, that is accepted (the only existing install is the author's). The update itself removes the :7777 server since the new build has none; the legacy-hooks banner covers the hooks.
- Launch at login: off by default, toggled from tray menu (`app.setLoginItemSettings`), verified on the packaged build.
- Keep Electron 33 + electron-builder + electron-updater + GitHub release workflow.
- `fast-glob` stays for directory scans; transcripts read with streaming line reader (`readline`) to avoid loading 7 MB strings repeatedly.

### 4.1 Refresh model
- **Live status:** poll `~/.claude/sessions/*.json` every 2 s (tiny files). A file whose `pid` is not alive (`process.kill(pid, 0)` throws) is ignored.
- **Transcripts:** full scan at startup (from cache — only files whose `mtime`/`size` changed are reparsed), then rescan every 30 s while any window is visible and every 5 min otherwise. Plus an immediate rescan when the popover opens.
- Index cache file: `userData/index-v1.json`. Disposable: deleting it only costs one cold scan. Version suffix bumps when record shape changes.
- Main pushes the full list to renderers on change (`sessions:update`). List size is small (hundreds), no diffing needed.

## 5. Session record (Claude adapter)

```ts
interface SessionRecord {
  tool: 'claude'
  id: string                 // transcript filename UUID
  filePath: string
  title: string              // custom-title → agent-name → latest ai-title → first real user prompt → '—'
  titleSource: 'custom' | 'agent' | 'ai' | 'prompt' | 'none'
  projectPath: string | null // cwd from first record that has one
  projectExists: boolean
  gitBranch: string | null   // from LAST record with gitBranch
  entrypoint: string | null  // e.g. 'cli'; raw value shown, not interpreted
  version: string | null     // Claude Code version at last activity
  createdAt: number | null   // first timestamp
  lastActivityAt: number     // last timestamp, else file mtime
  messageCount: number       // user + assistant records, excluding isMeta and sidechain
  fileSize: number
  contextTokens: number | null // last assistant usage: input + cache_read + cache_creation
  model: string | null       // last assistant message.model
  costUSD: number | null     // last cost-state.totalCostUSD — Claude Code's API-price estimate, not a bill; label "≈ API cost" (subscription plans pay flat)
  prUrls: string[]           // pr-link records
  lastPrompt: string | null  // last last-prompt.lastPrompt
  awaySummary: string | null // latest system:away_summary content (P1 uses it)
  subagentCount: number      // files in <uuid>/subagents/
  continuedInId: string | null // last continued-in.continuedInSessionId
  live: { pid: number; status: string; name: string | null; updatedAt: number } | null
}
```

Rules:
- Only top-level `<project>/<uuid>.jsonl` files are sessions. `subagents/*.jsonl` only feed `subagentCount`.
- "First real user prompt": first `type:"user"` record, not `isMeta`, with string content (or first text block) not starting with `<command-` / `<local-command-` / `<system-reminder>`; trimmed to 120 chars.
- Unknown record types ignored. Malformed lines skipped. A file with no `sessionId` anywhere still listed with filename id and "—" fields.
- `state` shown in UI: `live.status === 'busy'` → **Running**; any other live status → raw value (e.g. **Idle**); no live entry → **Ended**.
- Sessions spawned by the app itself: none in v1 (no summarizer yet).
- **Continued sessions (my call):** each file stays its own row; parsing stays per-file. A record with `continuedInId` pointing at a listed session is dimmed and shows a "Continued in →" link that selects the successor. No chain merging in v1; pins stay on the id the user pinned.

## 6. Surfaces (v1)

### 6.1 Tray icon
- Neutral icon. Tooltip: `Session Tray — N running`.
- Left-click toggles popover. Right-click menu: Open window, Remove legacy hooks (only when detected), Launch at login (checkbox), Quit.

### 6.2 Popover
- Frameless `BrowserWindow` ~380×560, positioned next to tray bounds (`tray.getBounds()`, clamp to `screen.getDisplayNearestPoint` work area), hides on blur.
- Search box focused on open. Searches title, project folder name, branch, lastPrompt (case-insensitive substring).
- Filter chips: time range (Today / 7d / 30d / All, default 7d), project (dropdown), state (All / Running).
- Sections: **Running**, **Pinned**, **Recent** (sorted by lastActivityAt desc). A session appears in one section only, first match wins in that order.
- **Filter scope (my call):** the time-range filter applies to Recent only; Running and Pinned are always shown. Search, project and state filters apply to all sections.
- Row: state dot, title, `project · branch`, relative time ("2h ago"), size hint (message count). Hover actions: **Resume**, **Copy**, **Pin**.
- Footer: "Open window" button.

### 6.3 Main window
- Same list on the left (wider rows add model, cost, context tokens).
- Detail panel on the right for selected session: all record fields, PR links (open in browser), the exact resume command with Copy, Resume, Reveal transcript file, Pin.

### 6.4 Legacy hooks banner
- If `~/.claude/settings.json` contains the old `localhost:7777` hook command: banner in both views — "Old The Office hooks found in Claude settings. They're no longer needed." → **Remove**. Uses existing `uninstallHooks` (exact-command match; leaves every other hook untouched). This is the only write to `~/.claude`, and it is explicit.

## 7. Actions

- **Copy command:** `cd '<projectPath>'; claude --resume <id>` (works in PowerShell and bash). Single quotes keep `$` and backticks literal; a `'` in the path is escaped as `''` on Windows (PowerShell) and `'\''` elsewhere (bash/zsh). *(Changed 2026-10-19 from double quotes.)*
- **Resume in terminal (Windows):** if `wt.exe` is on PATH → `wt.exe -d "<projectPath>" claude --resume <id>`; else `cmd /c start "" powershell -NoExit -Command "claude --resume <id>"` with `cwd` = projectPath. Spawn detached, no shell string concatenation of untrusted values beyond quoted path and the UUID (validated `^[0-9a-f-]{36}$`).
- **Resume (macOS):** `osascript` → Terminal.app `do script "cd '<path>'; claude --resume <id>"`. Built, lightly tested; Windows is primary.
- Project folder missing → Resume disabled with tooltip "Project folder no longer exists"; Copy still works.
- Running session → Resume still allowed (Claude handles it), but button label reads "Open another".
- **Pin:** toggles id in `userData/app-state.json` (`{ "pins": string[] }`), written atomically (write temp, rename).
- **Reveal file:** `shell.showItemInFolder(filePath)`.

## 8. Testing

- `desktop/src/core/**` is pure Node and tested with Jest against fixture transcripts in `desktop/src/core/__tests__/fixtures/` — small hand-trimmed JSONL covering: ai-title, custom-title, agent-name, meta/command prompts, compact summary, cost-state, pr-link, away_summary, malformed lines, missing sessionId, subagents folder.
- Live status parser tested with fixture `sessions/*.json` and an injected `isAlive(pid)`.
- Renderer: Vitest for pure list logic (search, filter, sectioning, relative time). Components lightly tested.
- Manual check on Windows: popover position, resume via `wt`, legacy-hook removal.

## 9. Roadmap after v1

- **v1 (done, v0.2.0):** everything in §§4–8, plus the review follow-ups listed in the plan's Status section.
- **P1 (next):** handoff summary (tier 1 = latest `away_summary` / `isCompactSummary` text; tier 2 = extract: goal, last prompt, files touched, branch, last answer) with Copy; "Continue in…" (new `claude` in project folder seeded with summary); stale detection + archive (prefer Claude's `cleanupPeriodDays` / `claude purge` before custom file moves; any move = write new, then remove old, with undo); detail message peek; rename (app-owned).
- **P2:** waiting-for-input badge (needs a reliable status value from session files — verify what Claude writes when blocked on a permission prompt); git hints (branch merged, worktree gone); token/cost totals; tags and notes.
- **P3:** Codex adapter (`~/.codex/sessions`, read-only sqlite), LLM-polished summaries, global hotkey, full-text index, CLI / `/sessions` command.

## 10. What happens to existing code

- **Delete:** `server/` workspace; client hook-event reducer, event stream, tool history, mock generator, `useRelay`, `useTranscriptSnapshot`; `desktop/assets/hooks-setup.html`, `hooks-remove.html`; hook installer's `installHooks`/`hasHooks` paths in the UI.
- **Keep/reuse:** Electron shell, tray, single-instance lock, auto-updater, release workflow, `uninstallHooks` (+ its tests), Tailwind setup, `TokenGauge` idea for context usage, `model-limits`.
- **Docs:** mark Phase 4 spec/plan as superseded; rewrite `CLAUDE.md` and `README.md` for the new architecture at the end of v1.

## 11. Open questions (not blocking v1)

- Exact set of `status` values in `sessions/<pid>.json` (seen: `busy` while working, `idle` while waiting for the next prompt; permission-prompt value still unknown). Unknown values are displayed raw until mapped.
- Whether desktop-app Code tab sessions resume cleanly via `claude --resume` on this Claude Code version (known issue #32992). v1 just tries; P1 handoff is the fallback.
- Rename write-back to Claude (`custom-title`) vs app-only — decide in P1.
- Crashed-session detection compares `procStart` with the real process start time on Windows only; macOS still relies on pid existence.
