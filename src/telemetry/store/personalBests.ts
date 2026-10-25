/**
 * All-time personal bests on disk: `<dir>/personal-bests.json`, one lap per
 * car model + track layout (personalBestKey in @shared/delta/references).
 *
 * Lives in the telemetry process. The file is read synchronously once, when
 * the store is created (before the loop starts); after that every read is a
 * Map lookup. A new best updates memory at once and schedules one debounced,
 * atomic (tmp + rename), asynchronous write, so the 60 Hz loop never waits
 * for the disk. Deleting from the settings window is saved at once (same
 * write path, so never two writes at a time). Nothing here throws: a missing
 * file is an empty store, a corrupt one is kept as `.bak` and the store
 * starts empty, and IO errors are logged once.
 *
 * File format: `{ version: 1, bests: { [key]: { lapTime, profile, recordedAt,
 * car, track, layout } } }`. The names (for the settings list) came later:
 * an entry without them reads as '' and gets them with the next lap there.
 */
import { copyFileSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  LapReference,
  PersonalBestLabel,
  PersonalBestStore,
  PersonalBestSummary
} from '@shared/delta/references'
import { RACE_TIMING_LINES } from '@shared/race/raceView'
import { errorMessage } from '../errors'

export const PERSONAL_BESTS_FILE = 'personal-bests.json'
export const PERSONAL_BESTS_VERSION = 1
/** Oldest laps (by recordedAt) are dropped beyond this many car + layout combinations. */
export const MAX_PERSONAL_BESTS = 500
/** A burst of new bests (several cars in one session) becomes one write. */
export const PERSONAL_BESTS_SAVE_DELAY_MS = 2000

/** Profile start / end versus 0 / the lap time, seconds. */
const END_TOLERANCE_S = 0.05
/** No lap takes longer: anything above is a corrupt entry. */
const MAX_LAP_S = 3600
const MAX_KEY_LENGTH = 200
const MAX_DATE_LENGTH = 40
/** Car and track names are display text; anything longer is not one. */
const MAX_LABEL_LENGTH = 120
/** 500 entries are ~0.4 MB; a much bigger file is not ours. */
const MAX_FILE_CHARS = 16 * 1024 * 1024
/** A file briefly locked at startup (antivirus, cloud sync) usually frees up within this. */
const READ_RETRIES = 3
const READ_RETRY_DELAY_MS = 50

export type StoreLog = (level: 'warn' | 'error', message: string) => void

export interface FileStoreOptions {
  saveDelayMs?: number
  maxEntries?: number
  /** Default: console.warn / console.error (the telemetry process's stderr reaches main). */
  log?: StoreLog
  /**
   * The stored bests changed (a new best, names added to one, a deletion).
   * Called synchronously, once per change; a throwing listener is ignored.
   */
  onChange?: () => void
}

/**
 * The telemetry process's store: it may have writes pending, and the
 * settings window lists and deletes its entries (through main).
 */
export interface FlushableStore extends PersonalBestStore {
  /** Writes pending changes now, after any write in flight. Never rejects. */
  flush(): Promise<void>
  /** Every stored best without its profile, newest first. */
  list(): PersonalBestSummary[]
  /** Deletes these keys (unknown ones are ignored); returns how many were deleted. */
  delete(keys: readonly string[]): number
  /** Deletes every best; returns how many there were. */
  clear(): number
}

/** A stored lap with the names of its car and layout. */
type StoredBest = Readonly<LapReference & PersonalBestLabel>

const NO_LABEL: PersonalBestLabel = Object.freeze({ car: '', track: '', layout: '' })

/**
 * The store of the telemetry process: on disk under `dataDir` (main passes
 * its userData as OVERLAY_DATA_DIR), in memory when there is none.
 */
export function openPersonalBestStore(
  dataDir: string | undefined,
  opts: FileStoreOptions = {}
): FlushableStore {
  return createStore(dataDir ? join(dataDir, PERSONAL_BESTS_FILE) : null, opts)
}

export function createFileStore(dir: string, opts: FileStoreOptions = {}): FlushableStore {
  return createStore(join(dir, PERSONAL_BESTS_FILE), opts)
}

/** The store over `file`, or only in memory when it is null. */
function createStore(file: string | null, opts: FileStoreOptions): FlushableStore {
  const log = opts.log ?? defaultLog
  const maxEntries = Math.max(1, Math.floor(opts.maxEntries ?? MAX_PERSONAL_BESTS))
  const saveDelayMs = Math.max(0, opts.saveDelayMs ?? PERSONAL_BESTS_SAVE_DELAY_MS)

  const loaded: Loaded = file
    ? load(file, maxEntries, log)
    : { bests: new Map(), mustBackUp: false }
  const bests = loaded.bests
  /** The file on disk holds laps we did not take: copy it to .bak before replacing it. */
  let mustBackUp = loaded.mustBackUp
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | null = null
  /** Writes run one after another (they share the tmp file). */
  let writing: Promise<void> = Promise.resolve()
  let writeErrorLogged = false

  const logWriteError = (message: string): void => {
    if (writeErrorLogged) return
    writeErrorLogged = true
    log('error', message)
  }

  const changed = (): void => {
    try {
      opts.onChange?.()
    } catch {
      // The listener's problem; the store itself is fine.
    }
  }

  const writeIfDirty = async (): Promise<void> => {
    if (!dirty || !file) return
    try {
      if (mustBackUp) {
        if (!(await backUpAsync(file))) {
          logWriteError(`Personal bests: could not back up ${file}, not overwriting it`)
          return
        }
        mustBackUp = false
      }
      dirty = false
      await writeAtomic(file, serialize(bests))
      writeErrorLogged = false
    } catch (err) {
      // Kept in memory; the next best or the flush on shutdown tries again.
      dirty = true
      logWriteError(`Personal bests: could not save ${file}: ${errorMessage(err)}`)
    }
  }

  const save = (): Promise<void> => {
    writing = writing.then(writeIfDirty)
    return writing
  }

  const cancelTimer = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const scheduleSave = (): void => {
    dirty = true
    if (timer || !file) return
    timer = setTimeout(() => {
      timer = null
      void save()
    }, saveDelayMs)
  }

  /** A deletion by the user: saved now, not lost if the app is killed within the delay. */
  const saveNow = (): void => {
    dirty = true
    cancelTimer()
    void save()
  }

  return {
    get: (key) => bests.get(key) ?? null,
    offer: (key, lap, label) => {
      if (!isKey(key)) return false
      const ref = toReference(lap)
      if (!ref) return false
      const cur = bests.get(key)
      if (cur && cur.lapTime <= ref.lapTime) {
        // Not faster, but it may name a best stored before names were kept.
        const named = withNames(cur, cur, label)
        if (named !== cur) {
          bests.set(key, named)
          scheduleSave()
          changed()
        }
        return false
      }
      // Re-inserted: the Map stays roughly in recording order.
      bests.delete(key)
      bests.set(key, withNames(ref, cur ?? NO_LABEL, label))
      if (!cur) evictOldest(bests, maxEntries, key)
      scheduleSave()
      changed()
      return true
    },
    flush: () => {
      cancelTimer()
      return save()
    },
    list: () =>
      Array.from(bests, ([key, b]): PersonalBestSummary => ({
        key,
        lapTime: b.lapTime,
        recordedAt: b.recordedAt,
        car: b.car,
        track: b.track,
        layout: b.layout
      })).sort((a, b) => compareText(b.recordedAt, a.recordedAt) || compareText(a.key, b.key)),
    delete: (keys) => {
      let deleted = 0
      for (const key of keys) if (bests.delete(key)) deleted++
      if (deleted > 0) {
        saveNow()
        changed()
      }
      return deleted
    },
    clear: () => {
      const deleted = bests.size
      if (deleted > 0) {
        bests.clear()
        saveNow()
        changed()
      }
      return deleted
    }
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && key.length <= MAX_KEY_LENGTH
}

function isLapTime(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_LAP_S
}

/** RACE_TIMING_LINES + 1 finite, non-decreasing seconds from ~0 to ~lapTime. */
function isProfile(p: unknown, lapTime: number): p is ArrayLike<number> {
  if (!Array.isArray(p) && !(ArrayBuffer.isView(p) && !(p instanceof DataView))) return false
  const list = p as ArrayLike<unknown>
  if (list.length !== RACE_TIMING_LINES + 1) return false
  const first = list[0]
  if (typeof first !== 'number' || !(Math.abs(first) <= END_TOLERANCE_S)) return false
  let prev = first
  for (let i = 1; i < list.length; i++) {
    const v = list[i]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < prev) return false
    prev = v
  }
  return Math.abs(prev - lapTime) <= END_TOLERANCE_S
}

const round = (v: number, scale: number): number => Math.round(v * scale) / scale

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Display text, or '' when it is not one. */
function labelText(v: unknown): string {
  if (typeof v !== 'string') return ''
  const t = v.trim()
  return t.length <= MAX_LABEL_LENGTH ? t : ''
}

/**
 * A validated, frozen copy of a lap (the caller's profile may be a reused
 * buffer), rounded like the file stores it: 0.1 ms lap time, 1 ms profile;
 * with the names `raw` has ('' when missing or odd). Null when it is not a
 * usable lap.
 */
function toReference(raw: unknown): StoredBest | null {
  if (!isRecord(raw)) return null
  const { lapTime, profile, recordedAt } = raw
  if (!isLapTime(lapTime) || !isProfile(profile, lapTime)) return null
  const copy = Array.from(profile, (v) => round(v, 1000))
  return Object.freeze({
    lapTime: round(lapTime, 10_000),
    profile: Object.freeze(copy),
    recordedAt:
      typeof recordedAt === 'string' && recordedAt.length <= MAX_DATE_LENGTH ? recordedAt : '',
    car: labelText(raw.car),
    track: labelText(raw.track),
    layout: labelText(raw.layout)
  })
}

/**
 * `best` with the names of `label`, falling back field by field to the ones
 * `known` already had (the same key is the same car and layout). `best`
 * itself when nothing changes.
 */
function withNames(
  best: StoredBest,
  known: PersonalBestLabel,
  label: PersonalBestLabel | undefined
): StoredBest {
  const track = labelText(label?.track)
  const car = labelText(label?.car) || known.car
  // A layout is legitimately '' (one-layout tracks): it comes with its track's name.
  const layout = track ? labelText(label?.layout) : known.layout
  const named = { car, track: track || known.track, layout }
  if (named.car === best.car && named.track === best.track && named.layout === best.layout) {
    return best
  }
  return Object.freeze({ ...best, ...named })
}

/** Drops the entries with the oldest recordedAt ('' = oldest) beyond `max`, never `keep`. */
function evictOldest(bests: Map<string, StoredBest>, max: number, keep: string): void {
  while (bests.size > max) {
    let oldestKey: string | null = null
    let oldestAt = ''
    for (const [key, ref] of bests) {
      if (key === keep) continue
      if (oldestKey === null || ref.recordedAt < oldestAt) {
        oldestKey = key
        oldestAt = ref.recordedAt
      }
    }
    if (oldestKey === null) return
    bests.delete(oldestKey)
  }
}

// ---------------------------------------------------------------------------
// Disk
// ---------------------------------------------------------------------------

interface Loaded {
  bests: Map<string, StoredBest>
  mustBackUp: boolean
}

function load(file: string, maxEntries: number, log: StoreLog): Loaded {
  let text: string | undefined
  for (let attempt = 0; text === undefined; attempt++) {
    try {
      text = readFileSync(file, 'utf8')
    } catch (err) {
      if (errorCode(err) === 'ENOENT') return { bests: new Map(), mustBackUp: false }
      if (attempt >= READ_RETRIES) {
        log('warn', `Personal bests: could not read ${file}, starting empty: ${errorMessage(err)}`)
        return { bests: new Map(), mustBackUp: true }
      }
      sleepSync(READ_RETRY_DELAY_MS)
    }
  }

  const parsed = parse(text)
  if (!parsed) {
    log('warn', `Personal bests: ${file} is corrupt, starting empty (copy kept as .bak)`)
    return { bests: new Map(), mustBackUp: !backUp(file) }
  }
  // Oldest first, like offer() keeps them; beyond the cap the oldest go.
  const entries = parsed.entries.sort((a, b) => compareText(a[1].recordedAt, b[1].recordedAt))
  if (entries.length > maxEntries) entries.splice(0, entries.length - maxEntries)
  const bests = new Map(entries)
  if (parsed.dropped === 0) return { bests, mustBackUp: false }
  log('warn', `Personal bests: ignored ${parsed.dropped} invalid entries (copy kept as .bak)`)
  return { bests, mustBackUp: !backUp(file) }
}

/** Null when the file is not a version-1 store at all. */
function parse(text: string): { entries: [string, StoredBest][]; dropped: number } | null {
  if (text.length > MAX_FILE_CHARS) return null
  let root: unknown
  try {
    // Strip a BOM in case the file was edited by hand with Notepad.
    root = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch {
    return null
  }
  if (!isRecord(root) || root.version !== PERSONAL_BESTS_VERSION || !isRecord(root.bests)) {
    return null
  }
  const entries: [string, StoredBest][] = []
  let dropped = 0
  for (const [key, raw] of Object.entries(root.bests)) {
    const ref = isKey(key) ? toReference(raw) : null
    if (ref) entries.push([key, ref])
    else dropped++
  }
  return { entries, dropped }
}

function serialize(bests: ReadonlyMap<string, StoredBest>): string {
  // fromEntries defines own properties: a '__proto__' key stays a plain key.
  return JSON.stringify({ version: PERSONAL_BESTS_VERSION, bests: Object.fromEntries(bests) })
}

/** Copies the file to `.bak`. True when done or there is nothing to keep. */
function backUp(file: string): boolean {
  try {
    copyFileSync(file, `${file}.bak`)
    return true
  } catch (err) {
    return errorCode(err) === 'ENOENT'
  }
}

/** backUp() off the event loop, for the saves that run while the loop does. */
async function backUpAsync(file: string): Promise<boolean> {
  try {
    await copyFile(file, `${file}.bak`)
    return true
  } catch (err) {
    return errorCode(err) === 'ENOENT'
  }
}

/** Write to a temp file and rename it over the target, so a crash never leaves half a file. */
async function writeAtomic(file: string, data: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await writeFile(tmp, data, 'utf8')
  try {
    await rename(tmp, file)
  } catch (err) {
    // Windows: the target can be briefly locked (antivirus, indexer). Fall back to a direct write.
    const code = errorCode(err)
    if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') throw err
    await writeFile(file, data, 'utf8')
    await rm(tmp, { force: true })
  }
}

/** Only at startup, before the loop runs. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function errorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

function defaultLog(level: 'warn' | 'error', message: string): void {
  try {
    console[level](`[bests] ${message}`)
  } catch {
    // Nothing else to report to.
  }
}
