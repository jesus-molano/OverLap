import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { fontScaleHelp, fontScaleWidgets } from './appearanceHelp'

describe('fontScaleHelp', () => {
  it('names the auto-height widgets as changed and the free ones as not', () => {
    const { scaled, free } = fontScaleWidgets()
    expect(scaled).toEqual(['standings', 'battle', 'inputs', 'traffic', 'alerts', 'lights', 'fuel'])
    expect(free).toEqual(['relative', 'radar', 'delta'])
    expect(fontScaleHelp(messagesFor('es'), 'es')).toBe(
      'Cambia el texto de Posiciones, Batalla, Pedales, Tráfico, Avisos, Testigos y Combustible. Relativo, Radar y Delta no: ajustan el texto al tamaño de su ventana'
    )
    expect(fontScaleHelp(messagesFor('en'), 'en')).toBe(
      'Changes the text of Standings, Battle, Inputs, Traffic, Alerts, Warning lights, and Fuel. Not Relative, Radar, and Delta: they fit their text to their window'
    )
  })
})
