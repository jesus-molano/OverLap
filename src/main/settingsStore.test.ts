import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from '@shared/settings'
import { SettingsStore } from './settingsStore'

/** Simulates a settings file locked by another process (antivirus, cloud sync). */
const lock = vi.hoisted(() => ({
  path: '',
  failReads: 0,
  failCopies: 0,
  reads: 0
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const busy = (): Error =>
    Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      if (args[0] === lock.path) {
        lock.reads++
        if (lock.failReads > 0) {
          lock.failReads--
          throw busy()
        }
      }
      return actual.readFileSync(...args)
    },
    copyFileSync: (...args: Parameters<typeof actual.copyFileSync>) => {
      if (args[0] === lock.path && lock.failCopies > 0) {
        lock.failCopies--
        throw busy()
      }
      actual.copyFileSync(...args)
    }
  }
})

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'overlay-settings-'))
  file = join(dir, 'nested', 'settings.json')
  Object.assign(lock, { path: '', failReads: 0, failCopies: 0, reads: 0 })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  rmSync(dir, { recursive: true, force: true })
})

describe('SettingsStore', () => {
  it('uses defaults when the file is missing and does not create it until a change', () => {
    const store = SettingsStore.load(file)
    expect(store.settings).toEqual(DEFAULT_SETTINGS)
    expect(store.flush()).toBe(true)
    expect(existsSync(file)).toBe(false)
    store.update((s) => (s.radar.rangeM = 30))
    expect(store.flush()).toBe(true)
    expect(existsSync(`${file}.bak`)).toBe(false)
  })

  it('keeps a .bak of a corrupt file and falls back to defaults', () => {
    const corrupt = join(dir, 'settings.json')
    writeFileSync(corrupt, '{ not json')
    const store = SettingsStore.load(corrupt)
    expect(store.settings).toEqual(DEFAULT_SETTINGS)
    expect(readFileSync(`${corrupt}.bak`, 'utf8')).toBe('{ not json')
  })

  it('saves atomically and reloads what it saved', () => {
    const store = SettingsStore.load(file)
    store.update((s) => {
      s.widgets.radar.visible = false
      s.radar.rangeM = 30
    })
    expect(store.flush()).toBe(true)
    expect(existsSync(`${file}.tmp`)).toBe(false)
    const reloaded = SettingsStore.load(file)
    expect(reloaded.settings.widgets.radar.visible).toBe(false)
    expect(reloaded.settings.radar.rangeM).toBe(30)
  })

  it('normalizes updates and loaded files', () => {
    const store = SettingsStore.load(file)
    const next = store.update((s) => {
      s.relative.carsAhead = 50
    })
    expect(next.relative.carsAhead).toBe(10)
    const bom = String.fromCharCode(0xfeff)
    writeFileSync(join(dir, 'raw.json'), `${bom}{"radar":{"rangeM":1},"widgets":{"x":{}}}`)
    const loaded = SettingsStore.load(join(dir, 'raw.json'))
    expect(loaded.settings.radar.rangeM).toBe(5)
    expect(Object.keys(loaded.settings.widgets)).not.toContain('x')
  })

  it('does not mutate the previous settings object on update', () => {
    const store = SettingsStore.load(file)
    const before = store.settings
    store.update((s) => {
      s.widgets.relative.bounds.x = 1234
    })
    expect(before.widgets.relative.bounds.x).toBe(DEFAULT_SETTINGS.widgets.relative.bounds.x)
    expect(store.settings.widgets.relative.bounds.x).toBe(1234)
    store.flush()
  })

  it('backs up a file from an older version once, before the first save over it', () => {
    const old = join(dir, 'settings.json')
    const text = JSON.stringify({ version: 5, radar: { rangeM: 30 } })
    writeFileSync(old, text)
    const store = SettingsStore.load(old)
    expect(existsSync(`${old}.v5.bak`)).toBe(false)
    store.update((s) => (s.radar.rangeM = 40))
    expect(store.flush()).toBe(true)
    expect(readFileSync(`${old}.v5.bak`, 'utf8')).toBe(text)
    expect(JSON.parse(readFileSync(old, 'utf8')).version).toBe(SETTINGS_VERSION)
    // Later saves leave the copy alone, and a file of this version needs none.
    store.update((s) => (s.radar.rangeM = 50))
    store.flush()
    expect(readFileSync(`${old}.v5.bak`, 'utf8')).toBe(text)
    rmSync(`${old}.v5.bak`)
    const current = SettingsStore.load(old)
    current.update((s) => (s.radar.rangeM = 60))
    current.flush()
    expect(existsSync(`${old}.v5.bak`)).toBe(false)
  })

  it('debounces saves', () => {
    vi.useFakeTimers()
    const store = SettingsStore.load(file, 200)
    store.update((s) => (s.radar.rangeM = 10))
    vi.advanceTimersByTime(150)
    store.update((s) => (s.radar.rangeM = 50))
    vi.advanceTimersByTime(150)
    expect(existsSync(file)).toBe(false)
    vi.advanceTimersByTime(60)
    expect(JSON.parse(readFileSync(file, 'utf8')).radar.rangeM).toBe(50)
  })
})

describe('SettingsStore with a locked file', () => {
  let saved: string

  beforeEach(() => {
    file = join(dir, 'settings.json')
    lock.path = file
    const settings = structuredClone(DEFAULT_SETTINGS)
    settings.radar.rangeM = 30
    saved = JSON.stringify(settings)
    writeFileSync(file, saved)
  })

  it('retries a briefly locked file and loads it', () => {
    lock.failReads = 2
    const store = SettingsStore.load(file)
    expect(lock.reads).toBe(3)
    expect(store.settings.radar.rangeM).toBe(30)
    store.update((s) => (s.radar.rangeM = 50))
    expect(store.flush()).toBe(true)
    expect(existsSync(`${file}.bak`)).toBe(false)
  })

  it('uses defaults if it stays locked and backs the file up before the first save', () => {
    lock.failReads = Infinity
    const store = SettingsStore.load(file)
    expect(lock.reads).toBe(6)
    expect(store.settings).toEqual(DEFAULT_SETTINGS)
    expect(store.flush()).toBe(true)
    lock.failReads = 0
    expect(readFileSync(file, 'utf8')).toBe(saved)

    store.update((s) => (s.radar.rangeM = 50))
    expect(store.flush()).toBe(true)
    expect(readFileSync(`${file}.bak`, 'utf8')).toBe(saved)
    expect(JSON.parse(readFileSync(file, 'utf8')).radar.rangeM).toBe(50)

    // Only the first save backs up: later ones must not replace the .bak with our own file.
    store.update((s) => (s.radar.rangeM = 10))
    expect(store.flush()).toBe(true)
    expect(readFileSync(`${file}.bak`, 'utf8')).toBe(saved)
  })

  it('does not overwrite the unread file while it cannot be backed up', () => {
    lock.failReads = Infinity
    const store = SettingsStore.load(file)
    lock.failReads = 0
    lock.failCopies = 1
    store.update((s) => (s.radar.rangeM = 50))
    expect(store.flush()).toBe(false)
    expect(readFileSync(file, 'utf8')).toBe(saved)
    expect(existsSync(`${file}.bak`)).toBe(false)

    expect(store.flush()).toBe(true)
    expect(readFileSync(`${file}.bak`, 'utf8')).toBe(saved)
    expect(JSON.parse(readFileSync(file, 'utf8')).radar.rangeM).toBe(50)
  })

  it('needs no backup when the file disappears before the first save', () => {
    lock.failReads = Infinity
    const store = SettingsStore.load(file)
    lock.failReads = 0
    rmSync(file)
    store.update((s) => (s.radar.rangeM = 50))
    expect(store.flush()).toBe(true)
    expect(existsSync(`${file}.bak`)).toBe(false)
    expect(JSON.parse(readFileSync(file, 'utf8')).radar.rangeM).toBe(50)
  })
})
