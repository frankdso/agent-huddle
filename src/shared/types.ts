export type SessionStatus = 'working' | 'needs-permission' | 'asks-question' | 'waiting' | 'idle'

export interface TaskItem {
  id: string
  subject: string
  activeForm?: string
  status: 'pending' | 'in_progress' | 'completed'
}

export interface TerminalInfo {
  command: string
  output: string | null
  running: boolean
}

export interface Question {
  question: string
  header?: string
  multiSelect: boolean
  options: { label: string; description?: string }[]
}

export interface PendingView {
  id: string
  kind: 'permission' | 'question' | 'plan'
  toolName: string
  summary: string
  questions?: Question[]
  /** Plan markdown, for kind 'plan'. */
  plan?: string
}

export interface Session {
  id: string
  cwd: string
  repo: string
  branch: string | null
  title: string
  activity: string
  status: SessionStatus
  tasks: TaskItem[]
  terminal: TerminalInfo | null
  pending: PendingView | null
  tabTag: string | null
  flash: string | null
  /** Name the user typed in the widget; wins over the auto title from the first prompt. */
  customTitle: string | null
  transcriptPath: string | null
  startedAt: number
  updatedAt: number
}

export type HookEvent = Record<string, unknown> & {
  hook_event_name: string
  session_id: string
  cwd?: string
}

export type Decision =
  | { kind: 'allow' }
  | { kind: 'deny'; message?: string }
  | { kind: 'defer' }
  | { kind: 'answer'; answers: Record<string, string> }

export interface HuddleState {
  sessions: Session[]
  /** A setup problem to show at the top of the widget, if any. */
  notice: string | null
}

/** API the preload script exposes to the renderer as `window.huddle`. */
export interface HuddleApi {
  onState(cb: (state: HuddleState) => void): () => void
  decide(pendingId: string, decision: Decision): void
  jump(sessionId: string): void
  dismiss(sessionId: string): void
  setHeight(px: number): void
  rename(sessionId: string, title: string): void
  hide(): void
}

export const HOOK_PORT = 47321
export const HOOK_PREFIX = `http://127.0.0.1:${HOOK_PORT}/hook/`
