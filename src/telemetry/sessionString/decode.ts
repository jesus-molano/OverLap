/**
 * The session info bytes to text. iRacing writes the YAML in Windows-1252 (pyirsdk reads it as
 * cp1252), not in UTF-8: 'é' is the single byte 0xE9. Pure.
 */

/**
 * 0x80-0x9F, where Windows-1252 differs from Latin-1 ('€', curly quotes, 'Š', 'Ÿ'...). The five
 * bytes it leaves undefined keep their C1 code point, as the WHATWG decoder does.
 */
const HIGH_BLOCK: readonly number[] = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039,
  0x0152, 0x008d, 0x017d, 0x008f, 0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178
]

/** Code units per String.fromCharCode call (well under the engine's argument limit). */
const CHUNK = 8192

/** The euro sign and a curly quote: a decoder that gets them wrong is Latin-1 in disguise. */
const PROBE = Uint8Array.of(0x80, 0x92)
const PROBE_TEXT = '€’'

/**
 * The engine's decoder when it really is Windows-1252 (Electron and Node ship full ICU; some
 * Node versions decoded it as Latin-1), else null.
 */
function nativeDecoder(): TextDecoder | null {
  try {
    const decoder = new TextDecoder('windows-1252')
    return decoder.decode(PROBE) === PROBE_TEXT ? decoder : null
  } catch {
    return null
  }
}

const NATIVE = nativeDecoder()
const UTF8 = new TextDecoder('utf-8', { fatal: true })

/** The table decoder the module falls back to without a usable TextDecoder. */
export function decodeCp1252Table(bytes: Uint8Array): string {
  let out = ''
  const units = new Uint16Array(Math.min(CHUNK, bytes.length))
  for (let start = 0; start < bytes.length; start += CHUNK) {
    const n = Math.min(CHUNK, bytes.length - start)
    for (let i = 0; i < n; i++) {
      const b = bytes[start + i] ?? 0
      units[i] = b >= 0x80 && b <= 0x9f ? (HIGH_BLOCK[b - 0x80] ?? b) : b
    }
    out += String.fromCharCode(...units.subarray(0, n))
  }
  return out
}

export function decodeCp1252(bytes: Uint8Array): string {
  return NATIVE ? NATIVE.decode(bytes) : decodeCp1252Table(bytes)
}

/**
 * The session info up to its first NUL (a C string in a fixed-size buffer). Windows-1252 unless
 * the bytes are valid UTF-8, should the sim be set to write that: accented Windows-1252 text is
 * practically never valid UTF-8, and plain ASCII reads the same either way.
 */
export function decodeSessionString(bytes: Uint8Array): string {
  const end = bytes.indexOf(0)
  const text = end < 0 ? bytes : bytes.subarray(0, end)
  try {
    return UTF8.decode(text)
  } catch {
    return decodeCp1252(text)
  }
}
