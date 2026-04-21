# Phase 3: Electron Distribution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a downloadable Electron tray app that bundles the server + client so users go from nothing to a working dashboard by double-clicking an installer.

**Architecture:** Electron main process spawns the compiled Express server as a child process. The server serves the compiled React client as static files. The tray menu opens `localhost:<port>` in the user's default browser. In dev mode (`!app.isPackaged`), server spawning is skipped and the tray opens Vite at `:5173` instead.

**Tech Stack:** Electron 33, electron-builder 25, electron-updater 6, ts-jest (desktop tests), GitHub Actions (matrix CI on tag push)

---

## File Map

**New files:**
- `desktop/package.json` — Electron workspace: deps, scripts, jest config pointer
- `desktop/tsconfig.json` — TS config targeting Node/commonjs (same pattern as server)
- `desktop/jest.config.cjs` — ts-jest config for desktop unit tests
- `desktop/electron-builder.yml` — packaging config for mac/win/linux
- `desktop/src/main.ts` — tray setup, server spawn, browser open, first-run dialog
- `desktop/src/installer.ts` — read/patch `~/.claude/settings.json` non-destructively
- `desktop/src/__tests__/installer.test.ts` — unit tests for installer
- `server/src/port-pool.ts` — `findFreePort(start, count)` extracted for testability
- `server/src/__tests__/port-pool.test.ts` — unit tests for port pool
- `.github/workflows/release.yml` — CI: build + publish installers on `v*` tag

**Modified files:**
- `package.json` (root) — add `"desktop"` to workspaces; add `dev:desktop`, `package` scripts
- `server/src/index.ts` — use `findFreePort`, serve static files when `SERVE_STATIC` is set, print `OFFICE_PORT:<n>` to stdout after binding

---

## Task 1: desktop/ workspace scaffold ✅

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/tsconfig.json`
- Create: `desktop/jest.config.cjs`
- Create: `desktop/electron-builder.yml`
- Modify: `package.json` (root)

- [x] **Step 1: Write `desktop/package.json`**

```json
{
  "name": "the-office-desktop",
  "version": "0.1.0",
  "private": true,
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "package": "electron-builder",
    "test": "jest"
  },
  "dependencies": {
    "electron-updater": "^6.3.9"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.5",
    "electron": "^33.0.0",
    "electron-builder": "^25.0.5",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "typescript": "^5.3.3"
  }
}
```

- [x] **Step 2: Write `desktop/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [x] **Step 3: Write `desktop/jest.config.cjs`**

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
}
```

- [x] **Step 4: Write `desktop/electron-builder.yml`**

```yaml
appId: com.the-office.app
productName: The Office
directories:
  output: dist-electron
files:
  - desktop/dist/**
  - server/dist/**
  - client/dist/**
  - package.json
extraMetadata:
  main: desktop/dist/main.js
mac:
  category: public.app-category.developer-tools
  target: dmg
win:
  target: nsis
linux:
  target: AppImage
publish:
  provider: github
  owner: Resip10
  repo: the-office
```

- [x] **Step 5: Add `desktop` workspace + new scripts to root `package.json`**

Replace the root `package.json` with:

```json
{
  "name": "the-office",
  "private": true,
  "workspaces": ["server", "client", "desktop"],
  "scripts": {
    "dev": "concurrently -n server,client -c cyan,magenta \"npm run dev -w server\" \"npm run dev -w client\"",
    "dev:desktop": "npm run build -w desktop && electron desktop/dist/main.js",
    "build": "npm run build -w server && npm run build -w client",
    "package": "npm run build && npm run package -w desktop"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [x] **Step 6: Install dependencies**

```bash
npm install
```

Expected: installs Electron (~100MB), electron-builder, electron-updater into `desktop/node_modules` (hoisted to root). No errors.

- [x] **Step 7: Commit**

```bash
git add desktop/package.json desktop/tsconfig.json desktop/jest.config.cjs desktop/electron-builder.yml package.json package-lock.json
git commit -m "feat(desktop): scaffold Electron workspace with builder config"
```

---

## Task 2: Port pool + server static serving ✅

**Files:**
- Create: `server/src/port-pool.ts`
- Create: `server/src/__tests__/port-pool.test.ts`
- Modify: `server/src/index.ts`

- [x] **Step 1: Write the failing test**

- [x] **Step 2: Run test — verify it fails**

- [x] **Step 3: Write `server/src/port-pool.ts`**

- [x] **Step 4: Run test — verify it passes**

3/3 passing.

- [x] **Step 5: Update `server/src/index.ts`**

- [x] **Step 6: Run all server tests to verify nothing broke**

22/22 passing (19 existing + 3 new).

- [x] **Step 7: Smoke-test server still starts**

- [x] **Step 8: Commit**

```bash
git commit -m "feat(server): extract port pool, serve static files in prod, announce bound port"
```

---

## Task 3: installer.ts + tests

**Files:**
- Create: `desktop/src/installer.ts`
- Create: `desktop/src/__tests__/installer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `desktop/src/__tests__/installer.test.ts`:

```typescript
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { installHooks, hasHooks } from '../installer'

const HOOK_EVENTS = [
  'SessionStart', 'SessionEnd', 'SubagentStart', 'SubagentStop',
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Stop', 'Notification',
]

let tmpDir: string
let settingsPath: string

beforeEach(() => {
  tmpDir = join(tmpdir(), `installer-test-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
  settingsPath = join(tmpDir, 'settings.json')
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('installHooks', () => {
  it('creates settings.json with all hook events when file does not exist', () => {
    const result = installHooks(settingsPath)
    expect(result).toBe(true)
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    for (const event of HOOK_EVENTS) {
      expect(settings.hooks[event]).toBeDefined()
      expect(settings.hooks[event][0].hooks[0].type).toBe('command')
    }
  })

  it('adds hooks to existing settings without disturbing other fields', () => {
    writeFileSync(settingsPath, JSON.stringify({ theme: 'dark', someOtherKey: 42 }, null, 2))
    installHooks(settingsPath)
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    expect(settings.theme).toBe('dark')
    expect(settings.someOtherKey).toBe(42)
    expect(settings.hooks.SessionStart).toBeDefined()
  })

  it('is idempotent — calling twice does not duplicate or overwrite hooks', () => {
    installHooks(settingsPath)
    const first = readFileSync(settingsPath, 'utf8')
    installHooks(settingsPath)
    const second = readFileSync(settingsPath, 'utf8')
    expect(first).toBe(second)
  })

  it('returns false when the settings file contains invalid JSON', () => {
    writeFileSync(settingsPath, 'not valid json')
    const result = installHooks(settingsPath)
    expect(result).toBe(false)
  })
})

describe('hasHooks', () => {
  it('returns false when file does not exist', () => {
    expect(hasHooks(settingsPath)).toBe(false)
  })

  it('returns false when hooks are not configured', () => {
    writeFileSync(settingsPath, JSON.stringify({ theme: 'dark' }, null, 2))
    expect(hasHooks(settingsPath)).toBe(false)
  })

  it('returns true after installHooks has run', () => {
    installHooks(settingsPath)
    expect(hasHooks(settingsPath)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -w desktop
```

Expected: FAIL — `Cannot find module '../installer'`

- [ ] **Step 3: Write `desktop/src/installer.ts`**

```typescript
import { readFileSync, writeFileSync, existsSync } from 'fs'

const HOOK_COMMAND =
  "curl -s -X POST http://localhost:7777/api/events -H 'Content-Type: application/json' -d @- 2>/dev/null || true"

const HOOK_EVENTS = [
  'SessionStart', 'SessionEnd', 'SubagentStart', 'SubagentStop',
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Stop', 'Notification',
]

interface ClaudeSettings {
  hooks?: Record<string, Array<{ hooks: Array<{ type: string; command: string }> }>>
  [key: string]: unknown
}

export function installHooks(settingsPath: string): boolean {
  let settings: ClaudeSettings = {}

  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as ClaudeSettings
    } catch {
      return false
    }
  }

  if (!settings.hooks) settings.hooks = {}

  let changed = false
  for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) {
      settings.hooks[event] = [{ hooks: [{ type: 'command', command: HOOK_COMMAND }] }]
      changed = true
    }
  }

  if (changed) {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  }
  return true
}

export function hasHooks(settingsPath: string): boolean {
  if (!existsSync(settingsPath)) return false
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as ClaudeSettings
    return Boolean(settings.hooks?.SessionStart)
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -w desktop
```

Expected: PASS — 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add desktop/src/installer.ts desktop/src/__tests__/installer.test.ts
git commit -m "feat(desktop): add hooks installer with idempotent patch + hasHooks check"
```

---

## Task 4: main.ts — tray, server spawn, first-run dialog, open browser

**Files:**
- Create: `desktop/src/main.ts`

No unit tests — Electron APIs require a running Electron process. Manual verification in Step 3.

- [ ] **Step 1: Write `desktop/src/main.ts`**

```typescript
import { app, Tray, Menu, nativeImage, dialog, shell } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { homedir } from 'os'
import { installHooks, hasHooks } from './installer'

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json')

let tray: Tray | null = null
let serverProcess: ChildProcess | null = null
let boundPort: number | null = null

function getServerScriptPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'server', 'dist', 'index.js')
  }
  return join(__dirname, '..', '..', 'server', 'dist', 'index.js')
}

function getClientDistPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'client', 'dist')
  }
  return join(__dirname, '..', '..', 'client', 'dist')
}

function getDashboardUrl(): string {
  if (!app.isPackaged) return 'http://localhost:5173'
  return boundPort ? `http://localhost:${boundPort}` : ''
}

function buildMenu(port: number | null, error?: string): Menu {
  const version = app.getVersion()
  const items: Electron.MenuItemConstructorOptions[] = [
    { label: `The Office (v${version})`, enabled: false },
    { type: 'separator' },
  ]

  if (error) {
    items.push({ label: `Error: ${error}`, enabled: false })
    items.push({ label: 'Retry', click: () => startServer() })
  } else {
    items.push({
      label: 'Open Dashboard',
      enabled: port !== null || !app.isPackaged,
      click: () => { const url = getDashboardUrl(); if (url) shell.openExternal(url) },
    })
  }

  items.push(
    { label: 'Configure hooks', click: () => promptInstall() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  )

  return Menu.buildFromTemplate(items)
}

function setTrayState(port: number | null, error?: string) {
  if (!tray) return
  const tooltip = error
    ? `The Office — error: ${error}`
    : port
      ? `The Office — running on :${port}`
      : 'The Office — starting…'
  tray.setToolTip(tooltip)
  tray.setContextMenu(buildMenu(port, error))
}

async function promptInstall() {
  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Allow', 'Not now'],
    defaultId: 0,
    title: 'Configure Claude Code hooks',
    message:
      'The Office needs to add hooks to ~/.claude/settings.json to receive Claude Code events. Allow?',
  })
  if (response === 0) {
    installHooks(SETTINGS_PATH)
  }
}

function spawnServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const clientDist = getClientDistPath()
    serverProcess = spawn(process.execPath, [getServerScriptPath()], {
      env: { ...process.env, SERVE_STATIC: clientDist },
    })

    let resolved = false

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString()
      const portMatch = text.match(/OFFICE_PORT:(\d+)/)
      const errMatch = text.match(/OFFICE_PORT_ERROR:(.+)/)
      if (portMatch && !resolved) {
        resolved = true
        resolve(parseInt(portMatch[1], 10))
      } else if (errMatch && !resolved) {
        resolved = true
        reject(new Error(errMatch[1].trim()))
      }
    })

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[server]', data.toString())
    })

    serverProcess.on('error', (err) => { if (!resolved) { resolved = true; reject(err) } })
    serverProcess.on('exit', (code) => {
      if (!resolved && code !== 0) {
        resolved = true
        reject(new Error(`Server exited with code ${code}`))
      }
    })

    setTimeout(() => {
      if (!resolved) { resolved = true; reject(new Error('startup timeout')) }
    }, 15000)
  })
}

async function startServer() {
  setTrayState(null)
  try {
    const port = await spawnServer()
    boundPort = port
    setTrayState(port)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    setTrayState(null, msg)
  }
}

async function main() {
  await app.whenReady()

  // Tray icon: empty placeholder — replace desktop/assets/icon.png with a real 32x32 PNG.
  const iconPath = join(__dirname, '..', 'assets', 'icon.png')
  const icon = nativeImage.createFromPath(iconPath).isEmpty()
    ? nativeImage.createEmpty()
    : nativeImage.createFromPath(iconPath)

  tray = new Tray(icon)
  setTrayState(null)

  if (!hasHooks(SETTINGS_PATH)) {
    promptInstall()
  }

  if (app.isPackaged) {
    await startServer()
  } else {
    // Dev mode: dashboard is served by Vite at :5173; no server spawn needed.
    setTrayState(1, undefined) // sentinel so "Open Dashboard" is enabled
    boundPort = null
    tray.setContextMenu(buildMenu(1))
  }
}

app.on('window-all-closed', () => {
  // Keep app running as tray-only — do not quit on window close.
})

app.on('before-quit', () => {
  serverProcess?.kill()
})

main()
```

- [ ] **Step 2: Create placeholder icon directory**

```bash
mkdir -p desktop/assets
```

Create `desktop/assets/.gitkeep` (empty file) so git tracks the directory. The icon.png is optional — the app falls back to an empty image in dev. For real distribution, place a 32×32 PNG at `desktop/assets/icon.png`.

- [ ] **Step 3: Compile desktop workspace**

```bash
npm run build -w desktop
```

Expected: `desktop/dist/main.js` and `desktop/dist/installer.js` created. No TypeScript errors.

- [ ] **Step 4: Manually verify tray in dev mode**

First, make sure the server is built (needed for dev:desktop):

```bash
npm run build -w server
```

Then:

```bash
npm run dev:desktop
```

Expected: Electron launches, a tray icon appears (may be invisible on dark taskbar — right-click the system tray area). Right-clicking shows the menu with "Open Dashboard" and "Quit". "Open Dashboard" opens `http://localhost:5173` in browser (Vite must be running separately). Quit kills Electron.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main.ts desktop/assets/.gitkeep
git commit -m "feat(desktop): add tray app with server spawn, first-run dialog, dev/prod mode switch"
```

---

## Task 5: Auto-update

**Files:**
- Modify: `desktop/src/main.ts` — add `autoUpdater` call

Auto-update only works in production (packaged) builds. In dev mode, `electron-updater` is a no-op when `app.isPackaged` is false.

- [ ] **Step 1: Add auto-update import and call to `desktop/src/main.ts`**

Add the import at the top of the file (after the existing imports):

```typescript
import { autoUpdater } from 'electron-updater'
```

Inside the `main()` function, after `startServer()` succeeds in the packaged branch, add:

```typescript
    autoUpdater.checkForUpdatesAndNotify()
```

The relevant section in `main()` changes from:

```typescript
  if (app.isPackaged) {
    await startServer()
  } else {
```

to:

```typescript
  if (app.isPackaged) {
    await startServer()
    autoUpdater.checkForUpdatesAndNotify()
  } else {
```

- [ ] **Step 2: Compile and verify no TS errors**

```bash
npm run build -w desktop
```

Expected: compiles cleanly — `electron-updater` types are already available since it's in `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/main.ts
git commit -m "feat(desktop): add auto-update check on startup via electron-updater"
```

---

## Task 6: GitHub Actions CI — release pipeline

**Files:**
- Create: `.github/workflows/release.yml`

Trigger: push of a `v*` tag (e.g. `v0.2.0`). Builds on all three platforms, publishes installers + `latest.yml` to GitHub Release.

- [ ] **Step 1: Create `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Build server + client
        run: npm run build

      - name: Build desktop (compile TS)
        run: npm run build -w desktop

      - name: Package with electron-builder
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run package -w desktop
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add GitHub Actions release pipeline for Electron installers on v* tags"
```

- [ ] **Step 3: Verify CI config is valid (optional local lint)**

```bash
npx action-validator .github/workflows/release.yml
```

If `action-validator` is not installed globally, skip this step — the CI will surface any YAML errors on the first push.

---

## Success criteria checklist (from spec §11)

- [ ] `npm run dev` is unaffected — verify `npm run dev` still starts server + Vite with no errors
- [ ] `npm run dev:desktop` starts Electron tray pointing at Vite `:5173`
- [ ] All server tests pass: `npm test -w server`
- [ ] All desktop tests pass: `npm test -w desktop`
- [ ] `npm version patch && git push --tags` triggers CI (verify after Task 6 is merged)
- [ ] Tray "Open Dashboard" opens the dashboard in browser
- [ ] First-run dialog appears when `~/.claude/settings.json` has no hooks
- [ ] Port fallback: if 7777 is occupied, server binds 7778 (covered by port-pool tests)
- [ ] All-ports-occupied: tray shows error state with Retry option (manual test)
