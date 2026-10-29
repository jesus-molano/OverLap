import { utilityProcess, type UtilityProcess } from 'electron'
import { createInterface } from 'node:readline'
import type { ControllerInfo } from '@shared/controllers'
import type { InputInMessage } from '@shared/ipc'
// electron-vite bundles the input entry as its own chunk and gives us its path.
import inputEntry from '../input/index?modulePath'
import { parseInputMessage } from './inputMessages'

const BACKOFF_MIN_MS = 500
const BACKOFF_MAX_MS = 10_000
/** A process that lived this long counts as healthy: the next crash restarts fast again. */
const STABLE_AFTER_MS = 10_000
const SHUTDOWN_GRACE_MS = 1_000

export interface InputHostOptions {
  /**
   * The controllers connected now; null when not known (no process running, or it is
   * starting), [] when they cannot be read at all.
   */
  onDevices(list: readonly ControllerInfo[] | null): void
  /** A button went down (once per press). */
  onPress(device: string, button: number): void
}

/**
 * Owns the input utilityProcess (src/input): running only while wanted (setWanted), restarted
 * with exponential backoff if it dies. A process that says controllers cannot be read (not
 * Windows, Raw Input refused) is not restarted until it is wanted again.
 */
export class InputHost {
  private child: UtilityProcess | null = null
  private wanted = false
  private spawnedAt = 0
  private backoffMs = BACKOFF_MIN_MS
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  /** The child that said controllers cannot be read. */
  private unavailable: UtilityProcess | null = null
  private invalidMessages = 0
  private disposed = false

  constructor(private readonly opts: InputHostOptions) {}

  get running(): boolean {
    return this.child !== null
  }

  /** Starts the process (when not running) or stops it. */
  setWanted(on: boolean): void {
    if (this.disposed || on === this.wanted) return
    this.wanted = on
    if (on) {
      this.backoffMs = BACKOFF_MIN_MS
      if (!this.child && !this.restartTimer) this.spawn()
    } else {
      this.halt()
    }
  }

  /** On quit: stops the process and never starts it again. */
  dispose(): void {
    this.wanted = false
    this.disposed = true
    this.halt()
  }

  private halt(): void {
    if (this.restartTimer) clearTimeout(this.restartTimer)
    this.restartTimer = null
    const child = this.child
    this.child = null
    if (child) {
      const killTimer = setTimeout(() => child.kill(), SHUTDOWN_GRACE_MS)
      child.once('exit', () => clearTimeout(killTimer))
      this.post(child, { type: 'shutdown' })
      console.log('[input] stopping')
    }
    this.opts.onDevices(null)
  }

  private spawn(): void {
    this.restartTimer = null
    this.spawnedAt = 0
    let child: UtilityProcess
    try {
      child = utilityProcess.fork(inputEntry, [], {
        serviceName: 'overlap-input',
        stdio: 'pipe'
      })
    } catch (err) {
      console.error('[input] fork failed:', err)
      this.restartLater()
      return
    }
    this.child = child
    const closeStdout = pipeLines(child.stdout, (line) => console.log(`[input] ${line}`))
    const closeStderr = pipeLines(child.stderr, (line) => console.error(`[input] ${line}`))
    child.on('spawn', () => {
      if (this.child !== child) return
      this.spawnedAt = Date.now()
      console.log(`[input] started (pid ${child.pid ?? '?'})`)
    })
    child.on('message', (raw: unknown) => {
      if (this.child === child) this.handleMessage(child, raw)
    })
    child.on('error', (type, location) => console.error(`[input] ${type} at ${location}`))
    child.on('exit', (code) => {
      closeStdout()
      closeStderr()
      this.handleExit(child, code)
    })
  }

  private handleExit(child: UtilityProcess, code: number): void {
    if (this.child !== child) {
      console.log(`[input] stopped (code ${code})`)
      return
    }
    this.child = null
    if (this.unavailable === child) {
      this.unavailable = null
      return
    }
    this.opts.onDevices(null)
    if (!this.wanted || this.disposed) return
    if (this.spawnedAt > 0 && Date.now() - this.spawnedAt >= STABLE_AFTER_MS) {
      this.backoffMs = BACKOFF_MIN_MS
    }
    console.warn(`[input] exited with code ${code}, restarting in ${this.backoffMs} ms`)
    this.restartLater()
  }

  private restartLater(): void {
    const delay = this.backoffMs
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX_MS)
    this.restartTimer = setTimeout(() => this.spawn(), delay)
  }

  private handleMessage(child: UtilityProcess, raw: unknown): void {
    const msg = parseInputMessage(raw)
    if (!msg) {
      if (this.invalidMessages++ % 600 === 0) console.warn('[input] ignoring an invalid message')
      return
    }
    switch (msg.type) {
      case 'devices':
        this.opts.onDevices(msg.list)
        break
      case 'press':
        this.opts.onPress(msg.device, msg.button)
        break
      case 'unavailable':
        console.warn(`[input] controllers cannot be read: ${msg.detail}`)
        this.unavailable = child
        this.opts.onDevices([])
        // Nothing to read: it is let go, and tried again the next time it is wanted.
        this.post(child, { type: 'shutdown' })
        break
      case 'log':
        console[msg.level](`[input] ${msg.message}`)
        break
    }
  }

  private post(child: UtilityProcess, msg: InputInMessage): void {
    try {
      child.postMessage(msg)
    } catch (err) {
      console.warn('[input] postMessage failed:', err)
    }
  }
}

/** Logs each non-empty line; the returned function closes the reader. */
function pipeLines(
  stream: NodeJS.ReadableStream | null,
  onLine: (line: string) => void
): () => void {
  if (!stream) return () => {}
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  rl.on('line', (line) => {
    if (line.trim() !== '') onLine(line)
  })
  rl.on('error', () => {})
  return () => rl.close()
}
