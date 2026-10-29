/** An info bar's editor: one choice for whether and how big the bar is (R20). */
import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { INFO_BAR_SIZES, INFO_BARS } from '@shared/infoBar'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import { choiceOptions } from '../controls/choice'
import EDITOR from './ElementEditor.vue?raw'
import SOURCE from './InfoBarEditor.vue?raw'

describe('InfoBarEditor', () => {
  it('offers "No / Pequeña / Normal / Grande" as one choice, no switch beside a size', () => {
    const es = messagesFor('es').settings.infoBar.sizeChoices
    expect(choiceOptions(INFO_BAR_SIZES, es).map((o) => o.label)).toEqual([
      'No',
      'Pequeña',
      'Normal',
      'Grande'
    ])
    const template = SOURCE.slice(SOURCE.indexOf('<template>'))
    expect(template).not.toContain('kind="switch"')
    expect(template.match(/<ChoiceControl/g)).toHaveLength(1)
  })

  it('stores each choice as the bar size itself: "No" is the hidden bar, "off"', () => {
    const en = messagesFor('en').settings.infoBar.sizeChoices
    const options = choiceOptions(INFO_BAR_SIZES, en)
    expect(options.map((o) => o.value)).toEqual(['off', 'small', 'normal', 'large'])
    expect(options[0]?.label).toBe('No')
    // The choice reads and writes `<bar>Size` as it is stored, so "small" and "large" show as
    // the current choice and "No" writes 'off' (the hidden bar of every file before R20).
    expect(SOURCE).toContain('const sizeField = `${props.field}Size` as const')
    expect(SOURCE).toContain(':current="size"')
    expect(SOURCE).toContain(':apply="setSize"')
    for (const [section, bars] of Object.entries(INFO_BARS)) {
      const schema = OPTION_SCHEMA[section as keyof typeof INFO_BARS] as unknown as Record<
        string,
        { values?: readonly string[] }
      >
      for (const [, sizeField] of bars) {
        expect(schema[sizeField]?.values, `${section}.${sizeField}`).toEqual([...INFO_BAR_SIZES])
      }
    }
  })

  it('shows the trend and wind options only while their item and the bar are shown', () => {
    expect(SOURCE).not.toContain(':disabled=')
    expect(SOURCE).toContain(`id === 'trackTemp' && visible && !off`)
  })

  it('with "No" hides the bar\'s items instead of greying them: only the choice and reset stay', () => {
    expect(SOURCE).toContain(':off="off"')
    expect(SOURCE).not.toContain(':dim=')
    const template = EDITOR.slice(EDITOR.indexOf('<template>'))
    const head = template.indexOf('<slot name="head" />')
    const gate = template.indexOf('<template v-if="!off">')
    const lists = template.indexOf('ref="listEl"')
    const foot = template.indexOf('class="ed-foot"')
    expect(head).toBeGreaterThan(0)
    expect(gate).toBeGreaterThan(head)
    expect(lists).toBeGreaterThan(gate)
    expect(foot).toBeGreaterThan(lists)
    expect(EDITOR).not.toContain('is-dim')
  })
})

describe('«Copiar a» (R13)', () => {
  it('offers the other widgets with the same bar, copying its items and size with "Deshacer"', () => {
    expect(SOURCE).toMatch(/v-for="x in targets"/)
    expect(SOURCE).toMatch(/offerSectionUndo\(target,/)
    expect(SOURCE).toMatch(/\[sizeField\]: size\.value/)
    // Only widgets that have this bar (the standings' second line has no twin).
    expect(SOURCE).toMatch(/INFO_BARS\[s\]\.some\(\(\[f\]\) => f === props\.field\)/)
  })
})
