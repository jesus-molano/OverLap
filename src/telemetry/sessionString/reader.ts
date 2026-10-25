/**
 * The session info YAML read straight from iRacing's shared memory and decoded as Windows-1252
 * (decode.ts). irsdk-node hands the same bytes to Napi::String::New(), which reads them as
 * UTF-8: every byte from 0x80 up (each accented letter) turns into U+FFFD there and the
 * original is lost. Only the header and the string are read here, through a read-only view
 * (win32.ts); everything else stays with irsdk-node.
 */
import { errorMessage } from '../errors'
import { decodeSessionString } from './decode'

/** irsdk_header (irsdk_defines.h): little-endian int32 fields at these byte offsets. */
const VER_OFFSET = 0
const UPDATE_OFFSET = 12
const LENGTH_OFFSET = 16
const STRING_OFFSET = 20
/** The fields above, read in one copy. */
const PREFIX_SIZE = 24
/** sizeof(irsdk_header): 12 ints, then IRSDK_MAX_BUFS (4) irsdk_varBuf of 16 bytes. */
export const HEADER_SIZE = 112
/** IRSDK_VER: the layout above. Any other version is left to irsdk-node. */
export const IRSDK_VER = 2
/** Copies tried while sessionInfoUpdate keeps moving during one (iRacing rewriting it). */
export const MAX_ATTEMPTS = 3

/** A read-only view of a named mapping (win32.ts; a fake in tests). */
export interface MappedView {
  /** Bytes readable from the start of the view. */
  readonly size: number
  /** Copies `target.length` bytes from `offset` into `target`. Throws outside the view. */
  read(offset: number, target: Uint8Array): void
  /** Unmaps the view and closes its handle. Safe to call twice. */
  close(): void
}

/** Opens a mapping read-only by name; null when there is none. */
export type OpenMapping = (name: string) => MappedView | null

interface SessionHeader {
  update: number
  offset: number
  length: number
}

function int32At(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(offset, true)
}

/** The string's place in the view, or null when the header does not describe one inside it. */
function readHeader(view: MappedView): SessionHeader | null {
  if (!Number.isSafeInteger(view.size) || view.size < HEADER_SIZE) return null
  const prefix = new Uint8Array(PREFIX_SIZE)
  view.read(0, prefix)
  if (int32At(prefix, VER_OFFSET) !== IRSDK_VER) return null
  const length = int32At(prefix, LENGTH_OFFSET)
  const offset = int32At(prefix, STRING_OFFSET)
  if (length < 0 || offset < HEADER_SIZE || offset + length > view.size) return null
  return { update: int32At(prefix, UPDATE_OFFSET), offset, length }
}

function updateCounter(view: MappedView): number {
  const field = new Uint8Array(4)
  view.read(UPDATE_OFFSET, field)
  return int32At(field, 0)
}

/**
 * One per source. The mapping is opened on the first read of a connection and kept until
 * close() (disconnect, process exit), so a reconnect loop never piles up handles.
 */
export class SessionStringReader {
  private view: MappedView | null = null
  /** The open failed on this connection: no new attempt until close(). */
  private openFailed = false
  private readonly logged = new Set<string>()

  /**
   * `name` is the mapping to read (the SDK's at runtime, a test's own in tests); `open` is null
   * when koffi did not load, and then every read returns null.
   */
  constructor(
    private readonly name: string,
    private readonly open: OpenMapping | null,
    private readonly log: (message: string) => void = (message) => console.warn(message)
  ) {}

  /**
   * The session info YAML, '' while iRacing has written none, or null when it cannot be read
   * here (no koffi, no mapping, a header out of bounds, a string rewritten during every copy):
   * the caller keeps irsdk-node's string then.
   */
  read(): string | null {
    const view = this.ensureView()
    if (!view) return null
    try {
      return this.readFrom(view)
    } catch (err) {
      this.warnOnce(`Could not read the session info from shared memory: ${errorMessage(err)}`)
      return null
    }
  }

  /** Releases the mapping; the next read opens it again. */
  close(): void {
    const view = this.view
    this.view = null
    this.openFailed = false
    try {
      view?.close()
    } catch {
      // Released with the process anyway.
    }
  }

  private ensureView(): MappedView | null {
    if (this.view) return this.view
    if (!this.open || this.openFailed) return null
    let view: MappedView | null = null
    try {
      view = this.open(this.name)
    } catch (err) {
      this.warnOnce(`Could not open the sim's shared memory: ${errorMessage(err)}`)
    }
    if (!view) {
      this.openFailed = true
      this.warnOnce("The sim's shared memory is not readable: names keep irsdk-node's decoding")
      return null
    }
    this.view = view
    return view
  }

  private readFrom(view: MappedView): string | null {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const header = readHeader(view)
      if (!header) {
        this.warnOnce('Unexpected session info header in shared memory: using irsdk-node')
        return null
      }
      const bytes = new Uint8Array(header.length)
      if (header.length > 0) view.read(header.offset, bytes)
      // Unchanged counter: iRacing did not start another version during the copy.
      if (updateCounter(view) === header.update) return decodeSessionString(bytes)
    }
    this.warnOnce('The session info kept changing while being read: using irsdk-node')
    return null
  }

  private warnOnce(message: string): void {
    if (this.logged.has(message)) return
    this.logged.add(message)
    try {
      this.log(message)
    } catch {
      // Logging must not break a read.
    }
  }
}
