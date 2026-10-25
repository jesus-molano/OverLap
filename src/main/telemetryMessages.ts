import {
  MAX_DELETE_KEYS,
  MAX_PERSONAL_BEST_KEY_LENGTH,
  type PersonalBestList,
  type PersonalBestSummary,
  type PersonalBestTarget
} from '@shared/delta/references'
import type { TelemetryOutMessage } from '@shared/ipc'
import type {
  ConnectionState,
  HiddenReason,
  OverlayStatus,
  SourceKind,
  StatusNote,
  WidgetDataMessage
} from '@shared/types'
import { isWidgetId, type WidgetId } from '@shared/widgets'

const STATES: readonly ConnectionState[] = ['starting', 'waiting', 'connected', 'mock', 'error']
const SOURCES: readonly SourceKind[] = ['iracing', 'mock']
const NOTES: readonly StatusNote[] = ['none', 'restarting', 'native-missing']
/** A record, so a new HiddenReason left out here fails to compile instead of being dropped. */
const HIDDEN_REASON_SET: Readonly<Record<HiddenReason, true>> = {
  practice: true,
  qualify: true,
  race: true,
  pits: true,
  garage: true,
  'ui-hidden': true,
  replay: true,
  'replay-player': true
}
const HIDDEN_REASONS = Object.keys(HIDDEN_REASON_SET) as HiddenReason[]
const LOG_LEVELS = ['info', 'warn', 'error'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}

/** Codes only (each window words them); `detail` is the untranslated text of an error. */
export function parseStatus(raw: unknown): OverlayStatus | null {
  if (!isRecord(raw)) return null
  const { state, source, note, detail } = raw
  if (
    !includes(STATES, state) ||
    !includes(SOURCES, source) ||
    !includes(NOTES, note) ||
    typeof detail !== 'string'
  ) {
    return null
  }
  return { state, source, note, detail }
}

/**
 * Minimal shape check of what the telemetry process posts. Payloads are only
 * checked to be objects: they come from our own bundled code, the check just
 * keeps a bug there from crashing main.
 */
export function parseTelemetryMessage(raw: unknown): TelemetryOutMessage | null {
  if (!isRecord(raw)) return null
  switch (raw.type) {
    case 'status': {
      const status = parseStatus(raw.status)
      return status ? { type: 'status', status } : null
    }
    case 'data': {
      if (!isWidgetId(raw.widget) || !isRecord(raw.payload)) return null
      const data: { widget: WidgetId; payload: unknown } = {
        widget: raw.widget,
        payload: raw.payload
      }
      return { type: 'data', ...(data as WidgetDataMessage) }
    }
    case 'log': {
      const { level, message } = raw
      if (!includes(LOG_LEVELS, level) || typeof message !== 'string') return null
      return { type: 'log', level, message }
    }
    case 'auto-hidden': {
      const { widget, hidden, reason } = raw
      if (!isWidgetId(widget) || typeof hidden !== 'boolean') return null
      if (reason !== null && !includes(HIDDEN_REASONS, reason)) return null
      return { type: 'auto-hidden', widget, hidden, reason }
    }
    case 'bests': {
      const list = parseBestList(raw.list)
      return list ? { type: 'bests', list } : null
    }
    default:
      return null
  }
}

/** Names and dates are short display strings. */
const MAX_TEXT_LENGTH = 200

function isText(v: unknown): v is string {
  return typeof v === 'string' && v.length <= MAX_TEXT_LENGTH
}

function parseTarget(raw: unknown): PersonalBestTarget | null {
  if (!isRecord(raw)) return null
  const { key, car, track, layout } = raw
  if (typeof key !== 'string' || key.length === 0 || key.length > MAX_PERSONAL_BEST_KEY_LENGTH) {
    return null
  }
  if (!isText(car) || !isText(track) || !isText(layout)) return null
  return { key, car, track, layout }
}

function parseSummary(raw: unknown): PersonalBestSummary | null {
  const target = parseTarget(raw)
  if (!target || !isRecord(raw)) return null
  const { lapTime, recordedAt } = raw
  if (typeof lapTime !== 'number' || !Number.isFinite(lapTime) || lapTime <= 0) return null
  if (!isText(recordedAt)) return null
  return { ...target, lapTime, recordedAt }
}

/** The whole list, or null when any part of it is malformed. */
export function parseBestList(raw: unknown): PersonalBestList | null {
  if (!isRecord(raw) || !Array.isArray(raw.entries) || raw.entries.length > MAX_DELETE_KEYS) {
    return null
  }
  const entries: PersonalBestSummary[] = []
  for (const e of raw.entries) {
    const entry = parseSummary(e)
    if (!entry) return null
    entries.push(entry)
  }
  if (raw.current === null) return { entries, current: null }
  const current = parseTarget(raw.current)
  return current ? { entries, current } : null
}
