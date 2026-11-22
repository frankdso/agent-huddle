import { app, ipcMain, type BrowserWindow, type Tray } from 'electron'
import { basename } from 'node:path'
import type { Decision, HookEvent, HuddleState, PendingView, Session } from '../shared/types'
import { HOOK_PORT } from '../shared/types'
import { claudeSettingsPath, loadConfig } from './config'
import { readBranch } from './git'
import { installHooks, removeHooks } from './hooks-config'
import { jumpToSession } from './jump'
import { PendingRegistry } from './pending'
import { startServer } from './server'
import { reduce, withPending } from './store'
import { createTray } from './tray'
import { createWidget, fitHeight } from './window'

const HOLD_TIMEOUT_MS = 300_000
const FLASH_MS = 2500

if (!app.requestSingleInstanceLock()) app.quit()

let win: BrowserWindow | null = null
let tray: Tray | null = null
let sessions = new Map<string, Session>()
let notice: string | null = null
const registry = new PendingRegistry()
let quitting = false

let emitTimer: NodeJS.Timeout | null = null
function emit() {
  if (emitTimer) return
  emitTimer = setTimeout(() => {
    emitTimer = null
    const state: HuddleState = {
      sessions: [...sessions.values()].sort((a, b) => a.startedAt - b.startedAt),
      notice
    }
    win?.webContents.send('huddle:state', state)
  }, 50)
}

function connectClaude(token: string) {
  const r = installHooks(claudeSettingsPath(), token)
  notice = r.ok ? null : `Couldn't connect to Claude Code: ${r.reason}`
  emit()
}

function onEvent(ev: HookEvent, tab: string | null) {
  const isNew = !sessions.has(ev.session_id)
  sessions = reduce(sessions, ev, tab, Date.now())
  if (ev.hook_event_name === 'SessionEnd') registry.resolveSession(ev.session_id, { kind: 'defer' })
  const s = sessions.get(ev.session_id)
  if (s && (isNew || ev.hook_event_name === 'SessionStart' || ev.hook_event_name === 'UserPromptSubmit')) {
    const { branch, root } = readBranch(s.cwd || '.')
    sessions.set(s.id, { ...s, branch, repo: root ? basename(root) : s.repo })
  }
  emit()
}

function onHold(sessionId: string, view: PendingView) {
  sessions = withPending(sessions, sessionId, view, null, Date.now())
  if (win && !win.isVisible()) win.showInactive()
  emit()
}

function flashFor(view: PendingView, d: Decision): string | null {
  if (d.kind === 'allow') return 'Allowed ✓'
  if (d.kind === 'deny') return 'Denied'
  if (d.kind === 'answer') {
    const first = Object.values(d.answers)[0]
    return first ? `Using “${first}”` : 'Answered ✓'
  }
  return null
}

function onRelease(sessionId: string, view: PendingView, d: Decision) {
  const flash = flashFor(view, d)
  sessions = withPending(sessions, sessionId, null, flash, Date.now())
  emit()
  if (flash)
    setTimeout(() => {
      const s = sessions.get(sessionId)
      if (s && s.flash === flash) {
        sessions.set(sessionId, { ...s, flash: null })
        emit()
      }
    }, FLASH_MS)
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.frankdso.agenthuddle')
  const cfg = loadConfig()
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: cfg.autostart, path: process.execPath })

  win = createWidget()
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      win?.hide()
    }
  })

  connectClaude(cfg.token)

  try {
    await startServer({ port: HOOK_PORT, token: cfg.token, registry, timeoutMs: HOLD_TIMEOUT_MS, onEvent, onHold, onRelease })
  } catch (e) {
    notice = `Port ${HOOK_PORT} is busy, so sessions can't report in. (${(e as Error).message})`
    emit()
  }

  tray = createTray(win, {
    onReconnect: () => connectClaude(loadConfig().token),
    onQuit: () => app.quit()
  })

  win.webContents.on('did-finish-load', emit)
})

app.on('second-instance', () => win?.showInactive())

app.on('before-quit', () => {
  quitting = true
  registry.resolveAll({ kind: 'defer' })
  removeHooks(claudeSettingsPath())
})

ipcMain.on('huddle:decide', (_e, pendingId: string, d: Decision) => {
  const sessionId = registry.sessionOf(pendingId)
  registry.resolve(pendingId, d)
  if (d.kind === 'defer' && sessionId) {
    const s = sessions.get(sessionId)
    if (s) void jumpToSession(s)
  }
})
ipcMain.on('huddle:jump', (_e, sessionId: string) => {
  const s = sessions.get(sessionId)
  if (s) void jumpToSession(s)
})
ipcMain.on('huddle:dismiss', (_e, sessionId: string) => {
  registry.resolveSession(sessionId, { kind: 'defer' })
  sessions.delete(sessionId)
  emit()
})
ipcMain.on('huddle:height', (_e, px: number) => win && fitHeight(win, px))
ipcMain.on('huddle:hide', () => win?.hide())

void tray
