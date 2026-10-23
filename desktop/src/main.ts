import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, nativeTheme, Notification, screen, shell, Tray } from 'electron'
import { autoUpdater } from 'electron-updater'
import { execFile, spawn } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, stat } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { applyNames, attachLive, loadCache, saveCache, scanClaude, type IndexCache } from './core/scanner'
import { createPidChecker, pidIsAlive, readLiveSessions } from './core/live-status'
import { copyCommand, resumeInvocation } from './core/commands'
import { parseDetails } from './core/details'
import { claudeLaunchFrom, continueInvocation, pruneHandoffs, writeHandoff, type ClaudeLaunch } from './core/continue'
import { applySettings, archive, dismissNotifyTip, keep, loadAppState, restore, setName, togglePin, updateAppState } from './core/app-state'
import { notificationText, trackWaiting, type Stretch } from './core/notify'
import { readStatusline } from './core/statusline-data'
import { connectStatusLine, disconnectStatusLine, gitBashFrom, isLinked, type ConnectResult } from './core/statusline-link'
import { usageTooltip } from './core/usage-text'
import { hasLegacyHooks, uninstallHooks } from './core/legacy-hooks'
import { popoverPosition } from './core/popover'
import { scanDue, unknownLiveIds } from './core/refresh'
import { DEFAULT_SETTINGS, type AppState, type StatuslineSnapshot, type LiveInfo, type OpenWindowOptions, type SessionDetails, type SessionRecord, type SessionsPayload } from './core/types'

const CLAUDE_DIR = join(homedir(), '.claude')
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects')
const SESSIONS_DIR = join(CLAUDE_DIR, 'sessions')
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json')

const SESSION_ID = /^[0-9a-f-]{36}$/
const LIVE_POLL_MS = 2_000
const SCAN_TICK_MS = 10_000
const POPOVER_SIZE = { width: 380, height: 560 }

type View = 'popover' | 'window' | 'settings'

let tray: Tray | null = null
let popover: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null
let popoverHiddenAt = 0

let cache: IndexCache | null = null
let records: SessionRecord[] = []
let live = new Map<string, LiveInfo>()
let state: AppState = { pins: [], names: {}, archived: [], keptAt: {}, notifyTipDone: false, statusLink: null, settings: DEFAULT_SETTINGS }
let settingsWindow: BrowserWindow | null = null
let legacyHooks = false
let lastPayload = ''
let scanning = false
// Until the first scan finishes the record list is empty, which would read as "no sessions".
let scannedOnce = false
let lastScanAt = 0
const rescannedForLive = new Set<string>()
// Resolved once `where.exe` answers (Windows); launches wait for them instead of guessing.
let wtReady: Promise<boolean> = Promise.resolve(false)
let claudeReady: Promise<ClaudeLaunch> = Promise.resolve({ kind: 'unknown' })
let hasWt = false
let statusline: StatuslineSnapshot | null = null
let statuslineLinked = false
// Windows needs Git Bash for the connected status line; macOS and Linux always have a POSIX shell.
let canLinkStatusline = process.platform !== 'win32'
let waitingStretches = new Map<string, Stretch>()
// Held so the click handler isn't garbage-collected while the notification is on screen.
let lastNotification: Notification | null = null
let trayWaiting = false

// Process start time as a FILETIME string, matching procStart in ~/.claude/sessions/<pid>.json (Windows only).
function processStartTime(pid: number): Promise<string | null> {
  if (process.platform !== 'win32') return Promise.resolve(null)
  const command = `(Get-Process -Id ${Math.trunc(pid)}).StartTime.ToFileTimeUtc()`
  return new Promise(resolve => {
    execFile('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true }, (err, out) => {
      resolve(err ? null : out.trim() || null)
    })
  })
}
const isSessionAlive = createPidChecker({ pidExists: pidIsAlive, startTimeOf: processStartTime })

const cachePath = () => join(app.getPath('userData'), 'index-v2.json')
const statePath = () => join(app.getPath('userData'), 'app-state.json')
const handoffsDir = () => join(app.getPath('userData'), 'handoffs')
// Where the connected status line saves what Claude Code passes it (statusline-link.ts).
const statuslineDir = () => join(app.getPath('userData'), 'statusline')
const findRecord = (id: unknown) => records.find(r => r.id === id)
const openWindows = () => [popover, mainWindow, settingsWindow].filter((w): w is BrowserWindow => !!w && !w.isDestroyed())

function payload(): SessionsPayload {
  const { pins, names, archived, keptAt, notifyTipDone, settings } = state
  return { records: applyNames(attachLive(records, live), names), pins, legacyHooks, names, archived, keptAt, notifyTipDone, settings, hasWt, statusline, statuslineLinked, canLinkStatusline }
}

function broadcast(): void {
  if (!scannedOnce) return
  const p = payload()
  const json = JSON.stringify(p)
  if (json === lastPayload) return
  lastPayload = json
  for (const win of openWindows()) win.webContents.send('sessions:update', p)
  updateTray()
}

const trayIcon = (waiting: boolean) => nativeImage.createFromPath(join(__dirname, '..', 'assets', waiting ? 'tray-waiting.png' : 'tray.png'))

function updateTray(): void {
  if (!tray) return
  const statuses = [...live.values()].map(l => l.status)
  const running = statuses.filter(s => s === 'busy').length
  const waiting = statuses.filter(s => s === 'waiting').length
  const usage = statuslineLinked && statusline ? usageTooltip(statusline, Date.now()) : ''
  tray.setToolTip(`Session Tray — ${waiting > 0 ? `${waiting} waiting, ` : ''}${running} running${usage ? ` · ${usage}` : ''}`)
  if (process.platform === 'darwin') tray.setTitle(waiting > 0 ? String(waiting) : '')
  else if ((waiting > 0) !== trayWaiting) tray.setImage(trayIcon(waiting > 0))
  trayWaiting = waiting > 0
}

// One silent notification per waiting stretch that passes the user's threshold; several at once are grouped.
function notifyWaiting(): void {
  if (!state.settings.notify || !Notification.isSupported()) { waitingStretches = new Map(); return }
  const waiting = [...live].filter(([, l]) => l.status === 'waiting').map(([id, l]) => ({ id, since: l.statusUpdatedAt ?? l.updatedAt }))
  const { next, due } = trackWaiting(waitingStretches, waiting, Date.now(), state.settings.notifyAfterMin * 60_000)
  waitingStretches = next
  if (due.length === 0) return
  const named = applyNames(records, state.names)
  const text = notificationText(due.map(id => ({
    title: named.find(r => r.id === id)?.title || live.get(id)?.name || 'A session',
    waitingFor: live.get(id)?.waitingFor ?? null,
  })))
  lastNotification = new Notification({ ...text, silent: true })
  lastNotification.on('click', () => openMainWindow(due.length === 1 ? { id: due[0] } : {}))
  lastNotification.show()
}

async function rescan(): Promise<void> {
  if (scanning) return
  scanning = true
  try {
    const result = await scanClaude({ projectsDir: PROJECTS_DIR, cache })
    records = result.records
    cache = result.cache
    if (result.changed) await saveCache(cachePath(), cache)
  } catch {
    // keep last good list
  } finally {
    scanning = false
    scannedOnce = true
    lastScanAt = Date.now()
  }
  broadcast()
}

async function pollLive(): Promise<void> {
  live = await readLiveSessions(SESSIONS_DIR, isSessionAlive)
  statusline = await readStatusline(statuslineDir())
  legacyHooks = hasLegacyHooks(SETTINGS_PATH)
  statuslineLinked = state.statusLink !== null && isLinked(SETTINGS_PATH, state.statusLink)
  // A brand-new session is live before its transcript has been scanned; rescan once per such session.
  const unknown = unknownLiveIds(live.keys(), new Set(records.map(r => r.id)), rescannedForLive)
  if (unknown.length > 0) {
    unknown.forEach(id => rescannedForLive.add(id))
    void rescan()
  }
  notifyWaiting()
  broadcast()
}

function scanTick(): void {
  const visible = openWindows().some(w => w.isVisible())
  if (scanDue({ visible, lastScanAt, now: Date.now() })) void rescan()
}

// Same rule as the renderer's effectiveTheme; passed in the URL so the first paint uses it.
const bootTheme = () => (state.settings.followSystem && !nativeTheme.shouldUseDarkColors ? 'paper' : state.settings.theme)
const windowBackground = () => (bootTheme() === 'paper' ? '#F3F3F1' : '#08080A')

function loadView(win: BrowserWindow, view: View): void {
  const query = { view, theme: bootTheme() }
  if (app.isPackaged) {
    win.loadFile(join(process.resourcesPath, 'client', 'dist', 'index.html'), { query })
    return
  }
  // Vite may still be starting when Electron boots in dev.
  win.webContents.on('did-fail-load', () => setTimeout(() => win.isDestroyed() || win.reload(), 1000))
  win.loadURL(`http://localhost:5173/?${new URLSearchParams(query)}`)
}

function createWindow(view: View, options: Electron.BrowserWindowConstructorOptions): BrowserWindow {
  const win = new BrowserWindow({
    ...options,
    show: false,
    title: 'Session Tray',
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })
  win.setMenuBarVisibility(false)
  loadView(win, view)
  return win
}

function togglePopover(): void {
  if (!tray) return
  if (!popover || popover.isDestroyed()) {
    popover = createWindow('popover', {
      ...POPOVER_SIZE, frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: true, fullscreenable: false,
      // Transparent so the popover's rounded corners show.
      transparent: true, backgroundColor: '#00000000',
    })
    popover.on('blur', () => { popover?.hide(); popoverHiddenAt = Date.now() })
  }
  // Clicking the tray while the popover is open blurs it first; don't reopen on that same click.
  if (popover.isVisible() || Date.now() - popoverHiddenAt < 250) {
    popover.hide()
    return
  }
  const trayBounds = tray.getBounds()
  const { workArea } = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
  popover.setBounds(popoverPosition(trayBounds, workArea, POPOVER_SIZE))
  popover.show()
  popover.focus()
  void rescan()
}

function openMainWindow(opts: OpenWindowOptions = {}): void {
  const valid: OpenWindowOptions = {}
  if (typeof opts?.id === 'string' && SESSION_ID.test(opts.id)) valid.id = opts.id
  if (opts?.view === 'cleanup') valid.view = 'cleanup'
  const send = () => { if (valid.id || valid.view) mainWindow?.webContents.send('window:open', valid) }
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow('window', { width: 1180, height: 760, minWidth: 760, minHeight: 500, backgroundColor: windowBackground() })
    mainWindow.once('ready-to-show', () => { mainWindow?.show(); send() })
  } else {
    mainWindow.show()
    mainWindow.focus()
    send()
  }
  popover?.hide()
  void rescan()
}

function openSettings(section?: unknown): void {
  const send = () => { if (section === 'stats') settingsWindow?.webContents.send('settings:section', section) }
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    settingsWindow = createWindow('settings', { width: 900, height: 640, minWidth: 640, minHeight: 480, backgroundColor: windowBackground() })
    settingsWindow.once('ready-to-show', () => { settingsWindow?.show(); send() })
  } else {
    settingsWindow.show()
    settingsWindow.focus()
    send()
  }
  popover?.hide()
}

function applyLoginItem(): void {
  if (app.getLoginItemSettings().openAtLogin !== state.settings.launchAtLogin) {
    app.setLoginItemSettings({ openAtLogin: state.settings.launchAtLogin })
  }
}

function removeLegacyHooks(): void {
  uninstallHooks(SETTINGS_PATH)
  legacyHooks = hasLegacyHooks(SETTINGS_PATH)
  broadcast()
}

// Dev runs report Electron's version from app.getVersion(); read ours instead.
const appVersion = () => app.isPackaged ? app.getVersion() : (require('../package.json') as { version: string }).version

function buildMenu(): Menu {
  const items: Electron.MenuItemConstructorOptions[] = [
    { label: `Session Tray v${appVersion()}`, enabled: false },
    { type: 'separator' },
    { label: 'Open window', click: () => openMainWindow() },
  ]
  if (legacyHooks) items.push({ label: 'Remove old The Office hooks', click: removeLegacyHooks })
  items.push(
    { type: 'separator' },
    { label: 'Settings…', click: () => openSettings() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  )
  return Menu.buildFromTemplate(items)
}

// null tells the renderer to keep showing "Scanning…"; the first broadcast follows the first scan.
ipcMain.handle('sessions:get', () => (scannedOnce ? payload() : null))

ipcMain.on('session:resume', async (_e, id: unknown) => {
  const r = findRecord(id)
  if (!r?.projectExists) return
  const inv = resumeInvocation(r, process.platform, state.settings.terminal, await wtReady)
  if (!inv) return
  spawn(inv.file, inv.args, { cwd: inv.cwd, detached: true, stdio: 'ignore' }).on('error', () => {}).unref()
})

ipcMain.on('session:copy', (_e, id: unknown) => {
  const r = findRecord(id)
  if (r) clipboard.writeText(copyCommand(r, process.platform))
})

ipcMain.on('session:pin', async (_e, id: unknown) => {
  if (typeof id !== 'string' || !findRecord(id)) return
  state = await togglePin(statePath(), id)
  broadcast()
})

// Parsed on demand per session; keyed by file mtime and size so edits invalidate it.
const DETAILS_CACHE_MAX = 50
const detailsCache = new Map<string, { key: string; details: SessionDetails | null }>()

ipcMain.handle('session:details', async (_e, id: unknown): Promise<SessionDetails | null> => {
  const r = typeof id === 'string' && SESSION_ID.test(id) ? findRecord(id) : undefined
  if (!r) return null
  const st = await stat(r.filePath).catch(() => null)
  if (!st) return null
  const key = `${st.mtimeMs}:${st.size}`
  const hit = detailsCache.get(r.id)
  if (hit?.key === key) return hit.details
  const details = await parseDetails(r.filePath, r.projectPath)
  detailsCache.delete(r.id)
  detailsCache.set(r.id, { key, details })
  if (detailsCache.size > DETAILS_CACHE_MAX) detailsCache.delete(detailsCache.keys().next().value as string)
  return details
})

ipcMain.on('session:copy-text', (_e, text: unknown) => {
  if (typeof text === 'string') clipboard.writeText(text)
})

ipcMain.on('session:rename', async (_e, id: unknown, name: unknown) => {
  if (typeof id !== 'string' || !findRecord(id)) return
  if (name !== null && typeof name !== 'string') return
  state = await updateAppState(statePath(), s => setName(s, id, name))
  broadcast()
})

ipcMain.on('session:continue', async (_e, id: unknown, opts: unknown) => {
  const r = typeof id === 'string' && SESSION_ID.test(id) ? findRecord(id) : undefined
  const o = (opts ?? {}) as { folder?: unknown; prompt?: unknown; target?: unknown }
  if (!r || typeof o.prompt !== 'string' || o.prompt.trim() === '') return
  if (o.target === 'clipboard') { clipboard.writeText(o.prompt); return }
  if (typeof o.folder !== 'string' || !(await stat(o.folder).then(st => st.isDirectory(), () => false))) return
  const promptFile = await writeHandoff(handoffsDir(), r.id, o.prompt, Date.now()).catch(() => null)
  if (!promptFile) return
  const inv = continueInvocation({
    folder: o.folder, promptFile, platform: process.platform, terminal: state.settings.terminal,
    hasWt: await wtReady, claude: await claudeReady,
  })
  if (!inv) return
  spawn(inv.file, inv.args, { cwd: inv.cwd, detached: true, stdio: 'ignore' }).on('error', () => {}).unref()
})

ipcMain.handle('dialog:pick-folder', async (e): Promise<string | null> => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const opts: Electron.OpenDialogOptions = { properties: ['openDirectory'] }
  const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  return result.canceled ? null : result.filePaths[0] ?? null
})

// Every id must be a known session; archive also skips live ones.
const knownIds = (ids: unknown): string[] =>
  Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && SESSION_ID.test(id) && !!findRecord(id)) : []

ipcMain.on('session:archive', async (_e, ids: unknown) => {
  const valid = knownIds(ids).filter(id => !live.has(id))
  if (valid.length === 0) return
  state = await updateAppState(statePath(), s => archive(s, valid))
  broadcast()
})

ipcMain.on('session:restore', async (_e, ids: unknown) => {
  const valid = knownIds(ids)
  if (valid.length === 0) return
  state = await updateAppState(statePath(), s => restore(s, valid))
  broadcast()
})

ipcMain.on('session:keep', async (_e, ids: unknown) => {
  const valid = knownIds(ids)
  if (valid.length === 0) return
  state = await updateAppState(statePath(), s => keep(s, valid, Date.now()))
  broadcast()
})

ipcMain.on('session:reveal', (_e, id: unknown) => {
  const r = findRecord(id)
  if (r) shell.showItemInFolder(r.filePath)
})

ipcMain.on('app:open-url', (_e, url: unknown) => {
  if (typeof url === 'string' && /^https:\/\//.test(url)) void shell.openExternal(url)
})

ipcMain.on('app:open-window', (_e, opts: unknown) => openMainWindow(opts && typeof opts === 'object' ? opts as OpenWindowOptions : {}))
ipcMain.on('app:remove-legacy-hooks', removeLegacyHooks)
ipcMain.on('app:open-settings', (_e, section: unknown) => openSettings(section))

// The only writes to ~/.claude besides removing old hooks; each runs on an explicit click in Settings → Stats.
ipcMain.handle('statusline:connect', async (): Promise<ConnectResult | { ok: false; reason: 'no-bash' }> => {
  if (!canLinkStatusline) return { ok: false, reason: 'no-bash' }
  await mkdir(statuslineDir(), { recursive: true })
  const result = connectStatusLine(SETTINGS_PATH, statuslineDir())
  if (result.ok) {
    state = await updateAppState(statePath(), s => ({ ...s, statusLink: result.link }))
    statuslineLinked = true
    broadcast()
  }
  return result
})

ipcMain.handle('statusline:disconnect', async (): Promise<'restored' | 'changed' | 'unreadable' | 'none'> => {
  if (!state.statusLink) return 'none'
  const result = disconnectStatusLine(SETTINGS_PATH, state.statusLink)
  if (result !== 'unreadable') {
    state = await updateAppState(statePath(), s => ({ ...s, statusLink: null }))
    statuslineLinked = false
    broadcast()
  }
  return result
})

ipcMain.on('settings:set', async (_e, patch: unknown) => {
  if (!patch || typeof patch !== 'object') return
  state = await updateAppState(statePath(), s => applySettings(s, patch))
  applyLoginItem()
  broadcast()
})

ipcMain.on('app:dismiss-notify-tip', async () => {
  state = await updateAppState(statePath(), dismissNotifyTip)
  broadcast()
})

async function main(): Promise<void> {
  // Gives dev runs the same userData folder as the packaged app instead of %APPDATA%\Electron.
  app.setName('Session Tray')
  if (!app.requestSingleInstanceLock()) { app.quit(); return }
  await app.whenReady()
  // Windows shows notifications under the installer's shortcut id (electron-builder's appId). Dev runs have no
  // such shortcut, so they keep Electron's default id, which Windows can show.
  if (process.platform === 'win32' && app.isPackaged) app.setAppUserModelId('com.the-office.app')

  if (process.platform === 'win32') {
    wtReady = new Promise(resolve => execFile('where.exe', ['wt.exe'], err => resolve(!err)))
    claudeReady = new Promise(resolve => execFile('where.exe', ['claude'], (err, out) => {
      resolve(claudeLaunchFrom(err ? null : out, existsSync))
    }))
    void wtReady.then(found => { hasWt = found; broadcast() })
    execFile('where.exe', ['git'], (err, out) => {
      canLinkStatusline = gitBashFrom(err ? null : out, process.env.CLAUDE_CODE_GIT_BASH_PATH, existsSync)
      broadcast()
    })
  }
  void pruneHandoffs(handoffsDir(), Date.now())

  tray = new Tray(trayIcon(false))
  tray.setToolTip('Session Tray')
  tray.on('click', togglePopover)
  tray.on('right-click', () => tray?.popUpContextMenu(buildMenu()))

  state = await loadAppState(statePath())
  applyLoginItem()
  cache = await loadCache(cachePath())
  await pollLive()
  await rescan()
  setInterval(() => void pollLive(), LIVE_POLL_MS)
  setInterval(scanTick, SCAN_TICK_MS)

  // Offline or no update feed: keep running quietly.
  if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify().catch(() => {})
}

app.on('second-instance', () => openMainWindow())

app.on('window-all-closed', () => {
  // Tray app: keep running with no windows.
})

main()
