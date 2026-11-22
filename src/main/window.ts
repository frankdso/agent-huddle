import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

export const WIDTH = 372
const MARGIN = 16
const MAX_HEIGHT = 720

export function createWidget(): BrowserWindow {
  const area = screen.getPrimaryDisplay().workArea
  const win = new BrowserWindow({
    width: WIDTH,
    height: 120,
    x: area.x + area.width - WIDTH - MARGIN,
    y: area.y + MARGIN,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    title: 'Agent Huddle',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true)

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))

  win.once('ready-to-show', () => win.showInactive())
  return win
}

/** Grows or shrinks the widget to fit its content, keeping the top edge where it is. */
export function fitHeight(win: BrowserWindow, contentHeight: number): void {
  const h = Math.max(48, Math.min(MAX_HEIGHT, Math.ceil(contentHeight)))
  const [x, y] = win.getPosition()
  win.setBounds({ x, y, width: WIDTH, height: h })
}
