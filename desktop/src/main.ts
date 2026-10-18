import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, screen, shell, Tray } from 'electron'
import { autoUpdater } from 'electron-updater'
import { execFile, spawn } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { attachLive, loadCache, saveCache, scanClaude, type IndexCache } from './core/scanner'
import { pidIsAlive, readLiveSessions } from './core/live-status'
import { copyCommand, resumeInvocation } from './core/commands'
import { loadAppState, togglePin } from './core/app-state'
import { hasLegacyHooks, uninstallHooks } from './core/legacy-hooks'
import { popoverPosition } from './core/popover'
import type { LiveInfo, SessionRecord, SessionsPayload } from './core/types'

const CLAUDE_DIR = join(homedir(), '.claude')
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects')
const SESSIONS_DIR = join(CLAUDE_DIR, 'sessions')
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json')

const LIVE_POLL_MS = 2_000
const SCAN_VISIBLE_MS = 30_000
const SCAN_HIDDEN_MS = 300_000
const POPOVER_SIZE = { width: 380, height: 560 }

type View = 'popover' | 'window'

let tray: Tray | null = null
let popover: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null
let popoverHiddenAt = 0

let cache: IndexCache | null = null
let records: SessionRecord[] = []
let live = new Map<string, LiveInfo>()
let pins: string[] = []
let legacyHooks = false
let lastPayload = ''
let scanning = false
let hasWt = false

const cachePath = () => join(app.getPath('userData'), 'index-v1.json')
const statePath = () => join(app.getPath('userData'), 'app-state.json')
const findRecord = (id: unknown) => records.find(r => r.id === id)
const openWindows = () => [popover, mainWindow].filter((w): w is BrowserWindow => !!w && !w.isDestroyed())

function payload(): SessionsPayload {
  return { records: attachLive(records, live), pins, legacyHooks }
}

function broadcast(): void {
  const p = payload()
  const json = JSON.stringify(p)
  if (json === lastPayload) return
  lastPayload = json
  for (const win of openWindows()) win.webContents.send('sessions:update', p)
  const running = [...live.values()].filter(l => l.status === 'busy').length
  tray?.setToolTip(`Session Tray — ${running} running`)
}

async function rescan(): Promise<void> {
  if (scanning) return
  scanning = true
  try {
    const result = await scanClaude({ projectsDir: PROJECTS_DIR, cache })
    records = result.records
    cache = result.cache
    await saveCache(cachePath(), cache)
  } catch {
    // keep last good list
  } finally {
    scanning = false
  }
  broadcast()
}

async function pollLive(): Promise<void> {
  live = await readLiveSessions(SESSIONS_DIR, pidIsAlive)
  legacyHooks = hasLegacyHooks(SETTINGS_PATH)
  // A brand-new session is live before its transcript has been scanned.
  if ([...live.keys()].some(id => !findRecord(id))) void rescan()
  broadcast()
}

function scheduleScan(): void {
  const visible = openWindows().some(w => w.isVisible())
  setTimeout(async () => {
    await rescan()
    scheduleScan()
  }, visible ? SCAN_VISIBLE_MS : SCAN_HIDDEN_MS)
}

function loadView(win: BrowserWindow, view: View): void {
  if (app.isPackaged) {
    win.loadFile(join(__dirname, '..', '..', 'client', 'dist', 'index.html'), { query: { view } })
    return
  }
  // Vite may still be starting when Electron boots in dev.
  win.webContents.on('did-fail-load', () => setTimeout(() => win.isDestroyed() || win.reload(), 1000))
  win.loadURL(`http://localhost:5173/?view=${view}`)
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
  const { x, y } = popoverPosition(trayBounds, workArea, POPOVER_SIZE)
  popover.setPosition(x, y)
  popover.show()
  popover.focus()
  void rescan()
}

function openMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow('window', { width: 1100, height: 720, minWidth: 720, minHeight: 480 })
    mainWindow.once('ready-to-show', () => mainWindow?.show())
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
  popover?.hide()
  void rescan()
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
    { label: 'Open window', click: openMainWindow },
  ]
  if (legacyHooks) items.push({ label: 'Remove old The Office hooks', click: removeLegacyHooks })
  items.push(
    { type: 'separator' },
    {
      label: 'Launch at login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: item => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  )
  return Menu.buildFromTemplate(items)
}

ipcMain.handle('sessions:get', () => payload())

ipcMain.on('session:resume', (_e, id: unknown) => {
  const r = findRecord(id)
  if (!r?.projectExists) return
  const inv = resumeInvocation(r, process.platform, hasWt)
  if (!inv) return
  spawn(inv.file, inv.args, { cwd: inv.cwd, detached: true, stdio: 'ignore' }).on('error', () => {}).unref()
})

ipcMain.on('session:copy', (_e, id: unknown) => {
  const r = findRecord(id)
  if (r) clipboard.writeText(copyCommand(r))
})

ipcMain.on('session:pin', async (_e, id: unknown) => {
  if (typeof id !== 'string' || !findRecord(id)) return
  pins = (await togglePin(statePath(), id)).pins
  broadcast()
})

ipcMain.on('session:reveal', (_e, id: unknown) => {
  const r = findRecord(id)
  if (r) shell.showItemInFolder(r.filePath)
})

ipcMain.on('app:open-url', (_e, url: unknown) => {
  if (typeof url === 'string' && /^https:\/\//.test(url)) void shell.openExternal(url)
})

ipcMain.on('app:open-window', openMainWindow)
ipcMain.on('app:remove-legacy-hooks', removeLegacyHooks)

async function main(): Promise<void> {
  // Gives dev runs the same userData folder as the packaged app instead of %APPDATA%\Electron.
  app.setName('Session Tray')
  if (!app.requestSingleInstanceLock()) { app.quit(); return }
  await app.whenReady()

  if (process.platform === 'win32') execFile('where.exe', ['wt.exe'], err => { hasWt = !err })

  tray = new Tray(nativeImage.createFromPath(join(__dirname, '..', 'assets', 'tray.png')))
  tray.setToolTip('Session Tray')
  tray.on('click', togglePopover)
  tray.on('right-click', () => tray?.popUpContextMenu(buildMenu()))

  pins = (await loadAppState(statePath())).pins
  cache = await loadCache(cachePath())
  await pollLive()
  await rescan()
  setInterval(() => void pollLive(), LIVE_POLL_MS)
  scheduleScan()

  if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify()
}

app.on('second-instance', openMainWindow)

app.on('window-all-closed', () => {
  // Tray app: keep running with no windows.
})

main()
