import type { IRacingSDK } from 'irsdk-node'
import type * as NativeModule from '@irsdk-node/native'
import { parseSessionYaml } from '@shared/sessionYaml'
import { TELEMETRY_VAR_NAMES, type TelemetryFrame, type TelemetryVarName } from '@shared/telemetry'
import type { SourceKind } from '@shared/types'
import { NativeSdkMissingError, errorMessage } from '../errors'
import { SessionStringReader, type OpenMapping } from '../sessionString/reader'
import { isSimRunning } from '../simStatus'
import type { TelemetrySource } from './TelemetrySource'

const EMPTY: readonly never[] = Object.freeze([])

/** IRSDK_MEMMAPFILENAME (irsdk_defines.h): only ever opened read-only. */
const IRSDK_MEMMAP_NAME = 'Local\\IRSDKMemMapFileName'

let nativeMocked: Promise<boolean> | null = null
// One wrapper per process: native tick detection keeps process-global state.
let sharedSdk: Promise<IRacingSDK> | null = null
let mappingOpener: Promise<OpenMapping | null> | null = null

/**
 * True when @irsdk-node/native fell back to its MockSDK (non-Windows or addon
 * load failure). The package must stay in package.json `dependencies`: that is
 * what keeps electron-vite from bundling it, which would break its addon lookup.
 */
function isNativeMocked(): Promise<boolean> {
  nativeMocked ??= (import('@irsdk-node/native') as Promise<typeof NativeModule>)
    .then((native) => native.sdkIsMocked)
    .catch((err: unknown) => {
      nativeMocked = null
      throw err
    })
  return nativeMocked
}

function getSdk(): Promise<IRacingSDK> {
  sharedSdk ??= import('irsdk-node')
    .then(
      ({ IRacingSDK }) =>
        // autoEnableTelemetry would broadcast "start telemetry", which turns on
        // .ibt disk recording; live shared-memory data does not need it.
        new IRacingSDK({ autoEnableTelemetry: false })
    )
    .catch((err: unknown) => {
      sharedSdk = null
      throw err
    })
  return sharedSdk
}

/**
 * koffi's read-only mapping opener, loaded once per process; null (logged once) when koffi or
 * its binary does not load, and session names then keep irsdk-node's decoding.
 */
function getMappingOpener(): Promise<OpenMapping | null> {
  mappingOpener ??= import('../sessionString/win32')
    .then(({ loadMappingOpener }) => loadMappingOpener())
    .catch((err: unknown) => {
      console.warn(`Session info reader unavailable, accents may be lost: ${errorMessage(err)}`)
      return null
    })
  return mappingOpener
}

/** irsdk-node 4.4.0 keeps the native instance in the private `_sdk`. */
interface NativeSdk {
  getSessionData?: () => unknown
  getTelemetryVariableIndex?: (name: string) => unknown
}

function nativeOf(sdk: IRacingSDK): NativeSdk | undefined {
  return (sdk as unknown as { _sdk?: NativeSdk })._sdk
}

/** Raw session YAML; the wrapper offers no public accessor to the string. */
function rawSessionYaml(sdk: IRacingSDK): string | null {
  const raw = nativeOf(sdk)?.getSessionData?.()
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

function isObject(v: unknown): v is object {
  return typeof v === 'object' && v !== null
}

function emptyFrame(): TelemetryFrame {
  const frame: Partial<Record<TelemetryVarName, readonly never[]>> = {}
  for (const name of TELEMETRY_VAR_NAMES) frame[name] = EMPTY
  return frame as TelemetryFrame
}

/** Live iRacing telemetry through irsdk-node's shared-memory bindings. */
export class IRacingSource implements TelemetrySource {
  readonly kind: SourceKind = 'iracing'

  private sdk: IRacingSDK | null = null
  /** The session YAML in its own encoding (irsdk-node's string loses every accent). */
  private sessionText: SessionStringReader | null = null
  private connected = false
  /** Set once irsdk-node's own YAML parse failed on this connection: go straight to ours. */
  private skipWrapperYaml = false
  /**
   * Var-header index of each TELEMETRY_VARS name this car has. The addon
   * dereferences NULL for a missing name (segfault), so only these are read.
   * Built lazily after a tick, when the header is valid.
   */
  private present: Map<TelemetryVarName, number> | null = null
  /** Session version and connection id `present` was built for. */
  private presentVersion = -1
  private presentConnection = -1
  private loggedMissing = ''

  async connect(): Promise<boolean> {
    if (this.connected) return true
    // irsdk's MockSDK would pass for a live session (static fake data) and its
    // waitForData never blocks; MockSource is the development source.
    if (await isNativeMocked()) throw new NativeSdkMissingError()
    // Checked before touching the SDK: its constructor and IsSimRunning() log when the sim is closed.
    if (!(await isSimRunning())) return false
    const sdk = await getSdk()
    this.sessionText ??= new SessionStringReader(IRSDK_MEMMAP_NAME, await getMappingOpener())
    this.sdk = sdk
    this.skipWrapperYaml = false
    this.present = null
    this.loggedMissing = ''
    this.connected = sdk.startSDK()
    return this.connected
  }

  disconnect(): void {
    const wasConnected = this.connected
    this.connected = false
    this.present = null
    // Opened again on the next connection's first read: no handle outlives a session.
    this.sessionText?.close()
    if (!wasConnected || !this.sdk) return
    try {
      this.sdk.stopSDK()
    } catch {
      // Already torn down.
    }
  }

  isConnected(): boolean {
    return this.connected && this.sdk !== null && this.sdk.sessionStatusOK
  }

  waitForTick(timeoutMs: number): boolean {
    if (!this.connected || !this.sdk) return false
    return this.sdk.waitForData(timeoutMs)
  }

  readFrame(): TelemetryFrame {
    const sdk = this.sdk
    // Without a received tick the native header and data buffer are NULL.
    if (!sdk || !this.connected || !sdk.sessionStatusOK) return emptyFrame()
    const present = this.presentVars(sdk)
    const frame: Partial<Record<TelemetryVarName, readonly (number | boolean)[]>> = {}
    for (const name of TELEMETRY_VAR_NAMES) {
      const index = present.get(name)
      frame[name] =
        index === undefined
          ? EMPTY
          : (sdk.getTelemetryVariable<number | boolean>(index)?.value ?? EMPTY)
    }
    return frame as TelemetryFrame
  }

  sessionInfoVersion(): number {
    return this.sdk?.getSessionVersionNum() ?? -1
  }

  readSessionInfo(): unknown {
    const sdk = this.sdk
    if (!sdk) return null
    try {
      // iRacing writes the YAML in Windows-1252, which only our own copy decodes right.
      const text = this.sessionText?.read() ?? null
      if (text !== null && text !== '') {
        const parsed = parseSessionYaml(text)
        if (isObject(parsed)) return parsed
      }
      // irsdk-node's string: koffi missing, shared memory unreadable, or a YAML ours cannot load.
      if (!this.skipWrapperYaml) {
        // Null when js-yaml throws (e.g. odd driver names); undefined while the YAML is empty.
        const data: unknown = sdk.getSessionData()
        if (isObject(data)) return data
      }
      const raw = rawSessionYaml(sdk)
      if (raw === null) return null
      this.skipWrapperYaml = true
      return parseSessionYaml(raw)
    } catch {
      return null
    }
  }

  /**
   * The var header can change with the session (car swap) or the data layout
   * (the connection id increments then), so `present` is rebuilt on either.
   */
  private presentVars(sdk: IRacingSDK): Map<TelemetryVarName, number> {
    const version = sdk.getSessionVersionNum()
    const connection = sdk.getSessionConnectionID()
    if (this.present && version === this.presentVersion && connection === this.presentConnection) {
      return this.present
    }
    sdk.resetTelemetryVariableCache()
    const native = nativeOf(sdk)
    const lookup = native?.getTelemetryVariableIndex
    const present = new Map<TelemetryVarName, number>()
    const missing: string[] = []
    for (const name of TELEMETRY_VAR_NAMES) {
      const index: unknown = typeof lookup === 'function' ? lookup.call(native, name) : null
      if (typeof index === 'number' && Number.isInteger(index) && index >= 0) {
        present.set(name, index)
      } else {
        missing.push(name)
      }
    }
    this.present = present
    this.presentVersion = version
    this.presentConnection = connection
    const key = missing.join(', ')
    if (key !== this.loggedMissing) {
      this.loggedMissing = key
      if (typeof lookup !== 'function') {
        console.warn('irsdk-node has no var index lookup: reading no telemetry variables')
      } else if (missing.length > 0) {
        console.warn(`Telemetry variables missing for this car: ${key}`)
      }
    }
    return present
  }
}
