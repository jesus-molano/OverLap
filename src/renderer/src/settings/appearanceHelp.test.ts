import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { fontScaleHelp, fontScaleWidgets } from './appearanceHelp'

describe('fontScaleHelp', () => {
  it('names the auto-height widgets as changed and the free ones as not', () => {
    const { scaled, free } = fontScaleWidgets()
    expect(scaled).toEqual(['standings', 'battle', 'inputs', 'traffic', 'alerts', 'lights', 'fuel'])
    expect(free).toEqual(['relative', 'radar', 'delta'])
    expect(fontScaleHelp(messagesFor('es'), 'es')).toEqual({
      help: 'Cambia Posiciones, Batalla, Pedales, Tráfico, Avisos, Testigos y Combustible',
      more: 'Relativo, Radar y Delta no: ajustan el texto al tamaño de su ventana.'
    })
    expect(fontScaleHelp(messagesFor('en'), 'en')).toEqual({
      help: 'Changes Standings, Battle, Inputs, Traffic, Alerts, Warning lights, and Fuel',
      more: 'Not Relative, Radar, and Delta: they fit their text to their window.'
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
