import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseTitles, readTitles } from '../src/main/transcript'
import { matchCandidates } from '../src/main/match'

describe('parseTitles', () => {
  it('takes the last ai-title and custom-title in the transcript', () => {
    const text = [
      JSON.stringify({ type: 'user', message: { content: 'hi "type":"ai-title" fake' } }),
      JSON.stringify({ type: 'ai-title', aiTitle: 'First guess', sessionId: 's' }),
      JSON.stringify({ type: 'assistant' }),
      JSON.stringify({ type: 'ai-title', aiTitle: 'Full repo sweep', sessionId: 's' }),
      JSON.stringify({ type: 'custom-title', customTitle: 'My audit', sessionId: 's' }),
      '{broken json'
    ].join('\n')
    expect(parseTitles(text)).toEqual({ aiTitle: 'Full repo sweep', customTitle: 'My audit' })
  })
  it('returns nulls when there are none', () => {
    expect(parseTitles('')).toEqual({ aiTitle: null, customTitle: null })
  })
})

describe('readTitles', () => {
  it('reads from disk and tolerates a missing file', () => {
    const p = join(mkdtempSync(join(tmpdir(), 'huddle-t-')), 's.jsonl')
    writeFileSync(p, JSON.stringify({ type: 'ai-title', aiTitle: 'Polish hero' }) + '\n')
    expect(readTitles(p).aiTitle).toBe('Polish hero')
    expect(readTitles(p + 'x')).toEqual({ aiTitle: null, customTitle: null })
    expect(readTitles(null)).toEqual({ aiTitle: null, customTitle: null })
  })
})

describe('matchCandidates', () => {
  it('orders tab tag, Claude titles, then folder; drops blanks, pipes and duplicates', () => {
    expect(
      matchCandidates({ tabTag: 'k3f9', cwd: 'C:\\x\\sequence', repo: 'sequence' }, { aiTitle: 'Full | repo sweep', customTitle: null })
    ).toEqual(['k3f9', 'Full  repo sweep', 'sequence'])
    expect(matchCandidates({ tabTag: null, cwd: '', repo: 'a' }, { aiTitle: null, customTitle: 'Mine' })).toEqual(['Mine'])
  })
})
