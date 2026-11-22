# Agent Huddle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An installable Windows tray/corner widget that shows every running Claude Code session, lets you approve permissions and answer questions inline, and jumps to the session's Windows Terminal tab.

**Architecture:** Electron main process runs an HTTP server on 127.0.0.1:47321 that receives Claude Code HTTP hooks, folds them into a session store (a pure reducer), and holds permission/question requests open until the UI decides. A React renderer shows the store over IPC. A PowerShell UI Automation script focuses WT tabs.

**Tech Stack:** Electron, electron-vite, React 19, TypeScript, Tailwind CSS v4, Motion, Vitest, electron-builder (NSIS), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-21-agent-huddle-design.md`

## Global Constraints

- Server binds `127.0.0.1` only, port `47321`; every request must carry header `X-Huddle-Token` matching `~/.agent-huddle/config.json`'s token, otherwise 401.
- Hook URLs all start with `http://127.0.0.1:47321/hook/`; that prefix is how our entries are recognised when merging or removing.
- Held requests time out after `300000` ms and respond `{}` (no decision); hook `timeout` is set to `600`.
- With the app closed, Claude Code must behave exactly as before (HTTP hook connection failures are non-blocking by default; never set `onFailure: "block"`).
- `~/.claude/settings.json` is backed up to `settings.json.huddle-backup` before the first write, and non-Huddle keys are preserved byte-for-byte in meaning.
- Windows only. Installer name `Agent Huddle Setup ${version}.exe`.

## Review Focus

1. Two hook events for the same session arriving out of order or for a session never seen (no SessionStart because the app started mid-session): create the session lazily from any event.
2. App restarted while a request is held: Claude gets a connection error and falls back to the terminal prompt; no stuck state. Test: pending registry `resolveAll({})` on shutdown.
3. `settings.json` missing, empty, or containing comments/invalid JSON: never overwrite an unparseable file; log and skip hook install.
4. Very long Bash output or prompt text: truncate (output tail 2000 chars, title 48 chars) so the widget never balloons.
5. Session ends while its permission is pending: pending resolves `{}` and the card is removed.

---

### Task 0: Spike on Windows (throwaway, not committed)

Prove, on the real machine with computer use: (a) `scripts/focus-tab.ps1 -Match <text>` selects the WT tab whose title contains the text and fronts its window; (b) the title can be pinned per session (`CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` plus an OSC title set by a `ch` wrapper, or `wt nt --title … --suppressApplicationTitle`); (c) a held PermissionRequest HTTP hook: what the terminal shows, and that `{}` then gives the normal prompt; (d) PreToolUse `updatedInput.answers` answers AskUserQuestion. Record the outcome in the spec's "Jump to tab" section.

### Task 1: Scaffold

**Files:** `package.json`, `electron.vite.config.ts`, `tsconfig*.json`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/index.css`, `src/shared/types.ts`, `vitest.config.ts`, `.gitignore`

**Interfaces — Produces (`src/shared/types.ts`):**
- `type SessionStatus = 'working' | 'needs-permission' | 'asks-question' | 'waiting' | 'idle'`
- `interface TaskItem { id: string; subject: string; activeForm?: string; status: 'pending'|'in_progress'|'completed' }`
- `interface TerminalInfo { command: string; output: string | null; running: boolean }`
- `interface PendingView { id: string; kind: 'permission'|'question'; toolName: string; summary: string; questions?: Question[] }`
- `interface Question { question: string; header?: string; multiSelect: boolean; options: { label: string; description?: string }[] }`
- `interface Session { id: string; cwd: string; repo: string; branch: string | null; title: string; activity: string; status: SessionStatus; tasks: TaskItem[]; terminal: TerminalInfo | null; pending: PendingView | null; tabTag: string | null; flash: string | null; updatedAt: number }`
- `type HookEvent = Record<string, unknown> & { hook_event_name: string; session_id: string; cwd?: string }`
- `type Decision = { kind: 'allow' } | { kind: 'deny' } | { kind: 'defer' } | { kind: 'answer'; answers: Record<string,string> }`

- [ ] `npx vitest run` passes with a smoke test; `npx electron-vite build` succeeds. Commit.

### Task 2: Hook settings installer — `src/main/hooks-config.ts`

- `mergeHuddleHooks(settings: object, opts: { token: string }): object` removes every hook entry whose url starts with the prefix, then adds one entry per event in `HUDDLE_EVENTS = ['SessionStart','SessionEnd','UserPromptSubmit','PreToolUse','PostToolUse','PermissionRequest','TaskCreated','TaskCompleted','Stop','Notification']`, with `matcher: "*"` for tool events (`PreToolUse`, `PostToolUse`, `PermissionRequest`), shape `{ type:'http', url:`${PREFIX}${event}`, timeout:600, headers:{ 'X-Huddle-Token': token, 'X-Huddle-Tab': '$HUDDLE_TAB' }, allowedEnvVars:['HUDDLE_TAB'] }`.
- `installHooks(settingsPath: string, token: string): { ok: boolean; reason?: string }`: backup once, refuse on unparseable JSON.
- Tests: merge into `{}`; merge preserves a user's own `PreToolUse` command hook and `env`; running merge twice is idempotent (deep-equal); unparseable file left untouched with `ok:false`; backup created exactly once. Commit.

### Task 3: Session store — `src/main/store.ts`, `src/main/describe.ts`

- `reduce(sessions: Map<string,Session>, ev: HookEvent, tabTag: string|null, now: number): Map<string,Session>` (new map; creates the session lazily from any event).
- `describeTool(name: string, input: any): string`, e.g. Bash → `input.description ?? first 60 chars of command`; Read → `Reading <basename>`; Edit/Write/MultiEdit → `Editing <basename>`; Grep/Glob → `Searching`; WebFetch/WebSearch → `Browsing the web`; Task/Agent → `Running a subagent`; default `Using <name>`.
- Rules: UserPromptSubmit → working, title from the prompt if empty (≤48 chars, single line); PreToolUse → activity; Bash sets terminal `{command, output:null, running:true}`; PostToolUse Bash → output = tail 2000 of `tool_response.stdout ?? tool_response.output ?? String(tool_response)`; TaskCreated → push `{id: task_id, subject: task_subject, status:'pending'}`; TaskCompleted → mark completed; PreToolUse `TaskUpdate` with `status` → update that id; PreToolUse `TodoWrite` → replace tasks from `todos`; Stop / Notification `idle_prompt` → waiting, activity "Waiting for you"; SessionEnd → delete. `repo` = basename of the git top-level guessed from cwd (basename(cwd)); branch from `.git/HEAD` read by the server (not the reducer).
- Tests for each rule, plus Review Focus 1 and 4. Commit.

### Task 4: Pending registry + server — `src/main/pending.ts`, `src/main/server.ts`

- `class PendingRegistry { hold(sessionId, view: Omit<PendingView,'id'>, timeoutMs): { id: string; promise: Promise<Decision> }; resolve(id: string, d: Decision): boolean; resolveSession(sessionId: string, d: Decision): void; resolveAll(d: Decision): void }`
- `toHookResponse(event: 'PermissionRequest'|'PreToolUse', d: Decision, toolInput: any): object`: allow → `{hookSpecificOutput:{hookEventName:'PermissionRequest',decision:{behavior:'allow'}}}`; deny → `behavior:'deny', message:'Denied from Agent Huddle'`; answer → `{hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'allow',updatedInput:{...toolInput, answers}}}`; defer → `{}`.
- `startServer(opts: { port: number; token: string; onEvent(ev, tabTag): void; registry: PendingRegistry; timeoutMs: number }): Promise<http.Server>`: holds on PermissionRequest and on PreToolUse where `tool_name === 'AskUserQuestion'`; every other event replies `{}` at once.
- Integration tests with real HTTP on an ephemeral port: 401 without a token; PermissionRequest held then allowed returns the allow JSON; question answered returns the answers; timeout returns `{}`; SessionEnd while pending → `{}` (Review Focus 5); `resolveAll` on close (Review Focus 2). Commit.

### Task 5: Main process wiring — `src/main/index.ts`, `window.ts`, `tray.ts`, `jump.ts`, `resources/focus-tab.ps1`

- Window: 360 px wide, frameless, transparent, `alwaysOnTop('floating')`, `skipTaskbar`, top-right of the primary work area with a 16 px margin, height set from the renderer via IPC `huddle:height`.
- Tray: Show/Hide, "Start with Windows" (`app.setLoginItemSettings`), "Reconnect Claude Code" (re-run installHooks), Quit. Single-instance lock.
- On launch: ensure the token config exists, `installHooks`, start the server, push `huddle:state` (array sorted by updatedAt desc) to the renderer on every change (throttled 50 ms).
- IPC from the renderer: `decide(pendingId, Decision)`, `jump(sessionId)`, `dismiss(sessionId)`, `setHeight(px)`, `quit()`.
- `jump(session)`: run `powershell -NoProfile -ExecutionPolicy Bypass -File focus-tab.ps1 -Match <tabTag ?? repo>`, based on the Task 0 outcome.
- Verify: `npx electron-vite build`. Commit.

### Task 6: Renderer UI — `src/renderer/src/{App,Header,SessionCard,SessionDetail,PermissionPanel,QuestionPanel,Avatar,Progress,sound}.tsx`

Matches the reel: dark panel `#16171a`, card `#1f2024`, accent lime `#d4f53c`, 12 px radius, Inter/system font. Header `• Agent Huddle N`, sound toggle, collapse, close. Card: robot avatar (original SVG, colour from hash of id over 6 colours), title, activity line (lime when it needs you), `done/total` plus bar, jump and × buttons. The card a pending request belongs to gets a lime border and its panel. Clicking a card opens detail (back arrow, task list with ✓ / spinner / ○, Terminal block). Flash text ("Allowed ✓", `Using "<choice>"`) for 2 s. Sound: WebAudio two-note chime when any session enters needs-permission / asks-question / waiting, if enabled (persisted in localStorage). Empty state: "No Claude sessions running". Motion for list layout and expand.
- Verify by rendering with fixture state in a browser and taking screenshots. Commit.

### Task 7: Packaging + sharing — `electron-builder.yml`, `.github/workflows/release.yml`, `README.md`

- NSIS installer, per-user, desktop and Start-menu shortcuts, `extraResources: resources/focus-tab.ps1`, app icon.
- Workflow: on tag `v*`, runs on `windows-latest`: `npm ci`, `npm test`, `npx electron-builder --win --publish always` with `GH_TOKEN`.
- README: download, install, SmartScreen note, using the `ch` launcher if Task 0 needs it.
- Commit.

### Task 8: End-to-end verification on Windows (computer use)

Install the built app, open two WT tabs with Claude sessions, and confirm: cards appear with titles; tasks progress; Allow and Deny work; a question answered in the widget is used by Claude; "In Terminal" brings up the normal prompt; jump focuses the right tab; with the app quit, Claude works normally.
