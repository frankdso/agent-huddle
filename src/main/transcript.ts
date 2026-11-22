import { readFileSync } from 'node:fs'

export interface ClaudeTitles {
  /** Title Claude generates for the session; it's what Claude puts on the terminal tab. */
  aiTitle: string | null
  /** Title set with /rename inside Claude Code. */
  customTitle: string | null
}

/** Pulls the latest ai-title / custom-title entries out of a session transcript (JSONL). */
export function parseTitles(text: string): ClaudeTitles {
  const out: ClaudeTitles = { aiTitle: null, customTitle: null }
  for (const line of text.split('\n')) {
    if (!line.includes('"ai-title"') && !line.includes('"custom-title"')) continue
    try {
      const e = JSON.parse(line)
      if (e?.type === 'ai-title' && typeof e.aiTitle === 'string') out.aiTitle = e.aiTitle
      if (e?.type === 'custom-title' && typeof e.customTitle === 'string') out.customTitle = e.customTitle
    } catch {
      /* partial line */
    }
  }
  return out
}

export function readTitles(path: string | null): ClaudeTitles {
  if (!path) return { aiTitle: null, customTitle: null }
  try {
    return parseTitles(readFileSync(path, 'utf8'))
  } catch {
    return { aiTitle: null, customTitle: null }
  }
}
