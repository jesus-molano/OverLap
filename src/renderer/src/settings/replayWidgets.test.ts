import { describe, expect, it } from 'vitest'
import { LOCALES, messagesFor } from '@shared/i18n'
import { liveOnlyWidgets, replayNote } from './replayWidgets'

const es = messagesFor('es')
const en = messagesFor('en')

describe('replay rule wording', () => {
  it('lists the widgets with your car’s data only, joined like each language lists things', () => {
    expect(liveOnlyWidgets(es, LOCALES.es)).toBe('Radar, Pedales, Avisos, Delta y Condiciones')
    expect(liveOnlyWidgets(en, LOCALES.en)).toBe('Radar, Inputs, Alerts, Delta and Conditions')
    expect(es.settings.appearance.screen.replaysHelp(liveOnlyWidgets(es, LOCALES.es))).toBe(
      'En directo siguen al coche que miras; Radar, Pedales, Avisos, Delta y Condiciones solo tienen datos de tu coche y se ocultan si miras otro'
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
      expect(replayNote(es, 'inputs', replays)).toBe(
        'Solo tiene datos de tu coche: se oculta en repeticiones y si miras otro coche'
      )
      expect(replayNote(en, 'delta', replays)).toBe(
        'Only your car’s data: hidden in replays and when you watch another car'
      )
    }
    expect(replayNote(en, 'battle', 'follow')).toBe(
      'Live, it follows the car you are watching; hidden when you rewind a replay'
    )
  })
})
