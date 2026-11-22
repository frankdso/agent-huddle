import { describe, it, expect, afterEach } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { PendingRegistry, toHookResponse } from '../src/main/pending'
import { startServer } from '../src/main/server'
import type { HookEvent, PendingView } from '../src/shared/types'

const TOKEN = 't0k'
let server: Server | null = null
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())))

async function boot(timeoutMs = 2000) {
  const registry = new PendingRegistry()
  const events: { ev: HookEvent; tab: string | null }[] = []
  const held: { sessionId: string; view: PendingView }[] = []
  server = await startServer({
    port: 0,
    token: TOKEN,
    registry,
    timeoutMs,
    onEvent: (ev, tab) => events.push({ ev, tab }),
    onHold: (sessionId, view) => held.push({ sessionId, view }),
    onRelease: () => {}
  })
  const port = (server.address() as AddressInfo).port
  const post = (event: string, body: object, headers: Record<string, string> = { 'X-Huddle-Token': TOKEN }) =>
    fetch(`http://127.0.0.1:${port}/hook/${event}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ hook_event_name: event, session_id: 's1', cwd: '/x', ...body })
    })
  return { registry, events, held, post }
}

const waitFor = async (fn: () => boolean) => {
  for (let i = 0; i < 100 && !fn(); i++) await new Promise((r) => setTimeout(r, 10))
}

describe('toHookResponse', () => {
  it('maps decisions to Claude Code hook output', () => {
    expect(toHookResponse('PermissionRequest', { kind: 'allow' }, {})).toEqual({
      hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } }
    })
    expect(toHookResponse('PermissionRequest', { kind: 'deny' }, {})).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: { behavior: 'deny', message: 'Denied from Agent Huddle' }
      }
    })
    const input = { questions: [{ question: 'Which?', options: [] }] }
    expect(toHookResponse('PreToolUse', { kind: 'answer', answers: { 'Which?': 'A' } }, input)).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput: { ...input, answers: { 'Which?': 'A' } }
      }
    })
    expect(toHookResponse('PreToolUse', { kind: 'defer' }, input)).toEqual({})
  })
})

describe('server', () => {
  it('rejects requests without the token', async () => {
    const { post } = await boot()
    expect((await post('Stop', {}, {})).status).toBe(401)
  })

  it('acknowledges ordinary events immediately and passes the tab tag', async () => {
    const { post, events } = await boot()
    const r = await post('Stop', {}, { 'X-Huddle-Token': TOKEN, 'X-Huddle-Tab': 'a7' })
    expect(await r.json()).toEqual({})
    expect(events[0].ev.hook_event_name).toBe('Stop')
    expect(events[0].tab).toBe('a7')
  })

  it('treats an unexpanded or empty tab header as no tag', async () => {
    const { post, events } = await boot()
    await post('Stop', {}, { 'X-Huddle-Token': TOKEN, 'X-Huddle-Tab': '$HUDDLE_TAB' })
    await post('Stop', {}, { 'X-Huddle-Token': TOKEN, 'X-Huddle-Tab': '' })
    expect(events.map((e) => e.tab)).toEqual([null, null])
  })

  it('holds a PermissionRequest until the user allows it', async () => {
    const { post, registry, held } = await boot()
    const p = post('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'rm -rf node_modules' } })
    await waitFor(() => held.length === 1)
    expect(held[0].view).toMatchObject({ kind: 'permission', toolName: 'Bash', summary: 'Bash: rm -rf node_modules' })
    registry.resolve(held[0].view.id, { kind: 'allow' })
    expect(await (await p).json()).toEqual({
      hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } }
    })
  })

  it('holds AskUserQuestion and returns the answers', async () => {
    const { post, registry, held } = await boot()
    const tool_input = {
      questions: [{ question: 'Which hook?', header: 'Hook', multiSelect: false, options: [{ label: 'Pain' }, { label: 'Number' }] }]
    }
    const p = post('PreToolUse', { tool_name: 'AskUserQuestion', tool_input })
    await waitFor(() => held.length === 1)
    expect(held[0].view.kind).toBe('question')
    expect(held[0].view.questions![0].options.map((o) => o.label)).toEqual(['Pain', 'Number'])
    registry.resolve(held[0].view.id, { kind: 'answer', answers: { 'Which hook?': 'Pain' } })
    const body = await (await p).json()
    expect(body.hookSpecificOutput.updatedInput.answers).toEqual({ 'Which hook?': 'Pain' })
  })

  it('does not hold ordinary PreToolUse', async () => {
    const { post, held } = await boot()
    expect(await (await post('PreToolUse', { tool_name: 'Read', tool_input: {} })).json()).toEqual({})
    expect(held).toHaveLength(0)
  })

  it('falls back to the terminal (no decision) after the timeout', async () => {
    const { post } = await boot(50)
    const r = await post('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'x' } })
    expect(await r.json()).toEqual({})
  })

  it('releases a held request with no decision when its session ends', async () => {
    const { post, registry, held } = await boot()
    const p = post('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'x' } })
    await waitFor(() => held.length === 1)
    registry.resolveSession('s1', { kind: 'defer' })
    expect(await (await p).json()).toEqual({})
  })

  it('resolveAll releases everything (used on quit)', async () => {
    const { post, registry, held } = await boot()
    const p = post('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'x' } })
    await waitFor(() => held.length === 1)
    registry.resolveAll({ kind: 'defer' })
    expect(await (await p).json()).toEqual({})
  })

  it('returns 400 on malformed JSON and keeps running', async () => {
    const { post } = await boot()
    const port = (server!.address() as AddressInfo).port
    const bad = await fetch(`http://127.0.0.1:${port}/hook/Stop`, {
      method: 'POST',
      headers: { 'X-Huddle-Token': TOKEN },
      body: '{nope'
    })
    expect(bad.status).toBe(400)
    expect((await post('Stop', {})).status).toBe(200)
  })
})
