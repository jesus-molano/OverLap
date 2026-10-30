import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, toTelemetryConfig } from '@shared/settings'
import { TelemetryHost, type TelemetryHostOptions } from './telemetryHost'

const fork = vi.hoisted(() => vi.fn())
const USER_DATA = vi.hoisted(() => 'C:/Users/me/AppData/Roaming/iracing-overlay')
const getPath = vi.hoisted(() => vi.fn((name: string) => (name === 'userData' ? USER_DATA : '')))
vi.mock('electron', () => ({ utilityProcess: { fork }, app: { getPath } }))
// Never load the real entry: it is the utilityProcess that talks to the sim.
vi.mock('../telemetry/index?modulePath', () => ({ default: 'telemetry.js' }))

/** Stand-in for Electron's UtilityProcess. */
class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  readonly pid = 1234
  readonly postMessage = vi.fn()
  readonly kill = vi.fn(() => true)
}

let children: FakeChild[]

function child(index: number): FakeChild {
  const c = index < 0 ? children[children.length + index] : children[index]
  if (!c) throw new Error(`no child #${index}`)
  return c
}

function makeHost(
  onAutoHidden: TelemetryHostOptions['onAutoHidden'] = () => {},
  extra: Partial<TelemetryHostOptions> = {}
): TelemetryHost {
  return new TelemetryHost({
    onBests: () => {},
    ...extra,
    source: 'mock',
    getConfig: () => toTelemetryConfig(DEFAULT_SETTINGS),
    onStatus: () => {},
    onData: () => {},
    onAutoHidden
  })
}

/** Streams deliver data on process.nextTick, which fake timers leave alone. */
async function ticks(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => process.nextTick(resolve))
}

beforeEach(() => {
  children = []
  fork.mockImplementation(() => {
    const c = new FakeChild()
    children.push(c)
    return c
  })
  vi.useFakeTimers()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

/** The env of fork call `i`. */
function forkEnv(i: number): Record<string, string | undefined> {
  const opts = fork.mock.calls[i]?.[2] as { env: Record<string, string | undefined> } | undefined
  if (!opts) throw new Error(`no fork #${i}`)
  return opts.env
}

describe('TelemetryHost', () => {
  it('tells the process its source and data directory (userData by default)', async () => {
    const host = makeHost()
    host.start()
    expect(getPath).toHaveBeenCalledWith('userData')
    expect(forkEnv(0)).toMatchObject({ OVERLAY_SOURCE: 'mock', OVERLAY_DATA_DIR: USER_DATA })
    const stopped = host.stop()
    child(0).emit('exit', 0)
    await stopped
  })

  it('passes a given data directory, and none when userData is unavailable', async () => {
    const given = makeHost(undefined, { dataDir: 'D:/overlay' })
    given.start()
    expect(forkEnv(0).OVERLAY_DATA_DIR).toBe('D:/overlay')
    const stopped = given.stop()
    child(0).emit('exit', 0)
    await stopped

    vi.stubEnv('OVERLAY_DATA_DIR', undefined)
    getPath.mockImplementationOnce(() => {
      throw new Error('not ready')
    })
    const missing = makeHost()
    missing.start()
    expect(forkEnv(1).OVERLAY_DATA_DIR).toBeUndefined()
    expect(console.warn).toHaveBeenCalledTimes(1)
    const stoppedToo = missing.stop()
    child(1).emit('exit', 0)
    await stoppedToo
    vi.unstubAllEnvs()
  })

  it('logs the child output and unhooks its streams when it exits', async () => {
    const host = makeHost()
    host.start()
    const first = child(0)
    first.stdout.write('hello\n')
    first.stderr.write('oops\r\n\n')
    await ticks()
    expect(console.log).toHaveBeenCalledWith('[telemetry] hello')
    expect(console.error).toHaveBeenCalledWith('[telemetry] oops')
    expect(first.stdout.listenerCount('data')).toBe(1)

    first.emit('exit', 1)
    for (const stream of [first.stdout, first.stderr]) {
      expect(stream.listenerCount('data')).toBe(0)
      expect(stream.listenerCount('end')).toBe(0)
      expect(stream.listenerCount('error')).toBe(0)
    }
    await host.stop()
  })

  it('does not pile up listeners or timers across respawns', async () => {
    const host = makeHost()
    host.start()
    for (let i = 0; i < 6; i++) {
      const c = child(-1)
      c.emit('spawn')
      c.emit('exit', 1)
      expect(c.stdout.listenerCount('data')).toBe(0)
      expect(vi.getTimerCount()).toBe(1)
      vi.advanceTimersByTime(10_000)
    }
    expect(children).toHaveLength(7)
    const last = child(-1)
    expect(last.stdout.listenerCount('data')).toBe(1)
    expect(last.stderr.listenerCount('data')).toBe(1)
    expect(last.listenerCount('exit')).toBe(1)
    expect(vi.getTimerCount()).toBe(0)

    last.stdout.write('still logging\n')
    await ticks()
    expect(console.log).toHaveBeenCalledWith('[telemetry] still logging')
    const stopped = host.stop()
    last.emit('exit', 0)
    await stopped
  })

  it('cancels a pending restart on stop', async () => {
    const host = makeHost()
    host.start()
    child(0).emit('exit', 1)
    expect(vi.getTimerCount()).toBe(1)
    await host.stop()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(60_000)
    expect(fork).toHaveBeenCalledTimes(1)
  })

  it('asks the child to shut down and leaves nothing behind once it exits', async () => {
    const host = makeHost()
    host.start()
    const c = child(0)
    c.emit('spawn')
    const stopped = host.stop()
    expect(c.postMessage).toHaveBeenLastCalledWith({ type: 'shutdown' })
    c.emit('exit', 0)
    await stopped
    expect(vi.getTimerCount()).toBe(0)
    expect(c.stdout.listenerCount('data')).toBe(0)
    vi.advanceTimersByTime(60_000)
    expect(c.kill).not.toHaveBeenCalled()
    expect(fork).toHaveBeenCalledTimes(1)
  })

  it('forwards auto-hidden changes and shows every hidden widget again when the child dies', async () => {
    const onAutoHidden = vi.fn()
    const host = makeHost(onAutoHidden)
    host.start()
    const c = child(0)
    c.emit('spawn')
    c.emit('message', {
      type: 'auto-hidden',
      widget: 'battle',
      hidden: true,
      reason: 'practice'
    })
    c.emit('message', {
      type: 'auto-hidden',
      widget: 'inputs',
      hidden: true,
      reason: 'pits'
    })
    c.emit('message', { type: 'auto-hidden', widget: 'inputs', hidden: false, reason: null })
    c.emit('message', { type: 'auto-hidden', widget: 'nope', hidden: true, reason: 'race' })
    expect(onAutoHidden.mock.calls).toEqual([
      ['battle', { hidden: true, reason: 'practice' }],
      ['inputs', { hidden: true, reason: 'pits' }],
      ['inputs', { hidden: false, reason: null }]
    ])
    onAutoHidden.mockClear()
    c.emit('exit', 1)
    expect(onAutoHidden.mock.calls).toEqual([['battle', { hidden: false, reason: null }]])
    // A later exit has nothing left to release.
    vi.advanceTimersByTime(10_000)
    onAutoHidden.mockClear()
    child(-1).emit('spawn')
    child(-1).emit('exit', 1)
    expect(onAutoHidden).not.toHaveBeenCalled()
    await host.stop()
  })

  it("forwards the child's status codes and reports a restart with the 'restarting' note", async () => {
    const onStatus = vi.fn()
    const host = new TelemetryHost({
      source: 'mock',
      getConfig: () => toTelemetryConfig(DEFAULT_SETTINGS),
      onStatus,
      onData: () => {},
      onAutoHidden: () => {},
      onBests: () => {}
    })
    host.start()
    const c = child(0)
    c.emit('spawn')
    const live = { state: 'mock', source: 'mock', note: 'none', detail: '' }
    c.emit('message', { type: 'status', status: live })
    // The old shape, with a sentence: ignored.
    c.emit('message', { type: 'status', status: { state: 'mock', source: 'mock', message: 'x' } })
    c.emit('exit', 1)
    expect(onStatus.mock.calls).toEqual([
      [live],
      [{ state: 'error', source: 'mock', note: 'restarting', detail: '' }]
    ])
    await host.stop()
  })

  it('forwards the personal-best list and passes deletions to the running child only', async () => {
    const onBests = vi.fn()
    const host = makeHost(undefined, { onBests })
    // Nothing running yet: nobody to ask.
    expect(host.deleteBests(['k'])).toBe(false)
    expect(host.clearBests()).toBe(false)
    host.start()
    const c = child(0)
    expect(host.deleteBests(['k'])).toBe(false)
    c.emit('spawn')
    const list = { entries: [], current: null }
    c.emit('message', { type: 'bests', list })
    c.emit('message', { type: 'bests', list: { entries: 'nope', current: null } })
    expect(onBests.mock.calls).toEqual([[list]])

    expect(host.deleteBests(['67@219/Grand Prix'])).toBe(true)
    expect(host.clearBests()).toBe(true)
    // The delta's cycle shortcut goes to the process (it never touches the settings).
    expect(host.cycleDeltaReference()).toBe(true)
    // «Importar todo» (R40): the bests file's text, merged by the process.
    expect(host.mergeBests('{"version":1}')).toBe(true)
    expect(c.postMessage.mock.calls.slice(-4)).toEqual([
      [{ type: 'delete-bests', keys: ['67@219/Grand Prix'] }],
      [{ type: 'clear-bests' }],
      [{ type: 'cycle-delta-reference' }],
      [{ type: 'merge-bests', text: '{"version":1}' }]
    ])
    c.postMessage.mockImplementationOnce(() => {
      throw new Error('port closed')
    })
    expect(host.clearBests()).toBe(false)

    c.emit('exit', 1)
    expect(host.deleteBests(['k'])).toBe(false)
    await host.stop()
  })

  it('asks the running process for its bests to export, the file otherwise (R40)', async () => {
    vi.useFakeTimers()
    try {
      const onBestsMerged = vi.fn()
      const host = makeHost(undefined, { onBestsMerged })
      // None running: the caller reads the file.
      await expect(host.bestsText()).resolves.toBeNull()
      host.start()
      const c = child(0)
      c.emit('spawn')
      const asked = host.bestsText()
      const sent = c.postMessage.mock.calls.at(-1)?.[0] as { type: string; id: number }
      expect(sent.type).toBe('bests-text')
      c.emit('message', { type: 'bests-text', id: sent.id, text: '{"version":1,"bests":{}}' })
      await expect(asked).resolves.toBe('{"version":1,"bests":{}}')
      // No answer in time, or the process gone first: null (the file).
      const late = host.bestsText(500)
      vi.advanceTimersByTime(500)
      await expect(late).resolves.toBeNull()
      // How an import's merge went reaches main.
      c.emit('message', { type: 'bests-merged', taken: 3, skipped: 1 })
      expect(onBestsMerged).toHaveBeenCalledWith(3, 1)
      const gone = host.bestsText()
      c.emit('exit', 1)
      await expect(gone).resolves.toBeNull()
      await host.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('kills a child that ignores the shutdown request', async () => {
    const host = makeHost()
    host.start()
    const c = child(0)
    c.emit('spawn')
    const stopped = host.stop()
    vi.advanceTimersByTime(1_000)
    expect(c.kill).toHaveBeenCalledTimes(1)
    c.emit('exit', 1)
    await stopped
    expect(vi.getTimerCount()).toBe(0)
    expect(fork).toHaveBeenCalledTimes(1)
  })
})
