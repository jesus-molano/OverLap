/**
 * Editing in the live sample of a widget page (usePreviewEdit.ts, PreviewEditLayer.vue): the
 * pure parts, tested without a DOM. What the pointer is on (the `data-el` of what the widget
 * draws: 'relative.headerBar.sof'), where a dragged element lands and where the drop line goes,
 * what a click may do (required ids, a fixed order), which hidden elements the sample draws
 * ghosted while you edit, and the one stylesheet that outlines, lights and ghosts them.
 */
import { INFO_BARS, type InfoBarSection } from '@shared/infoBar'
import { CUSTOMIZE_ZONE_IDS } from '@shared/settingsSchema'
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
/**
 * The zones of the preview: Personalizar's (CUSTOMIZE_ZONE_IDS), and the lists that are kept as
 * switches rather than as one list (the alerts, R12), clicked in the sample to hide one but never
 * ghosted (they have no list to draw them from).
 */
export type PreviewZoneId = CustomizeZoneId | 'alerts.alerts'

export interface ElRef {
  readonly zone: PreviewZoneId
  readonly id: string
}

const EL = /^([a-z]+\.[a-zA-Z]+)\.([a-zA-Z]+)$/

/** 'relative.headerBar.sof' → { zone: 'relative.headerBar', id: 'sof' }; null otherwise. */
export function parseEl(value: string | null | undefined): ElRef | null {
  const m = typeof value === 'string' ? EL.exec(value) : null
  if (m === null || m[1] === undefined || m[2] === undefined) return null
  return { zone: m[1] as PreviewZoneId, id: m[2] }
}

/**
 * The element a pointer is on: the first of the `data-el` values from the target outwards
 * (`chain`, innermost first) whose zone has an editor on the page. A part inside a row (the
 * delta's top line inside its row) wins over the row; one with no editor lets the row have it.
 */
export function pickEl(
  chain: readonly (string | null | undefined)[],
  known: (zone: PreviewZoneId) => boolean
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

/**
 * The list a ghost's drop makes: `id` placed there and shown, in one edit (a ghost is a hidden
 * element; dropping it where you want it is showing it there). Its own place when the drop
 * reads the same.
 */
export function shownDropList<Id extends string>(
  spec: SpecRules<Id>,
  list: List<Id>,
  id: Id,
  place: Place<Id>
): ElementEntry<Id>[] {
  return placedAt(spec, list, id, place).map((e) => (e.id === id ? { id, visible: true } : e))
}

// ---- The tooltip's place --------------------------------------------------------------------

/** Where the tooltip goes: its anchor point (stage px) and which way it grows from there. */
export interface TipPlace {
  readonly x: number
  readonly y: number
  /** 'right' of the widget, 'left' of it, 'above' or 'below' it (or, failing all, the element). */
  readonly side: 'right' | 'left' | 'above' | 'below'
  /** Its widest (px): the room it has beside the widget. */
  readonly maxWidth: number
  /** One line (the name and what it does side by side): the thin margin above a wide widget. */
  readonly compact: boolean
}

/** The tooltip's size budget (px): its widest and about its height (two lines). */
export const TIP_W = 240
export const TIP_H = 40
/** Its gap to the widget, and the room it keeps from the stage's edges (px). */
const TIP_GAP = 10
const TIP_EDGE = 6
/** The least room beside the widget worth a tooltip there (px): its text wraps to fit. */
const TIP_MIN_BESIDE = 120
/** The stage's foot (the scene switch and the caption): a tooltip below the widget clears it. */
const STAGE_FOOT = 28

/** The one-line tooltip's height and about half its width (px). */
const TIP_COMPACT_H = 20
const TIP_COMPACT_HALF_W = 180

/**
 * The tooltip of `el` (client px, as every box here) outside the widget's box, so it never
 * covers what is around the element: beside the widget where the stage has room (the side
 * nearer the element first), at the element's height; else in the margin above it, or below
 * it; else on one line in the stage's thin margin above a wide widget; else, a widget filling
 * the stage, just above the element (below it near the top).
 */
export function tipPlace(el: Box, widget: Box, stage: Box): TipPlace {
  const cy = (el.top + el.bottom) / 2 - stage.top
  const cx = (el.left + el.right) / 2 - stage.left
  const h = stage.bottom - stage.top
  const w = stage.right - stage.left
  const y = Math.min(Math.max(cy, TIP_EDGE + TIP_H / 2), h - STAGE_FOOT - TIP_H / 2)
  const right = stage.right - widget.right - TIP_GAP - TIP_EDGE
  const left = widget.left - stage.left - TIP_GAP - TIP_EDGE
  const nearRight = (el.left + el.right) / 2 >= (widget.left + widget.right) / 2
  const sides: readonly ['right' | 'left', number][] = nearRight
    ? [
        ['right', right],
        ['left', left]
      ]
    : [
        ['left', left],
        ['right', right]
      ]
  for (const [side, room] of sides) {
    if (room < TIP_MIN_BESIDE) continue
    const x =
      side === 'right' ? widget.right - stage.left + TIP_GAP : widget.left - stage.left - TIP_GAP
    return { x, y, side, maxWidth: Math.min(TIP_W, room), compact: false }
  }
  const across = (half: number): number =>
    Math.min(Math.max(cx, half + TIP_EDGE), Math.max(half + TIP_EDGE, w - half - TIP_EDGE))
  const x = across(TIP_W / 2)
  const full = { maxWidth: TIP_W, compact: false }
  if (widget.top - stage.top >= TIP_H + TIP_EDGE) {
    return { x, y: widget.top - stage.top - 4, side: 'above', ...full }
  }
  if (stage.bottom - widget.bottom >= TIP_H + STAGE_FOOT) {
    return { x, y: widget.bottom - stage.top + 4, side: 'below', ...full }
  }
  if (widget.top - stage.top >= TIP_COMPACT_H + 2) {
    return {
      x: across(TIP_COMPACT_HALF_W),
      y: widget.top - stage.top - 1,
      side: 'above',
      maxWidth: w - 2 * TIP_EDGE,
      compact: true
    }
  }
  const below = el.top - stage.top < TIP_H + TIP_EDGE
  return below
    ? { x, y: el.bottom - stage.top + 6, side: 'below', ...full }
    : { x, y: el.top - stage.top - 6, side: 'above', ...full }
}

/** How far the outline of a lit element stands outside its box (px): it never covers it. */
export const MARK_OUTSET = 2

/** The outline box of an element's `box` in the stage (px), `outset` px outside it. */
export function markBox(box: Box, stage: Box, outset = MARK_OUTSET): Box {
  return {
    left: box.left - stage.left - outset,
    top: box.top - stage.top - outset,
    right: box.right - stage.left + outset,
    bottom: box.bottom - stage.top + outset
  }
}

/**
 * How far a ghost's dashed outline stands outside its box (px): its 1 px line where the old
 * `outline-offset: 1px` drew it, never over its text.
 */
export const GHOST_OUTSET = 2

/**
 * The outline boxes (stage px, markBox) of the drawn copies of an element (client px): the
 * empty ones (not drawn: an item its bar had no room for) skipped, at most `max`.
 */
export function outlineBoxes(
  rects: readonly Box[],
  stage: Box,
  outset: number,
  max: number
): Box[] {
  const out: Box[] = []
  for (const r of rects) {
    if (out.length >= max) break
    if (r.right - r.left <= 0 || r.bottom - r.top <= 0) continue
    out.push(markBox(r, stage, outset))
  }
  return out
}

/** The points around a pointer tried when it is on nothing (px): small targets of a scaled sample. */
export const NEAR_OFFSETS: readonly (readonly [number, number])[] = [
  [4, 0],
  [-4, 0],
  [0, 4],
  [0, -4]
]

// ---- Ghosts -----------------------------------------------------------------------------------

/**
 * The zones whose hidden elements the sample draws ghosted while you edit: every one (R41), so a
 * hidden element looks the same in every preview, translucent where it would go, and comes back
 * with a click on it. An info bar's item it has no room for is simply not drawn (the ghosts go
 * first: InfoBar); a hidden column takes its width while you edit (the sample shows what showing
 * it would do). A traffic group is ghosted by its lines' `data-group` (its caption has the
 * `data-el` a click needs).
 */
export const GHOST_ZONES: ReadonlySet<CustomizeZoneId> = new Set<CustomizeZoneId>(
  CUSTOMIZE_ZONE_IDS
)

/**
 * What the line above a page's preview can promise (PreviewHint, R41): a drag only where a zone
 * the page shows can be reordered; the translucent hidden elements for every zone, some of them
 * (the rest come back from their list) or none.
 */
export interface PreviewHintKind {
  readonly sortable: boolean
  readonly ghosts: 'all' | 'some' | 'none'
}

export function previewHintOf(
  zones: readonly {
    readonly zone: PreviewZoneId
    readonly fixedOrder: boolean
    readonly off: boolean
  }[]
): PreviewHintKind | null {
  const on = zones.filter((z) => !z.off)
  if (on.length === 0) return null
  const ghosted = on.filter((z) => (GHOST_ZONES as ReadonlySet<string>).has(z.zone)).length
  return {
    sortable: on.some((z) => !z.fixedOrder),
    ghosts: ghosted === on.length ? 'all' : ghosted === 0 ? 'none' : 'some'
  }
}

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
 * the widget draws them where they would go), with the set of their `data-el`s to ghost. Those
 * of `except` stay hidden (one just hidden from its list row: quietAfterLit). The object itself
 * when nothing is ghosted.
 */
export function withGhosts<T extends object>(
  options: T,
  zones: readonly CustomizeZoneId[],
  except: readonly string[] = []
): { readonly options: T; readonly ghosts: readonly string[] } {
  if (zones.length === 0) return { options, ghosts: [] }
  const o = options as unknown as Options
  const out: Record<string, unknown> = { ...o }
  const ghosts: string[] = []
  for (const zone of zones) {
    const field = zone.split('.')[1] as string
    const list = o[field]
    if (!Array.isArray(list)) continue
    const elsewhere = shownInOtherBar(zone, o)
    out[field] = (list as ElementEntry<string>[]).map((e) => {
      if (e.visible || e.id === SPLIT) return { id: e.id, visible: true }
      const el = `${zone}.${e.id}`
      if (elsewhere.has(e.id) || except.includes(el)) return e
      ghosts.push(el)
      return { id: e.id, visible: true }
    })
  }
  return { options: out as unknown as T, ghosts }
}

/**
 * An element hidden from its list row (its eye) and not ghosted yet: drawn as a ghost at once,
 * while the pointer is still on its row, the hide reads as if it did nothing. `left`: the list
 * has lit another row of its zone since (an info bar's row moves to the hidden ones, so the
 * pointer ends up on another row).
 */
export interface QuietEl {
  readonly el: ElRef
  readonly left: boolean
}

/**
 * `quiet` after the list lights `lit`: kept while the pointer or the focus stays on its row or
 * on other rows of its zone; gone when the list lights nothing or another zone, or that row
 * again after another one (you came back to it: its ghost shows where it would go).
 */
export function quietAfterLit(quiet: QuietEl | null, lit: ElRef | null): QuietEl | null {
  if (quiet === null) return null
  if (lit === null || lit.zone !== quiet.el.zone) return null
  if (sameEl(lit, quiet.el)) return quiet.left ? null : quiet
  return quiet.left ? quiet : { el: quiet.el, left: true }
}

/**
 * The items another shown info bar of the same widget already draws (an info bar `zone` only):
 * never ghosted in this one too (a dashed second "TRÁFICO" in the footer under the header's
 * reads as a glitch). Empty for any other zone.
 */
function shownInOtherBar(zone: CustomizeZoneId, o: Options): ReadonlySet<string> {
  const [section, field] = zone.split('.') as [string, string]
  const bars = (INFO_BARS as Readonly<Record<string, readonly (readonly [string, string])[]>>)[
    section
  ]
  const out = new Set<string>()
  if (bars === undefined || !bars.some(([f]) => f === field)) return out
  for (const [f, size] of bars) {
    const list = o[f]
    if (f === field || o[size] === 'off' || !Array.isArray(list)) continue
    for (const e of list as ElementEntry<string>[]) if (e.visible && e.id !== SPLIT) out.add(e.id)
  }
  return out
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

/** A plain `data-el` value (safe in a selector). */
export const isPlainKey = (key: string): boolean => SAFE.test(key)

const sel = (scope: string, key: string): string => `${scope} [data-el="${key}"]`
/** A ghost: its element, or the lines of a group (the traffic's, by `data-group`). */
const ghostSel = (scope: string, key: string): string =>
  `${sel(scope, key)}, ${scope} [data-group="${key}"]`

/**
 * The rules for `marks` under `scope` (the sample's root selector), by attribute, so nothing in
 * the sample is queried or touched for them: ghosts are translucent, the dragged element fades.
 * Every outline (a ghost's dashed one, the hovered and the lit element's) is a box in the layer
 * over the sample instead (outlineBoxes, litKeys): one here would be clipped by the bars (an info
 * bar and its groups clip what overflows them) and the cells around it, or cover the element's
 * text. Keys that are not plain data-el values are skipped.
 */
export function marksCss(scope: string, marks: Marks): string {
  const rules: string[] = []
  const ghosts = marks.ghosts.filter(isPlainKey)
  if (ghosts.length > 0) {
    rules.push(`${ghosts.map((k) => ghostSel(scope, k)).join(',\n')} {\n` + '  opacity: 0.42;\n}')
  }
  if (marks.dragged !== null && SAFE.test(elKey(marks.dragged))) {
    rules.push(`${sel(scope, elKey(marks.dragged))} {\n  opacity: 0.3;\n}`)
  }
  return rules.join('\n')
}

/** The `data-el`s the layer outlines: the hovered and the lit element, once each (none while dragging). */
export function litKeys(marks: Marks): string[] {
  if (marks.dragged !== null) return []
  return [marks.hover, marks.lit]
    .filter((m): m is ElRef => m !== null)
    .map(elKey)
    .filter((k, i, all) => SAFE.test(k) && all.indexOf(k) === i)
}
