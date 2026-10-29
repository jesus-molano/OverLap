import { copyFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  SETTINGS_VERSION,
  createDefaultSettings,
  normalizeSettings,
  settingsDraft
} from '@shared/settings'
import type { OverlaySettings } from '@shared/types'

const DEFAULT_SAVE_DELAY_MS = 500
/** After a failed write, the next try (antivirus, cloud sync and indexers free files soon). */
const RETRY_SAVE_DELAY_MS = 3_000
/** A file briefly locked at startup (antivirus, cloud sync) usually frees up within this. */
const READ_RETRIES = 5
const READ_RETRY_DELAY_MS = 50

/**
 * Settings JSON on disk (`settings.json` in userData). Reads and writes are
 * synchronous on purpose: the file is small (up to about 1 MB with 30 layouts and
 * their options, written at most every half second), and `flush()` must
 * complete inside `before-quit`.
 */
export class SettingsStore {
  private current: OverlaySettings
  private timer: ReturnType<typeof setTimeout> | null = null
  private dirty = false
  private failing = false
  /** Called when saving starts failing (true) and when it works again (false). */
  onSaveFailing: ((failing: boolean) => void) | null = null

  /** The last write failed and the changes since are only in memory (retried every few s). */
  get saveFailing(): boolean {
    return this.failing
  }

  private constructor(
    readonly file: string,
    initial: OverlaySettings,
    private readonly saveDelayMs: number,
    /** The file exists but could not be read: back it up before the first save replaces it. */
    private loadFailed: boolean,
    /**
     * The file was written by an older version (before SETTINGS_VERSION): copied to
     * `<file>.v5.bak` before the first save, as that version would read it (without the
     * layouts' options, which it drops), so going back to it loses nothing.
     */
    private olderFile: boolean,
    /** There was no file: a first run, on the default settings. */
    readonly fresh: boolean
  ) {
    this.current = initial
  }

  /**
   * Missing file -> defaults. Corrupt file -> copied to `<file>.bak`, then defaults.
   * Unreadable file (still locked after a few retries) -> defaults, and the first
   * save copies it to `<file>.bak` before overwriting it. A file from an older version is
   * copied to `<file>.v5.bak` before the first save.
   */
  static load(file: string, saveDelayMs = DEFAULT_SAVE_DELAY_MS): SettingsStore {
    const { settings, loadFailed, fresh, older } = readSettings(file)
    return new SettingsStore(
      file,
      settings,
      saveDelayMs,
      loadFailed,
      older === true,
      fresh === true
    )
  }

  /** Current settings. Treat as read-only; change them through `update()`. */
  get settings(): OverlaySettings {
    return this.current
  }

  /**
   * Applies `mutate` to a copy, re-normalizes it and schedules a save. The layouts' options are
   * not copied (settingsDraft): frozen, they are replaced by whatever changes one.
   */
  update(mutate: (draft: OverlaySettings) => void): OverlaySettings {
    const draft = settingsDraft(this.current)
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
    if (this.loadFailed && !this.backUpUnreadFile()) return this.failed()
    if (this.olderFile) this.backUpOlderFile()
    try {
      const text = JSON.stringify(this.current, null, 2) + '\n'
      writeAtomic(this.file, text)
      console.log(`[settings] saved (${text.length} bytes)`)
      this.dirty = false
      this.setFailing(false)
      return true
    } catch (err) {
      console.error(`[settings] could not save ${this.file}:`, err)
      return this.failed()
    }
  }

  /** A write that did not happen: said once, and tried again later (the changes are kept). */
  private failed(): false {
    this.setFailing(true)
    if (this.timer === null) {
      this.timer = setTimeout(() => {
        this.timer = null
        this.flush()
      }, RETRY_SAVE_DELAY_MS)
    }
    return false
  }

  private setFailing(failing: boolean): void {
    if (this.failing === failing) return
    this.failing = failing
    if (failing) console.error(`[settings] changes are not being saved to ${this.file}; retrying`)
    else console.log(`[settings] saving to ${this.file} works again`)
    this.onSaveFailing?.(failing)
  }

  /** Once: a copy of the older version's file, kept for going back to that version. */
  private backUpOlderFile(): void {
    this.olderFile = false
    try {
      copyFileSync(this.file, `${this.file}.v5.bak`)
    } catch (err) {
      // Not worth refusing to save over: the settings themselves were read whole.
      if (errorCode(err) !== 'ENOENT')
        console.warn(`[settings] could not back up ${this.file}:`, err)
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
  /** No file at all (ENOENT). */
  fresh?: boolean
  /** Read whole, but written by an older version (its `version` below SETTINGS_VERSION). */
  older?: boolean
}

function readSettings(file: string): Loaded {
  let text: string | undefined
  for (let attempt = 0; text === undefined; attempt++) {
    try {
      text = readFileSync(file, 'utf8')
    } catch (err) {
      if (errorCode(err) === 'ENOENT')
        return { settings: createDefaultSettings(), loadFailed: false, fresh: true }
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
    const raw: unknown = JSON.parse(json)
    return { settings: normalizeSettings(raw), loadFailed: false, older: isOlderFile(raw) }
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

/** A settings file whose version is below this one's (a missing or odd one reads as older). */
function isOlderFile(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false
  const v = (raw as { version?: unknown }).version
  return !(typeof v === 'number' && v >= SETTINGS_VERSION)
}

/** Startup runs before any window exists, so blocking main briefly here is harmless. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Write to a temp file and rename it over the target, so a crash never leaves half a file. */
function writeAtomic(file: string, data: string): void {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  try {
    writeFileSync(tmp, data, 'utf8')
    renameSync(tmp, file)
  } catch (err) {
    // Windows: the target or a stale temp file can be briefly locked (antivirus, indexer,
    // cloud sync). Fall back to a direct write.
    if (!isLockError(err)) throw err
    writeFileSync(file, data, 'utf8')
    try {
      rmSync(tmp, { force: true })
    } catch {
      // A leftover temp file is harmless: the settings themselves are written.
    }
  }
}

function isLockError(err: unknown): boolean {
  const code = errorCode(err)
  return code === 'EPERM' || code === 'EBUSY' || code === 'EACCES'
}

function errorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}
