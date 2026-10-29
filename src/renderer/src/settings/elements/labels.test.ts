import { DEFAULT_SETTINGS } from '@shared/settings'
import { describe, expect, it } from 'vitest'
import { LANGUAGES, messagesFor } from '@shared/i18n'
import { elementFields, elementsSpec } from '@shared/settingsSchema'
import type { ElementField, OptionSection } from '@shared/settingsSchema'
import { barItemTexts, elementTexts, infoBarTexts, zoneTitle } from './labels'

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

describe('barItemTexts (R13)', () => {
  it('says which standings items the class lines show instead', () => {
    const es = messagesFor('es')
    const st = barItemTexts(es, 'standings', DEFAULT_SETTINGS.standings as never)
    expect(st.sof.hint).toBe(es.settings.standings.inClassLine)
    expect(st.carCount.hint).toBe(es.settings.standings.inClassLine)
    const noLine = barItemTexts(es, 'standings', {
      ...DEFAULT_SETTINGS.standings,
      classLine: [
        { id: 'sof', visible: false },
        { id: 'carCount', visible: true }
      ]
    } as never)
    expect(noLine.sof.hint).not.toBe(es.settings.standings.inClassLine)
    expect(barItemTexts(es, 'relative', DEFAULT_SETTINGS.relative as never).sof.hint).not.toBe(
      es.settings.standings.inClassLine
    )
  })
})
