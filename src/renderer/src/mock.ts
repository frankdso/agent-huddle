import type { HuddleApi, HuddleState, Session } from '@shared/types'

/** Browser-only preview data so the UI can be developed and screenshotted outside Electron. */
export function installMock(): void {
  const now = Date.now()
  const base = (id: string, patch: Partial<Session>): Session => ({
    id,
    cwd: '',
    repo: 'sitefolio',
    branch: 'main',
    title: '',
    activity: '',
    status: 'working',
    tasks: [],
    terminal: null,
    pending: null,
    tabTag: null,
    flash: null,
    startedAt: now,
    updatedAt: now,
    ...patch
  })
  const tasks = (done: number, total: number, cur: string) =>
    Array.from({ length: total }, (_, i) => ({
      id: String(i),
      subject: i === done ? cur : `Step ${i + 1}`,
      activeForm: i === done ? cur : undefined,
      status: (i < done ? 'completed' : i === done ? 'in_progress' : 'pending') as 'completed' | 'in_progress' | 'pending'
    }))

  const params = new URLSearchParams(location.search)
  let state: HuddleState = {
    notice: null,
    sessions:
      params.get('empty') !== null
        ? []
        : [
            base('a1', {
              title: 'Auth refresh tokens',
              repo: 'sitefolio-wt-auth',
              branch: 'auth-refresh',
              activity: 'Running the test suite',
              tasks: tasks(3, 5, 'Running the test suite'),
              terminal: { command: 'npm test -- auth', output: ' ✓ refresh.test.ts (12)\n ✓ session.test.ts (8)\n ❯ middleware.test.ts', running: true }
            }),
            base('b2', {
              title: 'Octo landing page polish',
              repo: 'octo-landing',
              activity: 'needs permission',
              tasks: tasks(2, 6, 'Fixing hero layout'),
              status: 'needs-permission',
              pending: { id: 'p1', kind: 'permission', toolName: 'Bash', summary: 'Bash: npx vercel deploy --prebuilt' }
            }),
            base('c3', {
              title: 'Trade invite emails',
              repo: 'sitefolio-wt-invites',
              branch: 'invites',
              status: 'asks-question',
              tasks: tasks(1, 4, 'Drafting email copy'),
              pending: {
                id: 'q1',
                kind: 'question',
                toolName: 'AskUserQuestion',
                summary: 'asks a question',
                questions: [
                  {
                    question: 'Which email provider should invites go through?',
                    header: 'Email',
                    multiSelect: false,
                    options: [
                      { label: 'Resend', description: 'Already used for password resets' },
                      { label: 'Postmark' },
                      { label: 'SES' }
                    ]
                  }
                ]
              }
            }),
            base('d4', {
              title: 'COMP 4900 notes summary',
              repo: 'notes',
              branch: null,
              status: 'waiting',
              activity: 'Waiting for you',
              tasks: tasks(4, 4, '')
            })
          ]
  }
  if (params.get('pending') === '0') state.sessions = state.sessions.map((s) => ({ ...s, pending: null, status: 'working', activity: s.activity || 'Thinking' }))

  let listener: ((s: HuddleState) => void) | null = null
  const push = () => listener?.(structuredClone(state))
  const api: HuddleApi = {
    onState(cb) {
      listener = cb
      setTimeout(push, 0)
      return () => (listener = null)
    },
    decide(pendingId, d) {
      state.sessions = state.sessions.map((s) =>
        s.pending?.id === pendingId
          ? {
              ...s,
              pending: null,
              status: 'working',
              flash: d.kind === 'allow' ? 'Allowed ✓' : d.kind === 'answer' ? `Using “${Object.values(d.answers)[0]}”` : null
            }
          : s
      )
      push()
    },
    jump: () => {},
    dismiss(id) {
      state.sessions = state.sessions.filter((s) => s.id !== id)
      push()
    },
    setHeight: () => {},
    hide: () => {}
  }
  window.huddle = api
}
