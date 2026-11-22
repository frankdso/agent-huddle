import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NameStore } from '../src/main/names'

const tmp = () => join(mkdtempSync(join(tmpdir(), 'huddle-names-')), 'names.json')

describe('NameStore', () => {
  it('persists names across instances', () => {
    const p = tmp()
    new NameStore(p).set('s1', 'Auth refactor')
    expect(new NameStore(p).get('s1')).toBe('Auth refactor')
  })
  it('null removes a name', () => {
    const p = tmp()
    const a = new NameStore(p)
    a.set('s1', 'X')
    a.set('s1', null)
    expect(new NameStore(p).get('s1')).toBeNull()
  })
  it('keeps only the most recent 200 names', () => {
    const p = tmp()
    const a = new NameStore(p)
    for (let i = 0; i < 205; i++) a.set('s' + i, 'n' + i)
    const b = new NameStore(p)
    expect(b.get('s0')).toBeNull()
    expect(b.get('s204')).toBe('n204')
  })
  it('survives a corrupt file', () => {
    const p = tmp()
    writeFileSync(p, '{bad')
    expect(new NameStore(p).get('s1')).toBeNull()
  })
})
