import { describe, expect, it } from 'vitest'
import { LOCALES, messagesFor } from '@shared/i18n'
import type { VisibilityOptions } from '@shared/types'
import { WIDGET_IDS, followsCamera, inCarOnly } from '@shared/widgets'
import { liveOnlyWidgets, replayNote, replaysHelp, sessionScreenRuleOn } from './replayWidgets'

const es = messagesFor('es')
const en = messagesFor('en')

type Choices = Pick<VisibilityOptions, 'replays' | 'showWhen'>
const FOLLOW: Choices = { replays: 'follow', showWhen: 'car' }
const HIDE: Choices = { replays: 'hide', showWhen: 'car' }
const HIDE_ALWAYS: Choices = { replays: 'hide', showWhen: 'always' }

describe('replay rule wording', () => {
  it('lists the widgets with your car’s data only, joined like each language lists things', () => {
    expect(liveOnlyWidgets(es, LOCALES.es)).toBe(
      'Radar, Pedales, Avisos, Testigos, Delta y Combustible'
    )
    expect(liveOnlyWidgets(en, LOCALES.en)).toBe(
      'Radar, Inputs, Alerts, Warning lights, Delta and Fuel'
    )
  })

  it('words the replays help for the current choices', () => {
    expect(replaysHelp(es, LOCALES.es, FOLLOW)).toBe(
      'Siguen al coche que miras y, al rebobinar, solo queda la clasificación en directo; Radar, Pedales, Avisos, Testigos, Delta y Combustible solo tienen datos de tu coche y se ocultan si miras otro'
    )
    expect(replaysHelp(es, LOCALES.es, HIDE)).toBe(
      'Ningún widget mientras ves una repetición, ni al mirar a otros coches en directo desde fuera del coche'
    )
    // Always shown: the live point is live, only the tape hides.
    expect(replaysHelp(en, LOCALES.en, HIDE_ALWAYS)).toBe(
      'No widgets when you rewind; live, they follow the car you are watching'
    )
  })

  it('tells each widget page what a replay does to it', () => {
    expect(replayNote(es, 'relative', FOLLOW)).toBe(
      'En directo sigue al coche que miras; al rebobinar una repetición se oculta'
    )
    // The standings keep the live race when you rewind.
    expect(replayNote(es, 'standings', FOLLOW)).toBe(
      'En directo sigue al coche que miras; al rebobinar mantiene la carrera en directo'
    )
    // Replays hidden (the default): watching from out of the car hides them too.
    expect(replayNote(es, 'standings', HIDE)).toBe(
      'Se oculta en repeticiones y al mirar otros coches desde fuera del coche (Apariencia > Visibilidad)'
    )
    expect(replayNote(es, 'standings', HIDE_ALWAYS)).toBe(
      'Al rebobinar se oculta (Apariencia > Visibilidad); en directo sigue al coche que miras'
    )
    // Your car's data only hides whatever the rule says.
    for (const choices of [FOLLOW, HIDE, HIDE_ALWAYS]) {
      expect(replayNote(es, 'alerts', choices)).toBe(
        'Solo tiene datos de tu coche: se oculta en repeticiones y si miras otro coche'
      )
      expect(replayNote(en, 'fuel', choices)).toBe(
        'Only your car’s data: hidden in replays and when you watch another car'
      )
      // The ones with data only from inside the car: out of it too (no session-screen switch).
      expect(replayNote(es, 'inputs', choices)).toBe(
        'Solo tiene datos de tu coche y desde dentro: se oculta fuera del coche (también en la pantalla de sesión), en repeticiones y si miras otro coche'
      )
      expect(replayNote(en, 'delta', choices)).toBe(
        'Only your car’s data, from inside it: hidden out of the car (the session screen too), in replays and when you watch another car'
      )
    }
    expect(replayNote(en, 'battle', FOLLOW)).toBe(
      'Live, it follows the car you are watching; hidden when you rewind a replay'
    )
  })

  it('has nothing to show out of the car only for the radar, the pedals, the lights and the delta', () => {
    expect(WIDGET_IDS.filter(inCarOnly)).toEqual(['radar', 'inputs', 'lights', 'delta'])
    // Every one of them hides with another car on camera too.
    for (const id of WIDGET_IDS.filter(inCarOnly)) expect(followsCamera(id)).toBe(false)
  })

  it('keeps the session-screen exception meaningful unless nothing hides there', () => {
    expect(sessionScreenRuleOn({ hideOnSessionScreen: true, showWhen: 'always' })).toBe(true)
    // Out of the car with the overlay only for the car: the exception is what keeps it.
    expect(sessionScreenRuleOn({ hideOnSessionScreen: false, showWhen: 'car' })).toBe(true)
    expect(sessionScreenRuleOn({ hideOnSessionScreen: false, showWhen: 'race' })).toBe(true)
    expect(sessionScreenRuleOn({ hideOnSessionScreen: false, showWhen: 'always' })).toBe(false)
  })
})
