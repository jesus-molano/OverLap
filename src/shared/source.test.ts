import { describe, expect, it } from 'vitest'
import { defaultSourceKind, parseSourceKind } from './source'

describe('source kind', () => {
  it('parses mock and iracing in any case', () => {
    expect(parseSourceKind('mock')).toBe('mock')
    expect(parseSourceKind(' MOCK ')).toBe('mock')
    expect(parseSourceKind('iRacing')).toBe('iracing')
    for (const v of ['', 'foo', 'mock2', null, undefined]) expect(parseSourceKind(v)).toBeNull()
  })

  it('defaults to the real sim on Windows only', () => {
    expect(defaultSourceKind('win32')).toBe('iracing')
    expect(defaultSourceKind('linux')).toBe('mock')
    expect(defaultSourceKind('darwin')).toBe('mock')
  })
})
