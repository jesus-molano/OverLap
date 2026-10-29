/**
 * Editing in the live sample of a widget page (usePreviewEdit.ts, PreviewEditLayer.vue): the
 * pure parts, tested without a DOM. What the pointer is on (the `data-el` of what the widget
 * draws: 'relative.headerBar.sof'), where a dragged element lands and where the drop line goes,
 * what a click may do (required ids, a fixed order), which hidden elements the sample draws
 * ghosted while you edit, and the one stylesheet that outlines, lights and ghosts them.
 */
import { INFO_BARS, type InfoBarSection } from '@shared/infoBar'
import type { CustomizeZoneId, ElementEntry } from '@shared/types'
import {
  isRequired,
  placeOfSlot,
  placedAt,
  type List,
  type Place,
  type Side,
  type SpecRules
} from '../elements/listOps'

// ---- Hit-testing --------------------------------------------------------------------------

/** One element as the sample draws it: its zone ('relative.columns') and id ('gap'). */
export interface ElRef {
  readonly zone: CustomizeZoneId
  readonly id: string
}

const EL = /^([a-z]+\.[a-zA-Z]+)\.([a-zA-Z]+)$/

/** 'relative.headerBar.sof' → { zone: 'relative.headerBar', id: 'sof' }; null otherwise. */
export function parseEl(value: string | null | undefined): ElRef | null {
  const m = typeof value === 'string' ? EL.exec(value) : null
  if (m === null || m[1] === undefined || m[2] === undefined) return null
  return { zone: m[1] as CustomizeZoneId, id: m[2] }
}

/**
 * The element a pointer is on: the first of the `data-el` values from the target outwards
 * (`chain`, innermost first) whose zone has an editor on the page. A part inside a row (the
 * delta's top line inside its row) wins over the row; one with no editor lets the row have it.
 */
export function pickEl(
  chain: readonly (string | null | undefined)[],
  known: (zone: CustomizeZoneId) => boolean
): ElRef | null {
  for (const v of chain) {
    const el = parseEl(v)
    if (el !== null && known(el.zone)) return el
  }
  return null
}

export const elKey = (el: ElRef): string => `${el.zone}.${el.id}`

export const sameEl = (a: ElRef | null, b: ElRef | null): boolean =>
  a === b || (a !== null && b !== null && a.zone === b.zone && a.id === b.id)

// ---- What a click and a drag may do -----------------------------------------------------------

/** What the sample offers on one element (and why not, on hover). */
export type ElAction =
  /** Drag to reorder, click to hide. */
  | 'move-hide'
  /** Click to hide (a fixed order). */
  | 'hide'
  /** Drag to reorder; never hidden (required). */
  | 'move-required'
  /** Neither: required in a fixed order. */
  | 'required'
  /** A ghost: click to show (and drag to place it). */
  | 'show'

export function elAction<Id extends string>(spec: SpecRules<Id>, list: List<Id>, id: Id): ElAction {
  const visible = list.some((e) => e.id === id && e.visible)
  const sortable = !spec.fixedOrder && list.length > 1
  if (!visible) return 'show'
  if (isRequired(spec, id)) return sortable ? 'move-required' : 'required'
  return sortable ? 'move-hide' : 'hide'
}

export const canDrag = (a: ElAction): boolean =>
  a === 'move-hide' || a === 'move-required' || a === 'show'

/** A press that travelled this far (px) is a drag, not a click. */
export const DRAG_SLOP_PX = 4

export function isDragDistance(dx: number, dy: number): boolean {
  return dx * dx + dy * dy >= DRAG_SLOP_PX * DRAG_SLOP_PX
}

// ---- Geometry of a drop ---------------------------------------------------------------------

export interface Box {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/** One element's place in the sample: every copy it draws (a column's cells) as one box. */
export interface Slot {
  readonly id: string
  readonly box: Box
  /** An info bar's item: the side of the bar it is on. */
  readonly side?: Side
}

export function union(boxes: readonly Box[]): Box | null {
  let out: Box | null = null
  for (const b of boxes) {
    out =
      out === null
        ? { left: b.left, top: b.top, right: b.right, bottom: b.bottom }
        : {
            left: Math.min(out.left, b.left),
            top: Math.min(out.top, b.top),
            right: Math.max(out.right, b.right),
            bottom: Math.max(out.bottom, b.bottom)
          }
  }
  return out
}

const centre = (b: Box, axis: Axis): number =>
  axis === 'x' ? (b.left + b.right) / 2 : (b.top + b.bottom) / 2

export type Axis = 'x' | 'y'

/**
 * The way a zone's elements follow each other: across (columns, bar items) or down (lines,
 * rows), whichever their centres spread over more. One element: across.
 */
export function axisOf(slots: readonly Slot[]): Axis {
  if (slots.length < 2) return 'x'
  const xs = slots.map((s) => centre(s.box, 'x'))
  const ys = slots.map((s) => centre(s.box, 'y'))
  const spread = (v: number[]): number => Math.max(...v) - Math.min(...v)
  return spread(ys) > spread(xs) ? 'y' : 'x'
}

/** The slots in the order the sample draws them along `axis`. */
export function inDrawnOrder(slots: readonly Slot[], axis: Axis): Slot[] {
  return [...slots].sort((a, b) => centre(a.box, axis) - centre(b.box, axis))
}

/** Where a drag would put the element, and the line that shows it (client px). */
export interface Drop {
  readonly place: Place<string>
  readonly line: Box
}

/** How many of `others` (drawn order) have their centre before `p` on `axis`. */
function slotAt(others: readonly Slot[], axis: Axis, p: number): number {
  let n = 0
  for (const s of others) if (centre(s.box, axis) < p) n++
  return n
}

/** The line between slot k-1 and k of `others` (drawn order), across `cross`. */
function lineAt(others: readonly Slot[], k: number, axis: Axis, cross: Box): Box | null {
  const prev = others[k - 1]
  const next = others[k]
  if (prev === undefined && next === undefined) return null
  const W = 2
  let at: number
  if (axis === 'x') {
    if (prev === undefined) at = (next as Slot).box.left - W
    else if (next === undefined) at = prev.box.right + W
    else at = (prev.box.right + next.box.left) / 2
    return { left: at - W / 2, right: at + W / 2, top: cross.top, bottom: cross.bottom }
  }
  if (prev === undefined) at = (next as Slot).box.top - W
  else if (next === undefined) at = prev.box.bottom + W
  else at = (prev.box.bottom + next.box.top) / 2
  return { left: cross.left, right: cross.right, top: at - W / 2, bottom: at + W / 2 }
}

/**
 * The drop of `id` in a zone of one line of elements (`slots`, the dragged one among them) at
 * pointer `x`, `y`: before the first of the others whose centre is past the pointer, or after
 * the last. Null when there is nothing else to drop next to.
 */
export function dropInLine(slots: readonly Slot[], id: string, x: number, y: number): Drop | null {
  const axis = axisOf(slots)
  const drawn = inDrawnOrder(slots, axis)
  const others = drawn.filter((s) => s.id !== id)
  const k = slotAt(others, axis, axis === 'x' ? x : y)
  const place = placeOfSlot(
    drawn.map((s) => s.id),
    id,
    // placeOfSlot counts the others; the dragged id itself is skipped there.
    k
  )
  const cross = union(slots.map((s) => s.box))
  const line = cross === null ? null : lineAt(others, k, axis, cross)
  return place === null || line === null ? null : { place, line }
}

/** An info bar as drawn: its box and its two groups' (null for an empty group). */
export interface BarBoxes {
  readonly bar: Box
  readonly left: Box | null
  readonly right: Box | null
}

const hasWidth = (b: Box | null): b is Box => b !== null && b.right - b.left > 0.5

/**
 * Where the left side ends and the right one starts, as the pointer goes: halfway between the
 * two groups; with one group, halfway between it and the bar's other end; with none, the
 * bar's middle.
 */
export function sideBoundary(b: BarBoxes): number {
  const l = hasWidth(b.left) ? b.left : null
  const r = hasWidth(b.right) ? b.right : null
  if (l !== null && r !== null) return (l.right + r.left) / 2
  if (l !== null) return (l.right + b.bar.right) / 2
  if (r !== null) return (b.bar.left + r.left) / 2
  return (b.bar.left + b.bar.right) / 2
}

/**
 * The drop of `id` in an info bar (`slots` with their sides): the side is the pointer's (left
 * or right of sideBoundary), then the place among that side's items like dropInLine; on a side
 * with nothing drawn, its end of the marker (`split`): the line at that end of the bar.
 */
export function dropInBar(
  slots: readonly Slot[],
  bar: BarBoxes,
  id: string,
  split: string,
  x: number
): Drop & { readonly side: Side } {
  const side: Side = x < sideBoundary(bar) ? 'left' : 'right'
  const drawn = inDrawnOrder(
    slots.filter((s) => s.side === side),
    'x'
  )
  const others = drawn.filter((s) => s.id !== id)
  const b = bar.bar
  const inset = 4
  if (others.length === 0) {
    const at = side === 'left' ? b.left + inset : b.right - inset
    return {
      side,
      place: { kind: side === 'left' ? 'before' : 'after', id: split },
      line: { left: at - 1, right: at + 1, top: b.top + 2, bottom: b.bottom - 2 }
    }
  }
  const k = slotAt(others, 'x', x)
  const before = others[k]
  const last = others[others.length - 1] as Slot
  const place: Place<string> =
    before !== undefined ? { kind: 'before', id: before.id } : { kind: 'after', id: last.id }
  const line = lineAt(others, k, 'x', { ...b, top: b.top + 2, bottom: b.bottom - 2 }) as Box
  return { side, place, line }
}

/** The list a drop makes (placedAt); null when it reads the same as `list`. */
export function droppedList<Id extends string>(
  spec: SpecRules<Id>,
  list: List<Id>,
  id: Id,
  place: Place<Id>
): ElementEntry<Id>[] | null {
  const next = placedAt(spec, list, id, place)
  return next.every((e, i) => e.id === list[i]?.id) ? null : next
}

// ---- Ghosts -----------------------------------------------------------------------------------

/**
 * The zones whose hidden elements the sample draws ghosted while you edit: the info bars (an
 * item the bar has no room for is simply not drawn, and the ghosts go first: InfoBar), and two
 * stacks of lines that only grow the widget's height. A table's columns are not ghosted: a
 * hidden column drawn would squeeze the others and misrepresent the widths; its way back is the
 * list (as for every zone the sample cannot draw).
 */
export const GHOST_ZONES: ReadonlySet<CustomizeZoneId> = new Set<CustomizeZoneId>([
  ...(Object.entries(INFO_BARS).flatMap(([section, bars]) =>
    bars.map(([field]) => `${section}.${field}`)
  ) as CustomizeZoneId[]),
  'fuel.lines',
  'battle.rows'
])

/** The size field of an info bar zone ('relative.headerBar' → 'headerBarSize'), else null. */
function barSizeField(zone: CustomizeZoneId): string | null {
  const [section, field] = zone.split('.') as [string, string]
  const bars = (INFO_BARS as Readonly<Record<string, readonly (readonly [string, string])[]>>)[
    section
  ]
  return bars?.find(([f]) => f === field)?.[1] ?? null
}

type Options = Readonly<Record<string, unknown>>

/** An info bar's side marker: no element of its own. */
const SPLIT = 'split'

/**
 * The ghosted zones of `section` in `options`: those of GHOST_ZONES with something hidden, an
 * info bar only while it is shown (its switch brings back a bar that is off).
 */
export function ghostZones(section: string, options: Options): CustomizeZoneId[] {
  const out: CustomizeZoneId[] = []
  for (const zone of GHOST_ZONES) {
    const [s, field] = zone.split('.') as [string, string]
    if (s !== section) continue
    const size = barSizeField(zone)
    if (size !== null && options[size] === 'off') continue
    const list = options[field]
    const hidden = (e: ElementEntry<string>): boolean => !e.visible && e.id !== SPLIT
    if (Array.isArray(list) && list.some(hidden)) out.push(zone)
  }
  return out
}

/**
 * `options` as the sample draws them while you edit: the hidden elements of `zones` shown (so
 * the widget draws them where they would go), with the set of their `data-el`s to ghost. The
 * object itself when nothing is ghosted.
 */
export function withGhosts<T extends object>(
  options: T,
  zones: readonly CustomizeZoneId[]
): { readonly options: T; readonly ghosts: readonly string[] } {
  if (zones.length === 0) return { options, ghosts: [] }
  const o = options as unknown as Options
  const out: Record<string, unknown> = { ...o }
  const ghosts: string[] = []
  for (const zone of zones) {
    const field = zone.split('.')[1] as string
    const list = o[field]
    if (!Array.isArray(list)) continue
    out[field] = (list as ElementEntry<string>[]).map((e) => {
      if (!e.visible && e.id !== SPLIT) ghosts.push(`${zone}.${e.id}`)
      return { id: e.id, visible: true }
    })
  }
  return { options: out as unknown as T, ghosts }
}

/** Every ghosted `data-el` of a page's section (the widget's InfoBar drops them first). */
export function ghostEls(section: string, options: Options): readonly string[] {
  return withGhosts(options, ghostZones(section, options)).ghosts
}

/** Info bar sections (their options read the bars' sizes). */
export const isBarSection = (section: string): section is InfoBarSection => section in INFO_BARS

// ---- The sample's one stylesheet --------------------------------------------------------------

/** What the sample marks: the hovered element, the one lit from the list, the dragged one. */
export interface Marks {
  readonly hover: ElRef | null
  readonly lit: ElRef | null
  readonly dragged: ElRef | null
  readonly ghosts: readonly string[]
}

const SAFE = /^[a-zA-Z.]+$/
const sel = (scope: string, key: string): string => `${scope} [data-el="${key}"]`

/**
 * The rules for `marks` under `scope` (the sample's root selector): every copy an element
 * draws (each cell of a column) is outlined at once, by attribute, so nothing in the sample is
 * queried or touched. Ghosts are translucent with a dashed outline; the hovered element and the
 * one lit from the list get a solid one (neutral ink with a dark edge, readable on both scenes);
 * the dragged one fades. Keys that are not plain data-el values are skipped.
 */
export function marksCss(scope: string, marks: Marks): string {
  const rules: string[] = []
  const ghosts = marks.ghosts.filter((k) => SAFE.test(k))
  if (ghosts.length > 0) {
    rules.push(
      `${ghosts.map((k) => sel(scope, k)).join(',\n')} {\n` +
        '  opacity: 0.42;\n' +
        '  outline: 1px dashed rgba(255, 255, 255, 0.85);\n' +
        '  outline-offset: -1px;\n' +
        '}'
    )
  }
  const lit = [marks.hover, marks.lit]
    .filter((m): m is ElRef => m !== null)
    .map(elKey)
    .filter((k, i, all) => SAFE.test(k) && all.indexOf(k) === i)
  if (lit.length > 0) {
    rules.push(
      `${lit.map((k) => sel(scope, k)).join(',\n')} {\n` +
        '  outline: 2px solid rgba(255, 255, 255, 0.95);\n' +
        '  outline-offset: -2px;\n' +
        '  box-shadow: inset 0 0 0 3px rgba(0, 0, 0, 0.55);\n' +
        '}'
    )
  }
  if (marks.dragged !== null && SAFE.test(elKey(marks.dragged))) {
    rules.push(`${sel(scope, elKey(marks.dragged))} {\n  opacity: 0.3;\n}`)
  }
  return rules.join('\n')
}
