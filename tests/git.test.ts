import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readBranch } from '../src/main/git'

const tmp = () => mkdtempSync(join(tmpdir(), 'huddle-git-'))

describe('readBranch', () => {
  it('reads the branch of a normal repo from a subfolder', () => {
    const root = tmp()
    mkdirSync(join(root, '.git'))
    writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/feature/login\n')
    mkdirSync(join(root, 'src', 'deep'), { recursive: true })
    expect(readBranch(join(root, 'src', 'deep'))).toEqual({ branch: 'feature/login', root })
  })

  it('reads the branch of a worktree (.git is a file)', () => {
    const main = tmp()
    const gitdir = join(main, '.git', 'worktrees', 'wt-auth')
    mkdirSync(gitdir, { recursive: true })
    writeFileSync(join(gitdir, 'HEAD'), 'ref: refs/heads/auth\n')
    const wt = tmp()
    writeFileSync(join(wt, '.git'), `gitdir: ${gitdir}\n`)
    expect(readBranch(wt)).toEqual({ branch: 'auth', root: wt })
  })

  it('shows a short sha for a detached HEAD', () => {
    const root = tmp()
    mkdirSync(join(root, '.git'))
    writeFileSync(join(root, '.git', 'HEAD'), '0123456789abcdef0123456789abcdef01234567\n')
    expect(readBranch(root).branch).toBe('0123456')
  })

  it('returns nulls outside a repo', () => {
    expect(readBranch(tmp())).toEqual({ branch: null, root: null })
  })
})
