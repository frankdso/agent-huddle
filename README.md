# Agent Huddle

A small always-on-top widget for Windows that keeps an eye on every Claude Code session you have running, across Windows Terminal tabs and git worktrees.

- See every session: what it's doing, its task progress, and its branch. Sessions are named after their folder; click the pencil to rename one.
- Click a session to see its task list and the last terminal command step by step.
- **Allow / Deny** permission prompts and **answer Claude's questions** without leaving what you're doing.
- **Jump** straight to the session's Windows Terminal tab.
- A soft chime when a session needs you (mute it from the header).

## Install (any Windows laptop)

1. Open the [Releases page](https://github.com/frankdso/agent-huddle/releases) and download `Agent-Huddle-Setup-x.y.z.exe`.
2. Run it. Windows SmartScreen may warn because the app isn't code-signed: click **More info → Run anyway**.
3. That's it. Agent Huddle opens in the top-right corner, adds itself to Start and the desktop, and starts with Windows (turn that off from the tray icon).

On launch it connects itself to Claude Code by adding a few hooks to `~/.claude/settings.json` (your original file is backed up once as `settings.json.huddle-backup`). When you quit it from the tray, it takes those hooks back out, so Claude Code behaves exactly as before.

Sessions started **before** Agent Huddle was running won't show up until you restart them.

## Getting "jump to tab" exactly right

Agent Huddle finds a session's tab by matching its title. By default it matches the folder name, which works when each tab is in a different folder or worktree. For exact matching, even with several sessions in the same folder, start Claude with this tiny `ch` launcher. Add it to your PowerShell profile (`notepad $PROFILE`):

```powershell
function ch {
  $tag = -join ((97..122) + (48..57) | Get-Random -Count 4 | ForEach-Object { [char]$_ })
  $env:HUDDLE_TAB = $tag
  $env:CLAUDE_CODE_DISABLE_TERMINAL_TITLE = '1'
  $host.UI.RawUI.WindowTitle = "$(Split-Path -Leaf (Get-Location)) · $tag"
  try { claude @args } finally { Remove-Item Env:HUDDLE_TAB -ErrorAction SilentlyContinue }
}
```

Then run `ch` instead of `claude`.

## How it works

Claude Code sends HTTP hooks to `127.0.0.1:47321` (local only, token-protected). For permission prompts and questions, Agent Huddle holds the hook open until you choose. **In Terminal** (or no answer within 5 minutes) hands the prompt back to the terminal as usual.

## Develop

```bash
npm install
npm run dev        # run the widget with hot reload
npm test           # unit + integration tests
npm run dist       # build the Windows installer into dist/
```

Releases: bump `version` in `package.json`, push, then either push a tag like `v0.2.0` or click **Run workflow** on the Release action. GitHub Actions builds the installer and publishes it (tag + release + files) in one step.
