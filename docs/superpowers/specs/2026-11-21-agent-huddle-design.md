# Agent Huddle (Windows) — Design

Date: 2026-11-21 · Status: awaiting approval

## Intent

A personal clone of @alextsoi_ai's "Agent Huddle" (reel Dfphrw3griE), built for one user on Windows.
They run several Claude Code sessions at once, each in its own Windows Terminal tab, often in separate
git worktrees, and lose track of which one is working, which is stuck waiting, and which is done.
Agent Huddle is a small always-on-top widget in a screen corner that answers "what are they doing?"
and lets them unblock agents without hunting through tabs.

Success: a full day of real work with 3–6 sessions where the user never cycles through tabs to find
the one waiting on them.

## Goals (match the reel)

1. **Corner widget**, always on top, frameless, dark. Header: `• Agent Huddle <count>`, sound toggle,
   collapse, close.
2. **One card per running session**: coloured robot avatar, title, current activity line, task progress
   (`5/7 Animations` plus bar), jump-to-tab button, dismiss (×) button.
3. **Click a card for step-by-step detail**: Claude's task list with done / in-progress / pending states,
   plus a "Terminal" block showing the current or last Bash command and its output.
4. **Permission inline**: card turns highlighted, "needs permission", shows `Tool: input`, with buttons
   **Allow / Deny / In Terminal**. After Allow the card briefly shows "Allowed ✓".
5. **Question inline** (Claude's AskUserQuestion): header chip, question, options, **Send /
   Answer in Terminal**. After Send the card briefly shows `Using "<choice>"`.
6. **Jump to tab**: focuses the Windows Terminal window and the tab running that session.
7. **Dismiss** a finished session from the list.
8. **Sound** (toggleable) when a session needs you or finishes.
9. **A real app, shareable across the user's Windows laptops**: a GitHub repo whose Releases page has
   an installer (`Agent Huddle Setup x.y.z.exe`, built by GitHub Actions on `windows-latest` when a
   `v*` tag is pushed). After installing, it opens from the Start menu or a desktop shortcut, never
   `npm start`. **First launch connects itself to that laptop's Claude Code** (installs the hooks),
   with no terminal step. Tray icon with Show / "Start with Windows" toggle / Quit. Each laptop
   shows only its own sessions.

## Non-goals

- macOS/Linux, VS Code terminals, WSL sessions, auto-update (download the new installer), code signing
  (Windows SmartScreen shows "More info → Run anyway" once).
- Launching new sessions from the widget.
- Showing *streaming* Bash output. Hooks only deliver output when a command finishes, so the
  Terminal block shows the running command, then its output once done.

## Anti-goals (a failure even if it "works")

- Any session behaving worse when the widget is closed or crashed. Claude Code must run exactly as today.
- A pending permission or question that can be answered **neither** in the widget **nor** in the terminal.
- Noticeable lag in Claude sessions caused by hooks.

## Constraints

- Windows 11, Windows Terminal, Claude Code CLI with hooks support.
- Must be buildable in about a day.

## Approaches considered

| Option | Trade-off | Verdict |
|---|---|---|
| **Electron + React + TS** | All TypeScript, server in the main process, Windows APIs reachable from Node; ~150 MB RAM | **Chosen**: fastest to build and debug the hard part (tab focus) |
| Tauri + React | ~⅓ the memory, more native feel; server and Windows integration in Rust | Slower to build in a day |
| Browser tab + local server | Simplest | Loses the always-on-top corner widget, which is the point |

The user chose the always-on-top corner widget built within a day; Electron was my recommendation.

## How it works

```
Claude Code session (WT tab) ──HTTP hooks──▶  Huddle server (Electron main, 127.0.0.1:47321)
        │                                            │  session store (in memory)
        └── transcript .jsonl ◀── read on demand ────┤
                                                     ▼
                                         Widget UI (React renderer, IPC)
```

**Hook registration.** On every app launch (idempotent), the app writes HTTP hooks into the user's global `~/.claude/settings.json`
(backing up the original first), pointing at `http://127.0.0.1:47321/hook/<event>` with a shared token
header. Connection failures are non-blocking, so when the widget isn't running, sessions behave normally.

| Hook | Used for |
|---|---|
| SessionStart / SessionEnd | add / remove card |
| UserPromptSubmit | set title (first prompt) and "working" |
| PreToolUse / PostToolUse | activity line, Terminal block (Bash command and output) |
| TaskCreated / TaskCompleted | progress `n/m` and task list |
| PermissionRequest | inline Allow / Deny (held request, see below) |
| PreToolUse matcher `AskUserQuestion` | inline answer via `updatedInput.answers` (held request) |
| Stop / Notification(idle_prompt) | "done / waiting for you" state and sound |

**Held requests.** For permissions and questions, the server holds the HTTP response open until the user
acts in the widget:
- Allow / Deny / Send → respond with the decision (for questions, `allow` plus `updatedInput` with answers).
- **In Terminal / Answer in Terminal** → respond with *no decision* so Claude Code shows its normal prompt,
  then jump to the tab.
- Safety timeout (default 5 min, under the 600 s hook limit) → respond with no decision, the same fallback.

**Session identity and title.** Key on `session_id`. Title: the session's custom/auto title from the
transcript if present, else the first prompt truncated. Subtitle shows repo · worktree/branch from `cwd`
(my addition for the worktree workflow). Avatar colour is derived from a hash of the session id.
Subagent events (they carry `agent_id`) roll up into the parent session's card rather than getting
their own cards.

**Jump to tab (riskiest part; prove it first).** Planned mechanism: a hook captures the session's
`WT_SESSION` env var and Claude Code's terminal title. To focus, use Windows UI Automation (via a small
PowerShell or .NET helper) to find the Windows Terminal tab whose name matches, select it, and bring
its window to the front. Fallback if titles aren't unique or stable: `wt -w <id> focus-tab -t <index>`
with the index recorded at session start.

## Spike before building (throwaway, about 1 hour)

1. Can we reliably focus a specific WT tab for a given Claude session? (UI Automation by title, then `wt focus-tab`.)
2. While a PermissionRequest HTTP hook is held, what does the terminal show? Does responding with no
   decision then bring up the normal prompt?
3. Does a PreToolUse `updatedInput.answers` for AskUserQuestion work end to end?

If (1) fails entirely, jump-to-tab degrades to "focus the Windows Terminal window", and the user is
told before the full build.

## Left to the builder

Port number and token storage, exact window size and corner, animation details, sound asset,
avatar art (original robot faces, styled like the reel but not copied), how long finished sessions
linger before auto-hiding.

## Where it lives

A new local repo on the user's machine (folder to be chosen). This doc is the first commit at
`docs/superpowers/specs/2026-11-21-agent-huddle-design.md`.
