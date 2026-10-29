/**
 * The pedals' customisable parts (inputs.sections, .bars, .info) to what the widget draws: which
 * blocks, bars and readouts are shown and the place of each in its row or column (a CSS `order`,
 * so the canvas and the readout elements are never re-created by a reorder). Pure.
 */
import { elementOrder, isElementVisible } from '@shared/elements'
import type {
  ElementEntry,
  InputsBarId,
  InputsInfoId,
  InputsOptions,
  InputsSectionId
} from '@shared/types'

type List<Id extends string> = readonly Readonly<ElementEntry<Id>>[]

export interface InputsLayout {
  /** The trace is drawn (hiding it is the old 'bars' layout). */
  readonly trace: boolean
  readonly clutch: boolean
  readonly gear: boolean
  readonly speed: boolean
  readonly steering: boolean
  /** Some readout of the info column is drawn. */
  readonly info: boolean
  /** Place of each block left to right, each bar left to right, each readout top to bottom. */
  readonly order: Readonly<Record<InputsSectionId | InputsBarId | InputsInfoId, number>>
  /** Changes with every option above: what the panel's height and the readouts depend on. */
  readonly key: string
}

function places<Id extends string>(list: List<Id>): Record<Id, number> {
  const out = {} as Record<Id, number>
  elementOrder(list).forEach((id, i) => (out[id] = i))
  return out
}

export function inputsLayout(o: Pick<InputsOptions, 'sections' | 'bars' | 'info'>): InputsLayout {
  const gear = isElementVisible(o.info, 'gear')
  const speed = isElementVisible(o.info, 'speed')
  const steering = isElementVisible(o.info, 'steering')
  const trace = isElementVisible(o.sections, 'trace')
  const clutch = isElementVisible(o.bars, 'clutch')
  const info = isElementVisible(o.sections, 'info') && (gear || speed || steering)
  const order = { ...places(o.sections), ...places(o.bars), ...places(o.info) }
  const key = [
    trace,
    clutch,
    info && gear,
    info && speed,
    info && steering,
    elementOrder(o.sections).join(),
    elementOrder(o.bars).join(),
    elementOrder(o.info).join()
  ].join('|')
  return {
    trace,
    clutch,
    gear: info && gear,
    speed: info && speed,
    steering: info && steering,
    info,
    order,
    key
  }
}

/** Two layouts draw the same: the same key. */
export function sameInputsLayout(a: InputsLayout, b: InputsLayout): boolean {
  return a.key === b.key
}
