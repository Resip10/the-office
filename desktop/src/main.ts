import { app, Tray, Menu, nativeImage, dialog, shell, utilityProcess } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { homedir } from 'os'
import { installHooks, hasHooks } from './installer'

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json')

let tray: Tray | null = null
let serverProcess: Electron.UtilityProcess | null = null
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
    const child = utilityProcess.fork(getServerScriptPath(), [], {
      env: { ...process.env, SERVE_STATIC: clientDist },
      stdio: 'pipe',
    })
    serverProcess = child

    let resolved = false

    child.stdout?.on('data', (data: Buffer) => {
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

    child.stderr?.on('data', (data: Buffer) => {
      console.error('[server]', data.toString())
    })

    child.on('exit', (exitCode) => {
      if (!resolved) {
        resolved = true
        reject(new Error(`Server exited with code ${exitCode}`))
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
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  await app.whenReady()

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
    autoUpdater.checkForUpdatesAndNotify()
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
