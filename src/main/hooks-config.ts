import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { HOOK_PREFIX } from '../shared/types'

export const HUDDLE_EVENTS = [
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PermissionRequest',
  'TaskCreated',
  'TaskCompleted',
  'Stop',
  'Notification'
] as const

const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse', 'PermissionRequest'])

type HookEntry = { type?: string; url?: string; [k: string]: unknown }
type HookGroup = { matcher?: string; hooks?: HookEntry[]; [k: string]: unknown }

const isOurs = (h: HookEntry) => typeof h?.url === 'string' && h.url.startsWith(HOOK_PREFIX)

/** Returns a copy of `settings` with exactly one Agent Huddle hook per event and every other hook untouched. */
export function mergeHuddleHooks(settings: object, opts: { token: string } | null): object {
  const out: any = structuredClone(settings ?? {})
  const hooks: Record<string, HookGroup[]> = out.hooks && typeof out.hooks === 'object' ? out.hooks : {}

  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue
    const cleaned: HookGroup[] = []
    for (const g of groups) {
      const list = Array.isArray(g?.hooks) ? g.hooks : []
      const kept = list.filter((h) => !isOurs(h))
      if (kept.length === list.length) cleaned.push(g)
      else if (kept.length > 0) cleaned.push({ ...g, hooks: kept })
    }
    if (cleaned.length) hooks[event] = cleaned
    else delete hooks[event]
  }

  for (const event of opts ? HUDDLE_EVENTS : []) {
    const group: HookGroup = {
      ...(TOOL_EVENTS.has(event) ? { matcher: '*' } : {}),
      hooks: [
        {
          type: 'http',
          url: `${HOOK_PREFIX}${event}`,
          timeout: 600,
          headers: { 'X-Huddle-Token': opts!.token, 'X-Huddle-Tab': '$HUDDLE_TAB' },
          allowedEnvVars: ['HUDDLE_TAB']
        }
      ]
    }
    hooks[event] = [...(hooks[event] ?? []), group]
  }

  if (Object.keys(hooks).length) out.hooks = hooks
  else delete out.hooks
  return out
}

/** Merges our hooks into Claude Code's settings file. Never overwrites a file it can't parse. */
export function installHooks(settingsPath: string, token: string): { ok: boolean; reason?: string } {
  let current: object = {}
  if (existsSync(settingsPath)) {
    const raw = readFileSync(settingsPath, 'utf8')
    if (raw.trim()) {
      try {
        current = JSON.parse(raw)
      } catch (e) {
        return { ok: false, reason: `Could not parse ${settingsPath}: ${(e as Error).message}` }
      }
    }
    const backup = settingsPath + '.huddle-backup'
    if (!existsSync(backup)) copyFileSync(settingsPath, backup)
  } else {
    mkdirSync(dirname(settingsPath), { recursive: true })
  }
  const merged = mergeHuddleHooks(current, { token })
  writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n')
  return { ok: true }
}

/** Takes our hooks back out (on quit), leaving everything else as it was. */
export function removeHooks(settingsPath: string): { ok: boolean; reason?: string } {
  if (!existsSync(settingsPath)) return { ok: true }
  const raw = readFileSync(settingsPath, 'utf8')
  if (!raw.trim()) return { ok: true }
  let current: object
  try {
    current = JSON.parse(raw)
  } catch (e) {
    return { ok: false, reason: (e as Error).message }
  }
  writeFileSync(settingsPath, JSON.stringify(mergeHuddleHooks(current, null), null, 2) + '\n')
  return { ok: true }
}
