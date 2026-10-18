# Session Tray

**Every local Claude Code session, one click away.** A small tray app that lists your sessions across all projects, shows what each one was about, and resumes any of them in a terminal.

---

## What it does

- **All sessions, one list.** Every Claude Code transcript in `~/.claude/projects`, from the CLI, IDE extensions and the desktop app, grouped into Running, Pinned and Recent.
- **Live status without setup.** Running and idle sessions come from Claude Code's own `~/.claude/sessions` files. No hooks, no server, no settings changes.
- **Useful rows.** Title (your `/rename`, Claude's auto-title, or the first prompt), project, git branch, last activity, message count. The window adds model, context size, ≈ API cost, PR links, the last prompt and Claude's recap.
- **One click back to work.** Resume opens a terminal in the project folder running `claude --resume <id>`, or copy the command to run it yourself.
- **Search and filters.** By title, project, branch or prompt; Today / 7 days / 30 days / All; by project; running only.
- **Pins.** Keep the sessions you come back to at the top.

"≈ API cost" is Claude Code's own estimate at API prices. On a Pro or Max subscription you are not billed this amount.

## Download

Grab the latest installer from [Releases](https://github.com/Resip10/the-office/releases) (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`).

The app lives in your system tray: left-click for the session list, right-click for Open window, Launch at login and Quit. Updates install in the background.

### Upgrading from The Office

Older versions added `curl … localhost:7777` hooks to `~/.claude/settings.json`. They are no longer needed. The app shows a banner (and a tray menu item) to remove them; only those exact hooks are removed, your other hooks stay.

## Resume

| Platform | What Resume runs |
|---|---|
| Windows with Windows Terminal | `wt.exe -d <project> powershell.exe -NoExit -Command "claude --resume <id>"` |
| Windows without it | a PowerShell window in the project folder |
| macOS | Terminal.app via `osascript` |

Resume is disabled when the project folder no longer exists; Copy still works.

## Development

```bash
git clone https://github.com/Resip10/the-office.git
cd the-office
npm install
npm run dev          # Vite :5173 + Electron tray app
npm test -w desktop  # Jest — transcript parser, scanner, live status, commands
npm test -w client   # Vitest — list logic and views
npm run package      # build + installer in desktop/dist-electron
```

## Architecture

```
~/.claude/projects/<project>/<uuid>.jsonl ─┐
~/.claude/sessions/<pid>.json ─────────────┤→ Electron main: scan (cached by mtime/size), live status every 2 s
                                           │        │ IPC
                                           └────────▼
                                 React renderer: tray popover + window
```

The app only reads `~/.claude`. Its own data (pins, the scan cache) lives in the app's user-data folder and can be deleted at any time.

## Roadmap

- **v1 (done):** list, metadata, search and filters, copy and resume, pins
- **Next:** handoff summary and "Continue in…", stale-session cleanup, message peek, rename
- **Later:** waiting-for-input badge, git hints, cost totals, Codex sessions, global hotkey

Design: [`docs/superpowers/specs/2026-10-18-session-tray-design.md`](docs/superpowers/specs/2026-10-18-session-tray-design.md)
