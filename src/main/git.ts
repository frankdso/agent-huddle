import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** Finds the enclosing git repo or worktree of `cwd` and reads its current branch without spawning git. */
export function readBranch(cwd: string): { branch: string | null; root: string | null } {
  let dir = resolve(cwd)
  for (let i = 0; i < 40; i++) {
    const dotgit = join(dir, '.git')
    if (existsSync(dotgit)) {
      try {
        let gitdir = dotgit
        if (statSync(dotgit).isFile()) {
          const m = /gitdir:\s*(.+)/.exec(readFileSync(dotgit, 'utf8'))
          if (!m) return { branch: null, root: dir }
          gitdir = resolve(dir, m[1].trim())
        }
        const head = readFileSync(join(gitdir, 'HEAD'), 'utf8').trim()
        const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head)
        return { branch: ref ? ref[1] : head.slice(0, 7), root: dir }
      } catch {
        return { branch: null, root: dir }
      }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return { branch: null, root: null }
}
