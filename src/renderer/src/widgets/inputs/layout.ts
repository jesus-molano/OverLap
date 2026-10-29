/**
 * The pedals' three fixed layouts read from and written to the sections list (until the widget
 * draws the list itself, package P4): trace, bars and info in either reading order, or the bars
 * without the trace. Pure.
 */
import { elementOrder, isElementVisible } from '@shared/elements'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { ElementEntry, InputsSectionId } from '@shared/types'

export type InputsLayout = 'trace-bars-info' | 'info-bars-trace' | 'bars'

export const INPUTS_LAYOUTS = [
  'trace-bars-info',
  'info-bars-trace',
  'bars'
] as const satisfies readonly InputsLayout[]

/** The layout the sections draw today: 'bars' without the trace, else by where the info is. */
export function inputsLayout(sections: readonly ElementEntry<InputsSectionId>[]): InputsLayout {
  if (!isElementVisible(sections, 'trace')) return 'bars'
  const order = elementOrder(sections)
  return order.indexOf('info') < order.indexOf('trace') ? 'info-bars-trace' : 'trace-bars-info'
}

/** The sections list of a layout (every block shown but the trace in 'bars'). */
export function sectionsOf(layout: InputsLayout): ElementEntry<InputsSectionId>[] {
  const order: readonly InputsSectionId[] =
    layout === 'info-bars-trace' ? ['info', 'bars', 'trace'] : OPTION_SCHEMA.inputs.sections.ids
  return order.map((id) => ({ id, visible: id !== 'trace' || layout !== 'bars' }))
}
