# Phase 3 — Distribution Design Spec
**Date:** 2026-04-20
**Status:** Approved
**Phase:** 3 (Distribution)

---

## 1. Goal

Zero-friction local setup. A user goes from nothing to a working dashboard in under 2 minutes with no terminal required.

**What it replaces for end users:**
- `git clone` + `npm install` + `npm run dev`
- Manually editing `~/.claude/settings.json`
- Remembering to start the server before using Claude Code

**What it does not replace for contributors:**
- `npm run dev` stays exactly as-is
- `npm run dev:desktop` adds the Electron tray on top of the existing dev setup

---

## 2. Scope

**In scope:**
- Electron tray app that bundles server + client
- First-run hooks installer (patches `~/.claude/settings.json`)
- GitHub Actions CI that builds and publishes installers on version tag
- Auto-update via `electron-updater`

**Out of scope:**
- Accounts, cloud relay, remote agents (Phase 4)
- New dashboard features
- Code signing / notarization (deferred — users see a one-time OS security warning but can proceed)

---

## 3. Architecture

```
electron-builder distributable
  └── Electron main process (desktop/src/main.ts)
        ├── Spawns: server/dist (compiled Express + ws) on port 7777
        ├── Express also serves: client/dist (static React build)
        ├── System tray: icon + menu
        └── First run: patches ~/.claude/settings.json with hooks
```

- **Single port (7777)** — Express serves both the API/WebSocket and the compiled React client as static files. No Vite in production.
- **Server as sidecar** — Electron spawns the compiled server via `child_process`. Server can still run standalone without Electron.
- **No BrowserWindow** — tray only. "Open Dashboard" opens `localhost:7777` in the user's default browser.
- **Port pool** — on startup the server tries ports 7777–7786 (10 ports) in order and binds to the first free one. The tray and "Open Dashboard" use whichever port was claimed. If all 10 are occupied, the tray shows an error state with a "Retry" option.
- **`desktop/` workspace** — Electron + electron-builder live here, isolated from server/client.

---

## 4. Project Structure

```
the-office/
├── package.json                   # add "desktop" to workspaces
├── server/                        # unchanged
├── client/                        # unchanged
└── desktop/
    ├── package.json               # electron, electron-builder, electron-updater
    ├── electron-builder.yml       # packaging config (mac/win/linux)
    └── src/
        ├── main.ts                # tray setup, spawn server, open browser, auto-update check
        └── installer.ts          # read/patch ~/.claude/settings.json
```

---

## 5. Dev Scripts

Added to root `package.json`:

| Command | What it does |
|---|---|
| `npm run dev` | Existing — unchanged (Vite + Express, no Electron) |
| `npm run dev:desktop` | Electron tray in dev mode, pointing at Vite `:5173` |
| `npm run build` | Compile server (tsc) + client (vite build) |
| `npm run package` | electron-builder → distributable in `dist/` |

---

## 6. Tray Menu

```
The Office  (v1.2.3)
──────────────────
Open Dashboard
Configure hooks
──────────────────
Quit
```

- **Open Dashboard** — opens `localhost:7777` in the default browser
- **Configure hooks** — re-runs the hooks installer (useful if skipped on first run or hooks were removed)

---

## 7. First-Run Hooks Installer

On first launch, a native dialog asks:

> *"The Office needs to add hooks to ~/.claude/settings.json to receive Claude Code events. Allow?"*

| Response | Behaviour |
|---|---|
| Yes | Patch `~/.claude/settings.json`, never ask again |
| No | Tray works, user can trigger later via "Configure hooks" |
| Hooks already present | Skip silently |

`installer.ts` reads the existing file (or creates it), merges the hook entries non-destructively, and writes it back. Existing settings are preserved.

---

## 8. Versioning & Release

**Version bump workflow:**
```bash
npm version patch     # or minor / major
                      # bumps package.json, commits, creates git tag
git push && git push --tags   # tag push triggers CI
```

`npm version` keeps `package.json` and the git tag in sync atomically.

---

## 9. GitHub Actions CI

Trigger: `push: tags: ['v*']`

```
jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - checkout
      - setup Node
      - npm install
      - npm run build           # compile server + client
      - electron-builder        # package for current platform
      - upload to GitHub Release # includes latest.yml for auto-update
```

Each platform builds on its own runner (macOS installer requires macOS runner, etc.). electron-builder publishes installers + `latest.yml` to the GitHub Release created from the tag.

**No code signing.** Users see a one-time OS security warning (macOS Gatekeeper, Windows SmartScreen) but can proceed. Acceptable for an open source dev tool.

---

## 10. Auto-Update

`electron-updater` checks for a newer GitHub Release on app start. If found, it prompts the user and applies the update in the background. This works automatically once CI publishes `latest.yml` alongside the installers.

---

## 11. Success Criteria

- [ ] Download installer → double-click → tray icon appears, no terminal needed
- [ ] First-run dialog asks permission before touching `~/.claude/settings.json`
- [ ] "Open Dashboard" opens `localhost:7777` in browser with full working UI
- [ ] `npm run dev` is unaffected — contributor workflow unchanged
- [ ] `npm run dev:desktop` starts Electron tray pointing at Vite dev server
- [ ] `npm version patch && git push --tags` triggers CI and produces installers for mac/win/linux
- [ ] Auto-update prompt appears when a newer release exists
- [ ] If port 7777 is taken, app automatically tries 7778–7786 and binds to the first free port
- [ ] If all 10 ports are occupied, tray shows an error state with a "Retry" option

---

## 12. Phase 4 Preview (out of scope here)

Phase 4 adds a cloud relay (Supabase Realtime) + Vercel-hosted client + user accounts. The tray app gets extended — not replaced — to optionally connect the local server to the relay. The `desktop/` workspace is designed to absorb this without touching server/ or client/.
