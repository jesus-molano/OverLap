/**
 * The lights' "Rótulos" choice: the captions switch (lights.showCaptions) and, in a column, the
 * side of the texts (lights.labelSide) as one control. Both fields are stored as before. Pure.
 */
import type { LightsOptions } from '@shared/types'

export type CaptionsChoice = 'off' | 'on' | 'right' | 'left'

/** The choices for `layout`: No / Derecha / Izquierda in a column, No / Sí in a row. */
export function captionsValues(layout: LightsOptions['layout']): readonly CaptionsChoice[] {
  return layout === 'column' ? ['off', 'right', 'left'] : ['off', 'on']
}

/** What the options say now. */
export function captionsChoice(
  o: Pick<LightsOptions, 'layout' | 'showCaptions' | 'labelSide'>
): CaptionsChoice {
  if (!o.showCaptions) return 'off'
  return o.layout === 'column' ? o.labelSide : 'on'
}

/** The options a choice sets: a side only when it names one (a row keeps the column's side). */
export function captionsPatch(v: CaptionsChoice): Partial<LightsOptions> {
  if (v === 'off') return { showCaptions: false }
  if (v === 'on') return { showCaptions: true }
  return { showCaptions: true, labelSide: v }
}
