import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const MAX_NAMES = 200

/** Custom session names, saved to disk so they survive restarts. Most recent last. */
export class NameStore {
  private names: Record<string, string> = {}

  constructor(private path: string) {
    try {
      if (existsSync(path)) {
        const data = JSON.parse(readFileSync(path, 'utf8'))
        if (data && typeof data === 'object') this.names = data
      }
    } catch {
      this.names = {}
    }
  }

  get(sessionId: string): string | null {
    const v = this.names[sessionId]
    return typeof v === 'string' ? v : null
  }

  set(sessionId: string, name: string | null): void {
    delete this.names[sessionId]
    if (name) this.names[sessionId] = name
    const keys = Object.keys(this.names)
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_NAMES))) delete this.names[k]
    try {
      mkdirSync(dirname(this.path), { recursive: true })
      writeFileSync(this.path, JSON.stringify(this.names, null, 2))
    } catch (e) {
      console.error('[huddle] could not save names', e)
    }
  }
}
