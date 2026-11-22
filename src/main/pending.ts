import { randomUUID } from 'node:crypto'
import type { Decision, PendingView } from '../shared/types'

interface Entry {
  sessionId: string
  view: PendingView
  settle: (d: Decision) => void
}

/** Requests Claude Code is waiting on (permissions, questions), each resolved exactly once. */
export class PendingRegistry {
  private entries = new Map<string, Entry>()

  hold(
    sessionId: string,
    view: Omit<PendingView, 'id'>,
    timeoutMs: number
  ): { id: string; view: PendingView; promise: Promise<Decision> } {
    const id = randomUUID()
    const full: PendingView = { ...view, id }
    let timer: NodeJS.Timeout
    const promise = new Promise<Decision>((resolve) => {
      const settle = (d: Decision) => {
        clearTimeout(timer)
        this.entries.delete(id)
        resolve(d)
      }
      this.entries.set(id, { sessionId, view: full, settle })
      timer = setTimeout(() => settle({ kind: 'defer' }), timeoutMs)
    })
    return { id, view: full, promise }
  }

  resolve(id: string, d: Decision): boolean {
    const e = this.entries.get(id)
    if (!e) return false
    e.settle(d)
    return true
  }

  resolveSession(sessionId: string, d: Decision): void {
    for (const e of [...this.entries.values()]) if (e.sessionId === sessionId) e.settle(d)
  }

  resolveAll(d: Decision): void {
    for (const e of [...this.entries.values()]) e.settle(d)
  }

  sessionOf(id: string): string | undefined {
    return this.entries.get(id)?.sessionId
  }
}

/** Translates a widget decision into the JSON body Claude Code expects from the hook. */
export function toHookResponse(event: 'PermissionRequest' | 'PreToolUse', d: Decision, toolInput: any): object {
  if (d.kind === 'defer') return {}
  if (event === 'PermissionRequest') {
    if (d.kind === 'allow')
      return { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } }
    if (d.kind === 'deny')
      return {
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: { behavior: 'deny', message: 'Denied from Agent Huddle' }
        }
      }
    return {}
  }
  if (d.kind === 'answer')
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput: { ...toolInput, answers: d.answers }
      }
    }
  return {}
}
