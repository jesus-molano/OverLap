/**
 * The bytes of an iRacing-like shared memory for the reader's tests: an irsdk_header with the
 * session info fields filled in and the string at its offset, NUL-padded like iRacing's
 * fixed-size buffer. Tests only.
 */
import { HEADER_SIZE, IRSDK_VER } from '../reader'

export interface SdkMemoryOptions {
  /** Whole memory size (default: room for the string buffer). */
  size?: number
  /** sessionInfoOffset (default 1024). */
  offset?: number
  /** sessionInfoLen, the buffer size (default: the string plus 256 NULs). */
  length?: number
  /** sessionInfoUpdate (default 1). */
  update?: number
  /** irsdk_header.ver (default IRSDK_VER). */
  ver?: number
}

export function writeHeader(
  memory: Uint8Array,
  h: { ver: number; update: number; length: number; offset: number }
): void {
  const dv = new DataView(memory.buffer, memory.byteOffset, memory.byteLength)
  dv.setInt32(0, h.ver, true)
  // status, tickRate: what a running sim shows.
  dv.setInt32(4, 1, true)
  dv.setInt32(8, 60, true)
  dv.setInt32(12, h.update, true)
  dv.setInt32(16, h.length, true)
  dv.setInt32(20, h.offset, true)
}

export function sdkMemory(session: Uint8Array, o: SdkMemoryOptions = {}): Uint8Array {
  const offset = o.offset ?? 1024
  const length = o.length ?? session.length + 256
  const memory = new Uint8Array(o.size ?? Math.max(HEADER_SIZE, offset + length))
  // A corrupt header may point past the end (the string is left out) or into itself (the
  // header, written last, wins).
  if (offset >= 0 && offset < memory.length) {
    memory.set(session.subarray(0, memory.length - offset), offset)
  }
  writeHeader(memory, { ver: o.ver ?? IRSDK_VER, update: o.update ?? 1, length, offset })
  return memory
}
