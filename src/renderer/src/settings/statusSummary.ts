/**
 * What the settings window's status chip and its panel say (R35): the connection, what is hidden
 * now and why, what does not work. The same facts as the tray (its status line, its "(oculto en
 * práctica)" notes), outside it. Pure.
 */
import { hiddenText, statusText, widgetTitle, type Messages } from '@shared/i18n'
import type { ShortcutStatusReport } from '@shared/shortcuts'
import type { ConnectionState, HiddenReason, OverlaySettings, OverlayStatus } from '@shared/types'
import { WIDGET_LIST_ORDER, type WidgetId } from '@shared/widgets'

export type StatusTone = 'idle' | 'ok' | 'sim' | 'warn' | 'error'

export interface StatusSummaryInput {
  status: OverlayStatus | null
  overlayHidden: boolean
  settings: OverlaySettings | null
  /** Why each widget a rule hides now is hidden (absent: shown; null: no known reason). */
  hidden: Partial<Record<WidgetId, HiddenReason | null>>
  shortcuts: ShortcutStatusReport | null
  saveFailing: boolean
}

export interface StatusSummary {
  state: ConnectionState
  /** The chip's colour: a dot, grey until there is something to say. */
  tone: StatusTone
  /** The chip's first line: 'Simulación'. */
  label: string
  /** The chip's second line, what is hidden or failing now; null when nothing is. */
  sub: string | null
  /** The whole status line ('Error en la telemetría: …') and what it means for you. */
  connection: string
  advice: string
  /** 'N de 10 widgets activados'. */
  enabled: string
  /** The rule-hidden enabled widgets ('Batalla · Oculto en práctica'), or the one line for all. */
  hiddenLines: string[]
  /** How many shortcuts do not work now (0: all do). */
  shortcutsFailing: number
  /** The telemetry cannot load its native module: a banner on every page says it too. */
  nativeMissing: boolean
}

/** Enabled widgets a rule hides now, in the lists' order, with their reasons. */
function hiddenNow(
  settings: OverlaySettings | null,
  hidden: StatusSummaryInput['hidden']
): { id: WidgetId; reason: HiddenReason | null }[] {
  if (settings === null) return []
  return WIDGET_LIST_ORDER.filter(
    (id) => settings.widgets[id].visible && hidden[id] !== undefined
  ).map((id) => ({ id, reason: hidden[id] ?? null }))
}

function adviceOf(m: Messages, s: OverlayStatus | null): string {
  const a = m.settings.status.advice
  if (s === null) return a.starting
  switch (s.state) {
    case 'starting':
      return a.starting
    case 'waiting':
      return s.source === 'mock' ? a.mock : a.waiting
    case 'connected':
      return a.connected
    case 'mock':
      return a.mock
    case 'error':
      if (s.note === 'restarting') return a.restarting
      return s.note === 'native-missing' ? a.nativeMissing : a.error
  }
}

function toneOf(s: OverlayStatus | null, warn: boolean): StatusTone {
  if (s?.state === 'error') return 'error'
  if (warn) return 'warn'
  if (s?.state === 'connected') return 'ok'
  return s?.state === 'mock' ? 'sim' : 'idle'
}

export function statusSummary(m: Messages, input: StatusSummaryInput): StatusSummary {
  const t = m.settings.status
  const s = input.status
  const state: ConnectionState = s?.state ?? 'starting'
  const enabledIds = input.settings
    ? WIDGET_LIST_ORDER.filter((id) => input.settings?.widgets[id].visible === true)
    : []
  const hidden = hiddenNow(input.settings, input.hidden)
  const common =
    hidden.length > 0 &&
    hidden.length === enabledIds.length &&
    hidden.every((h) => h.reason !== null && h.reason === hidden[0]?.reason)
      ? (hidden[0]?.reason ?? null)
      : null
  const hiddenLines =
    common !== null
      ? [t.allHidden(hiddenText(m, common))]
      : hidden.map((h) => t.hiddenOne(widgetTitle(m, h.id), hiddenText(m, h.reason)))
  const failing = input.shortcuts
    ? Object.values(input.shortcuts.actions).filter((v) => v === 'unavailable').length
    : 0
  let sub: string | null = null
  if (input.saveFailing) sub = t.saveFailing.replace(/\.$/, '')
  else if (input.overlayHidden) sub = t.sub.overlayHidden
  else if (input.settings !== null && enabledIds.length === 0) sub = t.sub.noneOn
  else if (common !== null) sub = hiddenText(m, common)
  else if (hidden.length > 0) sub = t.sub.hiddenNow(hidden.length)
  else if (failing > 0) sub = t.sub.shortcuts(failing)
  return {
    state,
    tone: toneOf(s, input.saveFailing || failing > 0),
    label: m.core.statusChip[state],
    sub,
    connection: s ? statusText(m, s) : m.core.status.unknown,
    advice: adviceOf(m, s),
    enabled: t.enabled(enabledIds.length, WIDGET_LIST_ORDER.length),
    hiddenLines,
    shortcutsFailing: failing,
    nativeMissing: s?.state === 'error' && s.note === 'native-missing'
  }
}
