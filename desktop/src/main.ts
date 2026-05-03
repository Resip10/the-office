import { app, Tray, Menu, nativeImage, shell, BrowserWindow, ipcMain, utilityProcess } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { homedir } from 'os'
import { installHooks, hasHooks, uninstallHooks } from './installer'

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json')

let tray: Tray | null = null
let serverProcess: Electron.UtilityProcess | null = null
let boundPort: number | null = null

function getServerScriptPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'server', 'dist', 'index.js')
  return join(__dirname, '..', '..', 'server', 'dist', 'index.js')
}

function getClientDistPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'client', 'dist')
  return join(__dirname, '..', '..', 'client', 'dist')
}

function getDashboardUrl(): string {
  if (!app.isPackaged) return 'http://localhost:5173'
  return boundPort ? `http://localhost:${boundPort}` : ''
}

function getPreloadPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'desktop', 'dist', 'preload.js')
  return join(__dirname, 'preload.js')
}

function getAssetPath(filename: string): string {
  if (app.isPackaged) return join(process.resourcesPath, 'desktop', 'assets', filename)
  return join(__dirname, '..', 'assets', filename)
}

function openHooksWindow(htmlFile: string, title: string): void {
  const win = new BrowserWindow({
    width: 480,
    height: 300,
    resizable: false,
    title,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.setMenuBarVisibility(false)
  win.loadFile(getAssetPath(htmlFile))
}

function rebuildTray(): void {
  if (!tray) return
  const hooksActive = hasHooks(SETTINGS_PATH)
  const version = app.getVersion()
  const items: Electron.MenuItemConstructorOptions[] = [
    { label: `The Office (v${version})`, enabled: false },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      enabled: boundPort !== null || !app.isPackaged,
      click: () => { const url = getDashboardUrl(); if (url) shell.openExternal(url) },
    },
    { type: 'separator' },
    hooksActive
      ? { label: 'Remove hooks', click: () => openHooksWindow('hooks-remove.html', 'Remove hooks') }
      : { label: 'Install hooks', click: () => openHooksWindow('hooks-setup.html', 'Enable real-time monitoring') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]
  tray.setContextMenu(Menu.buildFromTemplate(items))
  tray.setToolTip(boundPort ? `The Office — running on :${boundPort}` : 'The Office — starting…')
}

ipcMain.on('hooks:install', (event) => {
  installHooks(SETTINGS_PATH)
  BrowserWindow.fromWebContents(event.sender)?.close()
  rebuildTray()
})

ipcMain.on('hooks:remove', (event) => {
  uninstallHooks(SETTINGS_PATH)
  BrowserWindow.fromWebContents(event.sender)?.close()
  rebuildTray()
})

ipcMain.on('hooks:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close()
})

function spawnServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = utilityProcess.fork(getServerScriptPath(), [], {
      env: { ...process.env, SERVE_STATIC: getClientDistPath() },
      stdio: 'pipe',
    })
    serverProcess = child

    let resolved = false

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString()
      const portMatch = text.match(/OFFICE_PORT:(\d+)/)
      const errMatch = text.match(/OFFICE_PORT_ERROR:(.+)/)
      if (portMatch && !resolved) { resolved = true; resolve(parseInt(portMatch[1], 10)) }
      else if (errMatch && !resolved) { resolved = true; reject(new Error(errMatch[1].trim())) }
    })

    child.stderr?.on('data', (data: Buffer) => console.error('[server]', data.toString()))

    child.on('exit', (exitCode) => {
      if (!resolved) { resolved = true; reject(new Error(`Server exited with code ${exitCode}`)) }
    })

    child.on('message', (event: { data: unknown }) => {
      const msg = event.data as { type?: string } | null
      if (msg?.type === 'open-hooks-setup') openHooksWindow('hooks-setup.html', 'Enable real-time monitoring')
      else if (msg?.type === 'open-hooks-remove') openHooksWindow('hooks-remove.html', 'Remove hooks')
    })

    setTimeout(() => { if (!resolved) { resolved = true; reject(new Error('startup timeout')) } }, 15000)
  })
}

async function startServer() {
  try {
    const port = await spawnServer()
    boundPort = port
    rebuildTray()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    tray?.setToolTip(`The Office — error: ${msg}`)
  }
}

async function main() {
  if (!app.requestSingleInstanceLock()) { app.quit(); return }

  await app.whenReady()

  const iconPath = join(__dirname, '..', 'assets', 'icon.png')
  const icon = nativeImage.createFromPath(iconPath).isEmpty()
    ? nativeImage.createEmpty()
    : nativeImage.createFromPath(iconPath)

  tray = new Tray(icon)
  rebuildTray()

  if (app.isPackaged) {
    await startServer()
    autoUpdater.checkForUpdatesAndNotify()
  } else {
    boundPort = null
    rebuildTray()
  }
}

app.on('window-all-closed', () => {
  // Keep running as tray-only app — do not quit on window close.
})

app.on('before-quit', () => { serverProcess?.kill() })

main()
