import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { app } from 'electron'
import type { Session } from '../shared/types'

const scriptPath = () =>
  app.isPackaged
    ? join(process.resourcesPath, 'focus-tab.ps1')
    : join(app.getAppPath(), 'resources', 'focus-tab.ps1')

/** Strings to look for in Windows Terminal tab titles, most specific first. */
export function matchCandidates(s: Pick<Session, 'tabTag' | 'title' | 'repo'>): string[] {
  return [s.tabTag, s.repo]
    .map((x) => x?.replace(/\|/g, '').trim())
    .filter((x): x is string => !!x && x.length >= 2)
}

export function jumpToSession(s: Session): Promise<string> {
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath(), '-Match', matchCandidates(s).join('|')]
  return new Promise((resolve) => {
    execFile('powershell.exe', args, { windowsHide: true, timeout: 8000 }, (err, stdout, stderr) => {
      const out = String(stdout).trim()
      if (err && !out) console.error('[huddle] focus-tab failed', err.message, String(stderr))
      resolve(out || 'error')
    })
  })
}
