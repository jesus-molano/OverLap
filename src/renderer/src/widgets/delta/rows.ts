/**
 * The delta's customisable parts (delta.rows, delta.top, delta.laps) to what the widget draws:
 * the rows in the user's order, the lap times line with the time the delta compares against
 * marked, the font fit of the rows shown, and the brief label after another reference is
 * chosen. Pure; words come from the dictionary `m`.
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
 * line alone is DELTA_FIT_TOP_EM, with the bar today's 4.3, with the sectors too today's 6.
 */
export const DELTA_FIT_TOP_EM = 3.35
export const DELTA_ROW_FIT_EM: Readonly<Record<Exclude<DeltaRowId, 'top'>, number>> = {
  bar: 0.95,
  sectors: 1.7,
  laps: 1.7
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
