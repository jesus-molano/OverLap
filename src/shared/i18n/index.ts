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
