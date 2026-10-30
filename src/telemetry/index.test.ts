import { join } from 'node:path'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import type { PersonalBestSummary, PersonalBestTarget } from '@shared/delta/references'
import { createDefaultSettings, toTelemetryConfig } from '@shared/settings'
import type { SourceKind } from '@shared/types'
import type { FileStoreOptions } from './store/personalBests'

interface FakeLoop {
  stop: ReturnType<typeof vi.fn>
  settlePersonalBests: ReturnType<typeof vi.fn>
  deps: unknown
}

// The entry runs on import: fake everything it would start or touch.
const fakes = vi.hoisted(() => ({
  loops: [] as FakeLoop[],
  kind: 'mock' as SourceKind,
  /** Calls of openPersonalBestStore: [dataDir, options]. */
  opened: [] as [string | undefined, FileStoreOptions | undefined][],
  order: [] as string[],
  flush: (): Promise<void> => Promise.resolve(),
  /** What the fake store lists, and the calls that would change it. */
  entries: [] as PersonalBestSummary[],
  deleted: [] as string[][],
  cleared: 0,
  merged: [] as string[],
  /** What the fake store's merge takes. */
  takes: 0
}))
const store = vi.hoisted(() => ({
  get: () => null,
  offer: () => false,
  flush: () => {
    fakes.order.push('flush')
    return fakes.flush()
  },
  list: () => fakes.entries,
  delete: (keys: readonly string[]) => {
    fakes.deleted.push([...keys])
    return keys.filter((k) => fakes.entries.some((e) => e.key === k)).length
  },
  clear: () => {
    fakes.cleared++
    return fakes.entries.length
  },
  merge: (text: string) => {
    fakes.merged.push(text)
    return fakes.takes
  }
}))
vi.mock('./loop', () => ({
  TelemetryLoop: class {
    stop = vi.fn(() => fakes.order.push('stop'))
    settlePersonalBests = vi.fn(() => fakes.order.push('settle'))
    setConfig = vi.fn()
    start = vi.fn(() => new Promise<void>(() => {}))
    deps: unknown
    constructor(_source: unknown, _emit: unknown, deps: unknown) {
      this.deps = deps
      fakes.loops.push(this as unknown as FakeLoop)
    }
  }
}))
vi.mock('./sources/createSource', () => ({
  resolveSourceKind: () => fakes.kind,
  createSource: () => Promise.resolve({ kind: fakes.kind, disconnect: () => {} })
}))
vi.mock('./store/personalBests', () => ({
  openPersonalBestStore: (dir: string | undefined, opts?: FileStoreOptions) => {
    fakes.opened.push([dir, opts])
    return store
  }
}))

type Handler = (arg: unknown) => void

interface Entry {
  handlers: Map<string, Handler>
  portHandlers: Map<string, Handler>
  posted: unknown[]
  exit: ReturnType<typeof vi.fn>
  streamErrorListeners: string[]
}

async function loadEntry(postMessage?: (msg: unknown) => void): Promise<Entry> {
  const handlers = new Map<string, Handler>()
  const portHandlers = new Map<string, Handler>()
  const posted: unknown[] = []
  const streamErrorListeners: string[] = []
  vi.spyOn(process, 'on').mockImplementation(((event: string, fn: Handler) => {
    handlers.set(event, fn)
    return process
  }) as typeof process.on)
  for (const [name, stream] of [
    ['stdout', process.stdout],
    ['stderr', process.stderr]
  ] as const) {
    vi.spyOn(stream, 'on').mockImplementation(((event: string) => {
      if (event === 'error') streamErrorListeners.push(name)
      return stream
    }) as typeof stream.on)
  }
  const exit = vi.fn()
  vi.spyOn(process, 'exit').mockImplementation(exit as unknown as typeof process.exit)
  const port = {
    postMessage: postMessage ?? ((msg: unknown) => posted.push(msg)),
    on: (event: string, fn: Handler) => portHandlers.set(event, fn)
  }
  Object.defineProperty(process, 'parentPort', { value: port, configurable: true })
  vi.resetModules()
  await import('./index')
  await vi.advanceTimersByTimeAsync(0)
  return { handlers, portHandlers, posted, exit, streamErrorListeners }
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(fakes, {
    loops: [],
    kind: 'mock',
    opened: [],
    order: [],
    flush: () => Promise.resolve(),
    entries: [],
    deleted: [],
    cleared: 0,
    merged: [],
    takes: 0
  })
})

const BEST: PersonalBestSummary = {
  key: '67@219/Grand Prix',
  car: 'Porsche 911 GT3 R',
  track: 'Spa',
  layout: 'Grand Prix',
  lapTime: 137.5,
  recordedAt: '2026-10-25T10:00:00.000Z'
}

function bestsMessages(entry: Entry): unknown[] {
  return entry.posted.filter((m) => (m as { type: string }).type === 'bests')
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  Reflect.deleteProperty(process, 'parentPort')
})

describe('telemetry entry', () => {
  it('ignores EPIPE-style errors on stdout and stderr', async () => {
    const entry = await loadEntry()
    expect(entry.streamErrorListeners).toEqual(['stdout', 'stderr'])
  })

  it('announces itself with a starting status made of codes, no sentence', async () => {
    const entry = await loadEntry()
    expect(entry.posted).toContainEqual({
      type: 'status',
      status: { state: 'starting', source: 'mock', note: 'none', detail: '' }
    })
  })

  it('reports a crash once and exits once, however many errors follow', async () => {
    const entry = await loadEntry()
    const fatal = entry.handlers.get('uncaughtException')
    const rejection = entry.handlers.get('unhandledRejection')
    fatal?.(new Error('boom'))
    fatal?.(new Error('again'))
    rejection?.(new Error('later'))

    const reports = entry.posted.filter(
      (m) => (m as { type: string }).type === 'log' || (m as { type: string }).type === 'status'
    )
    expect(reports.slice(-2)).toEqual([
      expect.objectContaining({ type: 'log', level: 'error' }),
      {
        type: 'status',
        status: { state: 'error', source: 'mock', note: 'none', detail: 'boom' }
      }
    ])
    expect(fakes.loops[0]?.stop).toHaveBeenCalledTimes(1)
    expect(entry.exit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(entry.exit).toHaveBeenCalledTimes(1)
    expect(entry.exit).toHaveBeenCalledWith(1)
  })

  it('still exits when the port is gone and the error cannot be stringified', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    let broken = false
    const entry = await loadEntry(() => {
      if (broken) throw new Error('port closed')
    })
    broken = true
    const fatal = entry.handlers.get('uncaughtException')
    expect(() => fatal?.(Object.create(null))).not.toThrow()
    expect(consoleError).toHaveBeenCalledWith('Telemetry process crashed: unknown error')
    await vi.advanceTimersByTimeAsync(1000)
    expect(entry.exit).toHaveBeenCalledTimes(1)
  })

  it('applies a valid config and reports, without applying, an invalid one', async () => {
    const entry = await loadEntry()
    const loop = fakes.loops[0] as unknown as { setConfig: ReturnType<typeof vi.fn> }
    const config = toTelemetryConfig(createDefaultSettings())
    entry.portHandlers.get('message')?.({ data: { type: 'config', config } })
    expect(loop.setConfig).toHaveBeenCalledExactlyOnceWith(config)

    const broken = [
      { ...config, rules: undefined },
      { ...config, rules: { ...config.rules, battle: undefined } },
      { ...config, rules: { ...config.rules, radar: { ...config.rules.radar, hideInPits: 'no' } } },
      {
        ...config,
        rules: { ...config.rules, inputs: { hideInPits: false, showIn: { practice: true } } }
      },
      { ...config, enabledWidgets: ['relative', 'pitboard'] },
      { ...config, standings: null },
      { ...config, delta: undefined }
    ]
    for (const bad of broken)
      entry.portHandlers.get('message')?.({ data: { type: 'config', config: bad } })
    expect(loop.setConfig).toHaveBeenCalledTimes(1)
    const warnings = entry.posted.filter((m) => (m as { type: string }).type === 'log')
    expect(warnings).toHaveLength(broken.length)
    expect(warnings[0]).toEqual({
      type: 'log',
      level: 'warn',
      message: 'Ignoring an invalid config from main'
    })
  })

  it('opens the personal bests in the data directory main passes and hands them to the loop', async () => {
    vi.stubEnv('OVERLAY_DATA_DIR', join('C:', 'data'))
    fakes.kind = 'iracing'
    await loadEntry()
    expect(fakes.opened.map(([dir]) => dir)).toEqual([join('C:', 'data')])
    expect(fakes.loops[0]?.deps).toEqual({
      bests: store,
      onPersonalBestTarget: expect.any(Function)
    })

    // Simulated laps are kept apart from real ones.
    fakes.kind = 'mock'
    fakes.opened = []
    await loadEntry()
    expect(fakes.opened.map(([dir]) => dir)).toEqual([join('C:', 'data', 'mock')])
  })

  it('sends the personal bests at start, on every change and when the car + layout changes', async () => {
    fakes.entries = [BEST]
    const entry = await loadEntry()
    expect(bestsMessages(entry)).toEqual([
      { type: 'bests', list: { entries: [BEST], current: null } }
    ])

    // The store reports its own changes (a new best).
    fakes.opened[0]?.[1]?.onChange?.()
    expect(bestsMessages(entry)).toHaveLength(2)

    const target: PersonalBestTarget = {
      key: BEST.key,
      car: BEST.car,
      track: BEST.track,
      layout: BEST.layout
    }
    const deps = fakes.loops[0]?.deps as {
      onPersonalBestTarget: (t: PersonalBestTarget | null) => void
    }
    deps.onPersonalBestTarget(target)
    expect(bestsMessages(entry).at(-1)).toEqual({
      type: 'bests',
      list: { entries: [BEST], current: target }
    })
    deps.onPersonalBestTarget(null)
    expect(bestsMessages(entry).at(-1)).toEqual({
      type: 'bests',
      list: { entries: [BEST], current: null }
    })
  })

  it('deletes or clears personal bests on request; with nothing deleted it resends the list', async () => {
    fakes.entries = [BEST]
    const entry = await loadEntry()
    const send = (data: unknown): void => entry.portHandlers.get('message')?.({ data })
    const sent = bestsMessages(entry).length

    send({ type: 'delete-bests', keys: [BEST.key] })
    expect(fakes.deleted).toEqual([[BEST.key]])
    // Deleted: the store's onChange sends the list, not the entry.
    expect(bestsMessages(entry)).toHaveLength(sent)

    send({ type: 'delete-bests', keys: ['80@1/'] })
    expect(bestsMessages(entry)).toHaveLength(sent + 1)

    send({ type: 'clear-bests' })
    expect(fakes.cleared).toBe(1)
    expect(bestsMessages(entry)).toHaveLength(sent + 1)
    fakes.entries = []
    send({ type: 'clear-bests' })
    expect(bestsMessages(entry)).toHaveLength(sent + 2)
  })

  it('merges a backup of the bests; with nothing taken it resends the list (R40)', async () => {
    fakes.entries = [BEST]
    const entry = await loadEntry()
    const send = (data: unknown): void => entry.portHandlers.get('message')?.({ data })
    const sent = bestsMessages(entry).length
    fakes.takes = 2
    send({ type: 'merge-bests', text: '{"version":1}' })
    expect(fakes.merged).toEqual(['{"version":1}'])
    expect(bestsMessages(entry)).toHaveLength(sent)
    fakes.takes = 0
    send({ type: 'merge-bests', text: '{}' })
    expect(bestsMessages(entry)).toHaveLength(sent + 1)
    // Not a text: ignored.
    send({ type: 'merge-bests', text: 7 })
    expect(fakes.merged).toHaveLength(2)
  })

  it('ignores malformed delete requests and requests while exiting', async () => {
    fakes.entries = [BEST]
    const entry = await loadEntry()
    const send = (data: unknown): void => entry.portHandlers.get('message')?.({ data })
    for (const keys of [undefined, [], 'x', [1], [''], ['x'.repeat(201)]]) {
      send({ type: 'delete-bests', keys })
    }
    expect(fakes.deleted).toEqual([])
    send({ type: 'shutdown' })
    send({ type: 'delete-bests', keys: [BEST.key] })
    send({ type: 'clear-bests' })
    expect(fakes.deleted).toEqual([])
    expect(fakes.cleared).toBe(0)
  })

  it('keeps the personal bests in memory without a data directory', async () => {
    vi.stubEnv('OVERLAY_DATA_DIR', '')
    await loadEntry()
    expect(fakes.opened.map(([dir]) => dir)).toEqual([''])
  })

  it('sends what the store logs to main as log lines', async () => {
    const entry = await loadEntry()
    fakes.opened[0]?.[1]?.log?.('warn', 'Personal bests: corrupt')
    expect(entry.posted).toContainEqual({
      type: 'log',
      level: 'warn',
      message: 'Personal bests: corrupt'
    })
  })

  it('saves the personal bests (the lap in progress of settling included) before exiting', async () => {
    let finish: () => void = () => {}
    fakes.flush = () => new Promise<void>((resolve) => (finish = resolve))
    const entry = await loadEntry()
    entry.portHandlers.get('message')?.({ data: { type: 'shutdown' } })
    expect(fakes.order).toEqual(['stop', 'settle', 'flush'])
    await vi.advanceTimersByTimeAsync(100)
    expect(entry.exit).not.toHaveBeenCalled()
    finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(entry.exit).toHaveBeenCalledExactlyOnceWith(0)
    await vi.advanceTimersByTimeAsync(1000)
    expect(entry.exit).toHaveBeenCalledTimes(1)
  })

  it('exits anyway when saving the personal bests hangs', async () => {
    fakes.flush = () => new Promise<void>(() => {})
    const entry = await loadEntry()
    entry.portHandlers.get('message')?.({ data: { type: 'shutdown' } })
    await vi.advanceTimersByTimeAsync(699)
    expect(entry.exit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(entry.exit).toHaveBeenCalledExactlyOnceWith(0)
  })

  it('saves the personal bests on a crash too, still exiting no sooner than 50 ms', async () => {
    const entry = await loadEntry()
    entry.handlers.get('uncaughtException')?.(new Error('boom'))
    expect(fakes.order).toEqual(['stop', 'settle', 'flush'])
    await vi.advanceTimersByTimeAsync(49)
    expect(entry.exit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(entry.exit).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('exits 0 on shutdown and ignores errors raised while exiting', async () => {
    const entry = await loadEntry()
    entry.portHandlers.get('message')?.({ data: { type: 'shutdown' } })
    entry.portHandlers.get('message')?.({ data: { type: 'shutdown' } })
    entry.handlers.get('uncaughtException')?.(new Error('during exit'))
    await vi.advanceTimersByTimeAsync(1000)
    expect(entry.exit).toHaveBeenCalledTimes(1)
    expect(entry.exit).toHaveBeenCalledWith(0)
  })
})
