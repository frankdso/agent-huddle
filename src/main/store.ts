import type { HookEvent, PendingView, Session, TaskItem } from '../shared/types'

const TITLE_MAX = 48
const OUTPUT_TAIL = 2000

const basename = (p: string) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? p
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

export function describeTool(name: string, input: any): string {
  const file = basename(str(input?.file_path) || str(input?.notebook_path) || str(input?.path))
  switch (name) {
    case 'Bash':
    case 'PowerShell':
      return clip(str(input?.description) || str(input?.command), 60)
    case 'Read':
      return `Reading ${file}`
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return `Editing ${file}`
    case 'Write':
      return `Writing ${file}`
    case 'Grep':
    case 'Glob':
      return 'Searching the code'
    case 'WebFetch':
    case 'WebSearch':
      return 'Browsing the web'
    case 'Task':
    case 'Agent':
      return 'Running a subagent'
    case 'AskUserQuestion':
      return 'Asking you a question'
    default: {
      const mcp = /^mcp__([^_]+(?:_[^_]+)*?)__/.exec(name)
      return mcp ? `Using ${mcp[1]}` : `Using ${name}`
    }
  }
}

function blank(ev: HookEvent, tabTag: string | null, now: number): Session {
  const cwd = str(ev.cwd)
  return {
    id: ev.session_id,
    cwd,
    repo: cwd ? basename(cwd) : 'claude',
    branch: null,
    title: '',
    activity: 'Starting up',
    status: 'working',
    tasks: [],
    terminal: null,
    pending: null,
    tabTag,
    flash: null,
    startedAt: now,
    updatedAt: now
  }
}

function setTask(tasks: TaskItem[], id: string, patch: Partial<TaskItem>): TaskItem[] {
  return tasks.map((t) => (t.id === id ? { ...t, ...patch } : t))
}

/** Pure: folds one hook event into the session map and returns a new map. */
export function reduce(
  sessions: Map<string, Session>,
  ev: HookEvent,
  tabTag: string | null,
  now: number
): Map<string, Session> {
  if (!ev?.session_id) return sessions
  const next = new Map(sessions)
  const name = ev.hook_event_name

  if (name === 'SessionEnd') {
    next.delete(ev.session_id)
    return next
  }

  const prev = next.get(ev.session_id)
  let s: Session = prev ? { ...prev } : blank(ev, tabTag, now)
  if (tabTag && !s.tabTag) s.tabTag = tabTag
  if (!s.cwd && ev.cwd) {
    s.cwd = str(ev.cwd)
    s.repo = basename(s.cwd)
  }
  s.updatedAt = now

  const toolName = str(ev.tool_name)
  const input: any = ev.tool_input ?? {}
  const fromSubagent = typeof ev.agent_id === 'string' && ev.agent_id !== ''

  switch (name) {
    case 'SessionStart':
      if (!prev) {
        s.status = 'idle'
        s.activity = 'Ready'
        s.startedAt = now
      }
      break

    case 'UserPromptSubmit': {
      const prompt = str(ev.prompt).replace(/\s+/g, ' ').trim()
      if (!s.title && prompt) s.title = clip(prompt, TITLE_MAX)
      s.status = 'working'
      s.activity = 'Thinking'
      break
    }

    case 'PreToolUse':
      if (s.status === 'waiting' || s.status === 'idle') s.status = 'working'
      if (fromSubagent) {
        s.activity = 'Running a subagent'
        break
      }
      if (toolName === 'TaskUpdate' && input.taskId) {
        const patch: Partial<TaskItem> = {}
        if (input.status === 'pending' || input.status === 'in_progress' || input.status === 'completed')
          patch.status = input.status
        if (typeof input.activeForm === 'string') patch.activeForm = input.activeForm
        if (typeof input.subject === 'string') patch.subject = input.subject
        s.tasks = setTask(s.tasks, String(input.taskId), patch)
        const t = s.tasks.find((x) => x.id === String(input.taskId))
        if (t && t.status === 'in_progress') s.activity = t.activeForm || t.subject
        break
      }
      if (toolName === 'TodoWrite' && Array.isArray(input.todos)) {
        s.tasks = input.todos.map((t: any, i: number) => ({
          id: String(i),
          subject: str(t.content),
          activeForm: str(t.activeForm) || undefined,
          status: t.status === 'completed' || t.status === 'in_progress' ? t.status : 'pending'
        }))
        const cur = s.tasks.find((t) => t.status === 'in_progress')
        if (cur) s.activity = cur.activeForm || cur.subject
        break
      }
      if (toolName === 'TaskCreate' || toolName === 'TaskList' || toolName === 'TaskGet') break
      s.activity = describeTool(toolName, input)
      if (toolName === 'Bash' || toolName === 'PowerShell')
        s.terminal = { command: str(input.command), output: null, running: true }
      break

    case 'PostToolUse':
      if (s.status === 'waiting' || s.status === 'idle') s.status = 'working'
      if (!fromSubagent && (toolName === 'Bash' || toolName === 'PowerShell')) {
        const r: any = ev.tool_response
        let out =
          typeof r === 'string'
            ? r
            : [str(r?.stdout) || str(r?.output), str(r?.stderr)].filter(Boolean).join('\n')
        if (out.length > OUTPUT_TAIL) out = out.slice(-OUTPUT_TAIL)
        s.terminal = { command: str(input.command) || s.terminal?.command || '', output: out, running: false }
      }
      break

    case 'TaskCreated': {
      const id = str(ev.task_id)
      if (id && !s.tasks.some((t) => t.id === id))
        s.tasks = [...s.tasks, { id, subject: str(ev.task_subject), status: 'pending' }]
      break
    }

    case 'TaskCompleted': {
      const id = str(ev.task_id)
      if (s.tasks.some((t) => t.id === id)) s.tasks = setTask(s.tasks, id, { status: 'completed' })
      else if (id) s.tasks = [...s.tasks, { id, subject: str(ev.task_subject), status: 'completed' }]
      break
    }

    case 'Stop':
      if (!fromSubagent) {
        s.status = 'waiting'
        s.activity = 'Waiting for you'
        if (s.terminal) s.terminal = { ...s.terminal, running: false }
      }
      break

    case 'Notification':
      if (ev.notification_type === 'idle_prompt') {
        s.status = 'waiting'
        s.activity = 'Waiting for you'
      }
      break
  }

  next.set(s.id, s)
  return next
}

/** Pure: attaches or clears a pending request on a session. */
export function withPending(
  sessions: Map<string, Session>,
  sessionId: string,
  pending: PendingView | null,
  flash: string | null,
  now: number
): Map<string, Session> {
  const s = sessions.get(sessionId)
  if (!s) return sessions
  const next = new Map(sessions)
  const status = pending
    ? pending.kind === 'permission'
      ? 'needs-permission'
      : 'asks-question'
    : s.status === 'needs-permission' || s.status === 'asks-question'
      ? 'working'
      : s.status
  next.set(sessionId, { ...s, pending, status, flash, updatedAt: now })
  return next
}
