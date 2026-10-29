import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installLogFile } from './logFile'

const LEVELS = ['log', 'info', 'warn', 'error'] as const
let saved: Record<(typeof LEVELS)[number], (...args: unknown[]) => void>
let dir: string

beforeEach(() => {
  saved = { log: console.log, info: console.info, warn: console.warn, error: console.error }
  // The originals stay quiet in the test output; installLogFile wraps these.
  for (const level of LEVELS) console[level] = () => {}
  dir = mkdtempSync(join(tmpdir(), 'overlap-log-'))
})

afterEach(() => {
  Object.assign(console, saved)
  rmSync(dir, { recursive: true, force: true })
})

describe('installLogFile', () => {
  it('copies every console level to the file, formatted, after a start line', () => {
    const file = join(dir, 'sub', 'overlap.log')
    installLogFile(file)
    console.log('[main] source: %s', 'mock')
    console.error('[settings] could not save', new Error('EBUSY'))
    const text = readFileSync(file, 'utf8')
    expect(text).toMatch(/^---- .* start \(pid \d+\)\n/)
    expect(text).toContain(' log [main] source: mock\n')
    expect(text).toContain(' error [settings] could not save Error: EBUSY')
  })

  it('still calls the console, and a console that throws never reaches the caller', () => {
    const file = join(dir, 'overlap.log')
    const seen: unknown[] = []
    console.warn = (...args: unknown[]) => {
      seen.push(...args)
      throw new Error('EPIPE')
    }
    installLogFile(file)
    expect(() => console.warn('x')).not.toThrow()
    expect(seen).toEqual(['x'])
  })

  it('moves a log past 1 MB aside at startup', () => {
    const file = join(dir, 'overlap.log')
    writeFileSync(file, 'x'.repeat(1024 * 1024 + 1))
    installLogFile(file)
    expect(existsSync(join(dir, 'overlap.old.log'))).toBe(true)
    expect(readFileSync(file, 'utf8')).toMatch(/^---- /)
  })
})
