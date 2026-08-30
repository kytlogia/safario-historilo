import { app, BrowserWindow, dialog, shell } from 'electron'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveServerEntryPath, waitForServer } from './serverProcess.mjs'

// Repo root in dev (electron/main.mjs -> ..), unused once packaged (see
// resolveServerEntryPath, which uses resourcesPath instead when packaged).
const appDir = join(dirname(fileURLToPath(import.meta.url)), '..')

// ponytail: one fixed local port for this single-window desktop app. If a
// future need arises for multiple windows/instances sharing one machine,
// switch to an ephemeral port (bind port 0, read the OS-assigned port back
// via server.address()) instead of picking a second fixed number.
const PORT = 34521
const SERVER_URL = `http://127.0.0.1:${PORT}/`

let serverProcess = null
let mainWindow = null

function startServer() {
  const entry = resolveServerEntryPath({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appDir
  })
  // Runs the already-built Nitro server (server/utils/history-store.ts and
  // friends, including the node:sqlite Backup API hot-copy logic) as a
  // child process, using Electron's own bundled Node runtime
  // (ELECTRON_RUN_AS_NODE) — no separate Node.js install required on the
  // user's machine.
  serverProcess = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(PORT),
      HOST: '127.0.0.1'
    },
    stdio: 'inherit'
  })
  serverProcess.on('exit', (code) => {
    serverProcess = null
    if (code !== null && code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        '内部サーバーが終了しました',
        `履歴の読み込みに必要な内部サーバーが予期せず終了しました（コード: ${code}）。アプリを再起動してください。`
      )
    }
  })
}

async function createWindow() {
  startServer()
  try {
    await waitForServer(SERVER_URL)
  } catch (err) {
    dialog.showErrorBox('起動に失敗しました', err instanceof Error ? err.message : String(err))
    app.quit()
    return
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  mainWindow.setMenuBarVisibility(false)
  // Keep the window on this app's own local server; anything that would
  // navigate away from it (target="_blank" links, window.open) opens in the
  // system browser instead of inside this Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  await mainWindow.loadURL(SERVER_URL)
}

// Full Disk Access on macOS (needed to read ~/Library/Safari/History.db
// etc.) is not requested here: the same web app this window loads already
// detects "file exists but isn't readable" via GET /api/local-history*/status
// and shows an in-app hint (see UploadPanel.vue's serverPermissionHint alert
// / i18n `*.uploadPanel.permissionHint`) telling the user to grant this app
// Full Disk Access in System Settings — no separate Electron-only UI needed.

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(createWindow)

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })

  app.on('will-quit', () => {
    serverProcess?.kill()
  })
}
