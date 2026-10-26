/**
 * Migration of pre-v4 fields. v1/v2 files only lack newer widgets, fields and
 * sections (they get their defaults); v3 standings had one show* flag per
 * column and one toggle for the whole ratings header, which map onto the v4
 * column list and the two header toggles. v4 files written before v2.1 (v2.2)
 * only lack the traffic and alerts (delta) widgets and sections, and older v4
 * files the shortcuts or visibility section: no version bump, they get their
 * defaults like any missing section. A file from before the fuel widget gets it
 * hidden, in a free spot (`placeNewWidget`); one from before the warning lights
 * gets them shown in a free spot, and the alerts band's old engine options moved
 * to where those lights went (`migrateSection`). The conditions widget became the
 * footer of the relative and the standings: what a file saved for it
 * (REMOVED_WIDGETS) is dropped like any unknown key, the rest of the file
 * untouched, and the footers start with their own defaults. A visibility section
 * from before "when to show the overlay" gets replays hidden (`migrateVisibility`).
 */
import { OPTION_SCHEMA } from '../settingsSchema'
import type {
  OverlaySettings,
  Point,
  Rect,
  Size,
  StandingsColumn,
  StandingsColumnId
} from '../types'
import { ALERTS_DEFAULT_ROOM, WIDGET_DEFS, WIDGET_IDS, type WidgetId } from '../widgets'
import { isRecord } from './fields'

/**
 * Widgets added after settings files already existed that such a file gets hidden: the user
 * has moved the others, and the newcomer's default place may sit on one of them (the old
 * conditions widget's default covered a standings moved to the top left, report Q5; the fuel
 * default a relative moved to the bottom right). The user turns it on from the tray or the
 * settings, or with its ghost's eye in edit mode.
 */
export const HIDDEN_WHEN_ADDED: readonly WidgetId[] = Object.freeze(['fuel'])

/**
 * Widgets that existed and are gone: their `widgets` entry and option section in an old file
 * are dropped on load (normalizeSettings only reads WIDGET_IDS and OPTION_SECTIONS) and are not
 * written back. 'conditions' (v2.3) is now the footer of the relative and the standings
 * (ConditionsFooterOptions), with its own defaults: the old options chose readings for a panel
 * that no longer exists.
 */
export const REMOVED_WIDGETS: readonly string[] = Object.freeze(['conditions'])

/**
 * Widgets added after settings files existed that such a file gets shown, in the free spot
 * nearest their default (hidden like the others when there is none): the warning lights took the
 * temperature lights and the trend from the alerts band, so hiding them would drop what the band
 * showed until then.
 */
export const SHOWN_WHEN_ADDED: readonly WidgetId[] = Object.freeze(['lights'])

/** Where `freeSpot` looks: the default layout's display (1920 x 1080 without the taskbar). */
export const DEFAULT_AREA: Rect = Object.freeze({ x: 0, y: 0, width: 1920, height: 1040 })
/** Room kept around the other widgets, and the grid the search walks (px). */
const SPOT_GAP = 10

/**
 * The top-left nearest to `near` (on a SPOT_GAP grid, inside `area`) where `size`, with SPOT_GAP
 * all around, overlaps none of `taken`; null when there is none.
 */
export function freeSpot(
  size: Size,
  near: Point,
  taken: readonly Rect[],
  area: Rect
): Point | null {
  let best: Point | null = null
  let bestD = Infinity
  const g = SPOT_GAP
  for (let y = area.y + g; y + size.height + g <= area.y + area.height; y += g) {
    for (let x = area.x + g; x + size.width + g <= area.x + area.width; x += g) {
      const clear = taken.every(
        (r) =>
          x + size.width + g <= r.x ||
          r.x + r.width + g <= x ||
          y + size.height + g <= r.y ||
          r.y + r.height + g <= y
      )
      if (!clear) continue
      const d = (x - near.x) ** 2 + (y - near.y) ** 2
      if (d < bestD) {
        bestD = d
        best = { x, y }
      }
    }
  }
  return best
}

/** What a widget takes on screen at most: the alerts with their room to grow. */
function footprint(id: WidgetId, r: Rect): Rect {
  return id === 'alerts' ? { ...r, height: Math.max(r.height, ALERTS_DEFAULT_ROOM) } : r
}

/**
 * A widget the existing file `out` was read from had no entry for, moved to the free spot
 * nearest its default when there is one (so its edit-mode ghost and the first time it is shown
 * cover nothing). Its size stays the default. A HIDDEN_WHEN_ADDED one is hidden; with `shown`
 * (SHOWN_WHEN_ADDED) it keeps its default visibility, unless there is no free spot.
 */
export function placeNewWidget(out: OverlaySettings, id: WidgetId, shown = false): void {
  const w = out.widgets[id]
  const taken = WIDGET_IDS.filter((o) => o !== id).map((o) => footprint(o, out.widgets[o].bounds))
  const def = WIDGET_DEFS[id].defaultBounds
  const spot = freeSpot(w.bounds, def, taken, DEFAULT_AREA)
  if (spot !== null) w.bounds = { ...w.bounds, x: spot.x, y: spot.y }
  if (!shown || spot === null) w.visible = false
}

/** v3 flag -> v4 column (someone who hid the last lap does not want the best one either). */
const V3_COLUMN_FLAGS: readonly (readonly [flag: string, id: StandingsColumnId])[] = [
  ['showPositionsGained', 'gained'],
  ['showIRating', 'ir'],
  ['showLastLap', 'last'],
  ['showLastLap', 'best'],
  ['showPits', 'pit']
]

/**
 * The standings section with v3 fields translated, when it has no v4 column
 * list. v3's `showIRatingDelta` (on by default: a Δ in every row) is not
 * carried over: v4 shows your own Δ in the header and keeps the per-row
 * column off by default, which is the point of the redesign.
 */
export function migrateStandings(raw: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(raw.columns)) return raw
  const hasV3 =
    V3_COLUMN_FLAGS.some(([flag]) => typeof raw[flag] === 'boolean') ||
    typeof raw.showRatingsHeader === 'boolean'
  if (!hasV3) return raw

  const columns: StandingsColumn[] = OPTION_SCHEMA.standings.columns.default.map((c) => ({ ...c }))
  for (const [flag, id] of V3_COLUMN_FLAGS) {
    const v = raw[flag]
    const col = columns.find((c) => c.id === id)
    if (col && typeof v === 'boolean') col.visible = v
  }
  const out: Record<string, unknown> = { ...raw, columns }
  const header = raw.showRatingsHeader
  if (typeof header === 'boolean') {
    if (typeof raw.headerIRating !== 'boolean') out.headerIRating = header
    if (typeof raw.headerSafetyRating !== 'boolean') out.headerSafetyRating = header
  }
  return out
}

/**
 * The alerts band before the warning lights: `showEngineWarnings` (all four lights) becomes
 * `showOilPressure`, the one light the band keeps; `showEngineTrend` went to the lights
 * (migrateLights).
 */
export function migrateAlerts(raw: Record<string, unknown>): Record<string, unknown> {
  const old = raw.showEngineWarnings
  if (typeof old !== 'boolean' || typeof raw.showOilPressure === 'boolean') return raw
  return { ...raw, showOilPressure: old }
}

/**
 * The warning lights of a file from before them (no lights section): a trend turned off in the
 * alerts band (`alerts.showEngineTrend` false) stays off in the lights, where it went.
 */
export function migrateLights(raw: unknown, file: Record<string, unknown>): unknown {
  if (raw !== undefined) return raw
  const alerts = file.alerts
  if (!isRecord(alerts) || typeof alerts.showEngineTrend !== 'boolean') return raw
  return { showTrend: alerts.showEngineTrend }
}

/**
 * A visibility section saved before `showWhen` existed: its `replays` is the old default
 * ('follow', "keep the standings"), saved whether or not anyone chose it, so it takes the new
 * one (replays hidden, as the overlay now only shows while you drive). Later files keep theirs.
 */
export function migrateVisibility(raw: Record<string, unknown>): Record<string, unknown> {
  if ('showWhen' in raw) return raw
  return { ...raw, replays: OPTION_SCHEMA.visibility.replays.default }
}

/**
 * Section-level migrations, keyed by section; untouched sections pass through. `file` is the
 * whole file, for an option that moved from one section to another.
 */
export function migrateSection(
  section: string,
  raw: unknown,
  file: Record<string, unknown> = {}
): unknown {
  if (section === 'lights') return migrateLights(raw, file)
  if (!isRecord(raw)) return raw
  if (section === 'standings') return migrateStandings(raw)
  if (section === 'alerts') return migrateAlerts(raw)
  return section === 'visibility' ? migrateVisibility(raw) : raw
}
