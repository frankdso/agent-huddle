import { execFile } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { Session } from '../shared/types'
import { configDir } from './config'
import { matchCandidates } from './match'
import { readTitles } from './transcript'

const scriptPath = () =>
  app.isPackaged
    ? join(process.resourcesPath, 'focus-tab.ps1')
    : join(app.getAppPath(), 'resources', 'focus-tab.ps1')

export function log(line: string): void {
  try {
    mkdirSync(configDir(), { recursive: true })
    appendFileSync(join(configDir(), 'huddle.log'), `${new Date().toISOString()} ${line}\n`)
  } catch {
    /* ignore */
  }
}

export function jumpToSession(s: Session): Promise<string> {
  const candidates = matchCandidates(s, readTitles(s.transcriptPath))
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath(), '-Match', candidates.join('|')]
  return new Promise((resolve) => {
    execFile('powershell.exe', args, { windowsHide: true, timeout: 10000 }, (err, stdout, stderr) => {
      const out = String(stdout).trim()
      log(`jump ${s.id.slice(0, 8)} candidates=${JSON.stringify(candidates)} -> ${out || '(no output)'}${err ? ` err=${err.message}` : ''}${String(stderr).trim() ? ` stderr=${String(stderr).trim()}` : ''}`)
      resolve(out || 'error')
    })
  })
}
