import { describe, expect, it } from 'vitest'
import { LOCALES, messagesFor } from '@shared/i18n'
import { createDefaultSettings } from '@shared/settings'
import { SHOW_WHEN } from '@shared/settingsSchema'
import { CameraState, screenHiddenReason, type ScreenFacts } from '@shared/simScreen'
import type { VisibilityOptions } from '@shared/types'
import {
  WIDGET_IDS,
  canShowOnSessionScreen,
  followsCamera,
  inCarOnly,
  type WidgetId
} from '@shared/widgets'
import {
  liveOnlyWidgets,
  outOfCarHidesSessionScreen,
  replayFacts,
  replayNote,
  replaysHelp,
  sessionScreenRuleOn,
  sessionScreenSwitch
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
    expect(replaysHelp(es, LOCALES.es, FOLLOW)).toEqual({
      help: 'Siguen al coche que miras; al rebobinar solo queda Posiciones, en directo',
      more: 'Radar, Pedales, Avisos, Testigos, Delta y Combustible solo tienen datos de tu coche y se ocultan si miras otro.'
    })
    expect(replaysHelp(es, LOCALES.es, HIDE)).toEqual({
      help: 'Ningún widget en las repeticiones ni al mirar otros coches desde fuera del coche'
    })
    // Always shown: the live point is live, only the tape hides.
    expect(replaysHelp(en, LOCALES.en, HIDE_ALWAYS)).toEqual({
      help: 'No widgets when you rewind; live, they follow the car you are watching'
    })
  })

  it('tells each widget page what a replay does to it, in one sentence pattern (R45)', () => {
    const note = (m: typeof es, id: WidgetId, c: Choices): string =>
      replayNote(m, m === es ? LOCALES.es : LOCALES.en, id, c)
    expect(note(es, 'relative', FOLLOW)).toBe(
      'Sigue al coche que miras: se oculta al rebobinar una repetición'
    )
    // The standings keep the live race when you rewind.
    expect(note(es, 'standings', FOLLOW)).toBe(
      'Sigue al coche que miras: al rebobinar mantiene la carrera en directo'
    )
    // Replays hidden (the default): watching from out of the car hides them too.
    expect(note(es, 'standings', HIDE)).toBe(
      'Sigue al coche que miras: se oculta en repeticiones y al mirar otros coches desde fuera del coche (Visibilidad)'
    )
    expect(note(es, 'standings', HIDE_ALWAYS)).toBe(
      'Sigue al coche que miras: se oculta al rebobinar una repetición (Visibilidad)'
    )
    // Your car's data only hides whatever the rule says.
    for (const choices of [FOLLOW, HIDE, HIDE_ALWAYS]) {
      expect(note(es, 'alerts', choices)).toBe(
        'Solo tiene datos de tu coche: se oculta en repeticiones y si miras otro coche'
      )
      // Nothing while the replay system is on: the session screen either (no switch for it).
      expect(note(en, 'fuel', choices)).toBe(
        'Only your car’s data: hidden in replays, on the session screen and when you watch another car'
      )
      expect(note(es, 'fuel', choices)).toBe(
        'Solo tiene datos de tu coche: se oculta en repeticiones, en la pantalla de sesión y si miras otro coche'
      )
      // The ones with data only from inside the car: out of it too (no session-screen switch).
      expect(note(es, 'inputs', choices)).toBe(
        'Solo tiene datos de tu coche: se oculta en repeticiones, fuera del coche (también en la pantalla de sesión) y si miras otro coche'
      )
      expect(note(en, 'delta', choices)).toBe(
        'Only your car’s data: hidden in replays, out of the car (the session screen too) and when you watch another car'
      )
    }
    expect(note(en, 'battle', FOLLOW)).toBe(
      'Follows the car you are watching: hidden when you rewind a replay'
    )
  })

  it('reads the same for widgets that behave the same, and differently only when they do', () => {
    for (const choices of [FOLLOW, HIDE, HIDE_ALWAYS]) {
      const byFacts = new Map<string, Set<string>>()
      for (const id of WIDGET_IDS) {
        const key = JSON.stringify(replayFacts(id, choices))
        const set = byFacts.get(key) ?? new Set<string>()
        set.add(replayNote(es, LOCALES.es, id, choices))
        byFacts.set(key, set)
      }
      // One text per behaviour...
      for (const texts of byFacts.values()) expect(texts.size).toBe(1)
      // ...and as many texts as behaviours.
      const all = new Set(WIDGET_IDS.map((id) => replayNote(es, LOCALES.es, id, choices)))
      expect(all.size).toBe(byFacts.size)
    }
    // Avisos and Combustible differ on the session screen, and say so.
    expect(replayFacts('alerts', FOLLOW).hides).not.toContain('sessionScreen')
    expect(replayFacts('fuel', FOLLOW).hides).toContain('sessionScreen')
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

describe('sessionScreenSwitch', () => {
  const v = { hideOnSessionScreen: true, replays: 'hide', showWhen: 'car' } as const
  it('is on every page: the widget’s own exception where it applies', () => {
    expect(sessionScreenSwitch(es, 'relative', v, false)).toEqual({
      help: es.settings.window.sessionScreenHelp,
      on: false,
      disabled: false
    })
    expect(sessionScreenSwitch(es, 'standings', v, true).on).toBe(true)
  })

  it('is off and disabled, saying why, where it cannot apply', () => {
    for (const id of ['radar', 'inputs', 'lights', 'delta'] as const) {
      expect(sessionScreenSwitch(es, id, v, true), id).toEqual({
        help: 'No aplica: solo tiene datos dentro del coche',
        on: false,
        disabled: true
      })
    }
    expect(sessionScreenSwitch(es, 'fuel', v, true).help).toBe(
      'No aplica: con las repeticiones activas no muestra nada'
    )
  })

  it('is on and disabled while nothing hides on the session screen', () => {
    const open = { hideOnSessionScreen: false, replays: 'follow', showWhen: 'always' } as const
    expect(sessionScreenSwitch(es, 'battle', open, false)).toEqual({
      help: es.settings.window.sessionScreenOff,
      on: true,
      disabled: true
    })
  })
})
