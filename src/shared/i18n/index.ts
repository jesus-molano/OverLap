/**
 * Interface texts in every language. Spanish is the reference: each
 * namespace file defines its Spanish dictionary `as const` and the English
 * one as `Dict<typeof ...Es>`, so a missing or extra key fails the build.
 *
 * Payloads between processes carry codes, never sentences (OverlayStatus,
 * AutoHiddenState.reason, DeltaData.reference): each window translates them
 * with the current settings.appearance.language, so switching language
 * applies at once everywhere without the telemetry process knowing.
 */
import { modifierCaps, parseAccelerator, type HeldModifiers } from '../accelerator'
import { parseButtonBinding } from '../controllers'
import type { HiddenReason, OverlayStatus } from '../types'
import type { WidgetId } from '../widgets'
import type { Dict } from './dict'
import { DEFAULT_LANGUAGE, type Language } from './language'
import { coreEn, coreEs } from './messages/core'
import { settingsEn, settingsEs } from './messages/settings'
import { widgetsEn, widgetsEs } from './messages/widgets'

export * from './language'
export type { Dict } from './dict'

const ES = { core: coreEs, widgets: widgetsEs, settings: settingsEs } as const

export type Messages = Dict<typeof ES>

const MESSAGES: Readonly<Record<Language, Messages>> = {
  es: ES,
  en: { core: coreEn, widgets: widgetsEn, settings: settingsEn }
}

/** The dictionary of `lang` (Spanish for anything unknown). */
export function messagesFor(lang: Language): Messages {
  return MESSAGES[lang] ?? MESSAGES[DEFAULT_LANGUAGE]
}

export function widgetTitle(m: Messages, id: WidgetId): string {
  return m.core.widgetTitles[id]
}

/** The status line: 'Esperando a iRacing…', 'Error en la telemetría: <detail>'... */
export function statusText(m: Messages, s: OverlayStatus): string {
  const t = m.core.status
  const mock = s.source === 'mock'
  switch (s.state) {
    case 'starting':
      return mock ? t.startingMock : t.starting
    case 'waiting':
      return mock ? t.waitingMock : t.waiting
    case 'connected':
      return t.connected
    case 'mock':
      return t.mock
    case 'error':
      if (s.note === 'restarting') return t.restarting
      if (s.note === 'native-missing') return t.nativeMissing
      return s.detail ? t.errorWithDetail(s.detail) : t.error
  }
}

/** Edit-mode caption of a widget a visibility rule hides: 'Oculto en práctica'. */
export function hiddenText(m: Messages, reason: HiddenReason | null): string {
  return reason === null ? m.core.hidden.any : m.core.hidden[reason]
}

const ARROWS: Readonly<Record<string, string>> = { Up: '↑', Down: '↓', Left: '←', Right: '→' }
const NUMPAD_SYMBOLS: Readonly<Record<string, string>> = {
  numadd: '+',
  numsub: '-',
  nummult: '*',
  numdiv: '/',
  numdec: '.'
}

/** One key as the keyboards of the interface language print it: 'Supr', 'Re Pág', 'Num 5'. */
export function keyLabel(m: Messages, key: string): string {
  const k = m.core.keys
  const numpad = /^num(\d)$/.exec(key)
  if (numpad) return k.numpad(numpad[1] ?? '')
  const symbol = NUMPAD_SYMBOLS[key]
  if (symbol !== undefined) return k.numpad(symbol)
  switch (key) {
    case 'Space':
      return k.space
    case 'Insert':
      return k.insert
    case 'Delete':
      return k.delete
    case 'Home':
      return k.home
    case 'End':
      return k.end
    case 'PageUp':
      return k.pageUp
    case 'PageDown':
      return k.pageDown
    case 'Escape':
      return 'Esc'
    default:
      return ARROWS[key] ?? key
  }
}

/**
 * The modifiers held, as the keyboards of the interface language print them: 'Ctrl', 'Alt',
 * 'Mayús' (the same word as the edit-mode hints, «Mayús+Tab»).
 */
export function modifierLabels(m: Messages, held: HeldModifiers): string[] {
  return modifierCaps(held).map((c) => (c === 'Shift' ? m.core.keys.shift : c))
}

/**
 * The keycaps of a combination: ['Ctrl', 'Shift', 'Re Pág']; one for a controller's button
 * (['Botón 7']); [] when it has none ('').
 */
export function keycaps(m: Messages, accelerator: string): string[] {
  if (accelerator === '') return []
  const button = parseButtonBinding(accelerator)
  if (button) return [m.core.keys.button(button.button)]
  const parsed = parseAccelerator(accelerator)
  if (!parsed.ok) return [accelerator]
  return [...modifierLabels(m, parsed.value), keyLabel(m, parsed.value.key)]
}

/** A binding as one text: 'Ctrl+Shift+E', 'Alt+Av Pág', 'Botón 7'; '' when it has none. */
export function acceleratorText(m: Messages, accelerator: string): string {
  return keycaps(m, accelerator).join('+')
}
