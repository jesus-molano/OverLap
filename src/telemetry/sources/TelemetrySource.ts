import type { SourceKind } from '@shared/types'
import type { TelemetryFrame } from '@shared/telemetry'

/**
 * Where telemetry comes from. The loop in `../loop.ts` drives it:
 *
 *   while running:
 *     if not connected: await connect() every ~2 s, publish `waiting`
 *     else if waitForTick(timeout): readFrame(), and readSessionInfo() only
 *       when sessionInfoVersion() changed
 *     yield to the event loop (setImmediate)
 */
export interface TelemetrySource {
  readonly kind: SourceKind

  /**
   * Tries to connect. Must not block the event loop for long (the real
   * source first checks the sim status over HTTP). Resolves true when ticks
   * can be read.
   */
  connect(): Promise<boolean>

  /** Releases the connection. Safe to call when not connected. */
  disconnect(): void

  /** True while ticks are expected. Turns false when the sim goes away. */
  isConnected(): boolean

  /**
   * Blocks synchronously for at most `timeoutMs` until a new tick is
   * available. Returns false on timeout or when the connection was lost
   * (check `isConnected()` afterwards).
   */
  waitForTick(timeoutMs: number): boolean

  /** Reads every variable in TELEMETRY_VARS for the current tick. */
  readFrame(): TelemetryFrame

  /** Changes whenever the session YAML changes. */
  sessionInfoVersion(): number

  /**
   * The parsed session YAML (shape of irsdk `SessionData`, but treat it as
   * untrusted: fields can be missing). Expensive on the real source, so the
   * loop only calls it when `sessionInfoVersion()` changes.
   */
  readSessionInfo(): unknown
}
