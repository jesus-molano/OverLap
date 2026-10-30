import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { fontScaleHelp, fontScaleWidgets } from './appearanceHelp'

describe('fontScaleHelp', () => {
  it('says it changes every widget, and how the free-size ones grow (R09)', () => {
    const { scaled, free } = fontScaleWidgets()
    expect(scaled).toEqual(['standings', 'battle', 'inputs', 'traffic', 'alerts', 'lights', 'fuel'])
    expect(free).toEqual(['relative', 'radar', 'delta'])
    expect(fontScaleHelp(messagesFor('es'), 'es')).toEqual({
      help: 'Cambia los diez widgets: multiplica la «Escala» de cada uno',
      more: 'Relativo, Radar y Delta llenan su ventana con el texto: su ventana crece o encoge en la misma proporción, en todas tus disposiciones.'
    })
    expect(fontScaleHelp(messagesFor('en'), 'en')).toEqual({
      help: 'Changes all ten widgets: it multiplies each one’s “Scale”',
      more: 'Relative, Radar, and Delta fill their window with their text: their window grows or shrinks by the same amount, in all your layouts.'
    })
  })
})

describe('the global pages’ help (R31)', () => {
  /** Visible help lines on Apariencia, Atajos and Disposiciones: one line, about 90 characters. */
  const MAX = 90
  /** Not help lines: the ⓘ texts, screen-reader and confirm words, notices and refusals. */
  const SKIP = /More$|description|Label$|Aria$|confirm|errors|notices|anyOf|hint/i

  for (const lang of ['es', 'en'] as const) {
    it(`${lang}: keeps every help line to one line, the rest behind its ⓘ`, () => {
      const s = messagesFor(lang).settings
      const walk = (node: unknown, path: string): void => {
        if (SKIP.test(path)) return
        if (typeof node === 'string') expect(node.length, path).toBeLessThanOrEqual(MAX)
        else if (node !== null && typeof node === 'object') {
          for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`)
        }
      }
      walk(s.appearance, 'appearance')
      walk(s.shortcuts, 'shortcuts')
      walk(s.layouts, 'layouts')
      expect(fontScaleHelp(messagesFor(lang), lang).help.length).toBeLessThanOrEqual(MAX)
    })
  }
})
