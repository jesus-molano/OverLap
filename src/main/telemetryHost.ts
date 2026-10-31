import { app, utilityProcess, type UtilityProcess } from 'electron'
import { createInterface } from 'node:readline'
import type { PersonalBestList } from '@shared/delta/references'
import type { SessionKind } from '@shared/sessionInfo'
import type { AutoHiddenState, TelemetryInMessage } from '@shared/ipc'
import type {
  CarRef,
  OverlayStatus,
  SourceKind,
  TelemetryConfig,
  WidgetDataMessage
} from '@shared/types'
import type { WidgetId } from '@shared/widgets'
// electron-vite bundles the telemetry entry as its own chunk and gives us its path.
import telemetryEntry from '../telemetry/index?modulePath'
import { parseTelemetryMessage } from './telemetryMessages'

const BACKOFF_MIN_MS = 500
const BACKOFF_MAX_MS = 10_000
/** A process that lived this long counts as healthy: the next crash restarts fast again. */
const STABLE_AFTER_MS = 10_000
const SHUTDOWN_GRACE_MS = 1_000
/** «Exportar todo» waits this long for the process's bests, then reads the file. */
const BESTS_TEXT_TIMEOUT_MS = 2_000

export interface TelemetryHostOptions {
  source: SourceKind
  /**
   * Where the telemetry process keeps its data (the personal bests), passed as
   * OVERLAY_DATA_DIR. Default: userData. '' keeps it in memory.
   */
  dataDir?: string
  /** Read on every (re)spawn, so a restarted process gets the current settings. */
  getConfig(): TelemetryConfig
  onStatus(status: OverlayStatus): void
  onData(msg: WidgetDataMessage): void
  /**
   * A visibility rule hid or showed a widget. When the process exits, every
   * widget it had hidden is reported shown again: its successor starts from
   * scratch and only reports changes.
   */
  onAutoHidden(widget: WidgetId, state: AutoHiddenState): void
  /** The process's personal bests: once after each start, then on every change. */
  onBests(list: PersonalBestList): void
  /** How a `mergeBests` went (R40): laps taken, and new ones left out for lack of room. */
  onBestsMerged?(taken: number, skipped: number): void
  /**
   * The kind of session being driven, on change (null when unknown, and when the process
   * exits: its successor reports it again).
   */
  onSessionKind?(kind: SessionKind | null): void
  /** The player's car model, on change (null too when the process exits, like the kind). */
  onPlayerCar?(car: CarRef | null): void
  /** The classes of a multiclass session, the fastest first ([] with one or none). */
  onSessionClasses?(names: string[]): void
}

/**
 * Owns the telemetry utilityProcess: irsdk's blocking waitForData runs there,
 * never on main's event loop. Restarts it with exponential backoff if it dies.
 */
export class TelemetryHost {
  private child: UtilityProcess | null = null
  /** True between the child's 'spawn' and 'exit'. */
  private alive = false
  private spawnedAt = 0
  private backoffMs = BACKOFF_MIN_MS
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private stopping: Promise<void> | null = null
  private invalidMessages = 0
  /** Widgets the running process currently hides. */
  private readonly hidden = new Set<WidgetId>()
  /** `bestsText` calls waiting for their answer, by id. */
  private readonly textWaits = new Map<number, (text: string | null) => void>()
  private nextTextId = 1

  constructor(private readonly opts: TelemetryHostOptions) {}

  start(): void {
    if (this.child || this.restartTimer || this.stopping) return
    this.spawn()
  }

  /** Sends the config to the running process; a process not yet spawned gets it on 'spawn'. */
  sendConfig(config: TelemetryConfig = this.opts.getConfig()): void {
    if (this.alive) this.post({ type: 'config', config })
  }

  /** Asks the running process to delete these personal bests; false when none is running. */
  deleteBests(keys: string[]): boolean {
    return this.alive && this.post({ type: 'delete-bests', keys })
  }

  /**
   * The delta's cycle shortcut: the process moves the reference for this session only (nothing
   * is saved); false when none is running.
   */
  cycleDeltaReference(): boolean {
    return this.alive && this.post({ type: 'cycle-delta-reference' })
  }

  /** Asks the running process to delete every personal best; false when none is running. */
  clearBests(): boolean {
    return this.alive && this.post({ type: 'clear-bests' })
  }

  /** «Importar todo» (R40): merges a personal-bests file's text; false when none is running. */
  mergeBests(text: string): boolean {
    return this.alive && this.post({ type: 'merge-bests', text })
  }

  /**
   * «Exportar todo» (R40): the bests as their file holds them, from the process's memory (a lap
   * not yet written, or kept while writes fail, included). Null when none is running, it does
   * not answer in time, or it has no file of its own (the mock's): the caller reads the file.
   */
  bestsText(timeoutMs = BESTS_TEXT_TIMEOUT_MS): Promise<string | null> {
    const id = this.nextTextId++
    if (!this.alive) return Promise.resolve(null)
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.answerText(id, null), timeoutMs)
      this.textWaits.set(id, (text) => {
        clearTimeout(timer)
        resolve(text)
      })
      if (!this.post({ type: 'bests-text', id })) this.answerText(id, null)
    })
  }

  private answerText(id: number, text: string | null): void {
    const wait = this.textWaits.get(id)
    if (!wait) return
    this.textWaits.delete(id)
    wait(text)
  }

  /** Asks the process to shut down, kills it after 1 s. Never restarts it afterwards. */
  stop(): Promise<void> {
    if (this.stopping) return this.stopping
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    const child = this.child
    if (!child) {
      this.stopping = Promise.resolve()
      return this.stopping
    }
    this.stopping = new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => {
        console.warn('[telemetry] did not exit in time, killing it')
        child.kill()
      }, SHUTDOWN_GRACE_MS)
      // Last resort in case 'exit' never arrives after kill().
      const hardTimer = setTimeout(resolve, SHUTDOWN_GRACE_MS + 1_000)
      child.once('exit', () => {
        clearTimeout(killTimer)
        clearTimeout(hardTimer)
        resolve()
      })
      this.post({ type: 'shutdown' })
    })
    return this.stopping
  }

  private spawn(): void {
    this.restartTimer = null
    this.alive = false
    this.spawnedAt = 0
    let child: UtilityProcess
    try {
      const env: Record<string, string | undefined> = {
        ...process.env,
        OVERLAY_SOURCE: this.opts.source
      }
      const dataDir = this.dataDir()
      // Never inherited: no directory means bests in memory, not wherever the parent pointed.
      if (dataDir) env.OVERLAY_DATA_DIR = dataDir
      else delete env.OVERLAY_DATA_DIR
      child = utilityProcess.fork(telemetryEntry, [], {
        serviceName: 'iracing-telemetry',
        stdio: 'pipe',
        env
      })
    } catch (err) {
      console.error('[telemetry] fork failed:', err)
      this.restartLater()
      return
    }
    this.child = child

    const closeStdout = pipeLines(child.stdout, (line) => console.log(`[telemetry] ${line}`))
    const closeStderr = pipeLines(child.stderr, (line) => console.error(`[telemetry] ${line}`))

    child.on('spawn', () => {
      if (this.child !== child) return
      this.alive = true
      this.spawnedAt = Date.now()
      console.log(`[telemetry] started (pid ${child.pid ?? '?'}, source ${this.opts.source})`)
      this.sendConfig()
    })
    child.on('message', (raw: unknown) => {
      if (this.child === child) this.handleMessage(raw)
    })
    child.on('error', (type, location) => {
      // 'exit' follows; the report itself is a huge JSON blob, not worth logging.
      console.error(`[telemetry] ${type} at ${location}`)
    })
    child.on('exit', (code) => {
      // The pipes may never emit 'end': drop this spawn's readers with it.
      closeStdout()
      closeStderr()
      this.handleExit(child, code)
    })
  }

  private dataDir(): string {
    if (this.opts.dataDir !== undefined) return this.opts.dataDir
    try {
      return app.getPath('userData')
    } catch (err) {
      console.warn('[telemetry] no userData directory, personal bests stay in memory:', err)
      return ''
    }
  }

  private handleExit(child: UtilityProcess, code: number): void {
    if (this.child !== child) return
    this.child = null
    this.alive = false
    this.releaseHidden()
    if (this.stopping) {
      console.log(`[telemetry] stopped (code ${code})`)
      return
    }
    if (this.spawnedAt > 0 && Date.now() - this.spawnedAt >= STABLE_AFTER_MS) {
      this.backoffMs = BACKOFF_MIN_MS
    }
    console.warn(`[telemetry] exited with code ${code}, restarting in ${this.backoffMs} ms`)
    this.restartLater()
  }

  private restartLater(): void {
    this.opts.onStatus({
      state: 'error',
      source: this.opts.source,
      note: 'restarting',
      detail: ''
    })
    const delay = this.backoffMs
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX_MS)
    this.restartTimer = setTimeout(() => this.spawn(), delay)
  }

  private handleMessage(raw: unknown): void {
    const msg = parseTelemetryMessage(raw)
    if (!msg) {
      // Rate-limit: a broken provider could post invalid data at 60 Hz.
      if (this.invalidMessages++ % 600 === 0) {
        console.warn('[telemetry] ignoring invalid message:', summarize(raw))
      }
      return
    }
    switch (msg.type) {
      case 'status':
        this.opts.onStatus(msg.status)
        break
      case 'data':
        this.opts.onData({ widget: msg.widget, payload: msg.payload } as WidgetDataMessage)
        break
      case 'log':
        console[msg.level](`[telemetry] ${msg.message}`)
        break
      case 'auto-hidden':
        if (msg.hidden) this.hidden.add(msg.widget)
        else this.hidden.delete(msg.widget)
        this.opts.onAutoHidden(msg.widget, { hidden: msg.hidden, reason: msg.reason })
        break
      case 'bests':
        this.opts.onBests(msg.list)
        break
      case 'bests-merged':
        this.opts.onBestsMerged?.(msg.taken, msg.skipped)
        break
      case 'bests-text':
        this.answerText(msg.id, msg.text)
        break
      case 'session-kind':
        this.opts.onSessionKind?.(msg.kind)
        break
      case 'player-car':
        this.opts.onPlayerCar?.(msg.car)
        break
      case 'session-classes':
        this.opts.onSessionClasses?.(msg.names)
        break
    }
  }

  private releaseHidden(): void {
    // Gone before answering: the file, then.
    for (const id of [...this.textWaits.keys()]) this.answerText(id, null)
    this.opts.onSessionKind?.(null)
    this.opts.onPlayerCar?.(null)
    this.opts.onSessionClasses?.([])
    const ids = [...this.hidden]
    this.hidden.clear()
    for (const id of ids) this.opts.onAutoHidden(id, { hidden: false, reason: null })
  }

  /** False when there is no process or posting failed. */
  private post(msg: TelemetryInMessage): boolean {
    if (!this.child) return false
    try {
      this.child.postMessage(msg)
      return true
    } catch (err) {
      console.warn('[telemetry] postMessage failed:', err)
      return false
    }
  }
}

/** Logs each non-empty line; the returned function closes the reader and unhooks the stream. */
function pipeLines(
  stream: NodeJS.ReadableStream | null,
  onLine: (line: string) => void
): () => void {
  if (!stream) return () => {}
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  rl.on('line', (line) => {
    if (line.trim() !== '') onLine(line)
  })
  // readline re-emits stream errors; a broken pipe of a dying child is not worth an uncaught error.
  rl.on('error', () => {})
  return () => rl.close()
}

function summarize(raw: unknown): string {
  try {
    return (JSON.stringify(raw) ?? String(raw)).slice(0, 200)
  } catch {
    return String(raw)
  }
}
