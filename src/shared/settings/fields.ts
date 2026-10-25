/**
 * Field validation shared by normalisation (file on disk) and patching
 * (settings window). Every merge writes the valid fields of `raw` onto
 * `target` (a fresh copy); invalid ones keep target's value: the default when
 * normalising, the current value when patching.
 */
import { normalizeHexColor } from '../colors'
import { STANDINGS_COLUMN_IDS, WIDGET_FIELD_SCHEMA, type OptionSpec } from '../settingsSchema'
import type { StandingsColumn, StandingsColumnId, WidgetSettings } from '../types'
import { WIDGET_DEFS, type WidgetId } from '../widgets'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Rounds to `decimals` places (null: no rounding), then clamps. Non-finite -> fallback. */
export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  decimals: number | null
): number {
  if (!isFiniteNumber(value)) return fallback
  let v = value
  if (decimals !== null) {
    const scale = 10 ** decimals
    v = Math.round(value * scale) / scale
  }
  return Math.min(max, Math.max(min, v))
}

export function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback
}

function isColumnId(v: unknown): v is StandingsColumnId {
  return (STANDINGS_COLUMN_IDS as readonly unknown[]).includes(v)
}

/**
 * Column list with every id exactly once: entries in the given order (first
 * one wins on duplicates, unknown ids and malformed entries are dropped),
 * then the missing ids, hidden, in default order. A non-boolean `visible`
 * keeps the fallback's. A non-array, or one without a single valid entry,
 * gives a copy of `fallback`.
 */
export function normalizeColumns(
  raw: unknown,
  fallback: readonly Readonly<StandingsColumn>[]
): StandingsColumn[] {
  const out: StandingsColumn[] = []
  const seen = new Set<StandingsColumnId>()
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (!isRecord(entry) || !isColumnId(entry.id) || seen.has(entry.id)) continue
    const id = entry.id
    const before = fallback.find((c) => c.id === id)?.visible ?? false
    out.push({ id, visible: pickBoolean(entry.visible, before) })
    seen.add(id)
  }
  if (out.length === 0) return fallback.map((c) => ({ ...c }))
  for (const id of STANDINGS_COLUMN_IDS) if (!seen.has(id)) out.push({ id, visible: false })
  return out
}

/** A valid value for `spec` from `raw`, else `current` (copied when it is an object). */
export function validateOption(spec: OptionSpec, raw: unknown, current: unknown): unknown {
  switch (spec.kind) {
    case 'int':
      return clampNumber(raw, spec.min, spec.max, current as number, 0)
    case 'number':
      return clampNumber(raw, spec.min, spec.max, current as number, spec.decimals)
    case 'bool':
      return pickBoolean(raw, current as boolean)
    case 'enum':
      return pickEnum(raw, spec.values, current as string)
    case 'color':
      return normalizeHexColor(raw) ?? current
    case 'colors': {
      const base = current as Record<string, string>
      const out: Record<string, string> = {}
      const src = isRecord(raw) ? raw : {}
      for (const key of Object.keys(spec.default)) {
        out[key] = normalizeHexColor(src[key]) ?? base[key] ?? spec.default[key] ?? '#ffffff'
      }
      return out
    }
    case 'columns':
      return normalizeColumns(raw, current as readonly StandingsColumn[])
  }
}

/** Every field of the section from `raw`, validated against its spec. Unknown keys are ignored. */
export function mergeSection(
  target: object,
  raw: Record<string, unknown>,
  specs: Readonly<Record<string, OptionSpec>>
): void {
  const t = target as Record<string, unknown>
  for (const [field, spec] of Object.entries(specs)) {
    if (field in raw) t[field] = validateOption(spec, raw[field], t[field])
  }
}

/** Widget fields except bounds (only loaded from disk, never patched). */
export function mergeWidgetFields(
  id: WidgetId,
  target: WidgetSettings,
  raw: Record<string, unknown>
): void {
  const s = WIDGET_FIELD_SCHEMA
  target.visible = pickBoolean(raw.visible, target.visible)
  target.locked = pickBoolean(raw.locked, target.locked)
  target.backgroundOpacity = clampNumber(
    raw.backgroundOpacity,
    s.backgroundOpacity.min,
    s.backgroundOpacity.max,
    target.backgroundOpacity,
    s.backgroundOpacity.decimals
  )
  target.scale = clampNumber(raw.scale, s.scale.min, s.scale.max, target.scale, 0)
  // Only auto-height widgets can follow their content.
  target.autoHeight =
    WIDGET_DEFS[id].sizeModel === 'auto-height' && pickBoolean(raw.autoHeight, target.autoHeight)
  target.anchor = pickEnum(raw.anchor, s.anchor.values, target.anchor)
  if (isRecord(raw.showIn)) {
    const r = raw.showIn
    const t = target.showIn
    target.showIn = {
      practice: pickBoolean(r.practice, t.practice),
      qualify: pickBoolean(r.qualify, t.qualify),
      race: pickBoolean(r.race, t.race)
    }
  }
  target.hideInPits = pickBoolean(raw.hideInPits, target.hideInPits)
}
