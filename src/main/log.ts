import { appendFileSync, mkdirSync, statSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { configDir } from './config'

const MAX_BYTES = 1_000_000

/** Appends a line to ~/.agent-huddle/huddle.log (rotated at ~1 MB). Never throws. */
export function log(line: string): void {
  try {
    const dir = configDir()
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'huddle.log')
    try {
      if (statSync(file).size > MAX_BYTES) renameSync(file, file + '.old')
    } catch {
      /* no file yet */
    }
    appendFileSync(file, `${new Date().toISOString()} ${line}\n`)
  } catch {
    /* ignore */
  }
}
