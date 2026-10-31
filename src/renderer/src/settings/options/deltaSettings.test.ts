/**
 * Delta's "Personalizar" (R21): one list of lines, the top line's and the lap times' parts
 * unfolding under their own line; the references by their full names, and the preview drawing
 * the one last changed.
 */
import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { DELTA_REFERENCE_VALUES } from '@shared/settingsSchema'
import EDITOR from '../elements/ElementEditor.vue?raw'
import { previewDelta, previewSession } from '../../widgets/delta/preview'
import SOURCE from './DeltaSettings.vue?raw'

const templateOf = (sfc: string): string => /<template>([\s\S]*)<\/template>/.exec(sfc)?.[1] ?? ''

describe('DeltaSettings', () => {
  it('has one list: the lines, with the parts of three of them inside', () => {
    const t = templateOf(SOURCE)
    const custom = /<CustomizeSection>([\s\S]*)<\/CustomizeSection>/.exec(t)?.[1] ?? ''
    // One accordion: the other three lists (the bars per reference too) are in its parts slot.
    expect(custom.match(/<ElementEditor\b/g)).toHaveLength(4)
    expect(custom.match(/\bembedded\b/g)).toHaveLength(3)
    expect(custom).toMatch(/:parts-of="PARTS_OF"/)
    expect(custom).toMatch(/<template #parts="\{ id \}">/)
    expect(SOURCE).toContain(`const PARTS_OF: readonly DeltaRowId[] = ['top', 'refs', 'laps']`)
    // Showing a reference's bar shows its line, as a lap time does (the parent gate).
    // (applyRefBars: the gate's apply, after growing the window for the bars it adds.)
    expect(custom).toMatch(/:apply="applyRefBars"/)
    expect(SOURCE).toMatch(/return refBarsGate\.apply\(next\)/)
    expect(SOURCE).toMatch(/parent: 'refs',/)
    // Showing more bars grows the window as «Completo» does; the lists say «No cabe» by height.
    expect(SOURCE).toMatch(/deltaBarsGrowth\(s, delta\)/)
    expect(custom.match(/:room-words="tallWords"/g)).toHaveLength(2)
    // Folded parts stay mounted (their zones are the preview's): v-show, not v-if.
    expect(EDITOR).toMatch(/v-if="partsOf\.includes\(r\.entry\.id\)"\s+v-show="unfolded\.has/)
  })

  it('names the references in full, with what each one is', () => {
    const t = templateOf(SOURCE)
    expect(t).toMatch(/:apply="setReference\(k\.kind, k\.field\)"/)
    expect(SOURCE).toContain('label: d.references[value].label')
    const es = messagesFor('es').settings.delta
    for (const ref of DELTA_REFERENCE_VALUES) {
      expect(es.references[ref].label.length, ref).toBeGreaterThan(5)
      expect(es.references[ref].hint, ref).toBeTruthy()
    }
    expect(es.previewShows('Carrera', 'Vuelta óptima')).toBe(
      'La vista previa usa la de Carrera: Vuelta óptima'
    )
  })

  it('with a row per reference, says under the references what the line above them is', () => {
    const t = templateOf(SOURCE)
    expect(t).toContain(
      `<p v-if="rowsHelp !== ''" class="st-row st-help dl-cycle">{{ rowsHelp }}</p>`
    )
    expect(SOURCE).toContain('deltaShapeOf(opts.value).lanes >= 2')
    // A session's reference that adds a row grows the window as a bar does.
    expect(SOURCE).toContain('growForBars({ ...opts.value, [field]: v })')
    for (const lang of ['es', 'en'] as const) {
      const d = messagesFor(lang).settings.delta
      // The rows carry no mark: the line above names the reference in use.
      expect(d.refBarsHelp).not.toContain('Δ')
      expect(d.referenceRowsHelp).toContain(messagesFor(lang).widgets.delta.predicted)
    }
  })

  it('draws the reference of the session changed last in the preview', () => {
    expect(previewSession.value).toBe('race')
    expect(previewDelta('class').reference).toBe('class')
  })
})
