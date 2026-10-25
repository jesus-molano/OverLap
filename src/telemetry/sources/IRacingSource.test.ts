import { beforeEach, describe, it, expect, vi } from 'vitest'
import { TELEMETRY_VAR_NAMES } from '@shared/telemetry'
import { isNativeSdkMissing } from '../errors'
import { encodeCp1252 } from '../sessionString/testing/cp1252'
import { sdkMemory } from '../sessionString/testing/sdkMemory'

// Never load the real addon or touch the sim: everything below the source is faked.
const fake = vi.hoisted(() => {
  class FakeSDK {
    static instances: FakeSDK[] = []
    /** Var header: index = position. */
    header: string[] = []
    sessionStatusOK = false
    version = 1
    connectionId = 1
    cacheResets = 0
    lookups: string[] = []
    reads: number[] = []
    /** What irsdk-node's own parse returns (null: js-yaml threw). */
    wrapperSession: unknown = null
    /** The native string, every byte >= 0x80 already U+FFFD as in the real addon. */
    nativeSession = ''
    readonly _sdk = {
      getTelemetryVariableIndex: (name: string): number => {
        this.lookups.push(name)
        return this.header.indexOf(name)
      },
      getSessionData: (): string => this.nativeSession
    }

    constructor(readonly config: unknown) {
      FakeSDK.instances.push(this)
    }

    startSDK(): boolean {
      return true
    }

    stopCalls = 0

    stopSDK(): void {
      this.stopCalls++
    }

    waitForData(): boolean {
      return true
    }

    getSessionVersionNum(): number {
      return this.version
    }

    getSessionConnectionID(): number {
      return this.connectionId
    }

    resetTelemetryVariableCache(): void {
      this.cacheResets++
    }

    getTelemetryVariable(index: unknown): { value: number[] } {
      // The real addon segfaults here.
      if (typeof index !== 'number' || index < 0 || index >= this.header.length) {
        throw new Error(`read of a missing variable: ${String(index)}`)
      }
      this.reads.push(index)
      return { value: [index] }
    }

    getSessionData(): unknown {
      return this.wrapperSession
    }
  }
  return { FakeSDK, state: { mocked: false, simRunning: true, simChecks: 0 } }
})

/**
 * The read-only mapping opener, faked: nothing here reaches kernel32, so the name the source
 * asks for is only recorded. `memory` null = no mapping by that name.
 */
const shm = vi.hoisted(() => ({
  memory: null as Uint8Array | null,
  loadFails: false,
  loads: 0,
  opened: [] as string[],
  closes: 0
}))
vi.mock('../sessionString/win32', () => ({
  loadMappingOpener: () => {
    shm.loads++
    if (shm.loadFails) return Promise.reject(new Error('koffi binary missing'))
    return Promise.resolve((name: string) => {
      shm.opened.push(name)
      const memory = shm.memory
      if (!memory) return null
      return {
        size: memory.length,
        read: (offset: number, target: Uint8Array) =>
          target.set(memory.subarray(offset, offset + target.length)),
        close: () => {
          shm.closes++
        }
      }
    })
  }
}))

vi.mock('@irsdk-node/native', () => ({
  get sdkIsMocked() {
    return fake.state.mocked
  }
}))
vi.mock('irsdk-node', () => ({ IRacingSDK: fake.FakeSDK }))
vi.mock('../simStatus', () => ({
  isSimRunning: () => {
    fake.state.simChecks++
    return Promise.resolve(fake.state.simRunning)
  }
}))

type Module = typeof import('./IRacingSource')

/** Fresh module: the mocked-addon flag and the SDK are cached per process. */
async function load(): Promise<Module> {
  vi.resetModules()
  return import('./IRacingSource')
}

const MISSING = ['CarIdxClass', 'CarIdxClassPosition']
const HEADER = TELEMETRY_VAR_NAMES.filter((n) => !MISSING.includes(n))

function lastSdk(): InstanceType<typeof fake.FakeSDK> {
  const sdk = fake.FakeSDK.instances.at(-1)
  if (!sdk) throw new Error('no SDK created')
  return sdk
}

beforeEach(() => {
  fake.FakeSDK.instances = []
  fake.state.mocked = false
  fake.state.simRunning = true
  fake.state.simChecks = 0
  shm.memory = null
  shm.loadFails = false
  shm.loads = 0
  shm.opened = []
  shm.closes = 0
})

/** U+FFFD, what irsdk-node leaves of every byte from 0x80 up. */
const U = String.fromCharCode(0xfffd)

const YAML = 'DriverInfo:\n Drivers:\n - CarIdx: 4\n   UserName: Jérôme Duchêne\n'

function driverName(info: unknown): unknown {
  const drivers = (info as { DriverInfo?: { Drivers?: { UserName?: unknown }[] } } | null)
    ?.DriverInfo?.Drivers
  return drivers?.[0]?.UserName
}

describe('IRacingSource', () => {
  it("refuses irsdk's MockSDK instead of reporting a fake session", async () => {
    fake.state.mocked = true
    const { IRacingSource } = await load()
    const source = new IRacingSource()
    // A recognisable error (the status shows the 'native-missing' note), not a sentence to match.
    await expect(source.connect()).rejects.toSatisfy(isNativeSdkMissing)
    expect(fake.FakeSDK.instances).toHaveLength(0)
    expect(fake.state.simChecks).toBe(0)
    expect(source.isConnected()).toBe(false)
  })

  it('reads nothing native before the first tick', async () => {
    const { IRacingSource } = await load()
    const source = new IRacingSource()
    expect(await source.connect()).toBe(true)
    const sdk = lastSdk()
    sdk.header = HEADER
    const frame = source.readFrame()
    expect(TELEMETRY_VAR_NAMES.every((n) => frame[n].length === 0)).toBe(true)
    expect(sdk.lookups).toEqual([])
    expect(sdk.reads).toEqual([])
  })

  it('reads only variables in the var header and logs the missing ones once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { IRacingSource } = await load()
    const source = new IRacingSource()
    await source.connect()
    const sdk = lastSdk()
    sdk.header = HEADER
    sdk.sessionStatusOK = true

    const frame = source.readFrame()
    source.readFrame()
    source.readFrame()

    for (const name of TELEMETRY_VAR_NAMES) {
      expect(frame[name]).toEqual(MISSING.includes(name) ? [] : [HEADER.indexOf(name)])
    }
    // One lookup per name for the connection, then reads by index only.
    expect(sdk.lookups).toHaveLength(TELEMETRY_VAR_NAMES.length)
    expect(sdk.reads).toHaveLength(HEADER.length * 3)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      'Telemetry variables missing for this car: CarIdxClass, CarIdxClassPosition'
    )
  })

  it('rebuilds the variable set when the session or the data layout changes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { IRacingSource } = await load()
    const source = new IRacingSource()
    await source.connect()
    const sdk = lastSdk()
    sdk.header = HEADER
    sdk.sessionStatusOK = true
    source.readFrame()
    const resets = sdk.cacheResets

    // Car swap: new session version and a header that now has every variable.
    sdk.version = 2
    sdk.header = [...TELEMETRY_VAR_NAMES]
    const frame = source.readFrame()
    expect(frame.CarIdxClass).toEqual([TELEMETRY_VAR_NAMES.indexOf('CarIdxClass')])
    expect(sdk.cacheResets).toBe(resets + 1)
    expect(sdk.lookups).toHaveLength(TELEMETRY_VAR_NAMES.length * 2)

    // Data layout change (connection id bump) with a shorter header again.
    sdk.connectionId = 2
    sdk.header = HEADER
    expect(source.readFrame().CarIdxClass).toEqual([])
    expect(sdk.lookups).toHaveLength(TELEMETRY_VAR_NAMES.length * 3)
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('forgets the variable set on reconnect', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { IRacingSource } = await load()
    const source = new IRacingSource()
    await source.connect()
    const sdk = lastSdk()
    sdk.header = HEADER
    sdk.sessionStatusOK = true
    source.readFrame()

    source.disconnect()
    expect(source.readFrame().SessionTime).toEqual([])
    await source.connect()
    source.readFrame()
    expect(fake.FakeSDK.instances).toHaveLength(1)
    expect(sdk.lookups).toHaveLength(TELEMETRY_VAR_NAMES.length * 2)
    // Once per connection.
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('does not connect while the sim is not running', async () => {
    fake.state.simRunning = false
    const { IRacingSource } = await load()
    const source = new IRacingSource()
    expect(await source.connect()).toBe(false)
    expect(fake.FakeSDK.instances).toHaveLength(0)
  })
})

describe('IRacingSource session info', () => {
  it('reads the YAML from shared memory in Windows-1252 before irsdk-node', async () => {
    shm.memory = sdkMemory(encodeCp1252(YAML))
    const { IRacingSource } = await load()
    const source = new IRacingSource()
    await source.connect()
    const sdk = lastSdk()
    // What irsdk-node makes of the same bytes.
    sdk.wrapperSession = { DriverInfo: { Drivers: [{ UserName: `J${U}r${U}me Duch${U}ne` }] } }
    expect(driverName(source.readSessionInfo())).toBe('Jérôme Duchêne')
    // The SDK's mapping, opened lazily by the source (the opener here is a fake).
    expect(shm.opened).toEqual(['Local\\IRSDKMemMapFileName'])
  })

  it("keeps irsdk-node's session data when the shared memory is not readable", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { IRacingSource } = await load()
    const source = new IRacingSource()
    await source.connect()
    const sdk = lastSdk()
    sdk.wrapperSession = { DriverInfo: { Drivers: [{ UserName: `Ana L${U}pez` }] } }
    expect(driverName(source.readSessionInfo())).toBe(`Ana L${U}pez`)
    expect(driverName(source.readSessionInfo())).toBe(`Ana L${U}pez`)
    // One open per connection, one log line.
    expect(shm.opened).toHaveLength(1)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a header of another SDK version', sdkMemory(encodeCp1252(YAML), { ver: 3 })],
    ['a YAML no parser loads', sdkMemory(encodeCp1252('DriverInfo: [\n'))],
    ['no session info written yet', sdkMemory(new Uint8Array(0), { length: 0 })]
  ])("keeps irsdk-node's session data on %s", async (_, memory) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    shm.memory = memory
    const { IRacingSource } = await load()
    const source = new IRacingSource()
    await source.connect()
    lastSdk().wrapperSession = { DriverInfo: { Drivers: [{ UserName: `Ana L${U}pez` }] } }
    expect(driverName(source.readSessionInfo())).toBe(`Ana L${U}pez`)
    expect(shm.opened).toHaveLength(1)
  })

  it('falls back once, with one log line, when koffi does not load', async () => {
    shm.loadFails = true
    shm.memory = sdkMemory(encodeCp1252(YAML))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { IRacingSource } = await load()
    const source = new IRacingSource()
    await source.connect()
    const sdk = lastSdk()
    sdk.nativeSession = 'DriverInfo:\n Drivers:\n - UserName: @weird: name\n'
    // irsdk-node's own parse failed (null): its raw string, through our sanitizer.
    expect(driverName(source.readSessionInfo())).toBe('@weird: name')
    source.disconnect()
    await source.connect()
    expect(shm.loads).toBe(1)
    expect(shm.opened).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('koffi binary missing')
  })

  it('closes the mapping on disconnect and opens it again on the next connection', async () => {
    shm.memory = sdkMemory(encodeCp1252(YAML))
    const { IRacingSource } = await load()
    const source = new IRacingSource()
    await source.connect()
    source.readSessionInfo()
    source.readSessionInfo()
    expect(shm.opened).toHaveLength(1)
    source.disconnect()
    expect(shm.closes).toBe(1)
    // Reconnect attempts while the sim is away open nothing.
    fake.state.simRunning = false
    for (let i = 0; i < 5; i++) await source.connect()
    source.disconnect()
    expect(shm.opened).toHaveLength(1)
    fake.state.simRunning = true
    await source.connect()
    expect(driverName(source.readSessionInfo())).toBe('Jérôme Duchêne')
    expect(shm.opened).toHaveLength(2)
    source.disconnect()
    expect(shm.closes).toBe(2)
  })
})
