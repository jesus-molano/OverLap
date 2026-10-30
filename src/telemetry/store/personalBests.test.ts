import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LapReference, PersonalBestLabel } from '@shared/delta/references'
import { RACE_TIMING_LINES } from '@shared/race/raceView'
import {
  MAX_PERSONAL_BESTS,
  PERSONAL_BESTS_FILE,
  PERSONAL_BESTS_SAVE_DELAY_MS,
  createFileStore,
  legacyPersonalBestKey,
  openPersonalBestStore,
  type StoreLog
} from './personalBests'

/** Scripted IO failures, keyed by path; counts what reached the disk. */
const io = vi.hoisted(() => ({
  writes: [] as string[],
  failWrites: 0,
  failReadsOf: '',
  failCopies: 0
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    writeFile: (...args: Parameters<typeof actual.writeFile>) => {
      io.writes.push(String(args[0]))
      if (io.failWrites > 0) {
        io.failWrites--
        return Promise.reject(Object.assign(new Error('ENOSPC: no space left'), { code: 'ENOSPC' }))
      }
      return actual.writeFile(...args)
    },
    copyFile: (...args: Parameters<typeof actual.copyFile>) => {
      if (io.failCopies > 0) {
        io.failCopies--
        return Promise.reject(
          Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
        )
      }
      return actual.copyFile(...args)
    }
  }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const busy = (): Error =>
    Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      if (io.failReadsOf !== '' && args[0] === io.failReadsOf) throw busy()
      return actual.readFileSync(...args)
    },
    copyFileSync: (...args: Parameters<typeof actual.copyFileSync>) => {
      if (io.failCopies > 0) {
        io.failCopies--
        throw busy()
      }
      actual.copyFileSync(...args)
    }
  }
})

let dir: string
let file: string
let logs: [string, string][]
const log: StoreLog = (level, message) => logs.push([level, message])

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'overlay-bests-'))
  file = join(dir, PERSONAL_BESTS_FILE)
  logs = []
  Object.assign(io, { writes: [], failWrites: 0, failReadsOf: '', failCopies: 0 })
})

afterEach(() => {
  vi.useRealTimers()
  rmSync(dir, { recursive: true, force: true })
})

/** A plausible lap: uniform pace, profile from 0 to lapTime. */
function lap(lapTime: number, recordedAt = '2026-10-25T10:00:00.000Z'): LapReference {
  const profile = Array.from(
    { length: RACE_TIMING_LINES + 1 },
    (_, i) => (lapTime * i) / RACE_TIMING_LINES
  )
  return { lapTime, profile, recordedAt }
}

function readFile(): { version: number; bests: Record<string, LapReference> } {
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** Writes that reached the store file (its tmp or the file itself). */
function fileWrites(): number {
  return io.writes.filter((p) => p.startsWith(file)).length
}

const KEY = '67@9001/Gran Premio'
/** Notepad's byte order mark. */
const BOM = String.fromCharCode(0xfeff)

describe('createFileStore', () => {
  it('starts empty without a file and creates none until there is a best', async () => {
    const store = createFileStore(dir, { log })
    expect(store.get(KEY)).toBeNull()
    await store.flush()
    expect(existsSync(file)).toBe(false)
    expect(fileWrites()).toBe(0)
    expect(logs).toEqual([])
  })

  it('keeps a best in memory at once and on disk after flush, rounded, and reloads it', async () => {
    const store = createFileStore(dir, { log })
    const first = lap(97.123456)
    expect(store.offer(KEY, first)).toBe(true)
    const kept = store.get(KEY)
    expect(kept?.lapTime).toBe(97.1235)
    expect(kept?.profile).toHaveLength(RACE_TIMING_LINES + 1)
    expect(kept?.profile[50]).toBe(48.562)
    expect(kept?.recordedAt).toBe('2026-10-25T10:00:00.000Z')
    expect(Object.isFrozen(kept)).toBe(true)
    expect(Object.isFrozen(kept?.profile)).toBe(true)

    await store.flush()
    const saved = readFile()
    expect(saved.version).toBe(1)
    expect(Object.keys(saved.bests)).toEqual([KEY])
    expect(saved.bests[KEY]).toEqual(kept)
    expect(existsSync(`${file}.tmp`)).toBe(false)

    const reloaded = createFileStore(dir, { log })
    expect(reloaded.get(KEY)).toEqual(kept)
    expect(logs).toEqual([])
  })

  it('takes only improvements, and only an improvement schedules a write', async () => {
    const store = createFileStore(dir, { log })
    expect(store.offer(KEY, lap(98))).toBe(true)
    await store.flush()
    expect(fileWrites()).toBe(1)
    expect(store.offer(KEY, lap(98))).toBe(false)
    expect(store.offer(KEY, lap(98.5))).toBe(false)
    await store.flush()
    expect(fileWrites()).toBe(1)
    expect(store.offer(KEY, lap(97.9, '2026-10-25T11:00:00.000Z'))).toBe(true)
    expect(store.get(KEY)?.recordedAt).toBe('2026-10-25T11:00:00.000Z')
    // Another layout of the same track is another best.
    expect(store.offer('67@9001/Oval', lap(120))).toBe(true)
    await store.flush()
    expect(fileWrites()).toBe(2)
    expect(Object.keys(readFile().bests).sort()).toEqual(['67@9001/Gran Premio', '67@9001/Oval'])
  })

  it('copies the profile: the caller may reuse its buffer', () => {
    const store = createFileStore(dir, { log })
    const source = lap(90)
    const buffer = source.profile as number[]
    store.offer(KEY, source)
    buffer.fill(0)
    expect(store.get(KEY)?.profile[100]).toBe(90)
  })

  it('accepts a typed-array profile', () => {
    const store = createFileStore(dir, { log })
    const source = lap(90)
    const typed = Float64Array.from(source.profile) as unknown as readonly number[]
    expect(store.offer(KEY, { ...source, profile: typed })).toBe(true)
    expect(Array.isArray(store.get(KEY)?.profile)).toBe(true)
  })

  it('rejects laps that are not usable references and bad keys', () => {
    const store = createFileStore(dir, { log })
    const good = lap(90)
    const broken = (patch: (p: number[]) => void): LapReference => {
      const profile = [...good.profile]
      patch(profile)
      return { ...good, profile }
    }
    const bad: unknown[] = [
      { ...good, lapTime: 0 },
      { ...good, lapTime: -90 },
      { ...good, lapTime: Number.NaN },
      { ...good, lapTime: Infinity },
      { ...good, lapTime: 7200, profile: lap(7200).profile },
      { ...good, lapTime: '90' },
      { ...good, profile: good.profile.slice(1) },
      { ...good, profile: [...good.profile, 90] },
      { ...good, lapTime: 89 },
      broken((p) => (p[0] = 1)),
      broken((p) => (p[40] = 10)),
      broken((p) => (p[60] = Number.NaN)),
      broken((p) => (p[100] = 95)),
      { ...good, profile: 'x' },
      { ...good, profile: new DataView(new ArrayBuffer(808)) },
      null,
      'lap'
    ]
    for (const b of bad) expect(store.offer(KEY, b as LapReference), JSON.stringify(b)).toBe(false)
    for (const key of ['', 'x'.repeat(201), 5, null]) {
      expect(store.offer(key as string, good)).toBe(false)
    }
    expect(store.get(KEY)).toBeNull()
    // Within the tolerance: the profile may end up to 0.05 s off the lap time.
    expect(store.offer(KEY, { ...good, lapTime: 90.04 })).toBe(true)
  })

  it('keeps an odd recordedAt out: not a string or too long gives ""', () => {
    const store = createFileStore(dir, { log })
    store.offer('a', { ...lap(90), recordedAt: 5 as unknown as string })
    store.offer('b', { ...lap(90), recordedAt: 'x'.repeat(41) })
    expect(store.get('a')?.recordedAt).toBe('')
    expect(store.get('b')?.recordedAt).toBe('')
  })

  it('debounces a burst of bests into one write after the delay', async () => {
    vi.useFakeTimers()
    const store = createFileStore(dir, { log })
    store.offer('a', lap(90))
    vi.advanceTimersByTime(1000)
    store.offer('b', lap(91))
    store.offer('a', lap(89))
    vi.advanceTimersByTime(PERSONAL_BESTS_SAVE_DELAY_MS - 1001)
    expect(fileWrites()).toBe(0)
    vi.advanceTimersByTime(1)
    await store.flush()
    expect(fileWrites()).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
    expect(Object.keys(readFile().bests).sort()).toEqual(['a', 'b'])
    expect(readFile().bests.a?.lapTime).toBe(89)
  })

  it('flush writes at once and cancels the pending timer', async () => {
    vi.useFakeTimers()
    const store = createFileStore(dir, { log })
    store.offer(KEY, lap(90))
    expect(vi.getTimerCount()).toBe(1)
    await store.flush()
    expect(vi.getTimerCount()).toBe(0)
    expect(fileWrites()).toBe(1)
    vi.advanceTimersByTime(60_000)
    await store.flush()
    expect(fileWrites()).toBe(1)
  })

  it('serialises writes: a best during a write is saved by the next one', async () => {
    const store = createFileStore(dir, { log, saveDelayMs: 0 })
    store.offer('a', lap(90))
    const first = store.flush()
    store.offer('b', lap(91))
    await first
    await store.flush()
    expect(Object.keys(readFile().bests).sort()).toEqual(['a', 'b'])
  })

  it('keeps a .bak of a corrupt file, starts empty and logs once', async () => {
    writeFileSync(file, '{ not json')
    const store = createFileStore(dir, { log })
    expect(store.get(KEY)).toBeNull()
    expect(readFileSync(`${file}.bak`, 'utf8')).toBe('{ not json')
    expect(logs).toHaveLength(1)
    expect(logs[0]?.[0]).toBe('warn')
    store.offer(KEY, lap(90))
    await store.flush()
    expect(readFile().bests[KEY]?.lapTime).toBe(90)
    // The backup is the corrupt file, not overwritten by the save.
    expect(readFileSync(`${file}.bak`, 'utf8')).toBe('{ not json')
  })

  it('treats another version or shape as corrupt', () => {
    for (const text of [
      JSON.stringify({ version: 2, bests: {} }),
      JSON.stringify({ version: 1, bests: [] }),
      JSON.stringify([1, 2]),
      'null',
      ''
    ]) {
      writeFileSync(file, text)
      rmSync(`${file}.bak`, { force: true })
      const store = createFileStore(dir, { log })
      expect(store.get(KEY)).toBeNull()
      expect(readFileSync(`${file}.bak`, 'utf8'), text).toBe(text)
    }
  })

  it('drops invalid entries one by one, keeping the valid ones and a .bak', () => {
    const good = lap(90)
    const text = JSON.stringify({
      version: 1,
      bests: {
        [KEY]: good,
        '1@2/': { ...good, lapTime: -1 },
        '1@3/': { ...good, profile: good.profile.slice(0, 50) },
        '1@4/': { ...good, profile: [...good.profile].reverse() },
        '1@5/': 'lap',
        '': good,
        '1@6/': { lapTime: 90, profile: good.profile }
      }
    })
    writeFileSync(file, `${BOM}${text}`)
    const store = createFileStore(dir, { log })
    expect(store.get(KEY)?.lapTime).toBe(90)
    for (const key of ['1@2/', '1@3/', '1@4/', '1@5/', '']) expect(store.get(key)).toBeNull()
    // A missing recordedAt is just unknown.
    expect(store.get('1@6/')?.recordedAt).toBe('')
    expect(logs).toEqual([
      ['warn', 'Personal bests: ignored 5 invalid entries (copy kept as .bak)']
    ])
    expect(readFileSync(`${file}.bak`, 'utf8')).toBe(`${BOM}${text}`)
  })

  it('round-trips a key that looks like an object prototype', async () => {
    const store = createFileStore(dir, { log })
    store.offer('__proto__', lap(90))
    await store.flush()
    expect(createFileStore(dir, { log }).get('__proto__')?.lapTime).toBe(90)
  })

  it('caps the entries, dropping the oldest recordings, never the new one', async () => {
    const at = (n: number): string => `2026-10-${String(n).padStart(2, '0')}T00:00:00.000Z`
    const bests = Object.fromEntries([5, 1, 4, 2, 3].map((n) => [`k${n}`, lap(90 + n, at(n))]))
    writeFileSync(file, JSON.stringify({ version: 1, bests }))
    const store = createFileStore(dir, { log, maxEntries: 3 })
    expect(['k1', 'k2', 'k3', 'k4', 'k5'].map((k) => store.get(k) !== null)).toEqual([
      false,
      false,
      true,
      true,
      true
    ])
    // Over the cap is not an error: no .bak.
    expect(existsSync(`${file}.bak`)).toBe(false)
    expect(store.offer('k0', lap(80, ''))).toBe(true)
    expect(store.get('k0')).not.toBeNull()
    expect(store.get('k3')).toBeNull()
    // Improving an existing key evicts nothing.
    expect(store.offer('k4', lap(85, at(9)))).toBe(true)
    expect(['k0', 'k4', 'k5'].every((k) => store.get(k) !== null)).toBe(true)
    await store.flush()
    expect(Object.keys(readFile().bests).sort()).toEqual(['k0', 'k4', 'k5'])
    expect(MAX_PERSONAL_BESTS).toBe(500)
  })

  it('keeps bests in memory when saving fails, logs once and saves on a later try', async () => {
    const store = createFileStore(dir, { log, saveDelayMs: 0 })
    io.failWrites = 2
    expect(store.offer(KEY, lap(90))).toBe(true)
    await store.flush()
    expect(store.offer(KEY, lap(89))).toBe(true)
    await store.flush()
    expect(store.get(KEY)?.lapTime).toBe(89)
    expect(existsSync(file)).toBe(false)
    expect(logs).toHaveLength(1)
    expect(logs[0]?.[0]).toBe('error')
    // The flush on shutdown tries again without a new best.
    await store.flush()
    expect(readFile().bests[KEY]?.lapTime).toBe(89)
    // A later failure is logged again after a success.
    io.failWrites = 1
    store.offer(KEY, lap(88))
    await store.flush()
    expect(logs).toHaveLength(2)
  })

  it('never throws when the directory cannot be created', async () => {
    const blocker = join(dir, 'not-a-dir')
    writeFileSync(blocker, 'x')
    const store = createFileStore(join(blocker, 'sub'), { log })
    expect(store.offer(KEY, lap(90))).toBe(true)
    await expect(store.flush()).resolves.toBeUndefined()
    expect(logs).toHaveLength(1)
  })

  it('backs up an unreadable file before replacing it, and never replaces it without one', async () => {
    writeFileSync(file, JSON.stringify({ version: 1, bests: { [KEY]: lap(80) } }))
    io.failReadsOf = file
    const store = createFileStore(dir, { log, saveDelayMs: 0 })
    io.failReadsOf = ''
    expect(store.get(KEY)).toBeNull()
    expect(logs.map((l) => l[0])).toEqual(['warn'])

    io.failCopies = 1
    store.offer(KEY, lap(90))
    await store.flush()
    // No copy, no write: the unread file is still there as it was.
    expect(readFile().bests[KEY]?.lapTime).toBe(80)
    expect(logs.map((l) => l[0])).toEqual(['warn', 'error'])

    await store.flush()
    expect(readFileSync(`${file}.bak`, 'utf8')).toContain('"lapTime":80')
    expect(readFile().bests[KEY]?.lapTime).toBe(90)
  })
})

const SPA: PersonalBestLabel = { car: 'Porsche 911 GT3 R', track: 'Spa', layout: 'Grand Prix' }

describe('managing the stored bests', () => {
  it('keeps the names of the car and layout, on disk too, and lists newest first', async () => {
    const store = createFileStore(dir, { log })
    store.offer(KEY, lap(98, '2026-10-20T10:00:00.000Z'), SPA)
    store.offer('80@1/', lap(70, '2026-10-24T10:00:00.000Z'), {
      car: ' Mazda MX-5 ',
      track: 'Okayama',
      layout: ''
    })
    store.offer('1@1/x', lap(60, ''))
    expect(store.list()).toEqual([
      {
        key: '80@1/',
        lapTime: 70,
        recordedAt: '2026-10-24T10:00:00.000Z',
        car: 'Mazda MX-5',
        track: 'Okayama',
        layout: ''
      },
      { key: KEY, lapTime: 98, recordedAt: '2026-10-20T10:00:00.000Z', ...SPA },
      { key: '1@1/x', lapTime: 60, recordedAt: '', car: '', track: '', layout: '' }
    ])
    await store.flush()
    expect(readFile().bests[KEY]).toMatchObject(SPA)
    expect(createFileStore(dir, { log }).list()).toEqual(store.list())
  })

  it('names a best stored without names with the next lap there, faster or not', async () => {
    writeFileSync(file, JSON.stringify({ version: 1, bests: { [KEY]: lap(98) } }))
    const changes = vi.fn()
    const store = createFileStore(dir, { log, onChange: changes })
    expect(store.list()[0]).toMatchObject({ car: '', track: '', layout: '' })
    expect(store.offer(KEY, lap(99), SPA)).toBe(false)
    expect(store.list()[0]).toMatchObject(SPA)
    expect(store.get(KEY)?.lapTime).toBe(98)
    expect(changes).toHaveBeenCalledTimes(1)
    // Named already: a slower lap changes nothing.
    expect(store.offer(KEY, lap(99), SPA)).toBe(false)
    expect(changes).toHaveBeenCalledTimes(1)
    // A new best without names keeps the known ones.
    expect(store.offer(KEY, lap(97))).toBe(true)
    expect(store.list()[0]).toMatchObject({ lapTime: 97, ...SPA })
    await store.flush()
    expect(readFile().bests[KEY]).toMatchObject({ lapTime: 97, ...SPA })
  })

  it('moves a best stored under the old U+FFFD key to the right key, once', async () => {
    const key = '67@9001/Autódromo Núñez'
    const legacy = legacyPersonalBestKey(key)
    expect(legacy).toBe('67@9001/Aut�dromo N��ez')
    writeFileSync(file, JSON.stringify({ version: 1, bests: { [legacy]: lap(98) } }))
    const changes = vi.fn()
    const store = createFileStore(dir, { log, onChange: changes })
    expect(store.get(key)?.lapTime).toBe(98)
    expect(store.list().map((b) => b.key)).toEqual([key])
    expect(changes).toHaveBeenCalledTimes(1)
    // Already moved: asking again changes nothing; a slower lap there only fixes the names.
    expect(store.get(key)?.lapTime).toBe(98)
    expect(changes).toHaveBeenCalledTimes(1)
    const label = { car: 'Car', track: 'Autódromo', layout: 'Núñez' }
    expect(store.offer(key, lap(99), label)).toBe(false)
    expect(store.list()[0]).toMatchObject({ key, lapTime: 98, ...label })
    await store.flush()
    expect(Object.keys(readFile().bests)).toEqual([key])
    // An ASCII key has no old form; an unknown one stays unknown.
    expect(legacyPersonalBestKey(KEY)).toBe(KEY)
    expect(store.get('67@9001/Otro')).toBeNull()
  })

  it('ignores names that are not display text', () => {
    const store = createFileStore(dir, { log })
    const odd = { car: 'x'.repeat(121), track: 7, layout: null } as unknown as PersonalBestLabel
    store.offer(KEY, lap(98), odd)
    expect(store.list()[0]).toMatchObject({ car: '', track: '', layout: '' })
  })

  it('deletes the keys asked for, saving at once, and reports how many', async () => {
    const changes = vi.fn()
    const store = createFileStore(dir, { log, onChange: changes })
    store.offer(KEY, lap(98), SPA)
    store.offer('67@9001/Oval', lap(120))
    await store.flush()
    changes.mockClear()
    const writes = fileWrites()

    expect(store.delete(['nope'])).toBe(0)
    expect(changes).not.toHaveBeenCalled()
    expect(store.delete([KEY, 'nope', KEY])).toBe(1)
    expect(changes).toHaveBeenCalledTimes(1)
    expect(store.get(KEY)).toBeNull()
    expect(store.list().map((e) => e.key)).toEqual(['67@9001/Oval'])
    // No 2 s wait: the deletion reaches the disk with the write already started.
    await vi.waitFor(() => expect(fileWrites()).toBe(writes + 1))
    expect(Object.keys(readFile().bests)).toEqual(['67@9001/Oval'])

    // The next lap there is the new best, whatever its time.
    expect(store.offer(KEY, lap(130), SPA)).toBe(true)
  })

  it('clears every best and keeps an empty file', async () => {
    const changes = vi.fn()
    const store = createFileStore(dir, { log, onChange: changes })
    store.offer(KEY, lap(98))
    store.offer('67@9001/Oval', lap(120))
    expect(changes).toHaveBeenCalledTimes(2)
    expect(store.clear()).toBe(2)
    expect(changes).toHaveBeenCalledTimes(3)
    expect(store.list()).toEqual([])
    expect(store.clear()).toBe(0)
    expect(changes).toHaveBeenCalledTimes(3)
    await store.flush()
    expect(readFile()).toEqual({ version: 1, bests: {} })
    expect(createFileStore(dir, { log }).list()).toEqual([])
  })

  it('a deletion right after a new best leaves one pending write, not two at once', async () => {
    vi.useFakeTimers()
    const store = createFileStore(dir, { log })
    store.offer(KEY, lap(98))
    expect(vi.getTimerCount()).toBe(1)
    store.delete([KEY])
    // The debounce timer is gone: the deletion's save covers the best too.
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
    await store.flush()
    expect(readFile().bests).toEqual({})
  })

  it('a throwing change listener breaks nothing', () => {
    const store = createFileStore(dir, {
      log,
      onChange: () => {
        throw new Error('listener')
      }
    })
    expect(store.offer(KEY, lap(98))).toBe(true)
    expect(store.delete([KEY])).toBe(1)
  })
})

describe('openPersonalBestStore', () => {
  it('is in memory without a data directory', async () => {
    for (const dataDir of [undefined, '']) {
      vi.useFakeTimers()
      const changes = vi.fn()
      const store = openPersonalBestStore(dataDir, { log, onChange: changes })
      expect(store.offer(KEY, lap(90), SPA)).toBe(true)
      expect(store.offer(KEY, lap(91))).toBe(false)
      expect(store.get(KEY)?.lapTime).toBe(90)
      expect(store.list()).toEqual([
        { key: KEY, lapTime: 90, recordedAt: '2026-10-25T10:00:00.000Z', ...SPA }
      ])
      expect(vi.getTimerCount()).toBe(0)
      expect(store.delete([KEY])).toBe(1)
      expect(store.clear()).toBe(0)
      expect(changes).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
      await expect(store.flush()).resolves.toBeUndefined()
    }
    expect(io.writes).toEqual([])
  })

  it('is on disk with one', async () => {
    const store = openPersonalBestStore(dir, { log })
    store.offer(KEY, lap(90))
    await store.flush()
    expect(readFile().bests[KEY]?.lapTime).toBe(90)
  })
})

describe('merging a backup of the bests (R40)', () => {
  it('takes the new keys and the faster laps, keeps the rest, saves and tells the window', async () => {
    const changes = vi.fn()
    const store = createFileStore(dir, { log, onChange: changes })
    store.offer(KEY, lap(98), SPA)
    store.offer('80@1/', lap(70))
    const backup = JSON.stringify({
      version: 1,
      bests: {
        // Faster: taken, its names kept.
        [KEY]: { ...lap(97, '2026-10-26T10:00:00.000Z'), ...SPA },
        // Slower: the one here stays.
        '80@1/': lap(71),
        // New.
        '1@1/x': lap(60)
      }
    })
    changes.mockClear()
    expect(store.merge(backup)).toEqual({ taken: 2, skipped: 0 })
    expect(store.get(KEY)?.lapTime).toBe(97)
    expect(store.get('80@1/')?.lapTime).toBe(70)
    expect(store.get('1@1/x')?.lapTime).toBe(60)
    expect(store.list().find((b) => b.key === KEY)).toMatchObject(SPA)
    expect(changes).toHaveBeenCalledTimes(1)
    await store.flush()
    expect(Object.keys(readFile().bests).sort()).toEqual(['1@1/x', '80@1/', KEY].sort())
  })

  it('takes nothing from what is not a bests file, or has nothing better', () => {
    const store = createFileStore(dir, { log })
    store.offer(KEY, lap(98))
    const none = { taken: 0, skipped: 0 }
    expect(store.merge('{')).toEqual(none)
    expect(store.merge(JSON.stringify({ version: 2, bests: {} }))).toEqual(none)
    expect(store.merge(JSON.stringify({ version: 1, bests: { [KEY]: lap(99) } }))).toEqual(none)
    expect(store.get(KEY)?.lapTime).toBe(98)
  })

  it('never drops one of yours at the cap: new ones only while there is room, newest first', () => {
    const store = createFileStore(dir, { log, maxEntries: 3 })
    // Yours: two, one of them recent.
    store.offer('1@1/a', lap(80, '2026-10-01T10:00:00.000Z'))
    store.offer('1@1/b', lap(81, '2026-10-29T10:00:00.000Z'))
    const backup = JSON.stringify({
      version: 1,
      bests: {
        // Older than everything here: still never in place of one of yours.
        '1@1/old': lap(70, '2020-01-01T10:00:00.000Z'),
        '1@1/new': lap(71, '2026-10-30T10:00:00.000Z'),
        '1@1/mid': lap(72, '2025-01-01T10:00:00.000Z'),
        // Faster on a key you have: always taken (no room needed).
        '1@1/a': lap(79, '2019-01-01T10:00:00.000Z')
      }
    })
    expect(store.merge(backup)).toEqual({ taken: 2, skipped: 2 })
    expect(
      store
        .list()
        .map((b) => b.key)
        .sort()
    ).toEqual(['1@1/a', '1@1/b', '1@1/new'])
    expect(store.get('1@1/a')?.lapTime).toBe(79)
    expect(store.get('1@1/b')?.lapTime).toBe(81)
  })

  it('gives its bests as the file holds them, before the delayed save (R40 export)', () => {
    const store = createFileStore(dir, { log, saveDelayMs: 60_000 })
    store.offer(KEY, lap(98), SPA)
    const text = store.text()
    expect(text).not.toBeNull()
    expect(Object.keys(JSON.parse(text ?? '{}').bests)).toEqual([KEY])
    // Only in memory: no file of its own to stand for.
    expect(openPersonalBestStore(undefined).text()).toBeNull()
  })
})
