import { describe, expect, it } from 'vitest'
import {
  ASSIGNABLE_KEYS,
  FUNCTION_KEYS,
  NAVIGATION_KEYS,
  NUMPAD_KEYS,
  RESERVED_ACCELERATORS,
  canonicalAccelerator,
  checkAccelerator,
  formatAccelerator,
  heldModifiers,
  modifierCaps,
  parseAccelerator,
  readKeyboardEvent,
  type KeyInput
} from './accelerator'

/** A keydown as Chromium reports it; no modifiers unless given. */
function key(k: string, code: string, mods: Partial<KeyInput> = {}): KeyInput {
  return { key: k, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods }
}

const CTRL_SHIFT = { ctrlKey: true, shiftKey: true }

/** The accelerator a keydown reads as, or the reason it does not. */
function read(e: KeyInput): string {
  const r = readKeyboardEvent(e)
  if (r.kind === 'key') return r.accelerator
  return r.kind === 'refused' ? `refused:${r.error}` : `held:${modifierCaps(r.held).join('+')}`
}

describe('parseAccelerator', () => {
  it('reads the canonical spelling', () => {
    expect(parseAccelerator('Ctrl+Alt+Shift+E')).toEqual({
      ok: true,
      value: { ctrl: true, alt: true, shift: true, key: 'E' }
    })
    expect(parseAccelerator('F13')).toEqual({
      ok: true,
      value: { ctrl: false, alt: false, shift: false, key: 'F13' }
    })
  })

  it("takes Electron's aliases, in any case and order", () => {
    for (const text of [
      'CommandOrControl+Shift+E',
      'CmdOrCtrl+Shift+E',
      'Control+Shift+E',
      'ctrl+shift+e',
      'SHIFT+CTRL+E',
      ' Ctrl + Shift + E '
    ]) {
      expect(canonicalAccelerator(text), text).toBe('Ctrl+Shift+E')
    }
    expect(canonicalAccelerator('Option+F2')).toBe('Alt+F2')
    expect(canonicalAccelerator('ctrl+alt+pageup')).toBe('Ctrl+Alt+PageUp')
    expect(canonicalAccelerator('Ctrl+NUMADD')).toBe('Ctrl+numadd')
    expect(canonicalAccelerator('ctrl+Num7')).toBe('Ctrl+num7')
    expect(canonicalAccelerator('alt+space')).toBeNull()
    expect(canonicalAccelerator('ctrl+space')).toBe('Ctrl+Space')
  })

  it('refuses what is not one key with each modifier at most once', () => {
    for (const text of [
      '',
      '+',
      'Ctrl+',
      '+E',
      'Ctrl++E',
      'Ctrl+Shift',
      'Ctrl',
      'Ctrl+E+F',
      'Ctrl+Ctrl+E',
      'Ctrl+Control+E',
      'Super+Win+E',
      'x'.repeat(65)
    ]) {
      expect(parseAccelerator(text), JSON.stringify(text)).toEqual({ ok: false, error: 'invalid' })
    }
  })

  it('refuses the Windows key by any name', () => {
    for (const text of ['Super+E', 'Meta+Shift+E', 'Win+D', 'Cmd+E', 'Command+Alt+E']) {
      expect(parseAccelerator(text), text).toEqual({ ok: false, error: 'meta' })
    }
  })

  it('refuses keys that move between layouts and unknown ones', () => {
    for (const text of [
      'Ctrl+;',
      'Ctrl+ñ',
      'Ctrl+Plus',
      'Ctrl+,',
      'Ctrl+PrintScreen',
      'Ctrl+F25'
    ]) {
      expect(parseAccelerator(text), text).toEqual({ ok: false, error: 'unsupported-key' })
    }
  })
})

describe('formatAccelerator', () => {
  it('writes the modifiers present, always Ctrl, Alt, Shift, then the key', () => {
    expect(formatAccelerator({ ctrl: true, alt: true, shift: true, key: 'E' })).toBe(
      'Ctrl+Alt+Shift+E'
    )
    expect(formatAccelerator({ ctrl: false, alt: true, shift: true, key: 'Up' })).toBe(
      'Alt+Shift+Up'
    )
    expect(formatAccelerator({ ctrl: false, alt: false, shift: false, key: 'F20' })).toBe('F20')
  })

  it('round-trips every assignable key', () => {
    for (const k of ASSIGNABLE_KEYS) {
      const text = `Ctrl+Shift+${k}`
      expect(canonicalAccelerator(text.toLowerCase()), k).toBe(text)
    }
  })
})

describe('checkAccelerator', () => {
  it('accepts the defaults and other ordinary combinations', () => {
    for (const text of ['Ctrl+Shift+H', 'Ctrl+Shift+E', 'Alt+F2', 'Ctrl+num5', 'Alt+Shift+Left']) {
      expect(checkAccelerator(text), text).toEqual({ ok: true, accelerator: text })
    }
  })

  it('lets only F13-F24 go without Ctrl or Alt', () => {
    for (const k of FUNCTION_KEYS.slice(12)) {
      expect(checkAccelerator(k).ok, k).toBe(true)
      expect(checkAccelerator(`Shift+${k}`).ok, k).toBe(true)
    }
    for (const text of [
      'F1',
      'F12',
      'Shift+F5',
      'A',
      'Shift+A',
      '7',
      'Shift+7',
      'num5',
      'Space',
      'Shift+Delete',
      'PageUp'
    ]) {
      expect(checkAccelerator(text), text).toMatchObject({ ok: false, error: 'needs-modifier' })
    }
  })

  it('refuses every reserved combination and anything with Esc', () => {
    for (const text of RESERVED_ACCELERATORS) {
      expect(checkAccelerator(text), text).toMatchObject({ ok: false, error: 'reserved' })
    }
    for (const text of [
      'Alt+Tab',
      'Alt+F4',
      'Alt+Space',
      'Ctrl+Esc',
      'Alt+Esc',
      'Ctrl+Alt+Delete',
      'Ctrl+Shift+Esc',
      'Ctrl+A',
      'Ctrl+C',
      'Ctrl+V',
      'Ctrl+X',
      'Ctrl+Z',
      'Ctrl+Y',
      'Escape',
      'Esc',
      'Shift+Escape',
      'Ctrl+Alt+Shift+Escape'
    ]) {
      expect(checkAccelerator(text), text).toMatchObject({ ok: false, error: 'reserved' })
    }
    // Only those exact combinations: one more modifier is another combination.
    expect(checkAccelerator('Ctrl+Shift+C').ok).toBe(true)
    expect(checkAccelerator('Alt+Shift+F4').ok).toBe(true)
  })

  it('refuses Tab, Enter and Backspace in any combination', () => {
    for (const text of ['Ctrl+Tab', 'Ctrl+Enter', 'Ctrl+Return', 'Ctrl+Shift+Backspace']) {
      expect(checkAccelerator(text), text).toMatchObject({ ok: false, error: 'unsupported-key' })
    }
  })

  it('warns about AltGr: Ctrl+Alt without Shift with a letter or digit, saved anyway', () => {
    expect(checkAccelerator('Ctrl+Alt+E')).toEqual({
      ok: true,
      accelerator: 'Ctrl+Alt+E',
      warning: 'altgr'
    })
    expect(checkAccelerator('Ctrl+Alt+2').warning).toBe('altgr')
    expect(checkAccelerator('Ctrl+Alt+Shift+E').warning).toBeUndefined()
    expect(checkAccelerator('Ctrl+Alt+F5').warning).toBeUndefined()
    expect(checkAccelerator('Ctrl+Alt+num2').warning).toBeUndefined()
    expect(checkAccelerator('Ctrl+Alt+Up').warning).toBeUndefined()
  })

  it('reports why unparsable text fails, with no accelerator', () => {
    expect(checkAccelerator('Win+E')).toEqual({ ok: false, accelerator: '', error: 'meta' })
    expect(checkAccelerator('Ctrl+ñ')).toEqual({
      ok: false,
      accelerator: '',
      error: 'unsupported-key'
    })
    expect(checkAccelerator('nonsense+')).toEqual({ ok: false, accelerator: '', error: 'invalid' })
  })

  it('canonicalAccelerator: only assignable combinations, only strings', () => {
    expect(canonicalAccelerator('ctrl+shift+h')).toBe('Ctrl+Shift+H')
    for (const raw of [42, null, undefined, {}, ['Ctrl+E'], 'Ctrl+C', 'F5', 'Win+E', '']) {
      expect(canonicalAccelerator(raw), JSON.stringify(raw)).toBeNull()
    }
  })
})

describe('readKeyboardEvent', () => {
  it('keeps recording while only modifiers are held', () => {
    expect(read(key('Control', 'ControlLeft', { ctrlKey: true }))).toBe('held:Ctrl')
    expect(read(key('Shift', 'ShiftRight', CTRL_SHIFT))).toBe('held:Ctrl+Shift')
    expect(read(key('Alt', 'AltLeft', { altKey: true }))).toBe('held:Alt')
  })

  it('reads AltGr as Ctrl+Alt (what Windows sends), so the check warns', () => {
    expect(read(key('AltGraph', 'AltRight', { ctrlKey: true, altKey: true }))).toBe('held:Ctrl+Alt')
    // Spanish layout: AltGr+E types '€', AltGr+2 types '@'.
    const euro = read(key('€', 'KeyE', { ctrlKey: true, altKey: true }))
    expect(euro).toBe('Ctrl+Alt+E')
    expect(checkAccelerator(euro).warning).toBe('altgr')
    expect(read(key('@', 'Digit2', { ctrlKey: true, altKey: true }))).toBe('Ctrl+Alt+2')
  })

  it('reads AltGr reported only as the AltGraph modifier as Ctrl+Alt too', () => {
    // When AltGr types a character, Chromium on Windows may clear ctrlKey and altKey and set
    // only getModifierState('AltGraph'); the hot key Windows sees is still Ctrl+Alt+E.
    expect(read(key('AltGraph', 'AltRight', { altGraph: true }))).toBe('held:Ctrl+Alt')
    const euro = read(key('€', 'KeyE', { altGraph: true }))
    expect(euro).toBe('Ctrl+Alt+E')
    expect(checkAccelerator(euro).warning).toBe('altgr')
    expect(read(key('@', 'Digit2', { altGraph: true }))).toBe('Ctrl+Alt+2')
    expect(read(key('|', 'Digit1', { altGraph: true, shiftKey: true }))).toBe('Ctrl+Alt+Shift+1')
    // Both at once (Ctrl+Alt flags and the modifier) is the same combination.
    expect(read(key('€', 'KeyE', { ctrlKey: true, altKey: true, altGraph: true }))).toBe(
      'Ctrl+Alt+E'
    )
    expect(heldModifiers(key('Shift', 'ShiftLeft', { shiftKey: true, altGraph: true }))).toEqual({
      ctrl: true,
      alt: true,
      shift: true
    })
  })

  it('takes letters as the layout labels them (AZERTY), by position when they are not latin', () => {
    expect(read(key('h', 'KeyH', CTRL_SHIFT))).toBe('Ctrl+Shift+H')
    expect(read(key('H', 'KeyH', CTRL_SHIFT))).toBe('Ctrl+Shift+H')
    // AZERTY: the key labelled A sits where QWERTY has Q.
    expect(read(key('a', 'KeyQ', CTRL_SHIFT))).toBe('Ctrl+Shift+A')
    expect(read(key('q', 'KeyA', CTRL_SHIFT))).toBe('Ctrl+Shift+Q')
    // Cyrillic layout: no latin letter, the position decides.
    expect(read(key('у', 'KeyE', CTRL_SHIFT))).toBe('Ctrl+Shift+E')
  })

  it('takes digits by position: Shift+1 is ! and the AZERTY 1 is &', () => {
    expect(read(key('!', 'Digit1', CTRL_SHIFT))).toBe('Ctrl+Shift+1')
    expect(read(key('&', 'Digit1', { ctrlKey: true }))).toBe('Ctrl+1')
    expect(read(key('0', 'Digit0', { altKey: true }))).toBe('Alt+0')
  })

  it('reads the numeric keypad, and its navigation keys with Num Lock off', () => {
    expect(read(key('5', 'Numpad5', { ctrlKey: true }))).toBe('Ctrl+num5')
    expect(read(key('+', 'NumpadAdd', { ctrlKey: true }))).toBe('Ctrl+numadd')
    expect(read(key('-', 'NumpadSubtract', { altKey: true }))).toBe('Alt+numsub')
    expect(read(key('*', 'NumpadMultiply', { altKey: true }))).toBe('Alt+nummult')
    expect(read(key('/', 'NumpadDivide', { altKey: true }))).toBe('Alt+numdiv')
    expect(read(key(',', 'NumpadDecimal', { altKey: true }))).toBe('Alt+numdec')
    expect(read(key('.', 'NumpadDecimal', { altKey: true }))).toBe('Alt+numdec')
    // Num Lock off: the key that arrives is the navigation one.
    expect(read(key('End', 'Numpad1', { ctrlKey: true }))).toBe('Ctrl+End')
    expect(read(key('ArrowUp', 'Numpad8', { ctrlKey: true }))).toBe('Ctrl+Up')
    expect(read(key('Delete', 'NumpadDecimal', { ctrlKey: true }))).toBe('Ctrl+Delete')
    expect(read(key('Clear', 'Numpad5', { ctrlKey: true }))).toBe('refused:unsupported-key')
    expect(read(key('Enter', 'NumpadEnter', { ctrlKey: true }))).toBe('Ctrl+Enter')
  })

  it('reads F1-F24, arrows and navigation by position', () => {
    for (const f of FUNCTION_KEYS) expect(read(key(f, f, { altKey: true }))).toBe(`Alt+${f}`)
    expect(read(key('F13', 'F13'))).toBe('F13')
    expect(checkAccelerator(read(key('F13', 'F13')))).toEqual({ ok: true, accelerator: 'F13' })
    expect(read(key('ArrowLeft', 'ArrowLeft', { ctrlKey: true }))).toBe('Ctrl+Left')
    expect(read(key('PageDown', 'PageDown', { altKey: true }))).toBe('Alt+PageDown')
    expect(read(key(' ', 'Space', { ctrlKey: true }))).toBe('Ctrl+Space')
    for (const k of NAVIGATION_KEYS) expect(ASSIGNABLE_KEYS).toContain(k)
    for (const k of NUMPAD_KEYS) expect(ASSIGNABLE_KEYS).toContain(k)
  })

  it('names the keys a shortcut cannot have, so the check can say why', () => {
    expect(read(key('Tab', 'Tab', { ctrlKey: true }))).toBe('Ctrl+Tab')
    expect(read(key('Escape', 'Escape', { ctrlKey: true }))).toBe('Ctrl+Escape')
    expect(read(key('Backspace', 'Backspace', { ctrlKey: true }))).toBe('Ctrl+Backspace')
    expect(checkAccelerator('Ctrl+Escape').error).toBe('reserved')
  })

  it('refuses punctuation and other layout keys', () => {
    for (const [k, code] of [
      ['ñ', 'Semicolon'],
      ['´', 'Quote'],
      ['Dead', 'BracketLeft'],
      ['<', 'IntlBackslash'],
      ['ç', 'Backslash'],
      ['-', 'Slash'],
      ['PrintScreen', 'PrintScreen']
    ] as const) {
      expect(read(key(k, code, { ctrlKey: true })), code).toBe('refused:unsupported-key')
    }
  })

  it('refuses the Windows key, alone or held', () => {
    expect(read(key('Meta', 'MetaLeft', { metaKey: true }))).toBe('refused:meta')
    expect(read(key('e', 'KeyE', { metaKey: true, ctrlKey: true }))).toBe('refused:meta')
    expect(read(key('OS', 'OSLeft'))).toBe('refused:meta')
  })

  it('reports the modifiers held with every reading', () => {
    expect(readKeyboardEvent(key('ñ', 'Semicolon', { ctrlKey: true, shiftKey: true }))).toEqual({
      kind: 'refused',
      error: 'unsupported-key',
      held: { ctrl: true, alt: false, shift: true }
    })
    expect(readKeyboardEvent(key('h', 'KeyH', CTRL_SHIFT))).toEqual({
      kind: 'key',
      accelerator: 'Ctrl+Shift+H',
      held: { ctrl: true, alt: false, shift: true }
    })
  })
})

describe('modifierCaps', () => {
  it('names the held modifiers the same in every language, in order', () => {
    expect(modifierCaps({ ctrl: true, alt: true, shift: true })).toEqual(['Ctrl', 'Alt', 'Shift'])
    expect(modifierCaps({ ctrl: false, alt: false, shift: true })).toEqual(['Shift'])
    expect(modifierCaps({ ctrl: false, alt: false, shift: false })).toEqual([])
  })
})
