import { copyFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createDefaultSettings, normalizeSettings } from '@shared/settings'
import type { OverlaySettings } from '@shared/types'

const DEFAULT_SAVE_DELAY_MS = 500
/** A file briefly locked at startup (antivirus, cloud sync) usually frees up within this. */
const READ_RETRIES = 5
const READ_RETRY_DELAY_MS = 50

/**
 * Settings JSON on disk (`settings.json` in userData). Reads and writes are
 * synchronous on purpose: the file is a few hundred bytes, and `flush()` must
 * complete inside `before-quit`.
 */
export class SettingsStore {
  private current: OverlaySettings
  private timer: ReturnType<typeof setTimeout> | null = null
  private dirty = false

  private constructor(
    readonly file: string,
    initial: OverlaySettings,
    private readonly saveDelayMs: number,
    /** The file exists but could not be read: back it up before the first save replaces it. */
    private loadFailed: boolean
  ) {
    this.current = initial
  }

  /**
   * Missing file -> defaults. Corrupt file -> copied to `<file>.bak`, then defaults.
   * Unreadable file (still locked after a few retries) -> defaults, and the first
   * save copies it to `<file>.bak` before overwriting it.
   */
  static load(file: string, saveDelayMs = DEFAULT_SAVE_DELAY_MS): SettingsStore {
    const { settings, loadFailed } = readSettings(file)
    return new SettingsStore(file, settings, saveDelayMs, loadFailed)
  }

  /** Current settings. Treat as read-only; change them through `update()`. */
  get settings(): OverlaySettings {
    return this.current
  }

  /** Applies `mutate` to a copy, re-normalizes it and schedules a save. */
  update(mutate: (draft: OverlaySettings) => void): OverlaySettings {
    const draft = structuredClone(this.current)
    mutate(draft)
    this.current = normalizeSettings(draft)
    this.scheduleSave()
    return this.current
  }

  /** Debounced: bursts of changes produce a single write. */
  scheduleSave(): void {
    this.dirty = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.flush()
    }, this.saveDelayMs)
  }

  /** Writes now if there are unsaved changes. Returns false if the write failed. */
  flush(): boolean {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (!this.dirty) return true
    if (this.loadFailed && !this.backUpUnreadFile()) return false
    try {
      writeAtomic(this.file, JSON.stringify(this.current, null, 2) + '\n')
      this.dirty = false
      return true
    } catch (err) {
      console.error(`[settings] could not save ${this.file}:`, err)
      return false
    }
  }

  /** Never overwrite settings we could not read without keeping a copy first. */
  private backUpUnreadFile(): boolean {
    try {
      copyFileSync(this.file, `${this.file}.bak`)
    } catch (err) {
      if (errorCode(err) !== 'ENOENT') {
        console.error(`[settings] could not back up ${this.file}, not overwriting it:`, err)
        return false
      }
    }
    this.loadFailed = false
    return true
  }
}

interface Loaded {
  settings: OverlaySettings
  loadFailed: boolean
}

function readSettings(file: string): Loaded {
  let text: string | undefined
  for (let attempt = 0; text === undefined; attempt++) {
    try {
      text = readFileSync(file, 'utf8')
    } catch (err) {
      if (errorCode(err) === 'ENOENT')
        return { settings: createDefaultSettings(), loadFailed: false }
      if (attempt >= READ_RETRIES) {
        console.warn(`[settings] could not read ${file}, using defaults:`, err)
        return { settings: createDefaultSettings(), loadFailed: true }
      }
      sleepSync(READ_RETRY_DELAY_MS)
    }
  }
  try {
    // Strip a BOM in case the file was edited by hand with Notepad.
    const json = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
    return { settings: normalizeSettings(JSON.parse(json)), loadFailed: false }
  } catch (err) {
    console.warn(`[settings] ${file} is corrupt, using defaults (copy kept as .bak):`, err)
    try {
      copyFileSync(file, `${file}.bak`)
    } catch (copyErr) {
      console.warn('[settings] could not back up the corrupt file:', copyErr)
    }
    return { settings: createDefaultSettings(), loadFailed: false }
  }
}

/** Startup runs before any window exists, so blocking main briefly here is harmless. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Write to a temp file and rename it over the target, so a crash never leaves half a file. */
function writeAtomic(file: string, data: string): void {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, data, 'utf8')
  try {
    renameSync(tmp, file)
  } catch (err) {
    // Windows: the target can be briefly locked (antivirus, indexer). Fall back to a direct write.
    const code = errorCode(err)
    if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') throw err
    writeFileSync(file, data, 'utf8')
    rmSync(tmp, { force: true })
  }
}

function errorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}
