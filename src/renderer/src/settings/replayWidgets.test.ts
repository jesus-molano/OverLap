import { describe, expect, it } from 'vitest'
import { LOCALES, messagesFor } from '@shared/i18n'
import { liveOnlyWidgets, replayNote } from './replayWidgets'

const es = messagesFor('es')
const en = messagesFor('en')

describe('replay rule wording', () => {
  it('lists the widgets every replay hides, joined like each language lists things', () => {
    expect(liveOnlyWidgets(es, LOCALES.es)).toBe('Radar, Pedales, Avisos, Delta y Condiciones')
    expect(liveOnlyWidgets(en, LOCALES.en)).toBe('Radar, Inputs, Alerts, Delta and Conditions')
    expect(es.settings.appearance.screen.replaysHelp(liveOnlyWidgets(es, LOCALES.es))).toBe(
      'Radar, Pedales, Avisos, Delta y Condiciones solo muestran datos en directo: se ocultan siempre'
    )
  })

  it('tells each widget page what a replay does to it', () => {
    expect(replayNote(es, 'relative', 'follow')).toBe(
      'En repeticiones muestra el coche que estás viendo'
    )
    expect(replayNote(es, 'relative', 'hide')).toBe(
      'En repeticiones se oculta (Apariencia > Visibilidad)'
    )
    // Live-only data hides whatever the rule says.
    for (const replays of ['follow', 'hide'] as const) {
      expect(replayNote(es, 'inputs', replays)).toBe(
        'En repeticiones se oculta: solo muestra datos en directo'
      )
      expect(replayNote(en, 'delta', replays)).toBe('Hidden in replays: it only shows live data')
    }
    expect(replayNote(en, 'battle', 'follow')).toBe('In replays it shows the car you are watching')
  })
})
