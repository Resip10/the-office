# Agent Session Tray — Design Plan

A small OS tray (menu bar) app that shows all local Claude Code and Codex sessions in one place, so you can find, resume, summarize, and clean them up without opening an agent first.

---

## 1. Goals

- **Never lose a session.** Every local session is listed, whichever surface created it: terminal, IDE extension, or desktop app.
- **One click back to work.** Resume a session in a terminal, or hand it off to a fresh agent with a summary.
- **Keep history tidy.** Spot stale sessions and archive them safely.
- **Always reachable.** The app lives in the tray, so no agent or terminal needs to be running.

## 2. Non-goals

- Cloud sessions (Claude Code on the web, Codex cloud tasks): they're not stored locally.
- Regular chat conversations from the Claude or ChatGPT apps.
- Writing a custom transcript converter between tools. Exact migration is delegated to an external tool if installed.
- Replacing the agents' own UIs. The app finds and launches; it doesn't chat.

## 3. Core principles

1. **Read-only by default.** The app never edits the agents' files or databases. The only exceptions are explicit user actions (archive, rename), done through the safest available route.
2. **Local only.** No server, no account, no telemetry. Nothing leaves the machine unless the user enables an external summarizer.
3. **Fail soft.** If a tool's file format changes, show what can still be read and mark the rest as unknown. Don't crash or show an empty list.
4. **Reversible actions.** Delete means archive first, with a restore window.
5. **App data is separate.** Pins, tags, notes, cached summaries, and settings live in the app's own folder, never inside `~/.claude` or `~/.codex`.

## 4. Sources

| Source | What is read | Notes |
|---|---|---|
| Claude Code (CLI, IDE, desktop Code tab) | Transcripts in `~/.claude/projects/`; live session files in `~/.claude/sessions/` | Desktop-born sessions are visible; terminal resume may not work for them (see §9) |
| Codex (CLI, IDE, desktop) | Rollouts in `~/.codex/sessions/` and `archived_sessions/`; thread index in `~/.codex/state_*.sqlite` | Database opened read-only; schema version detected, never hardcoded |
| Custom config dirs | Same as above, at user-added paths | e.g. a second Claude account via `CLAUDE_CONFIG_DIR` |

Each source is a separate adapter that produces the same session record (§5). Adding another tool later means adding one adapter.

## 5. Session record

Every session shown in the app has these fields. Unknown values are shown as "—", never guessed.

- **Identity:** tool (Claude / Codex), session ID, title (custom name → tool's title → first prompt)
- **Location:** project folder, git branch at last activity, originating surface (CLI / IDE / desktop)
- **Time:** created, last activity, active duration
- **Size:** message count, file size, total tokens, last known context usage
- **State:** running / waiting for input / idle / ended; stale flag (§8)
- **Content hints:** latest compaction summary if present; last user request; files touched
- **User data (app-owned):** pinned, tags, personal note, cached summary

## 6. App surfaces

### 6.1 Tray icon
- Neutral icon by default.
- A badge or dot when a session is waiting for input (once live status exists).
- Click opens the popover; right-click shows quick actions (open last session, settings, quit).

### 6.2 Popover (main list)
- Search box at the top: searches titles, projects, branches, and notes. Full-text search over transcripts is optional.
- Filters: tool, project, state, time range (today / 7d / 30d / all).
- Sections: **Running**, **Pinned**, **Recent**. Stale sessions are hidden behind a toggle.
- Each row shows tool icon, title, project, branch, last activity ("2h ago"), and a size/context indicator.
- Row actions on hover: **Resume**, **Copy command**, **Summary**, **More…**

### 6.3 Session detail panel
- All record fields from §5.
- Summary preview with **Copy** and **Continue in…** buttons.
- Last few user and assistant messages as a read-only peek.
- Actions: Resume, Copy command, Continue in Claude / Codex, Rename, Pin, Tag, Archive, Reveal file.

### 6.4 Cleanup view
- Lists stale sessions grouped by reason (§8).
- Bulk select → Archive.
- Archive tab with a restore button and countdown to permanent removal.

### 6.5 Settings
- Sources and custom paths
- Terminal app used for Resume
- Stale rules and archive retention
- Summary mode: built-in only / external summarizer / local model
- Launch at login, global hotkey
- Optionally expose Claude Code's own `cleanupPeriodDays` retention setting

## 7. Features by priority

### P0 — MVP (personal daily driver)
1. Unified list of Claude Code and Codex sessions across all projects and surfaces.
2. Metadata per row: title, project, branch, last activity, size.
3. Search and filters.
4. **Copy resume command** (`cd <project> && claude --resume <id>` / `codex resume <id>`).
5. **Resume in terminal** with one click.
6. Pin / favorite (app-owned).

### P1 — First public release
7. **Handoff summary**, built without any model: tool's own compaction summary when present, otherwise an extract (goal, last request, files touched, branch, last answer).
8. **Continue in…**: open a new agent session in the project folder, seeded with the handoff summary. Works in either direction and for sessions that can't be resumed natively.
9. **Stale detection and archive** (Claude first; Codex only via its own archive mechanism).
10. Session detail panel with message peek.
11. Rename (app-owned display name, optionally synced to the tool's own name).

### P2 — Nice to have
12. **Live status**: running / waiting / idle, with a tray badge and optional notification when an agent needs input. *(Done in 0.3.2: reads `waiting` / `waitingFor`; notifications off by default.)*
13. **Git awareness**: branch merged? worktree deleted? uncommitted changes? Shown as hints on stale detection.
14. **Exact migration** via an external migration tool when installed; the button is hidden otherwise.
15. Tags and personal notes.
16. Token and context usage per session, plus totals. *(Done in 0.3.3: context % on running rows; an overview line with app totals (running/waiting, ≈ cost today or this week, sessions today); and, after a one-click Connect of the Claude Code status line, account-wide plan limits in the overview line plus each session's own status line text, effort and thinking in its details, all marked `>_`. Token totals across sessions are left for later.)*

### P3 — Later / optional
17. LLM-polished summaries (external CLI or local model), run on the extract rather than the raw transcript and cached.
18. Global hotkey to open the popover with search focused.
19. Full-text transcript search with an index.
20. The same core exposed as a CLI and a Claude Code `/sessions` command.

## 8. Stale detection rules

A session is flagged stale if it matches any enabled rule. Users can toggle rules and adjust the thresholds.

- No activity for N days (default 30).
- Trivial: fewer than N messages (default 3) and no file edits.
- Project folder no longer exists.
- Git branch merged or deleted (P2).
- Generated by the app's own summarizer runs (always hidden).

Pinned sessions and running sessions are never flagged.

## 9. Resume behaviour

| Session origin | Resume in terminal | Fallback |
|---|---|---|
| Claude Code CLI / IDE | Native `--resume` | — |
| Claude desktop Code tab | Try native; verify per version | Continue in… (handoff) |
| Codex CLI / IDE / desktop | Native `codex resume` | Continue in… (handoff) |
| Project folder missing | Disabled | Copy summary |

Resume always starts in the session's original project folder.

## 10. Archive and delete

> **As shipped in P1:** archive is hide-only. It is a list in the app's `app-state.json`; transcripts are never moved or deleted, and Restore just removes the id. The file-moving design below is kept for reference and is not planned.

- **Archive** moves the session's files into the app's archive folder, along with related per-session files where known. The entry disappears from the tool's own picker.
- **Restore** moves files back exactly as they were.
- **Permanent removal** happens only after the retention period (default 30 days), or by explicit "empty archive".
- **Codex:** the app never edits the state database directly. Archive goes through Codex's own mechanism; if that's unavailable, the action is hidden.
- Running sessions can't be archived.

## 11. Summary design

| Tier | Source | Cost | Default |
|---|---|---|---|
| 1 | Tool's own latest compaction summary | Free | On |
| 2 | Structured extract: goal, last request, files touched, branch, last answer, open TODOs | Free, instant | On |
| 3 | LLM rewrite of the tier 1+2 output | Model call | Off |

Output is a single handoff block ready to paste into any agent, with a header naming the source tool, session ID, and project. Summaries are cached and refreshed when the session changes.

## 12. Risks

- **Undocumented formats.** Both tools change their storage without notice. Mitigation: per-adapter version detection, a fail-soft display, and fixture tests per tool version.
- **Desktop session resume** may not work in terminals; handoff covers this.
- **Live status accuracy:** file-based detection is approximate; precise status needs agent hooks, which must be opt-in.
- **Summarizer clutter:** headless agent calls create their own sessions. The app must tag and hide or remove them.
- **Privacy:** transcripts can contain secrets. Nothing is sent anywhere unless an external summarizer is explicitly enabled, and the user is told what will be sent.

## 13. Open questions

- Should rename write back to the tool (so the name shows in `/resume`) or stay app-only?
- Include other agents later (Gemini CLI, OpenCode), or stay focused on two?
- Does live status justify installing hooks into the user's agent config?

## 14. References

### 14.1 Existing tools to study

**Session browsers and tray apps**

| Tool | Platform | Worth studying for |
|---|---|---|
| [Agent Sessions](https://github.com/jazzyalex/agent-sessions) | macOS | Closest to this plan. One list across many agents, "Copy Resume Command", a choice of terminal (Terminal / iTerm2 / Warp), and browse-only handling of sessions that can't be resumed. Shows how to scope per-agent support honestly ("maintained" vs "steward wanted"). |
| [agent-sessions-menubar](https://github.com/konaito/agent-sessions-menubar) | macOS | Minimal scope done well: 10 recent sessions per tool side by side, click to copy the resume command, never writes to `~/.claude` or `~/.codex`. A good P0 reference. |
| [Session Bar](https://github.com/aadilkadiwal/claude-session-bar) | macOS | Live status from `~/.claude/sessions/<pid>.json` and `claude agents --json`, polled cheaply. Retention via Claude's own `cleanupPeriodDays` instead of custom deletion. No server, every action runs through the normal `claude` CLI. |
| [Lunopeak](https://github.com/idevtim/lunopeak) | macOS / Windows / Linux | Cross-platform desktop app: live view that matches each process to its transcript, session history, replay, per-session cost. |
| [cc-cockpit](https://pypi.org/project/cc-cockpit/) | Linux | Tray app that keeps the tray menu as a quick glance and moves detail into a dashboard. Detects multiple Claude config dirs (accounts) and reports what it found rather than guessing. |
| [persistent-claude-code](https://github.com/seulsale/persistent-claude-code) | Linux (GTK) | Project-grouped sidebar, resume in an embedded terminal, live status dots (working / waiting / idle). |
| [Claude Statistics](https://github.com/sj719045032/claude-statistics/wiki) | macOS | Multi-provider menu bar (Claude / Codex / Gemini) with active sessions grouped by project and live state. |
| [Code Bar](https://github.com/For-Tr/Code-Bar) | macOS / Windows | Session launcher with a git worktree per session; useful for the git-awareness feature. |

**Search and export**

| Tool | Worth studying for |
|---|---|
| [search-sessions](https://github.com/sinzin91/search-sessions) | Two-tier search: an instant metadata index plus an optional deep transcript search. Every result prints a ready-to-run resume command. |
| [session-browser](https://github.com/giannimassi/session-browser) | Read-only design: indexes transcripts into its own SQLite FTS5 database in a cache folder, which can be deleted and rebuilt at any time. |
| [claude-code-log](https://github.com/daaain/claude-code-log/wiki) | TUI across all projects; one key resumes the selected session. HTML/Markdown export of transcripts. |
| [Codex-Usage](https://github.com/Yves-alain/Codex-Usage) | Reading Codex rollouts and enriching them from `state_5.sqlite`. Small parser tested against fixture files because the format may change. |

**Migration and handoff**

| Tool | Worth studying for |
|---|---|
| [session-migrate](https://github.com/xhluca/session-migrate) | Exact migration between many agents into native, resumable sessions; never modifies the source. The candidate for the optional "exact migration" action. |
| [ai-sessions](https://pypi.org/project/ai-sessions/3.1.5/) | Linux and native Windows. When bridging a session to another tool, it starts from the latest compaction summary instead of the full transcript, which is the same idea as the handoff summary here. |
| [session-porter](https://github.com/liwala/session-porter/wiki) | Claude ↔ Codex transfer; documents both on-disk formats and registers transferred sessions in Codex's database. |
| [codex-claude-transfer](https://github.com/ahmojo/codex-claude-transfer/wiki) | Safe file moves: writes the new file first, removes the original only afterward, and has an undo command. A good pattern for archive/restore. |

### 14.2 Best practices drawn from these tools

1. **Never write to the agents' stores.** Almost every well-regarded tool is explicitly read-only and keeps its own index or cache elsewhere.
2. **Make your own index disposable.** If it's deleted, it should rebuild from the source files.
3. **Run actions through the official CLI** (`claude --resume`, `codex resume`) instead of reimplementing what they do.
4. **Prefer the tool's own settings** (such as `cleanupPeriodDays`) over custom cleanup logic.
5. **Always show the exact command** next to any one-click action, so users can fall back when a terminal launch fails.
6. **Test parsers against fixture files per tool version**, and fail soft on unknown records.
7. **Write new, then remove old, and keep an undo** for any file move.
8. **Poll cheaply.** Watch small status files frequently and run heavier checks only while the UI is open.
9. **Be honest about support levels** per agent and per surface, including what can't be resumed.

### 14.3 Official docs and known issues

- [Claude Code: manage sessions](https://code.claude.com/docs/en/sessions): resume, picker, naming, storage location, `CLAUDE_CONFIG_DIR`.
- Claude desktop / CLI session split: [#22723](https://github.com/anthropics/claude-code/issues/22723) (CLI sessions missing in desktop), [#32992](https://github.com/anthropics/claude-code/issues/32992) (desktop sessions can't be resumed in CLI), [#69585](https://github.com/anthropics/claude-code/issues/69585) (desktop history missing after machine move), [#67118](https://github.com/anthropics/claude-code/issues/67118) (Windows desktop sidebar history).
- Claude feature requests this app answers: [#31564](https://github.com/anthropics/claude-code/issues/31564) (token metadata in `/resume`), [#26249](https://github.com/anthropics/claude-code/issues/26249) (rename not searchable).
- Codex state database pitfalls: [#20944](https://github.com/openai/codex/issues/20944) (missing `threads` row breaks resume), [#25084](https://github.com/openai/codex/issues/25084) (desktop sidebar hides threads that exist locally).
