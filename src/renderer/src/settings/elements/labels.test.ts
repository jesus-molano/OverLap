import { describe, expect, it } from 'vitest'
import { LANGUAGES, messagesFor } from '@shared/i18n'
import { elementFields, elementsSpec } from '@shared/settingsSchema'
import type { ElementField, OptionSection } from '@shared/settingsSchema'
import { elementTexts, infoBarTexts, zoneTitle } from './labels'

describe('the words of every element list', () => {
  it('a title for every zone and a label for every id, in every language', () => {
    for (const lang of LANGUAGES) {
      const m = messagesFor(lang)
      for (const [section, field] of elementFields()) {
        const s = section as OptionSection
        const f = field as ElementField<typeof s>
        const name = `${lang} ${section}.${field}`
        expect(zoneTitle(m, s, f), name).toBeTruthy()
        const texts = elementTexts(m, s, f) as Readonly<Record<string, { label: string }>>
        for (const id of elementsSpec(s, f).ids) {
          expect(texts[id]?.label, `${name}.${id}`).toBeTruthy()
        }
      }
    }
  })

  it('names the info bars’ marker and hints the items that need it', () => {
    const t = infoBarTexts(messagesFor('es'))
    expect(t.split).toEqual({
      label: 'A la derecha',
      hint: 'Lo que va después se alinea al otro extremo'
    })
    expect(t.fastestLap.hint).toContain('VR')
    expect(t.title.hint).toContain('RELATIVO')
    expect(t.session.hint).toBeUndefined()
  })

  it('reuses the existing words: the standings columns, the lights', () => {
    const m = messagesFor('es')
    expect(elementTexts(m, 'standings', 'columns').gap.label).toBe(m.settings.columns.labels.gap)
    expect(elementTexts(m, 'lights', 'icons').water.label).toBe(m.widgets.lights.names.water)
  })
})
