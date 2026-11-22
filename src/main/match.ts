import type { Session } from '../shared/types'
import type { ClaudeTitles } from './transcript'

/** Strings to look for in Windows Terminal tab titles, most specific first. */
export function matchCandidates(s: Pick<Session, 'tabTag' | 'cwd' | 'repo'>, titles: ClaudeTitles): string[] {
  const folder = s.cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
  const all = [s.tabTag, titles.customTitle, titles.aiTitle, folder, s.repo]
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of all) {
    const x = raw?.replace(/\|/g, '').trim()
    if (!x || x.length < 2 || seen.has(x.toLowerCase())) continue
    seen.add(x.toLowerCase())
    out.push(x)
  }
  return out
}
