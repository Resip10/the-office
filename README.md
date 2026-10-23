# Session Tray

**Every local Claude Code session, one click away.** A small tray app that lists your sessions across all projects, shows what each one was about, and gets you back into any of them: resume it, or continue it in a fresh session with a handoff summary.

---

## What it does

- **All sessions, one list.** Every Claude Code transcript in `~/.claude/projects`, from the CLI, IDE extensions and the desktop app, grouped into Running, Pinned and Recent.
- **Live status without setup.** Running, idle and waiting sessions come from Claude Code's own `~/.claude/sessions` files. No hooks, no server, no settings changes.
- **Waiting for input.** A session that needs you shows why ("waiting · input needed"), sorts to the top, and puts a dot on the tray icon (a count on macOS). Optional silent notifications after 1, 5, 15 or 30 minutes of waiting; off by default.
- **Overview line and context.** Running rows show how full their context is ("25% ctx"). An overview line in the popover and window shows what you pick in Settings → Overview: running and waiting counts, ≈ cost today or this week, sessions today.
- **Data from your Claude Code status line (optional).** Claude Code passes some things only to its status line: plan limits ("5h 11% · resets 2h 14m"), and per session: effort, thinking and whatever your status line prints. Settings → Overview → **Connect status line** makes this available with one click. Plan limits (account-wide) show in the overview line, in their own group marked `>_`; each session's own status line text, effort and thinking show quietly in its details, with the same mark. Connect changes one setting in `~/.claude/settings.json`: your status line command also saves a copy of its data into Session Tray's folder. It keeps working and looks the same, nothing is sent anywhere, and **Disconnect** restores the original. On Windows it needs Git Bash.
- **Useful rows.** Title (your rename, your `/rename`, Claude's auto-title, or the first prompt), project, git branch, last activity, message count.
- **Session details.** In the window you get:
  - messages, context used, ≈ API cost and active time
  - a **handoff summary** (Claude Code's compaction summary or recap when there is one, otherwise the goal, last request, files touched, branch and last answer)
  - a **peek** at the last messages, with tool calls hidden unless you switch them on
  - PR links
- **One click back to work.**
  - **Resume** opens a terminal in the project folder running `claude --resume <id>`.
  - **Copy** puts that command on the clipboard.
  - **Continue in…** starts a new Claude Code session in the same folder with the handoff (which you can edit) as its first message. It also works for sessions that can't be resumed.
- **Search and filters.** By title, project, branch or prompt; Today / 7 days / 30 days / All; by project; running only.
- **Pins and rename.** Keep the sessions you come back to at the top, and give any session your own name.
- **Cleanup.** Flags stale sessions:
  - no activity for 30 days
  - fewer than 3 messages and no file edits
  - project folder gone

  Archive them in bulk, or restore them later. Archive only hides sessions in the app; transcripts are never moved or deleted. Pinned and running sessions are never flagged.
- **Themes and settings.** Five themes: Carbon (default), Graphite, Midnight, Ink and Paper (light). Paper can follow your system's light mode. The Settings window also has row density, the terminal used for Resume, cleanup rules, waiting notifications and launch at login.

"≈ API cost" is Claude Code's own estimate at API prices. On a Pro or Max subscription you are not billed this amount.

## Download

Grab the latest installer from [Releases](https://github.com/Resip10/the-office/releases) (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`).

The app lives in your system tray:
- **Left-click:** the session list.
- **Right-click:** Open window, Settings… and Quit.

Updates install in the background.

### Upgrading from The Office

Older versions added `curl … localhost:7777` hooks to `~/.claude/settings.json`. They are no longer needed. The app shows a banner (and a tray menu item) to remove them; only those exact hooks are removed, your other hooks stay.

## Resume and Continue

| Platform | What runs |
|---|---|
| Windows with Windows Terminal | `wt.exe -d <project> powershell.exe -NoExit …` |
| Windows without it, or Settings → Terminal → PowerShell | a PowerShell window in the project folder |
| macOS | Terminal.app via `osascript` |

- **Resume** runs `claude --resume <id>`. It is disabled when the project folder no longer exists; Copy still works.
- **Continue in…** writes the handoff to a file in the app's data folder (deleted after 7 days) and passes its contents to `claude` as the first message.
  - On Windows this goes through an encoded PowerShell script, so quotes and newlines survive.
  - npm installs of Claude Code are started through `node` directly, because the `claude.cmd` shim cuts arguments at newlines.
  - If the project folder is gone, you pick another one.

## Development

```bash
git clone https://github.com/Resip10/the-office.git
cd the-office
npm install
npm run dev          # Vite :5173 + Electron tray app
npm test -w desktop  # Jest: parser, scanner, details, continue, stale rules, app state
npm test -w client   # Vitest: list logic, themes, views
npm run package      # build + installer in desktop/dist-electron
```

Quit the installed Session Tray before `npm run dev`: only one copy can run at a time.

## Architecture

```
~/.claude/projects/<project>/<uuid>.jsonl ─┐
~/.claude/sessions/<pid>.json ─────────────┤→ Electron main: scan (cached by mtime/size), live status every 2 s,
                                           │   session details on demand
                                           │        │ IPC
                                           └────────▼
                                 React renderer: tray popover, window, settings
```

The app only reads `~/.claude`, except on an explicit click: removing the old The Office hooks, and Connect/Disconnect of the status line. Its own data lives in the app's user-data folder and can be deleted at any time:
- `app-state.json`: pins, names, archive, settings, and the original status line while connected
- `index-v2.json`: the scan cache
- `handoffs/`: Continue prompt files
- `statusline/`: what the connected status line last received and printed

## Roadmap

- **v1 (done):** list, metadata, search and filters, copy and resume, pins
- **P1 (done):** redesign and themes, handoff summary, Continue in…, stale-session cleanup and archive, message peek, rename, settings
- **P2 (in progress):** waiting-for-input badge and notifications, overview line with status line data and context % (done); next: git hints, tags and notes
- **Ideas:** active subagents per session; a read-only snapshot of installed MCP servers and plugins
- **Later:** Codex sessions, LLM summaries, global hotkey, full-text search

Design: [v1 spec](docs/superpowers/specs/2026-10-18-session-tray-design.md) · [P1 spec](docs/superpowers/specs/2026-10-22-p1-design.md)
