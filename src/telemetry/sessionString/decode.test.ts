import { describe, expect, it } from 'vitest'
import { decodeCp1252, decodeCp1252Table, decodeSessionString } from './decode'
import { encodeCp1252 } from './testing/cp1252'

/** Latin-1 bytes: the same as Windows-1252 for letters (none is in 0x80-0x9F). */
const latin1 = (text: string): Uint8Array => Uint8Array.from(Buffer.from(text, 'latin1'))

/** Every byte value but NUL (it ends the string), in order. */
const ALL_BYTES = Uint8Array.from({ length: 255 }, (_, i) => i + 1)

describe.each([
  ['the engine decoder', decodeCp1252],
  ['the table', decodeCp1252Table]
])('Windows-1252 with %s', (_, decode) => {
  it('decodes accented Latin letters from their single bytes', () => {
    // One byte per letter, as iRacing writes them (Node's Latin-1 encoder, not ours).
    const bytes = latin1('Lucía Peñalver,Jérôme Duchêne')
    expect(decode(bytes)).toBe('Lucía Peñalver,Jérôme Duchêne')
    expect(decode(encodeCp1252('Zoë Ångström'))).toBe('Zoë Ångström')
  })

  it('maps the 0x80-0x9F block to its own characters, not to C1 controls', () => {
    expect(decode(Uint8Array.of(0x80, 0x91, 0x92, 0x93, 0x94, 0x96, 0x97, 0x85))).toBe('€‘’“”–—…')
    expect(decode(Uint8Array.of(0x8a, 0x9a, 0x8e, 0x9e, 0x9f, 0x8c, 0x9c, 0x99))).toBe('ŠšŽžŸŒœ™')
    // The five bytes Windows-1252 leaves undefined keep their C1 code point (as in WHATWG).
    expect(decode(Uint8Array.of(0x81, 0x8d, 0x8f, 0x90, 0x9d))).toBe(
      '\u0081\u008d\u008f\u0090\u009d'
    )
  })

  it('is Latin-1 outside that block, one character per byte', () => {
    const text = decode(ALL_BYTES)
    expect(text).toHaveLength(255)
    for (const b of ALL_BYTES) {
      if (b < 0x80 || b > 0x9f) expect(text.charCodeAt(b - 1)).toBe(b)
    }
  })

  it('decodes text longer than one chunk', () => {
    expect(decode(new Uint8Array(20_000).fill(0xe9))).toBe('é'.repeat(20_000))
  })

  it('decodes nothing to an empty string', () => {
    expect(decode(new Uint8Array(0))).toBe('')
  })
})

describe('decodeCp1252', () => {
  it('agrees with the table on every byte', () => {
    expect(decodeCp1252(ALL_BYTES)).toBe(decodeCp1252Table(ALL_BYTES))
  })
})

describe('decodeSessionString', () => {
  it('reads what iRacing writes as Windows-1252', () => {
    expect(decodeSessionString(encodeCp1252('UserName: Jérôme Duchêne “JD” €'))).toBe(
      'UserName: Jérôme Duchêne “JD” €'
    )
  })

  it('stops at the first NUL, like the C string it is', () => {
    expect(decodeSessionString(Uint8Array.of(0x41, 0xe9, 0x00, 0x42, 0x00))).toBe('Aé')
    expect(decodeSessionString(Uint8Array.of(0x00, 0x41))).toBe('')
    expect(decodeSessionString(new Uint8Array(16))).toBe('')
  })

  it('reads valid UTF-8 as UTF-8 (a sim set to write it)', () => {
    const utf8 = new TextEncoder().encode('UserName: Zoë Ångström, Иван')
    const padded = new Uint8Array(utf8.length + 8)
    padded.set(utf8)
    expect(decodeSessionString(padded)).toBe('UserName: Zoë Ångström, Иван')
  })
})

describe('encodeCp1252 (test helper)', () => {
  it("writes '?' for what Windows-1252 lacks, as iRacing does", () => {
    expect(decodeCp1252(encodeCp1252('Иван Петров'))).toBe('???? ??????')
    expect(decodeCp1252(encodeCp1252('Paweł 李'))).toBe('Pawe? ?')
    expect(encodeCp1252('€é')).toEqual(Uint8Array.of(0x80, 0xe9))
  })
})
