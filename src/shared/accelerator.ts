/**
 * Key combinations of the global shortcuts. Pure: no Electron, no DOM.
 *
 * One canonical spelling, 'Ctrl+Alt+Shift+Key' (the modifiers present, always in that order),
 * which is also a valid Electron accelerator; parsing takes Electron's aliases in any case.
 * Only keys that are the same physical key on every layout can be assigned: punctuation moves
 * between layouts (a Spanish keyboard has ñ, ç and ´ where an English one has ; ' and [), so a
 * combination recorded on one would be another key, or none, on the next.
 */

export interface Accelerator {
  ctrl: boolean
  alt: boolean
  shift: boolean
  /** Canonical key name: 'E', '7', 'F13', 'num5', 'numadd', 'PageUp', 'Up'... */
  key: string
}

/** The modifiers held while a combination is being pressed. */
export type HeldModifiers = Pick<Accelerator, 'ctrl' | 'alt' | 'shift'>

export const NO_MODIFIERS: Readonly<HeldModifiers> = Object.freeze({
  ctrl: false,
  alt: false,
  shift: false
})

/**
 * - 'invalid': not a key combination at all (empty, two keys, a modifier twice, no key).
 * - 'unsupported-key': a key that cannot be assigned (punctuation, Tab, Enter, Backspace...).
 * - 'meta': the Windows key (Windows keeps its combinations for itself).
 * - 'needs-modifier': without Ctrl or Alt (only F13-F24 may go alone). Shift + a letter would
 *   stop you typing that capital, and the bare F1-F12 are iRacing's black boxes.
 * - 'reserved': Windows or every program already uses it (Alt+F4, Ctrl+C, anything with Esc...).
 * - 'duplicate': another action has it (checked against the other shortcuts, see shortcuts.ts).
 */
export type AcceleratorError =
  'invalid' | 'unsupported-key' | 'meta' | 'needs-modifier' | 'reserved' | 'duplicate'

/**
 * Saved anyway. 'altgr': Ctrl+Alt (without Shift) with a letter or digit is what AltGr sends on
 * a Spanish keyboard, so the shortcut may swallow @ # € and friends while typing.
 */
export type AcceleratorWarning = 'altgr'

export interface AcceleratorCheck {
  ok: boolean
  /** The canonical spelling ('' when it does not parse). */
  accelerator: string
  error?: AcceleratorError
  warning?: AcceleratorWarning
}

export const LETTER_KEYS: readonly string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
export const DIGIT_KEYS: readonly string[] = '0123456789'.split('')
/** F1-F24. F13-F24 are not on most keyboards: button boxes and macro pads send them. */
export const FUNCTION_KEYS: readonly string[] = Array.from({ length: 24 }, (_, i) => `F${i + 1}`)
export const NUMPAD_KEYS: readonly string[] = [
  ...DIGIT_KEYS.map((d) => `num${d}`),
  'numadd',
  'numsub',
  'nummult',
  'numdiv',
  'numdec'
]
export const NAVIGATION_KEYS = [
  'Space',
  'Insert',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Up',
  'Down',
  'Left',
  'Right'
] as const

/** Every key a shortcut can use. */
export const ASSIGNABLE_KEYS: readonly string[] = [
  ...LETTER_KEYS,
  ...DIGIT_KEYS,
  ...FUNCTION_KEYS,
  ...NUMPAD_KEYS,
  ...NAVIGATION_KEYS
]

/** Known by name so the check can say why they are refused; never assignable. */
const REFUSED_KEYS = ['Escape', 'Tab', 'Enter', 'Backspace'] as const

/** Lower-case spelling (and Electron's aliases) -> canonical key name. */
const KEY_NAMES: ReadonlyMap<string, string> = new Map([
  ...[...ASSIGNABLE_KEYS, ...REFUSED_KEYS].map((k) => [k.toLowerCase(), k] as const),
  ['esc', 'Escape'],
  ['return', 'Enter']
])

type Modifier = 'ctrl' | 'alt' | 'shift' | 'meta'

const MODIFIER_NAMES: ReadonlyMap<string, Modifier> = new Map([
  ['ctrl', 'ctrl'],
  ['control', 'ctrl'],
  ['commandorcontrol', 'ctrl'],
  ['cmdorctrl', 'ctrl'],
  ['alt', 'alt'],
  ['option', 'alt'],
  ['shift', 'shift'],
  // The Windows key (and macOS Command, which is the same key on a Windows keyboard).
  ['super', 'meta'],
  ['meta', 'meta'],
  ['win', 'meta'],
  ['cmd', 'meta'],
  ['command', 'meta']
])

/**
 * Taken by Windows or by every program (exact combinations): the task switcher, closing and
 * system menus, Start, Task Manager, the secure attention sequence and the editing keys.
 */
export const RESERVED_ACCELERATORS: ReadonlySet<string> = new Set([
  'Alt+Tab',
  'Alt+F4',
  'Alt+Space',
  'Ctrl+Escape',
  'Alt+Escape',
  'Ctrl+Alt+Delete',
  'Ctrl+Shift+Escape',
  'Ctrl+A',
  'Ctrl+C',
  'Ctrl+V',
  'Ctrl+X',
  'Ctrl+Z',
  'Ctrl+Y'
])

/** Longer than any combination: refused before splitting (the text may come from IPC). */
const MAX_LENGTH = 64

export type ParsedAccelerator =
  { ok: true; value: Accelerator } | { ok: false; error: 'invalid' | 'unsupported-key' | 'meta' }

/**
 * Reads an accelerator in any order and case, with Electron's aliases (CommandOrControl,
 * CmdOrCtrl, Control -> Ctrl; Option -> Alt). Exactly one key; each modifier at most once.
 */
export function parseAccelerator(text: string): ParsedAccelerator {
  if (text.length === 0 || text.length > MAX_LENGTH) return { ok: false, error: 'invalid' }
  const value: Accelerator = { ctrl: false, alt: false, shift: false, key: '' }
  let meta = false
  let unsupported = false
  let keys = 0
  for (const raw of text.split('+')) {
    const token = raw.trim().toLowerCase()
    if (token === '') return { ok: false, error: 'invalid' }
    const modifier = MODIFIER_NAMES.get(token)
    if (modifier === 'meta') {
      if (meta) return { ok: false, error: 'invalid' }
      meta = true
    } else if (modifier !== undefined) {
      if (value[modifier]) return { ok: false, error: 'invalid' }
      value[modifier] = true
    } else {
      keys++
      const key = KEY_NAMES.get(token)
      if (key === undefined) unsupported = true
      else value.key = key
    }
  }
  if (keys !== 1) return { ok: false, error: 'invalid' }
  if (meta) return { ok: false, error: 'meta' }
  if (unsupported) return { ok: false, error: 'unsupported-key' }
  return { ok: true, value }
}

/** 'Ctrl+Alt+Shift+Key', with only the modifiers present. */
export function formatAccelerator(a: Accelerator): string {
  const parts: string[] = []
  if (a.ctrl) parts.push('Ctrl')
  if (a.alt) parts.push('Alt')
  if (a.shift) parts.push('Shift')
  parts.push(a.key)
  return parts.join('+')
}

function isFunctionKeyAbove12(key: string): boolean {
  const m = /^F(\d+)$/.exec(key)
  return m !== null && Number(m[1]) >= 13
}

/** Whether a combination can be assigned (duplicates aside: see shortcuts.ts). */
export function checkAccelerator(text: string): AcceleratorCheck {
  const parsed = parseAccelerator(text)
  if (!parsed.ok) return { ok: false, accelerator: '', error: parsed.error }
  const a = parsed.value
  const accelerator = formatAccelerator(a)
  // Esc leaves edit mode (and closes things everywhere): never assignable, in any combination.
  if (a.key === 'Escape' || RESERVED_ACCELERATORS.has(accelerator)) {
    return { ok: false, accelerator, error: 'reserved' }
  }
  if ((REFUSED_KEYS as readonly string[]).includes(a.key)) {
    return { ok: false, accelerator, error: 'unsupported-key' }
  }
  if (!a.ctrl && !a.alt && !isFunctionKeyAbove12(a.key)) {
    return { ok: false, accelerator, error: 'needs-modifier' }
  }
  if (a.ctrl && a.alt && !a.shift && /^[A-Z0-9]$/.test(a.key)) {
    return { ok: true, accelerator, warning: 'altgr' }
  }
  return { ok: true, accelerator }
}

/** The canonical spelling of an assignable combination, else null. */
export function canonicalAccelerator(text: unknown): string | null {
  if (typeof text !== 'string') return null
  const check = checkAccelerator(text)
  return check.ok ? check.accelerator : null
}

// ---------------------------------------------------------------------------
// Keyboard events (the settings page records a combination)
// ---------------------------------------------------------------------------

/** The fields of a DOM KeyboardEvent this reads. */
export interface KeyInput {
  readonly key: string
  readonly code: string
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly metaKey: boolean
  /**
   * getModifierState('AltGraph'): AltGr is held. When AltGr types a character (AltGr+E is '€'
   * on a Spanish layout) Chromium may report only this, with ctrlKey and altKey false.
   */
  readonly altGraph?: boolean
}

/**
 * - 'modifiers': only modifiers so far (keep recording, show them).
 * - 'key': a whole combination, canonical, still to be checked (checkAccelerator).
 * - 'refused': the Windows key or a key no shortcut can use.
 */
export type KeyReading =
  | { kind: 'modifiers'; held: HeldModifiers }
  | { kind: 'key'; accelerator: string; held: HeldModifiers }
  | { kind: 'refused'; error: 'meta' | 'unsupported-key'; held: HeldModifiers }

const MODIFIER_CODES: ReadonlySet<string> = new Set([
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight'
])
const MODIFIER_KEY_VALUES: ReadonlySet<string> = new Set(['Control', 'Alt', 'Shift', 'AltGraph'])
const META_CODES: ReadonlySet<string> = new Set(['MetaLeft', 'MetaRight', 'OSLeft', 'OSRight'])

/** KeyboardEvent.code -> key name, for the keys that do not depend on the layout. */
const CODE_KEYS: ReadonlyMap<string, string> = new Map([
  ...FUNCTION_KEYS.map((k) => [k, k] as const),
  ['ArrowUp', 'Up'],
  ['ArrowDown', 'Down'],
  ['ArrowLeft', 'Left'],
  ['ArrowRight', 'Right'],
  ['Home', 'Home'],
  ['End', 'End'],
  ['PageUp', 'PageUp'],
  ['PageDown', 'PageDown'],
  ['Insert', 'Insert'],
  ['Delete', 'Delete'],
  ['Space', 'Space'],
  ['Escape', 'Escape'],
  ['Tab', 'Tab'],
  ['Enter', 'Enter'],
  ['NumpadEnter', 'Enter'],
  ['Backspace', 'Backspace'],
  ['NumpadAdd', 'numadd'],
  ['NumpadSubtract', 'numsub'],
  ['NumpadMultiply', 'nummult'],
  ['NumpadDivide', 'numdiv']
])

/**
 * KeyboardEvent.key of the numeric keypad with Num Lock off: the navigation key Windows sends
 * instead (so the shortcut is the key that actually arrives).
 */
const NUMPAD_NAVIGATION: ReadonlyMap<string, string> = new Map([
  ['Insert', 'Insert'],
  ['End', 'End'],
  ['ArrowDown', 'Down'],
  ['PageDown', 'PageDown'],
  ['ArrowLeft', 'Left'],
  ['ArrowRight', 'Right'],
  ['Home', 'Home'],
  ['ArrowUp', 'Up'],
  ['PageUp', 'PageUp'],
  ['Delete', 'Delete']
])

/** The key of an event, or null when no shortcut can use it. */
function keyOf(e: KeyInput): string | null {
  const numpad = /^Numpad(\d)$/.exec(e.code)
  if (numpad) {
    if (/^\d$/.test(e.key)) return `num${numpad[1]}`
    return NUMPAD_NAVIGATION.get(e.key) ?? null
  }
  if (e.code === 'NumpadDecimal') {
    if (e.key === '.' || e.key === ',') return 'numdec'
    return NUMPAD_NAVIGATION.get(e.key) ?? null
  }
  // Digits by position: Shift+1 is '!' in English and Spanish alike, '&' is 1 on AZERTY.
  const digit = /^Digit(\d)$/.exec(e.code)
  if (digit) return digit[1] ?? null
  // Letters as the layout labels them (the A of an AZERTY keyboard sits where QWERTY has Q,
  // and Windows maps the shortcut by label too); by position when the key gives no latin
  // letter (AltGr+E is '€', a Cyrillic layout gives 'у').
  if (/^[a-z]$/i.test(e.key)) return e.key.toUpperCase()
  const letter = /^Key([A-Z])$/.exec(e.code)
  if (letter) return letter[1] ?? null
  return CODE_KEYS.get(e.code) ?? null
}

/** The modifiers an event says are held; AltGr counts as Ctrl+Alt (see readKeyboardEvent). */
export function heldModifiers(e: KeyInput): HeldModifiers {
  const altGraph = e.altGraph === true || e.key === 'AltGraph'
  return { ctrl: e.ctrlKey || altGraph, alt: e.altKey || altGraph, shift: e.shiftKey }
}

/**
 * What a keydown means while recording a combination. AltGr is Ctrl+Alt for Windows (a hot key
 * on Ctrl+Alt+E fires on AltGr+E), whether the event has ctrlKey and altKey or only the
 * AltGraph modifier, so it reads as Ctrl+Alt and the check warns about it.
 */
export function readKeyboardEvent(e: KeyInput): KeyReading {
  const held = heldModifiers(e)
  if (e.metaKey || e.key === 'Meta' || e.key === 'OS' || META_CODES.has(e.code)) {
    return { kind: 'refused', error: 'meta', held }
  }
  if (MODIFIER_CODES.has(e.code) || MODIFIER_KEY_VALUES.has(e.key)) {
    return { kind: 'modifiers', held }
  }
  const key = keyOf(e)
  if (key === null) return { kind: 'refused', error: 'unsupported-key', held }
  return { kind: 'key', accelerator: formatAccelerator({ ...held, key }), held }
}

/** Ctrl, Alt, Shift, as stored; shown in the interface's words by modifierLabels (i18n). */
export function modifierCaps(held: HeldModifiers): string[] {
  const out: string[] = []
  if (held.ctrl) out.push('Ctrl')
  if (held.alt) out.push('Alt')
  if (held.shift) out.push('Shift')
  return out
}
