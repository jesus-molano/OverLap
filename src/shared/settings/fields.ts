/**
 * Field validation shared by normalisation (file on disk) and patching
 * (settings window). Every merge writes the valid fields of `raw` onto
 * `target` (a fresh copy); invalid ones keep target's value: the default when
 * normalising, the current value when patching.
 */
import { FOLLOW_ACCENT, normalizeHexColor } from '../colors'
import {
  OPTION_SCHEMA,
  WIDGET_FIELD_SCHEMA,
  type ElementsSpec,
  type OptionSpec
} from '../settingsSchema'
import { canonicalShortcut } from '../shortcuts'
import type { ElementEntry, Rect, Size, StandingsColumn, WidgetSettings } from '../types'
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

/** The parts of an 'elements' spec normalisation needs. */
export type ElementRules<Id extends string> = Pick<
  ElementsSpec<Id>,
  'ids' | 'required' | 'fixedOrder'
>

/**
 * An element list with every id of `spec` exactly once: the entries of `raw` in their order
 * (the first one wins on duplicates; unknown ids and malformed entries are dropped), then the
 * missing ids, hidden, in default order (a file saved before an element existed keeps its look).
 * A non-boolean `visible` keeps the fallback's. A non-array, or one without a single valid
 * entry, gives a copy of `fallback`. Required ids are always visible; a fixed-order list is
 * sorted by `spec.ids`. The result shares no object with its inputs.
 */
export function normalizeElements<Id extends string>(
  raw: unknown,
  fallback: readonly Readonly<ElementEntry<Id>>[],
  spec: ElementRules<Id>
): ElementEntry<Id>[] {
  const known = new Set<string>(spec.ids)
  const before = new Map<string, boolean>(fallback.map((e) => [e.id, e.visible]))
  const pick = (entries: readonly unknown[]): ElementEntry<Id>[] => {
    const out: ElementEntry<Id>[] = []
    const seen = new Set<string>()
    for (const entry of entries) {
      if (!isRecord(entry) || typeof entry.id !== 'string') continue
      const id = entry.id
      if (!known.has(id) || seen.has(id)) continue
      seen.add(id)
      out.push({ id: id as Id, visible: pickBoolean(entry.visible, before.get(id) ?? false) })
    }
    return out
  }
  let out = pick(Array.isArray(raw) ? raw : [])
  if (out.length === 0) out = pick(fallback)
  const present = new Set<string>(out.map((e) => e.id))
  for (const id of spec.ids) if (!present.has(id)) out.push({ id, visible: false })
  const required = new Set<string>(spec.required)
  for (const e of out) if (required.has(e.id)) e.visible = true
  if (spec.fixedOrder) {
    const rank = new Map<string, number>(spec.ids.map((id, i) => [id, i]))
    out.sort((x, y) => (rank.get(x.id) ?? 0) - (rank.get(y.id) ?? 0))
  }
  return out
}

/** The standings column list (normalizeElements with the columns' spec). */
export function normalizeColumns(
  raw: unknown,
  fallback: readonly Readonly<StandingsColumn>[]
): StandingsColumn[] {
  return normalizeElements(raw, fallback, OPTION_SCHEMA.standings.columns)
}

/**
 * '' (turned off), an assignable combination in its canonical spelling, or a controller's
 * button (controllers.ts); anything else (not a string, unparsable, reserved, needing a
 * modifier) keeps `fallback`.
 */
export function pickAccelerator(value: unknown, fallback: string): string {
  if (value === '') return ''
  return canonicalShortcut(value) ?? fallback
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
    case 'flag':
      return raw === 'inherit' || typeof raw === 'boolean' ? raw : current
    case 'enum':
      return pickEnum(raw, spec.values, current as string)
    case 'color':
      if (spec.followsAccent === true && raw === FOLLOW_ACCENT) return FOLLOW_ACCENT
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
    case 'elements':
      return normalizeElements(raw, current as readonly ElementEntry[], spec)
    case 'accelerator':
      return pickAccelerator(raw, current as string)
  }
}

/** The accelerator fields of a section, in schema order. */
function acceleratorFields(specs: Readonly<Record<string, OptionSpec>>): string[] {
  return Object.keys(specs).filter((f) => specs[f]?.kind === 'accelerator')
}

/**
 * One combination, one action. Read from disk: the first accelerator field (schema order)
 * keeps a combination and the later ones that repeat it are turned off.
 */
export function disableDuplicateAccelerators(
  target: object,
  specs: Readonly<Record<string, OptionSpec>>
): void {
  const t = target as Record<string, unknown>
  const seen = new Set<unknown>()
  for (const field of acceleratorFields(specs)) {
    const value = t[field]
    if (value === '') continue
    if (seen.has(value)) t[field] = ''
    else seen.add(value)
  }
}

/**
 * One combination, one action. From a patch: every field it changed that now repeats another
 * field's combination keeps its value from `before`, until none does (`before` has no
 * duplicates, so this ends). Fields that only swapped combinations are accepted.
 */
export function revertDuplicateAccelerators(
  target: object,
  before: object,
  specs: Readonly<Record<string, OptionSpec>>
): void {
  const t = target as Record<string, unknown>
  const b = before as Record<string, unknown>
  const fields = acceleratorFields(specs)
  for (;;) {
    const colliding = fields.filter(
      (f) =>
        t[f] !== b[f] && t[f] !== '' && fields.some((other) => other !== f && t[other] === t[f])
    )
    if (colliding.length === 0) return
    for (const f of colliding) t[f] = b[f]
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
  // 'inherit', or a number of the range (a file's own number stays as it was).
  if (raw.backgroundOpacity === 'inherit') target.backgroundOpacity = 'inherit'
  else if (isFiniteNumber(raw.backgroundOpacity)) {
    target.backgroundOpacity = clampNumber(
      raw.backgroundOpacity,
      s.backgroundOpacity.min,
      s.backgroundOpacity.max,
      s.backgroundOpacity.default,
      s.backgroundOpacity.decimals
    )
  }
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
  target.showOnSessionScreen = pickBoolean(raw.showOnSessionScreen, target.showOnSessionScreen)
}

/** Upper bound for a widget dimension; anything larger is a corrupt file. */
const MAX_WIDGET_DIMENSION = 10_000

/** Field by field: an invalid coordinate falls back to the default one. */
export function normalizeBounds(raw: unknown, fallback: Rect, minSize: Size): Rect {
  if (!isRecord(raw)) return { ...fallback }
  const pick = (v: unknown, def: number): number => (isFiniteNumber(v) ? Math.round(v) : def)
  const size = (v: unknown, def: number, min: number): number =>
    isFiniteNumber(v) && v > 0 ? Math.min(MAX_WIDGET_DIMENSION, Math.max(min, Math.round(v))) : def
  return {
    x: pick(raw.x, fallback.x),
    y: pick(raw.y, fallback.y),
    width: size(raw.width, fallback.width, minSize.width),
    height: size(raw.height, fallback.height, minSize.height)
  }
}
