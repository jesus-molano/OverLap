import { describe, expect, it } from 'vitest'
import { LOCALES, messagesFor } from '@shared/i18n'
import { WIDGET_IDS, followsCamera, inCarOnly } from '@shared/widgets'
import { liveOnlyWidgets, replayNote } from './replayWidgets'

const es = messagesFor('es')
const en = messagesFor('en')

describe('replay rule wording', () => {
  it('lists the widgets with your car’s data only, joined like each language lists things', () => {
    expect(liveOnlyWidgets(es, LOCALES.es)).toBe(
      'Radar, Pedales, Avisos, Testigos, Delta y Combustible'
    )
    expect(liveOnlyWidgets(en, LOCALES.en)).toBe(
      'Radar, Inputs, Alerts, Warning lights, Delta and Fuel'
    )
    expect(es.settings.appearance.screen.replaysHelp(liveOnlyWidgets(es, LOCALES.es))).toBe(
      'En directo siguen al coche que miras; Radar, Pedales, Avisos, Testigos, Delta y Combustible solo tienen datos de tu coche y se ocultan si miras otro'
    )
  })

  it('tells each widget page what a replay does to it', () => {
    expect(replayNote(es, 'relative', 'follow')).toBe(
      'En directo sigue al coche que miras; al rebobinar una repetición se oculta'
    )
    // The standings keep the live race when you rewind.
    expect(replayNote(es, 'standings', 'follow')).toBe(
      'En directo sigue al coche que miras; al rebobinar mantiene la carrera en directo'
    )
    expect(replayNote(es, 'standings', 'hide')).toBe(
      'Al rebobinar se oculta (Apariencia > Visibilidad); en directo sigue al coche que miras'
    )
    // Your car's data only hides whatever the rule says.
    for (const replays of ['follow', 'hide'] as const) {
      expect(replayNote(es, 'alerts', replays)).toBe(
        'Solo tiene datos de tu coche: se oculta en repeticiones y si miras otro coche'
      )
      expect(replayNote(en, 'fuel', replays)).toBe(
        'Only your car’s data: hidden in replays and when you watch another car'
      )
      // The ones with data only from inside the car: out of it too (no session-screen switch).
      expect(replayNote(es, 'inputs', replays)).toBe(
        'Solo tiene datos de tu coche y desde dentro: se oculta fuera del coche (también en la pantalla de sesión), en repeticiones y si miras otro coche'
      )
      expect(replayNote(en, 'delta', replays)).toBe(
        'Only your car’s data, from inside it: hidden out of the car (the session screen too), in replays and when you watch another car'
      )
    }
    expect(replayNote(en, 'battle', 'follow')).toBe(
      'Live, it follows the car you are watching; hidden when you rewind a replay'
    )
  })

  it('has nothing to show out of the car only for the radar, the pedals, the lights and the delta', () => {
    expect(WIDGET_IDS.filter(inCarOnly)).toEqual(['radar', 'inputs', 'lights', 'delta'])
    // Every one of them hides with another car on camera too.
    for (const id of WIDGET_IDS.filter(inCarOnly)) expect(followsCamera(id)).toBe(false)
  })
})
