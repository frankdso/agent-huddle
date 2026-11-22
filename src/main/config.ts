import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

export interface HuddleConfig {
  token: string
  /** Set once the first-run defaults (start with Windows) have been applied. */
  initialized: boolean
}

export const configDir = () => join(homedir(), '.agent-huddle')
export const claudeSettingsPath = () =>
  join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'settings.json')

export function loadConfig(dir = configDir()): HuddleConfig {
  const path = join(dir, 'config.json')
  let cfg: Partial<HuddleConfig> = {}
  if (existsSync(path)) {
    try {
      cfg = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      cfg = {}
    }
  }
  const full: HuddleConfig = {
    token: typeof cfg.token === 'string' && cfg.token.length >= 16 ? cfg.token : randomBytes(24).toString('hex'),
    initialized: !!cfg.initialized
  }
  if (full.token !== cfg.token) saveConfig(full, dir)
  return full
}

export function saveConfig(cfg: HuddleConfig, dir = configDir()): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'config.json'), JSON.stringify(cfg, null, 2))
}
