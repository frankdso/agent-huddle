import { describe, it, expect } from 'vitest'
import { reduce, describeTool } from '../src/main/store'
import type { HookEvent, Session } from '../src/shared/types'

const S = 'sess-1'
const ev = (hook_event_name: string, extra: Record<string, unknown> = {}): HookEvent => ({
  hook_event_name,
  session_id: S,
  cwd: 'C:\\code\\octo-wt-auth',
  ...extra
})
const run = (...events: HookEvent[]) => {
  let m = new Map<string, Session>()
  events.forEach((e, i) => (m = reduce(m, e, null, 1000 + i)))
  return m
}

describe('reduce', () => {
  it('creates a session lazily from any event', () => {
    const m = run(ev('PostToolUse', { tool_name: 'Read', tool_input: {} }))
    const s = m.get(S)!
    expect(s.repo).toBe('octo-wt-auth')
    expect(s.status).toBe('working')
  })

  it('SessionStart creates an idle session with the tab tag', () => {
    const m = reduce(new Map(), ev('SessionStart', { source: 'startup' }), 'a7', 5)
    expect(m.get(S)).toMatchObject({ status: 'idle', tabTag: 'a7', title: '', startedAt: 5 })
  })

  it('does not mutate the input map', () => {
    const a = run(ev('SessionStart'))
    const b = reduce(a, ev('UserPromptSubmit', { prompt: 'hi' }), null, 9)
    expect(a.get(S)!.status).toBe('idle')
    expect(b.get(S)!.status).toBe('working')
  })

  it('titles the session from the first prompt, single line, max 48 chars', () => {
    const long = 'Refactor the authentication middleware so that\nit supports refresh tokens and more'
    const m = run(ev('UserPromptSubmit', { prompt: long }), ev('UserPromptSubmit', { prompt: 'second' }))
    const t = m.get(S)!.title
    expect(t.length).toBeLessThanOrEqual(48)
    expect(t).not.toContain('\n')
    expect(t.startsWith('Refactor the authentication middleware')).toBe(true)
  })

  it('PreToolUse sets activity and a running terminal for Bash', () => {
    const m = run(ev('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test', description: 'Run tests' } }))
    const s = m.get(S)!
    expect(s.activity).toBe('Run tests')
    expect(s.terminal).toEqual({ command: 'npm test', output: null, running: true })
  })

  it('PostToolUse Bash stores the tail of the output', () => {
    const big = 'x'.repeat(5000) + 'END'
    const m = run(
      ev('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' } }),
      ev('PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: { stdout: big, stderr: '' } })
    )
    const t = m.get(S)!.terminal!
    expect(t.running).toBe(false)
    expect(t.output!.length).toBe(2000)
    expect(t.output!.endsWith('END')).toBe(true)
  })

  it('tracks tasks from TaskCreated / TaskCompleted', () => {
    const m = run(
      ev('TaskCreated', { task_id: '1', task_subject: 'Render hook' }),
      ev('TaskCreated', { task_id: '2', task_subject: 'Render problem' }),
      ev('TaskCompleted', { task_id: '1', task_subject: 'Render hook' })
    )
    expect(m.get(S)!.tasks).toEqual([
      { id: '1', subject: 'Render hook', status: 'completed' },
      { id: '2', subject: 'Render problem', status: 'pending' }
    ])
  })

  it('TaskUpdate to in_progress marks the task and uses its activeForm as activity', () => {
    const m = run(
      ev('TaskCreated', { task_id: '1', task_subject: 'Render hook' }),
      ev('PreToolUse', { tool_name: 'TaskUpdate', tool_input: { taskId: '1', status: 'in_progress', activeForm: 'Rendering hook' } })
    )
    const s = m.get(S)!
    expect(s.tasks[0]).toMatchObject({ status: 'in_progress', activeForm: 'Rendering hook' })
    expect(s.activity).toBe('Rendering hook')
  })

  it('TodoWrite replaces the task list', () => {
    const m = run(
      ev('PreToolUse', {
        tool_name: 'TodoWrite',
        tool_input: {
          todos: [
            { content: 'A', status: 'completed', activeForm: 'Doing A' },
            { content: 'B', status: 'in_progress', activeForm: 'Doing B' }
          ]
        }
      })
    )
    const s = m.get(S)!
    expect(s.tasks.map((t) => [t.subject, t.status])).toEqual([
      ['A', 'completed'],
      ['B', 'in_progress']
    ])
    expect(s.activity).toBe('Doing B')
  })

  it('Stop and idle notifications mean waiting for you', () => {
    expect(run(ev('UserPromptSubmit', { prompt: 'x' }), ev('Stop')).get(S)!.status).toBe('waiting')
    const n = run(ev('Notification', { notification_type: 'idle_prompt', message: 'idle' })).get(S)!
    expect(n.status).toBe('waiting')
    expect(n.activity).toBe('Waiting for you')
  })

  it('SessionEnd removes the session', () => {
    expect(run(ev('SessionStart'), ev('SessionEnd', { reason: 'exit' })).has(S)).toBe(false)
  })

  it('ignores events from subagents for activity but still keeps the session alive', () => {
    const m = run(
      ev('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'a' } }),
      ev('PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'x.md' }, agent_id: 'sub1' })
    )
    expect(m.get(S)!.activity).toBe('Running a subagent')
  })

  it('ignores events without a session id', () => {
    const m = reduce(new Map(), { hook_event_name: 'Stop' } as any, null, 1)
    expect(m.size).toBe(0)
  })
})

describe('describeTool', () => {
  it.each([
    ['Bash', { command: 'npx hyperframes render . -o 03-huddle.mp4 --quality high --fps 60 --long-flag' }, 'npx hyperframes render . -o 03-huddle.mp4 --quality high --…'],
    ['Read', { file_path: 'C:\\x\\style-sheet.md' }, 'Reading style-sheet.md'],
    ['Edit', { file_path: '/a/b/index.html' }, 'Editing index.html'],
    ['Write', { file_path: '/a/b/new.ts' }, 'Writing new.ts'],
    ['Grep', { pattern: 'foo' }, 'Searching the code'],
    ['WebFetch', { url: 'https://x.dev' }, 'Browsing the web'],
    ['Agent', {}, 'Running a subagent'],
    ['mcp__linear__create_issue', {}, 'Using linear']
  ])('%s', (name, input, expected) => {
    expect(describeTool(name, input)).toBe(expected)
  })
})

import { withTitle } from '../src/main/store'
describe('withTitle', () => {
  it('sets a custom title that later prompts never overwrite', () => {
    let m = run(ev('UserPromptSubmit', { prompt: 'whats happening here' }))
    m = withTitle(m, S, '  Auth refactor  ', 5)
    m = reduce(m, ev('UserPromptSubmit', { prompt: 'next prompt' }), null, 6)
    expect(m.get(S)!.customTitle).toBe('Auth refactor')
    expect(m.get(S)!.title).toBe('whats happening here')
  })
  it('clears the custom title when given an empty name', () => {
    let m = withTitle(run(ev('SessionStart')), S, 'X', 1)
    m = withTitle(m, S, '   ', 2)
    expect(m.get(S)!.customTitle).toBeNull()
  })
  it('caps the name at 60 characters', () => {
    const m = withTitle(run(ev('SessionStart')), S, 'a'.repeat(100), 1)
    expect(m.get(S)!.customTitle!.length).toBe(60)
  })
  it('ignores unknown sessions', () => {
    const m = run(ev('SessionStart'))
    expect(withTitle(m, 'nope', 'X', 1)).toBe(m)
  })
})
