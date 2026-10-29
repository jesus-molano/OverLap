/**
 * The CSS `order` of a widget's part from its place in an element list (the delta's rows, the
 * fuel's lines, the pedals' blocks): a reorder moves the parts with one property each, never
 * re-creating them (a canvas, a readout written straight to the DOM, a v-memo'd line). Frozen per
 * place, so `v-inline-style` writes nothing while the place stays. Places count from 1: a part
 * outside the list (a header) keeps the default 0 and stays first. Pure.
 */
import type { InlineStyle } from '@renderer/view/styles'

const STYLES: InlineStyle[] = []

export function orderStyle(index: number): InlineStyle {
  const i = Number.isInteger(index) && index >= 0 ? index : 0
  let s = STYLES[i]
  if (s === undefined) {
    s = Object.freeze({ order: String(i + 1) })
    STYLES[i] = s
  }
  return s
}

/** Each id's place in `order` (ids not in it get none: they keep the default order). */
export function placesOf<Id extends string>(
  order: readonly Id[]
): Readonly<Partial<Record<Id, number>>> {
  const out: Partial<Record<Id, number>> = {}
  order.forEach((id, i) => (out[id] = i))
  return out
}
