import { beforeEach, describe, it, expect, vi } from 'vitest'
import { TELEMETRY_VAR_NAMES } from '@shared/telemetry'
import { isNativeSdkMissing } from '../errors'

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
    readonly _sdk = {
      getTelemetryVariableIndex: (name: string): number => {
        this.lookups.push(name)
        return this.header.indexOf(name)
      },
      getSessionData: (): string => ''
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

    getSessionData(): null {
      return null
    }
  }
  return { FakeSDK, state: { mocked: false, simRunning: true, simChecks: 0 } }
})

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
})

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
