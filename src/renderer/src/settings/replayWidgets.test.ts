import { describe, expect, it } from 'vitest'
import { LOCALES, messagesFor } from '@shared/i18n'
import { createDefaultSettings } from '@shared/settings'
import { SHOW_WHEN } from '@shared/settingsSchema'
import { CameraState, screenHiddenReason, type ScreenFacts } from '@shared/simScreen'
import type { VisibilityOptions } from '@shared/types'
import { WIDGET_IDS, canShowOnSessionScreen, followsCamera, inCarOnly } from '@shared/widgets'
import {
  liveOnlyWidgets,
  outOfCarHidesSessionScreen,
  replayNote,
  replaysHelp,
  sessionScreenRuleOn,
  sessionScreenWidgets
} from './replayWidgets'

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
      'Siguen al coche que miras y, al rebobinar, solo queda Posiciones, con la carrera en directo; Radar, Pedales, Avisos, Testigos, Delta y Combustible solo tienen datos de tu coche y se ocultan si miras otro'
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
      // Nothing while the replay system is on: the session screen either (no switch for it).
      expect(replayNote(en, 'fuel', choices)).toBe(
        'Only your car’s data: hidden in replays, on the session screen and when you watch another car'
      )
      expect(replayNote(es, 'fuel', choices)).toBe(
        'Solo tiene datos de tu coche: se oculta en repeticiones, en la pantalla de sesión y si miras otro coche'
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

  it('offers the session-screen switch only to widgets that can show something there', () => {
    // The fuel shows nothing while the replay system is on, which it is on the session screen.
    expect(WIDGET_IDS.filter(canShowOnSessionScreen)).toEqual([
      'relative',
      'standings',
      'battle',
      'traffic',
      'alerts'
    ])
    expect(sessionScreenWidgets(es, LOCALES.es)).toBe('Relativo, Batalla, Tráfico y Avisos')
    expect(sessionScreenWidgets(en, LOCALES.en)).toBe('Relative, Battle, Traffic and Alerts')
  })

  it('keeps the session-screen exception meaningful unless nothing hides there', () => {
    const rule = (o: Partial<VisibilityOptions>): boolean =>
      sessionScreenRuleOn({ hideOnSessionScreen: false, replays: 'hide', showWhen: 'car', ...o })
    expect(rule({ hideOnSessionScreen: true, showWhen: 'always' })).toBe(true)
    // Out of the car with the overlay only for the car: the exception is what keeps it.
    expect(rule({ showWhen: 'car' })).toBe(true)
    expect(rule({ showWhen: 'race' })).toBe(true)
    expect(rule({ showWhen: 'always' })).toBe(false)
    // Following replays shows every widget at the live point, the session screen: nothing hides.
    expect(rule({ replays: 'follow' })).toBe(false)
    expect(rule({ replays: 'follow', hideOnSessionScreen: true })).toBe(true)
  })

  it('says what the global rules do on the session screen, for every choice', () => {
    // The session screen, out of the car, the replay system at its live point (Playback: Live).
    const frame = { CamCameraState: [CameraState.IsSessionScreen | 0x50], IsGarageVisible: [false] }
    const facts: ScreenFacts = { mode: 'live', inCar: false, kind: 'race' }
    const base = createDefaultSettings().visibility
    for (const showWhen of SHOW_WHEN) {
      for (const replays of ['hide', 'follow'] as const) {
        for (const hideOnSessionScreen of [false, true]) {
          const v: VisibilityOptions = { ...base, showWhen, replays, hideOnSessionScreen }
          const name = JSON.stringify({ showWhen, replays, hideOnSessionScreen })
          // The exception is on exactly when it changes what shows there.
          const kept = screenHiddenReason(v, frame, facts, true)
          const notKept = screenHiddenReason(v, frame, facts, false)
          expect(kept, name).toBeNull()
          expect(sessionScreenRuleOn(v), name).toBe(notKept !== null)
          // Hiding there is greyed out exactly when it changes nothing.
          const flipped = screenHiddenReason(
            { ...v, hideOnSessionScreen: !hideOnSessionScreen },
            frame,
            facts,
            false
          )
          expect(outOfCarHidesSessionScreen(v), name).toBe(flipped === notKept)
        }
      }
    }
  })
})
