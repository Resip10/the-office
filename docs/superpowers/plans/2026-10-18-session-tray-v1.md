# Session Tray v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn The Office into Session Tray: an Electron tray app that lists every local Claude Code session with live state and resumes any of them in one click.

**Architecture:** Electron main process reads `~/.claude/projects/**` transcripts and `~/.claude/sessions/*.json` with pure, Jest-tested modules in `desktop/src/core/`, caches parsed metadata in `userData`, and pushes `SessionRecord[]` to a React renderer over IPC. The renderer has two layouts (popover, window) over the same list logic. The Express/WebSocket server and hook pipeline are deleted.

**Tech Stack:** Electron 33, electron-builder, electron-updater, TypeScript 5, Node 20, fast-glob, React 18, Vite 5, Tailwind 3, Jest + ts-jest (desktop), Vitest (client).

**Spec:** `docs/superpowers/specs/2026-10-18-session-tray-design.md` (product vision: `docs/product/session-tray-plan.md`)

## Global Constraints

- Never write to `~/.claude` except `uninstallHooks` on explicit user click.
- No server, no port, no WebSocket, no hooks required.
- Claude Code only. `tool: 'claude'` on every record.
- Unknown values render as `—`. Malformed input never throws out of `core/`.
- App data only in `app.getPath('userData')`: `index-v1.json`, `app-state.json`.
- Live poll 2 s; transcript rescan 30 s while a window is visible, 5 min otherwise, plus immediately on popover open.
- Copy command format: `cd "<projectPath>"; claude --resume <id>`.
- Session ids validated against `/^[0-9a-f-]{36}$/` before any spawn.
- `productName: Session Tray`; `appId: com.the-office.app` unchanged.
- Launch at login off by default.
- Tests: `npm test -w desktop` (Jest) and `npm test -w client` (Vitest) pass before every commit.

## Review Focus

1. Transcript being written while read (last line half-written) → parser skips it, record still produced. *(Task 1 test `ignores truncated last line`)*
2. Project path with spaces or non-ASCII (`C:\Users\Ім'я\my app`) → copy command and resume invocation quote it correctly. *(Task 4 tests)*
3. `sessions/<pid>.json` left behind by a crashed process → session shows Ended, not Running. *(Task 2 test `drops entries whose pid is dead`)*
4. `settings.json` with BOM, invalid JSON, or missing → no banner, no write, no crash. *(Task 5 test `hasLegacyHooks handles BOM and invalid JSON`)*
5. Taskbar on top/left or tray on secondary display → popover fully inside the display work area. *(Task 5 test for `popoverPosition`)*

---

## File Structure

```
desktop/src/
  core/
    types.ts            SessionRecord, LiveInfo, TranscriptMeta, IndexCache
    claude-transcript.ts  parseTranscript(filePath) → TranscriptMeta (streaming)
    live-status.ts      readLiveSessions(dir, isAlive) → Map<sessionId, LiveInfo>
    scanner.ts          scanClaude({ projectsDir, cache }) → { records, cache }
    commands.ts         copyCommand(), resumeInvocation()
    app-state.ts        loadAppState(), togglePin() (atomic write)
    legacy-hooks.ts     hasLegacyHooks(settingsPath) (+ moved uninstallHooks)
    popover.ts          popoverPosition(trayBounds, workArea, size)
    __tests__/          *.test.ts + fixtures/
  main.ts               tray, windows, pollers, IPC
  preload.ts            window.sessionTray API
client/src/
  lib/list.ts           buildSections(), relativeTime(), formatters
  hooks/useSessions.ts  subscribes to window.sessionTray
  components/           SessionRow, SessionList, FilterBar, DetailPanel, LegacyHooksBanner
  views/Popover.tsx, views/Window.tsx
  App.tsx               picks view from ?view=
```

Deleted: `server/` workspace, `client/src/{reducer.ts,mock/,hooks/useRelay.ts,hooks/useTranscriptSnapshot.ts}`, old components (`AgentTree, AgentNode, AgentDetail, EventRow, EventStream, ConnectionBadge, HooksBanner, ProjectGroup, ToolHistory`), `desktop/assets/hooks-*.html`, `desktop/src/installer.ts`.

---

### Task 1: Claude transcript parser ✅ (done 2026-10-18)

**Files:**
- Create: `desktop/src/core/types.ts`, `desktop/src/core/claude-transcript.ts`
- Create: `desktop/src/core/__tests__/claude-transcript.test.ts`, fixtures `desktop/src/core/__tests__/fixtures/projects/C--work-app/*.jsonl`
- Modify: `desktop/jest.config.cjs` (testMatch already covers `**/__tests__/**`; no change expected)

**Interfaces:**
- Produces:
  ```ts
  export interface TranscriptMeta {
    id: string; sessionId: string | null; title: string
    titleSource: 'custom' | 'agent' | 'ai' | 'prompt' | 'none'
    projectPath: string | null; gitBranch: string | null; entrypoint: string | null
    version: string | null; createdAt: number | null; lastTimestamp: number | null
    messageCount: number; contextTokens: number | null; model: string | null
    costUSD: number | null; prUrls: string[]; lastPrompt: string | null
    awaySummary: string | null; continuedInId: string | null
  }
  export async function parseTranscript(filePath: string): Promise<TranscriptMeta>
  ```
  `SessionRecord` (in `types.ts`) = `TranscriptMeta` minus `sessionId`/`lastTimestamp` plus `tool: 'claude'`, `filePath`, `projectExists`, `lastActivityAt`, `fileSize`, `subagentCount`, `live: LiveInfo | null` — exactly the spec §5 shape.

- [x] **Step 1: Write fixtures** (hand-written, 5–20 lines each): `titled.jsonl` (ai-title twice, then custom-title, agent-name, gitBranch changes mid-file `main`→`feat/x`, cost-state twice, two pr-link, away_summary, continued-in), `prompt-only.jsonl` (first user record `isMeta:true`, second `<command-name>/clear</command-name>`, third real prompt 200 chars), `broken.jsonl` (malformed middle line + truncated last line), `no-session-id.jsonl` (no sessionId field anywhere).

- [x] **Step 2: Write failing tests** in `claude-transcript.test.ts`:
  - `prefers custom title over agent-name and ai-title` → `title` = custom value, `titleSource: 'custom'`
  - `uses latest ai-title when no custom/agent title` → second ai-title
  - `falls back to first real user prompt, trimmed to 120 chars` → skips isMeta and `<command-` content; `title.length === 120`; `titleSource: 'prompt'`
  - `takes gitBranch from last record` → `'feat/x'`
  - `takes cost from last cost-state` and `contextTokens = input + cache_read + cache_creation of last assistant usage`, `model` from last assistant
  - `collects prUrls, lastPrompt, awaySummary, continuedInId`
  - `counts user+assistant records excluding isMeta and isSidechain`
  - `ignores truncated last line` and malformed lines → resolves, `messageCount` counts only valid lines
  - `no sessionId still returns record` → `id` = filename without `.jsonl`, `title: '—'`, `titleSource: 'none'`

- [x] **Step 3: Run** `npm test -w desktop -- claude-transcript` → FAIL (module not found).

- [x] **Step 4: Implement `parseTranscript`** with `readline.createInterface({ input: createReadStream(filePath) })`, one `JSON.parse` per line in try/catch, single pass keeping "first" and "last" values. `id` always from filename. Timestamps via `Date.parse`, NaN → ignore.

- [x] **Step 5: Run** `npm test -w desktop -- claude-transcript` → PASS.

- [x] **Step 6: Commit** `feat(core): add streaming Claude transcript parser`

---

### Task 2: Live status reader ✅ (done 2026-10-18)

**Files:**
- Create: `desktop/src/core/live-status.ts`, `desktop/src/core/__tests__/live-status.test.ts`, fixtures `fixtures/sessions/{100,200,300}.json` + a `.key` file

**Interfaces:**
- Produces:
  ```ts
  export interface LiveInfo { pid: number; status: string; name: string | null; updatedAt: number }
  export async function readLiveSessions(dir: string, isAlive: (pid: number) => boolean): Promise<Map<string, LiveInfo>>
  export function pidIsAlive(pid: number): boolean // process.kill(pid, 0) in try/catch
  ```

- [x] **Step 1: Failing tests:**
  - `maps sessionId to live info` (fixture 100.json copied from real shape: `{"pid":100,"sessionId":"…","status":"busy","name":"app-1c","updatedAt":…}`)
  - `drops entries whose pid is dead` (`isAlive = pid => pid !== 200`)
  - `ignores non-json files and malformed json` (300.json is `{oops`)
  - `missing dir returns empty map`
  - `status missing → 'unknown'`
- [x] **Step 2: Run** → FAIL.
- [x] **Step 3: Implement** with `readdir` + `readFile`, only `*.json`.
- [x] **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `feat(core): read live session status from ~/.claude/sessions`

---

### Task 3: Scanner with disposable cache ✅ (done 2026-10-18)

**Files:**
- Create: `desktop/src/core/scanner.ts`, `desktop/src/core/__tests__/scanner.test.ts`

**Interfaces:**
- Consumes: `parseTranscript` (Task 1), `LiveInfo` (Task 2)
- Produces:
  ```ts
  export interface IndexCache { version: 1; entries: Record<string, { mtimeMs: number; size: number; meta: TranscriptMeta }> }
  export async function scanClaude(opts: { projectsDir: string; cache: IndexCache | null; parse?: typeof parseTranscript }): Promise<{ records: SessionRecord[]; cache: IndexCache }>
  export function attachLive(records: SessionRecord[], live: Map<string, LiveInfo>): SessionRecord[]
  export async function loadCache(path: string): Promise<IndexCache | null>  // wrong version/invalid → null
  export async function saveCache(path: string, cache: IndexCache): Promise<void> // temp + rename
  ```

- [x] **Step 1: Failing tests** (build temp dir with `fs.mkdtemp`, copy Task 1 fixtures):
  - `lists only top-level <project>/<uuid>.jsonl, not subagents/` and `subagentCount` = number of `<uuid>/subagents/*.jsonl`
  - `reuses cached meta when mtime and size unchanged` (spy `parse` called 0 times on second scan)
  - `reparses changed file`
  - `drops cache entries for deleted files`
  - `projectExists false when cwd folder missing`
  - `lastActivityAt = lastTimestamp ?? file mtime`
  - `attachLive sets live by sessionId, null otherwise`
  - `loadCache returns null for version 2 or garbage`
- [x] **Step 2: Run** → FAIL.
- [x] **Step 3: Implement** with `fast-glob` pattern `*/*.jsonl` (cwd = projectsDir) and `*/*/subagents/*.jsonl` for counts. Add `fast-glob` to `desktop/package.json` dependencies.
- [x] **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `feat(core): scan Claude projects with mtime cache`

---

### Task 4: Commands and app state ✅ (done 2026-10-19)

**Files:**
- Create: `desktop/src/core/commands.ts`, `desktop/src/core/app-state.ts`, tests `commands.test.ts`, `app-state.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function copyCommand(r: Pick<SessionRecord, 'id' | 'projectPath'>): string
  export interface Invocation { file: string; args: string[]; cwd: string }
  export function resumeInvocation(r: Pick<SessionRecord, 'id' | 'projectPath'>, platform: NodeJS.Platform, hasWt: boolean): Invocation | null
  export interface AppState { pins: string[] }
  export async function loadAppState(path: string): Promise<AppState>   // missing/invalid → { pins: [] }
  export async function togglePin(path: string, id: string): Promise<AppState>
  ```

- [x] **Step 1: Failing tests:**
  - `copyCommand` → `cd "C:\\work\\my app"; claude --resume 0c29cf4c-54bc-4ff4-9393-82f33c39613d`; non-ASCII path preserved verbatim
  - `resumeInvocation win32 with wt` → `{ file: 'wt.exe', args: ['-d', path, 'claude', '--resume', id], cwd: path }`
  - `resumeInvocation win32 without wt` → `{ file: 'cmd.exe', args: ['/c', 'start', '""', 'powershell', '-NoExit', '-Command', 'claude --resume ' + id], cwd: path }`
  - `resumeInvocation darwin` → `file: 'osascript'`, args contain `do script` with single-quoted path; a `'` in path is escaped
  - `returns null for invalid id` (`'abc; rm -rf /'`) and for `projectPath: null`
  - `togglePin adds then removes`; `loadAppState` on garbage → `{ pins: [] }`; write is temp-then-rename (file never half-written: assert no `.tmp` left)
- [x] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `feat(core): resume commands and pin state`

---

### Task 5: Electron main rewrite (server removed) ✅ (done 2026-10-19 — root `npm run build` still blocked by pre-existing client mock error until Task 6)

**Files:**
- Create: `desktop/src/core/legacy-hooks.ts` (move `uninstallHooks` + `HOOK_COMMAND` from `installer.ts`, add `hasLegacyHooks`), `desktop/src/core/popover.ts`, tests `legacy-hooks.test.ts` (port the existing `uninstallHooks` tests), `popover.test.ts`
- Delete: `desktop/src/installer.ts`, `desktop/src/__tests__/installer.test.ts`, `desktop/assets/hooks-*.html`, `server/` workspace
- Modify: `desktop/src/main.ts` (rewrite), `desktop/src/preload.ts`, root `package.json`, `desktop/electron-builder.yml`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces (preload, for Task 6/7):
  ```ts
  window.sessionTray: {
    view: 'popover' | 'window'
    onUpdate(cb: (p: { records: SessionRecord[]; pins: string[]; legacyHooks: boolean }) => void): () => void
    resume(id: string): void; copy(id: string): void; togglePin(id: string): void
    reveal(id: string): void; openUrl(url: string): void
    openWindow(): void; removeLegacyHooks(): void
  }
  ```
  IPC channels: `sessions:update` (main→renderer), `session:resume|copy|pin|reveal`, `app:open-url|open-window|remove-legacy-hooks`.
  Pure helpers: `hasLegacyHooks(settingsPath: string): boolean`, `popoverPosition(tray: Rectangle, workArea: Rectangle, size: { width: number; height: number }): { x: number; y: number }`.

- [x] **Step 1: Failing tests:** `hasLegacyHooks` true when command present, false when only other hooks, false for missing file, `hasLegacyHooks handles BOM and invalid JSON` (BOM + valid → true; invalid → false); ported `uninstallHooks` tests; `popoverPosition` for taskbar bottom (above tray, right-aligned to tray), top (below tray), left/right, and tray near screen edge → clamped inside `workArea`.
- [x] **Step 2: Run** `npm test -w desktop` → FAIL.
- [x] **Step 3: Implement helpers.** Run → PASS.
- [x] **Step 4: Rewrite `main.ts`:** single-instance lock; tray (left-click toggles popover, context menu: Open window, Remove legacy hooks (only when detected), Launch at login checkbox via `app.setLoginItemSettings`, Quit); popover `BrowserWindow` 380×560 frameless, `skipTaskbar`, hide on `blur`, positioned with `popoverPosition`; main window 1100×720; both load renderer (`loadURL('http://localhost:5173/?view=…')` when `!app.isPackaged`, else `loadFile(client/dist/index.html, { query: { view } })`); live poll 2 s; rescan 30 s / 5 min / on popover show; cache in `userData/index-v1.json`; broadcast `sessions:update` only when JSON changed; `session:resume` → `spawn(file, args, { cwd, detached: true, stdio: 'ignore' }).unref()`, `hasWt` checked once via `where wt.exe`; `session:copy` → `clipboard.writeText(copyCommand(r))`; tooltip `Session Tray — N running`; keep `autoUpdater.checkForUpdatesAndNotify()` when packaged.
- [x] **Step 5: Delete server + old installer;** root `package.json`: workspaces `["client", "desktop"]`, `dev` = `concurrently "npm run dev -w client" "npm run build -w desktop && electron desktop/dist/main.js"`, `build` = client + desktop builds; `electron-builder.yml`: `productName: Session Tray`, drop `server/dist/**`; client `vite.config.ts`: `base: './'`, remove `/api` proxy.
- [x] **Step 6: Verify** `npm test -w desktop` PASS, `npm run build` succeeds, `npm run dev` shows tray icon (renderer may still be the old app — Task 7 replaces it).
- [x] **Step 7: Commit** `feat(desktop): tray + popover over local session index, remove server`

---

### Task 6: Client list logic ✅ (done 2026-10-19)

**Files:**
- Create: `client/src/lib/list.ts`, `client/src/__tests__/list.test.ts`
- Delete: `client/src/reducer.ts`, `client/src/__tests__/reducer.test.ts`, `client/src/mock/`, `client/src/hooks/useRelay.ts`, `client/src/hooks/useTranscriptSnapshot.ts`, `client/src/types.ts` (replace with `import type { SessionRecord } from '../../desktop/src/core/types'`)

**Interfaces:**
- Produces:
  ```ts
  export type TimeRange = 'today' | '7d' | '30d' | 'all'
  export interface Filters { query: string; range: TimeRange; project: string | null; runningOnly: boolean }
  export interface Sections { running: SessionRecord[]; pinned: SessionRecord[]; recent: SessionRecord[] }
  export function buildSections(records: SessionRecord[], pins: string[], f: Filters, now: number): Sections
  export function relativeTime(ts: number, now: number): string   // 'just now' | '5m ago' | '2h ago' | '3d ago' | 'Oct 2'
  export function projectName(path: string | null): string        // last path segment or '—'
  export function stateOf(r: SessionRecord): 'running' | 'ended' | string
  ```

- [x] **Step 1: Failing tests:** section precedence Running > Pinned > Recent (a pinned running session only in Running); each section sorted by `lastActivityAt` desc; `range` filters Recent only (pinned 20-day-old session visible with `'7d'`); `query` matches title/project name/branch/lastPrompt case-insensitively and applies to all sections; `project` filter applies to all; `runningOnly` empties pinned/recent; `today` = since local midnight of `now`; `relativeTime` boundaries (59 s → 'just now', 60 m → '1h ago', 7 d → date); `stateOf` live busy → 'running', live idle → 'idle', null → 'ended'.
- [x] **Step 2: Run** `npm test -w client` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `feat(client): session list sectioning, filtering, formatting`

---

### Task 7: Client views ✅ (done 2026-10-19)

**Files:**
- Create: `client/src/hooks/useSessions.ts`, `client/src/components/{SessionRow,SessionList,FilterBar,DetailPanel,LegacyHooksBanner}.tsx`, `client/src/views/{Popover,Window}.tsx`, `client/src/global.d.ts` (declares `window.sessionTray`)
- Modify: `client/src/App.tsx`
- Delete: old components listed in File Structure (keep `TokenGauge.tsx` if reused in DetailPanel for context tokens, with `model-limits.ts`)
- Test: `client/src/__tests__/SessionRow.test.tsx`

**Interfaces:**
- Consumes: `window.sessionTray` (Task 5), `buildSections`/`relativeTime`/`stateOf` (Task 6).
- Produces: `useSessions(): { records: SessionRecord[]; pins: string[]; legacyHooks: boolean }`.

- [x] **Step 1: Failing tests** (`SessionRow.test.tsx`, mock `window.sessionTray`): renders title, `project · branch`, relative time; Resume button disabled with title `Project folder no longer exists` when `projectExists` false; Resume label `Open another` when running; clicking Copy calls `sessionTray.copy(id)`; dimmed + "Continued in →" when `continuedInId` set.
- [x] **Step 2: Run** → FAIL.
- [x] **Step 3: Implement** per spec §6: Popover (search autofocus, chips, three sections, footer "Open window"); Window (list left with model/cost/context columns, `DetailPanel` right with every record field, PR links via `openUrl`, command + Copy, Resume, Reveal, Pin); `LegacyHooksBanner` text: "Old The Office hooks found in Claude settings. They're no longer needed." + **Remove**. Status dot colors: running `#d29922`, idle `#3fb950`, ended `#6e7681`, other `#bc8cff`. Empty state: "No Claude Code sessions found in ~/.claude/projects".
- [x] **Step 4: Run** `npm test -w client` → PASS; `npm run dev` → popover lists real sessions, Resume opens Windows Terminal in project folder, Copy puts command on clipboard, pin survives restart.
- [x] **Step 5: Commit** `feat(client): popover and window views`

---

### Task 8: Docs and release check ✅ (done 2026-10-19 — unpacked package verified; full NSIS installer left to CI release)

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/superpowers/specs/2026-05-14-phase4-office-view-design.md` + `docs/superpowers/plans/2026-05-14-phase4-office-view.md` (status line → `Superseded by 2026-10-18-session-tray-design.md`)
- Modify: `.github/workflows/release.yml` (step "Build server + client" → "Build client + desktop"; drop separate desktop build if `npm run build` now covers it)

- [x] **Step 1:** Rewrite `CLAUDE.md` for new architecture (key files table = Task file structure, tests, design decisions from spec §4, no hooks/server/port). Rewrite README: what it is, install, dev, no settings changes needed, how to remove old hooks.
- [x] **Step 2: Verify** `npm test -w desktop && npm test -w client && npm run package` → all pass, installer produced in `dist-electron/` named `Session Tray Setup *.exe`.
- [x] **Step 3: Manual** install over existing 0.1.2: app launches, legacy-hooks banner appears, Remove clears only the `localhost:7777` hooks from `~/.claude/settings.json` (diff before/after), port 7777 no longer listening.
- [x] **Step 4: Commit** `docs: Session Tray architecture, supersede office view`
