/**
 * Telemetry utility process entry (forked by main with utilityProcess.fork).
 * irsdk-node's waitForData() blocks synchronously, so the loop lives here and
 * talks to main only through process.parentPort.
 */
import type { ParentPort } from 'electron'
import { join } from 'node:path'
import { isPersonalBestKeys, type PersonalBestTarget } from '@shared/delta/references'
import type { TelemetryInMessage, TelemetryOutMessage } from '@shared/ipc'
import type { ShowInSessions, SourceKind, TelemetryConfig } from '@shared/types'
import { WIDGET_IDS, isWidgetId } from '@shared/widgets'
import { errorMessage } from './errors'
import { TelemetryLoop } from './loop'
import { createSource, resolveSourceKind } from './sources/createSource'
import type { TelemetrySource } from './sources/TelemetrySource'
import { openPersonalBestStore, type FlushableStore } from './store/personalBests'

/** Lets the last messages reach main before a crash exit. */
const CRASH_EXIT_DELAY_MS = 50
/** Exit waits at most this long for the personal bests to reach the disk (main kills at 1 s). */
const FLUSH_TIMEOUT_MS = 700

// stdout/stderr are pipes to main: if main goes away, writes fail with EPIPE,
// and an 'error' event without a listener would be an uncaught exception.
process.stdout.on('error', () => {})
process.stderr.on('error', () => {})

function errorDetail(err: unknown): string {
  try {
    if (err instanceof Error && typeof err.stack === 'string') return err.stack
  } catch {
    // Throwing stack getter.
  }
  return errorMessage(err)
}

function safeConsoleError(message: string): void {
  try {
    console.error(message)
  } catch {
    // Nothing else to report to.
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

const SESSION_KINDS = ['practice', 'qualify', 'race'] as const satisfies (keyof ShowInSessions)[]

/** One `{ showIn, hideInPits, showOnSessionScreen }` rule per widget, every field a boolean. */
function isRules(v: unknown): boolean {
  if (!isObject(v)) return false
  return WIDGET_IDS.every((id) => {
    const rule = v[id]
    if (!isObject(rule) || typeof rule.hideInPits !== 'boolean') return false
    if (typeof rule.showOnSessionScreen !== 'boolean') return false
    const showIn = rule.showIn
    return isObject(showIn) && SESSION_KINDS.every((k) => typeof showIn[k] === 'boolean')
  })
}

/**
 * Shape check of what main sends. The options themselves were normalized by
 * main; the loop only needs every section and a rule per widget.
 */
function isTelemetryConfig(v: unknown): v is TelemetryConfig {
  return (
    isObject(v) &&
    Array.isArray(v.enabledWidgets) &&
    v.enabledWidgets.every(isWidgetId) &&
    isRules(v.rules) &&
    isObject(v.relative) &&
    isObject(v.radar) &&
    isObject(v.standings) &&
    isObject(v.battle) &&
    isObject(v.inputs) &&
    isObject(v.traffic) &&
    isObject(v.alerts) &&
    isObject(v.delta)
  )
}

/** Null for anything that is not a valid message; 'invalid-config' is reported, not applied. */
function parseInMessage(data: unknown): TelemetryInMessage | 'invalid-config' | null {
  if (!isObject(data)) return null
  if (data.type === 'shutdown') return { type: 'shutdown' }
  if (data.type === 'clear-bests') return { type: 'clear-bests' }
  if (data.type === 'cycle-delta-reference') return { type: 'cycle-delta-reference' }
  if (data.type === 'delete-bests') {
    return isPersonalBestKeys(data.keys) ? { type: 'delete-bests', keys: [...data.keys] } : null
  }
  if (data.type === 'config') {
    return isTelemetryConfig(data.config)
      ? { type: 'config', config: data.config }
      : 'invalid-config'
  }
  return null
}

/**
 * The personal bests in main's userData (OVERLAY_DATA_DIR); the mock keeps
 * its own under mock/, so simulated laps never mix with real ones. In memory
 * without a data directory.
 */
function openBests(
  kind: SourceKind,
  emit: (msg: TelemetryOutMessage) => void,
  onChange: () => void
): FlushableStore {
  const dataDir = process.env.OVERLAY_DATA_DIR
  const dir = dataDir && kind === 'mock' ? join(dataDir, 'mock') : dataDir
  const log = (level: 'warn' | 'error', message: string): void => {
    try {
      emit({ type: 'log', level, message })
    } catch {
      safeConsoleError(message)
    }
  }
  try {
    return openPersonalBestStore(dir, { log, onChange })
  } catch (err) {
    log('error', `Personal bests unavailable: ${errorMessage(err)}`)
    return openPersonalBestStore(undefined, { onChange })
  }
}

function run(port: ParentPort): void {
  const kind = resolveSourceKind(process.env.OVERLAY_SOURCE, process.platform)
  const emit = (msg: TelemetryOutMessage): void => port.postMessage(msg)
  /** The car + layout being driven, as the loop last reported it. */
  let bestTarget: PersonalBestTarget | null = null
  // The store only calls back on a change, long after it is assigned.
  const bests = openBests(kind, emit, () => emitBests())
  /** Main keeps the latest list for the settings window: sent at start and on every change. */
  const emitBests = (): void => {
    try {
      emit({ type: 'bests', list: { entries: bests.list(), current: bestTarget } })
    } catch (err) {
      safeConsoleError(`[telemetry] could not send the personal bests: ${errorMessage(err)}`)
    }
  }
  let source: TelemetrySource | null = null
  let loop: TelemetryLoop | null = null
  let pendingConfig: TelemetryConfig | null = null
  let dying = false
  let exiting = false

  const exitOnce = (code: number): void => {
    if (exiting) return
    exiting = true
    process.exit(code)
  }

  /**
   * Exits once the personal bests are saved and at least `minDelayMs` passed,
   * after FLUSH_TIMEOUT_MS at the latest.
   */
  const exitAfterFlush = (code: number, minDelayMs: number): void => {
    let flushed = false
    let waited = minDelayMs <= 0
    const maybeExit = (): void => {
      if (flushed && waited) exitOnce(code)
    }
    const onFlushed = (): void => {
      flushed = true
      maybeExit()
    }
    if (!waited) {
      setTimeout(() => {
        waited = true
        maybeExit()
      }, minDelayMs)
    }
    setTimeout(() => exitOnce(code), FLUSH_TIMEOUT_MS)
    try {
      bests.flush().then(onFlushed, onFlushed)
    } catch {
      onFlushed()
    }
  }

  const release = (): void => {
    try {
      loop?.stop()
    } catch {
      // Exiting anyway.
    }
    try {
      // A lap that just ended still makes it into the flush that follows.
      loop?.settlePersonalBests()
    } catch {
      // Exiting anyway.
    }
    try {
      source?.disconnect()
    } catch {
      // Exiting anyway.
    }
  }

  // Report and exit(1) so main restarts the process. Later errors are ignored:
  // the first one decides, and reporting cannot start another round.
  const fatal = (err: unknown): void => {
    if (dying) return
    dying = true
    const detail = errorDetail(err)
    try {
      emit({ type: 'log', level: 'error', message: `Telemetry process crashed: ${detail}` })
      emit({
        type: 'status',
        status: { state: 'error', source: kind, note: 'none', detail: errorMessage(err) }
      })
    } catch {
      // Parent port gone: stderr is the only channel left.
      safeConsoleError(`Telemetry process crashed: ${detail}`)
    }
    release()
    exitAfterFlush(1, CRASH_EXIT_DELAY_MS)
  }

  process.on('uncaughtException', fatal)
  process.on('unhandledRejection', fatal)

  port.on('message', (event) => {
    const msg = parseInMessage(event.data)
    if (msg === 'invalid-config') {
      // Main and this process ship in one bundle: a mismatch is a bug worth a log line.
      emit({ type: 'log', level: 'warn', message: 'Ignoring an invalid config from main' })
      return
    }
    if (!msg) return
    if (msg.type === 'shutdown') {
      if (dying) return
      dying = true
      release()
      exitAfterFlush(0, 0)
      return
    }
    if (msg.type === 'cycle-delta-reference') {
      // Not connected yet: no session to cycle in.
      loop?.cycleDeltaReference()
      return
    }
    if (msg.type === 'delete-bests' || msg.type === 'clear-bests') {
      if (dying) return
      const deleted = msg.type === 'clear-bests' ? bests.clear() : bests.delete(msg.keys)
      // Nothing to delete (already gone): the window still needs the list to settle.
      if (deleted === 0) emitBests()
      return
    }
    if (loop) loop.setConfig(msg.config)
    else pendingConfig = msg.config
  })

  emit({
    type: 'status',
    status: { state: 'starting', source: kind, note: 'none', detail: '' }
  })
  emitBests()

  void (async () => {
    source = await createSource(kind)
    loop = new TelemetryLoop(source, emit, {
      bests,
      onPersonalBestTarget: (target) => {
        bestTarget = target
        emitBests()
      }
    })
    if (pendingConfig) loop.setConfig(pendingConfig)
    await loop.start()
  })().catch(fatal)
}

// Null in other Electron processes, undefined under plain Node.
const parentPort = process.parentPort as ParentPort | null | undefined
if (parentPort) {
  run(parentPort)
} else {
  safeConsoleError('[telemetry] Must be started with Electron utilityProcess.fork().')
  process.exit(1)
}
