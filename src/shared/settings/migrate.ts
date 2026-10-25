/**
 * Migration of pre-v4 fields. v1/v2 files only lack newer widgets, fields and
 * sections (they get their defaults); v3 standings had one show* flag per
 * column and one toggle for the whole ratings header, which map onto the v4
 * column list and the two header toggles. v4 files written before v2.1 (v2.2)
 * only lack the traffic and alerts (delta) widgets and sections, and older v4
 * files the shortcuts section: no version bump, they get their defaults like
 * any missing section.
 */
import { OPTION_SCHEMA } from '../settingsSchema'
import type { StandingsColumn, StandingsColumnId } from '../types'
import { isRecord } from './fields'

/** v3 flag -> v4 column. */
const V3_COLUMN_FLAGS: readonly (readonly [flag: string, id: StandingsColumnId])[] = [
  ['showPositionsGained', 'gained'],
  ['showIRating', 'ir'],
  ['showLastLap', 'last'],
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

/** Section-level migrations, keyed by section; untouched sections pass through. */
export function migrateSection(section: string, raw: unknown): unknown {
  return section === 'standings' && isRecord(raw) ? migrateStandings(raw) : raw
}
