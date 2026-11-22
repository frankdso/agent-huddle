import http from 'node:http'
import type { Decision, HookEvent, PendingView, Question } from '../shared/types'
import { PendingRegistry, toHookResponse } from './pending'
import { describeTool } from './store'

export interface ServerOptions {
  port: number
  token: string
  registry: PendingRegistry
  timeoutMs: number
  onEvent(ev: HookEvent, tabTag: string | null): void
  /** Called when a request starts waiting on the user. */
  onHold(sessionId: string, view: PendingView): void
  /** Called when a held request is settled (by the user, timeout, or shutdown). */
  onRelease(sessionId: string, view: PendingView, decision: Decision): void
}

const MAX_BODY = 5 * 1024 * 1024

function summarize(toolName: string, input: any): string {
  if (toolName === 'Bash' || toolName === 'PowerShell') return `${toolName}: ${String(input?.command ?? '')}`
  return `${toolName}: ${describeTool(toolName, input)}`
}

function questionsOf(input: any): Question[] {
  const qs = Array.isArray(input?.questions) ? input.questions : []
  return qs.map((q: any) => ({
    question: String(q?.question ?? ''),
    header: typeof q?.header === 'string' ? q.header : undefined,
    multiSelect: !!q?.multiSelect,
    options: (Array.isArray(q?.options) ? q.options : []).map((o: any) => ({
      label: String(o?.label ?? ''),
      description: typeof o?.description === 'string' ? o.description : undefined
    }))
  }))
}

function tabHeader(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v
  if (!s || s.startsWith('$')) return null
  return s.trim() || null
}

export function startServer(opts: ServerOptions): Promise<http.Server> {
  const send = (res: http.ServerResponse, status: number, body: object) => {
    if (res.writableEnded) return
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  const server = http.createServer((req, res) => {
    const m = /^\/hook\/([A-Za-z]+)$/.exec(req.url ?? '')
    if (req.method !== 'POST' || !m) return send(res, 404, {})
    if (req.headers['x-huddle-token'] !== opts.token) return send(res, 401, {})

    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) req.destroy()
      else chunks.push(c)
    })
    req.on('end', async () => {
      let ev: HookEvent
      try {
        ev = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        return send(res, 400, {})
      }
      if (!ev || typeof ev !== 'object') return send(res, 400, {})
      ev.hook_event_name ||= m[1]
      const tab = tabHeader(req.headers['x-huddle-tab'])

      try {
        opts.onEvent(ev, tab)
      } catch (e) {
        console.error('[huddle] onEvent failed', e)
      }

      const toolName = String(ev.tool_name ?? '')
      const input: any = ev.tool_input ?? {}
      let event: 'PermissionRequest' | 'PreToolUse' | null = null
      let view: Omit<PendingView, 'id'> | null = null
      if (ev.hook_event_name === 'PermissionRequest') {
        event = 'PermissionRequest'
        view = { kind: 'permission', toolName, summary: summarize(toolName, input) }
      } else if (ev.hook_event_name === 'PreToolUse' && toolName === 'AskUserQuestion' && !ev.agent_id) {
        event = 'PreToolUse'
        view = { kind: 'question', toolName, summary: 'asks a question', questions: questionsOf(input) }
      }
      if (!event || !view || !ev.session_id) return send(res, 200, {})

      const held = opts.registry.hold(ev.session_id, view, opts.timeoutMs)
      // If Claude Code gives up (hook timeout, user answered in terminal, process killed), release.
      res.on('close', () => opts.registry.resolve(held.id, { kind: 'defer' }))
      opts.onHold(ev.session_id, held.view)
      const decision = await held.promise
      opts.onRelease(ev.session_id, held.view, decision)
      send(res, 200, toHookResponse(event, decision, input))
    })
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(opts.port, '127.0.0.1', () => resolve(server))
  })
}
