/**
 * The delta's customisable parts (delta.rows, delta.top, delta.laps, delta.refBars) to what the
 * widget draws: the rows in the user's order, the lap times line and the bars per reference
 * with the reference the delta compares against marked, the font fit of the rows shown, and the
 * brief label after another reference is chosen. Pure; words come from the dictionary `m`.
 */
import { visibleIds } from '@shared/elements'
import { formatLapTime } from '@shared/format'
import type { Messages } from '@shared/i18n'
import type {
  DeltaLapId,
  DeltaLaps,
  DeltaReference,
  DeltaRowId,
  DeltaTopId,
  ElementEntry
} from '@shared/types'
import { perDictionary } from '@renderer/view/perDictionary'

type List<Id extends string> = readonly Readonly<ElementEntry<Id>>[]

/** The rows drawn, top to bottom: the top line always (it holds the hero), the rest as shown. */
export function deltaRows(rows: List<DeltaRowId>): readonly DeltaRowId[] {
  const ids = visibleIds(rows)
  return ids.includes('top') ? ids : ['top', ...ids]
}

/** Which parts of the top line are drawn (fixed order: state, predicted lap, reference). */
export interface DeltaTopParts {
  /** The trend caption ('GANANDO'); a lap that won't count says so whatever this is. */
  readonly state: boolean
  readonly predicted: boolean
  readonly reference: boolean
}

export function deltaTopParts(top: List<DeltaTopId>): DeltaTopParts {
  const shown = new Set(visibleIds(top))
  return {
    state: shown.has('state'),
    predicted: shown.has('predicted'),
    reference: shown.has('reference')
  }
}

/**
 * Em height each row adds to the font fit (the panel's --dl-fit-h), its gap included: the top
 * line alone is DELTA_FIT_TOP_EM, with the bar today's 4.3, with the sectors too today's 6. The
 * bars per reference add DELTA_REF_BAR_FIT_EM per bar on top of their row's.
 */
export const DELTA_FIT_TOP_EM = 3.35
export const DELTA_ROW_FIT_EM: Readonly<Record<Exclude<DeltaRowId, 'top'>, number>> = {
  bar: 0.95,
  refs: 0.15,
  sectors: 1.7,
  laps: 1.7
}
/** Em height of one bar per reference, the gap to the next included (1.15 + 0.2). */
export const DELTA_REF_BAR_FIT_EM = 1.35
/** Em width the bars per reference need at least (caption, a readable bar, the value). */
export const DELTA_REF_BARS_FIT_W = 14

/** The row's em height for `count` bars (0 when none shows: the row draws nothing). */
export function refBarsFitEm(count: number): number {
  return count > 0 ? DELTA_ROW_FIT_EM.refs + count * DELTA_REF_BAR_FIT_EM : 0
}

/** Em width each lap time takes in the lap times line ('Últ. 2:16.731 Δ'), its gap included. */
export const DELTA_LAP_FIT_EM = 7

/** The ref mark's lap for each reference: your record, best and optimal; the class's are none. */
const REF_LAP: Readonly<Record<DeltaReference, DeltaLapId | null>> = {
  pb: 'pb',
  session: 'best',
  optimal: 'optimal',
  class: null,
  classOptimal: null
}

/** The lap of the lap times line that the delta compares against, null for a class reference. */
export function refLapOf(reference: DeltaReference | null | undefined): DeltaLapId | null {
  return reference !== null && reference !== undefined ? (REF_LAP[reference] ?? null) : null
}

export interface LapTimeView {
  readonly id: DeltaLapId
  /** 'Últ.', 'Mejor', 'Ópt.', 'Récord'. */
  readonly caption: string
  /** '2:16.731', '—' when there is none yet. */
  readonly time: string
  /** The time the delta compares against (accent underline and the 'Δ' tag). */
  readonly isRef: boolean
}

const NO_LAP_TIMES: readonly LapTimeView[] = Object.freeze([])

/** The lap times line: the shown items in order, the reference in use marked. */
export function lapTimesView(
  laps: Readonly<DeltaLaps> | null | undefined,
  items: List<DeltaLapId>,
  reference: DeltaReference | null | undefined,
  m: Messages
): readonly LapTimeView[] {
  const ids = visibleIds(items)
  if (ids.length === 0) return NO_LAP_TIMES
  const ref = refLapOf(reference)
  const captions = m.widgets.delta.laps
  return ids.map((id) => ({
    id,
    caption: captions[id],
    time: formatLapTime(laps?.[id] ?? null),
    isRef: id === ref
  }))
}

// ---------------------------------------------------------------------------
// Bars per reference
// ---------------------------------------------------------------------------

export interface RefBarView {
  readonly id: DeltaReference
  /** 'Récord', 'Mejor', 'Ópt.', 'Clase', 'Ópt. clase'. */
  readonly caption: string
  /** Its full name, for the bar's accessible name ('Vuelta óptima'). */
  readonly name: string
  /** The reference the delta compares against ('Δ' tag, accent underline, as the lap times). */
  readonly isRef: boolean
}

const NO_REF_BARS: readonly RefBarView[] = Object.freeze([])
const REFERENCE_IDS: readonly string[] = ['pb', 'session', 'optimal', 'class', 'classOptimal']

/**
 * The bars drawn, in the user's order (delta.refBars), the reference in use marked. Depends on
 * the list, the reference and the language only: the 30 Hz values are drawn apart.
 */
export function refBarsView(
  items: List<DeltaReference>,
  reference: DeltaReference | null | undefined,
  m: Messages
): readonly RefBarView[] {
  const ids = visibleIds(items).filter((id) => REFERENCE_IDS.includes(id))
  if (ids.length === 0) return NO_REF_BARS
  const captions = m.widgets.delta.bars
  const names = referenceNames(m)
  return ids.map((id) => ({ id, caption: captions[id], name: names[id], isRef: id === reference }))
}

/** A reference's own name ('Vuelta óptima', 'Vuelta rápida de clase'): nobody's lap, no driver. */
export const referenceNames = perDictionary((m): Readonly<Record<DeltaReference, string>> => {
  const t = m.widgets.delta
  return Object.freeze({
    pb: t.pb,
    session: t.session,
    optimal: t.optimal,
    class: t.classBest,
    classOptimal: t.classOptimal
  })
})

/** What the provider says of the choice: the reference in force and the one waiting for a lap. */
export interface ReferenceChoice {
  readonly preferred: DeltaReference | null
  readonly pending: DeltaReference | null
  /** The choice is the cycle shortcut's, for this session only (DeltaData.temporary). */
  readonly temporary: boolean
}

/** How long the brief label stays after another reference is chosen or takes over (ms). */
export const REFERENCE_NOTE_MS = 3000

/**
 * The brief label after the choice changes: 'Vuelta óptima desde la próxima vuelta' when one is
 * chosen mid-lap, its name once it takes over (or when it applies at once); '' when the change
 * is a choice taken back, and null when there is nothing new to say (the label, if any, stays).
 */
export function referenceNote(
  prev: ReferenceChoice,
  next: ReferenceChoice,
  m: Messages
): string | null {
  const all = referenceNames(m)
  const t = m.widgets.delta
  const name = (r: DeltaReference): string => (next.temporary ? t.temporaryRef(all[r]) : all[r])
  if (next.pending !== null && next.pending !== prev.pending) {
    return t.nextLap(name(next.pending))
  }
  if (next.preferred !== null && prev.preferred !== null && next.preferred !== prev.preferred) {
    return name(next.preferred)
  }
  // Chosen again before the line: nothing changes, nothing to announce.
  if (next.pending === null && prev.pending !== null) return ''
  return null
}

/** A free widget's text fit: the em height and width its contents need. */
export interface DeltaFit {
  readonly h: number
  readonly w: number
}

/** The em width of the lap times line, by how many times it shows. */
const DELTA_LAPS_W = [0, 8, 15, 22, 29] as const

/** What deltaFit reads of the options. */
type FitOptions = {
  readonly rows: List<DeltaRowId>
  readonly top: List<DeltaTopId>
  readonly laps: List<DeltaLapId>
  readonly refBars: List<DeltaReference>
}

/**
 * The delta's fit (DeltaWidget's --dl-fit-h and --dl-fit-w) for its options, with `bars` bars per
 * reference (by default all those shown).
 */
export function deltaFitOf(o: FitOptions, bars?: number): DeltaFit {
  let h = DELTA_FIT_TOP_EM
  const shown = new Set(visibleIds(o.rows))
  for (const row of ['bar', 'sectors', 'laps'] as const) {
    if (shown.has(row)) h += DELTA_ROW_FIT_EM[row]
  }
  const n = bars ?? (shown.has('refs') ? visibleIds(o.refBars).length : 0)
  h += refBarsFitEm(n)
  const top = new Set(visibleIds(o.top))
  const info = top.has('predicted') || top.has('reference') ? 20 : 11.5
  const trend = top.has('state') ? 6 : 0
  const laps = shown.has('laps') ? (DELTA_LAPS_W[Math.min(4, visibleIds(o.laps).length)] ?? 0) : 0
  const refs = n > 0 ? DELTA_REF_BARS_FIT_W : 0
  return { h: Math.round(h * 100) / 100, w: Math.max(info + trend, laps, refs) }
}

/** The delta's own text ceiling (px, DeltaWidget's font-size clamp). */
export const DELTA_MAX_TEXT_PX = 40
/** Windows this short (px) draw no sectors, lap times or bars (DeltaWidget's container query). */
export const DELTA_SHORT_PX = 62

/**
 * How many of the `count` bars per reference a `w` x `h` px window draws whole. The text is
 * fitted to the window (deltaFitOf), so all fit until it reaches the floor `minText`: then only
 * those the height still holds (the rest would wrap out of view).
 */
export function refBarsThatFit(
  o: FitOptions,
  count: number,
  w: number,
  h: number,
  minText: number
): number {
  if (count <= 0 || !(w > 0) || !(h > 0)) return count
  if (h <= DELTA_SHORT_PX) return 0
  const all = deltaFitOf(o, count)
  const font = Math.min(DELTA_MAX_TEXT_PX, Math.max(minText, Math.min(h / all.h, w / all.w)))
  for (let k = count; k > 0; k--) {
    if (deltaFitOf(o, k).h * font <= h + 1e-6) return k
  }
  return 0
}

/**
 * The bars drawn when only `fit` of `bars` fit: the first ones in your order, but never without
 * the reference the delta is using (its bar takes the last place left). All of them when they fit.
 */
export function barsInRoom(bars: readonly RefBarView[], fit: number): readonly RefBarView[] {
  if (fit >= bars.length) return bars
  if (fit <= 0) return NO_REF_BARS
  const head = bars.slice(0, fit)
  if (head.some((b) => b.isRef)) return head
  const ref = bars.find((b) => b.isRef)
  return ref === undefined ? head : [...head.slice(0, fit - 1), ref]
}
