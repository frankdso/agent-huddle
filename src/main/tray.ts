import { app, Menu, Tray, nativeImage, type BrowserWindow } from 'electron'
import { join } from 'node:path'

export function iconPath(name: string): string {
  return app.isPackaged ? join(process.resourcesPath, name) : join(app.getAppPath(), 'resources', name)
}

export function createTray(win: BrowserWindow, opts: { onReconnect(): void; onQuit(): void }): Tray {
  const tray = new Tray(nativeImage.createFromPath(iconPath('tray.png')))
  tray.setToolTip('Agent Huddle')

  const toggle = () => (win.isVisible() ? win.hide() : win.showInactive())

  const build = () =>
    Menu.buildFromTemplate([
      { label: win.isVisible() ? 'Hide widget' : 'Show widget', click: () => { toggle(); tray.setContextMenu(build()) } },
      { type: 'separator' },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
      },
      { label: 'Reconnect Claude Code', click: opts.onReconnect },
      { type: 'separator' },
      { label: 'Quit Agent Huddle', click: opts.onQuit }
    ])

  tray.setContextMenu(build())
  tray.on('click', toggle)
  win.on('show', () => tray.setContextMenu(build()))
  win.on('hide', () => tray.setContextMenu(build()))
  return tray
}
