import { describe, expect, it, vi } from 'vitest'
import {
  CURSOR_SHOWING,
  CURSOR_SUPPRESSED,
  createCursorProbe,
  cursorShowingFrom
} from './cursorProbe'

describe('cursorShowingFrom', () => {
  it('reads CURSORINFO.flags as a DWORD', () => {
    expect(cursorShowingFrom(CURSOR_SHOWING)).toBe(true)
    // iRacing in the car: no CURSOR_SHOWING.
    expect(cursorShowingFrom(0)).toBe(false)
    expect(cursorShowingFrom(CURSOR_SHOWING | CURSOR_SUPPRESSED)).toBe(false)
    expect(cursorShowingFrom(CURSOR_SUPPRESSED)).toBe(false)
    // A sign-extended DWORD is still the same bits.
    expect(cursorShowingFrom(-0xffffffff)).toBe(true)
    expect(cursorShowingFrom(Number.NaN)).toBeNull()
    expect(cursorShowingFrom(undefined)).toBeNull()
  })
})

describe('createCursorProbe', () => {
  it('answers null until the reader has loaded, then what it reads', async () => {
    let showing: boolean | null = false
    const load = vi.fn(() => Promise.resolve(() => showing))
    const probe = createCursorProbe(load, 'win32')
    expect(probe()).toBeNull()
    expect(probe()).toBeNull()
    await Promise.resolve()
    await Promise.resolve()
    expect(probe()).toBe(false)
    showing = true
    expect(probe()).toBe(true)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('stays unknown when the reader cannot load or throws, and off Windows', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failing = createCursorProbe(() => Promise.reject(new Error('no koffi')), 'win32')
    expect(failing()).toBeNull()
    await Promise.resolve()
    await Promise.resolve()
    expect(failing()).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)

    const throwing = createCursorProbe(
      () =>
        Promise.resolve(() => {
          throw new Error('bad call')
        }),
      'win32'
    )
    throwing()
    await Promise.resolve()
    await Promise.resolve()
    expect(throwing()).toBeNull()

    const load = vi.fn(() => Promise.resolve(() => true))
    const linux = createCursorProbe(load, 'linux')
    expect(linux()).toBeNull()
    expect(load).not.toHaveBeenCalled()
  })
})
