import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mergeHuddleHooks, installHooks, HUDDLE_EVENTS } from '../src/main/hooks-config'
import { HOOK_PREFIX } from '../src/shared/types'

const TOKEN = 'tok123'

describe('mergeHuddleHooks', () => {
  it('adds one http hook per event to empty settings', () => {
    const out: any = mergeHuddleHooks({}, { token: TOKEN })
    for (const ev of HUDDLE_EVENTS) {
      const groups = out.hooks[ev]
      expect(groups).toHaveLength(1)
      const h = groups[0].hooks[0]
      expect(h).toEqual({
        type: 'http',
        url: `${HOOK_PREFIX}${ev}`,
        timeout: 600,
        headers: { 'X-Huddle-Token': TOKEN, 'X-Huddle-Tab': '$HUDDLE_TAB' },
        allowedEnvVars: ['HUDDLE_TAB']
      })
    }
    expect(out.hooks.PreToolUse[0].matcher).toBe('*')
    expect(out.hooks.PermissionRequest[0].matcher).toBe('*')
    expect(out.hooks.Stop[0].matcher).toBeUndefined()
  })

  it("preserves the user's own hooks and other keys", () => {
    const mine = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }
    const out: any = mergeHuddleHooks(
      { env: { A: '1' }, model: 'opus', hooks: { PreToolUse: [mine] } },
      { token: TOKEN }
    )
    expect(out.env).toEqual({ A: '1' })
    expect(out.model).toBe('opus')
    expect(out.hooks.PreToolUse[0]).toEqual(mine)
    expect(out.hooks.PreToolUse).toHaveLength(2)
  })

  it('is idempotent and replaces an old token', () => {
    const once = mergeHuddleHooks({}, { token: 'old' })
    const twice: any = mergeHuddleHooks(once, { token: TOKEN })
    expect(twice).toEqual(mergeHuddleHooks({}, { token: TOKEN }))
    expect(twice.hooks.Stop).toHaveLength(1)
  })

  it('removes a group only if all its hooks are ours, keeping mixed groups minus our hook', () => {
    const mixed = {
      hooks: [
        { type: 'command', command: 'echo keep' },
        { type: 'http', url: `${HOOK_PREFIX}Stop` }
      ]
    }
    const out: any = mergeHuddleHooks({ hooks: { Stop: [mixed] } }, { token: TOKEN })
    expect(out.hooks.Stop[0].hooks).toEqual([{ type: 'command', command: 'echo keep' }])
    expect(out.hooks.Stop).toHaveLength(2)
  })
})

describe('installHooks', () => {
  let dir: string
  let path: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'huddle-'))
    path = join(dir, 'settings.json')
  })

  it('creates settings.json when missing', () => {
    expect(installHooks(path, TOKEN)).toEqual({ ok: true })
    const s = JSON.parse(readFileSync(path, 'utf8'))
    expect(s.hooks.Stop).toHaveLength(1)
  })

  it('backs up the original exactly once', () => {
    writeFileSync(path, JSON.stringify({ model: 'opus' }))
    installHooks(path, TOKEN)
    const backup = path + '.huddle-backup'
    expect(JSON.parse(readFileSync(backup, 'utf8'))).toEqual({ model: 'opus' })
    installHooks(path, 'other')
    expect(JSON.parse(readFileSync(backup, 'utf8'))).toEqual({ model: 'opus' })
  })

  it('treats an empty file as {}', () => {
    writeFileSync(path, '   ')
    expect(installHooks(path, TOKEN).ok).toBe(true)
  })

  it('leaves an unparseable file untouched', () => {
    writeFileSync(path, '{ // comment\n "a": 1 }')
    const r = installHooks(path, TOKEN)
    expect(r.ok).toBe(false)
    expect(readFileSync(path, 'utf8')).toBe('{ // comment\n "a": 1 }')
    expect(existsSync(path + '.huddle-backup')).toBe(false)
  })
})
