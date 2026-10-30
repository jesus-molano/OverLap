/**
 * The options that act during the session only carry one note, the same words everywhere: the
 * note itself, and (read from the pages' sources, the test runner draws nothing) every page that
 * has such an option passing it.
 */
import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { behaviourNote } from './previewNote'
import WINDOW from '../pages/WindowSection.vue?raw'
import BATTLE from '../options/BattleSettings.vue?raw'
import ALERTS from '../options/AlertsSettings.vue?raw'
import TRAFFIC from '../options/TrafficSettings.vue?raw'
import DELTA from '../options/DeltaSettings.vue?raw'
import FUEL from '../options/FuelSettings.vue?raw'

/** The `:apply` setters of the controls that pass `:note="behaviour"` in `source`. */
function noted(source: string): string[] {
  return [...source.matchAll(/:note="behaviour"\s+:apply="set\('(\w+)'\)"/g)].map((m) => m[1] ?? '')
}

describe('behaviourNote', () => {
  it('says the same thing on every page, in each language', () => {
    expect(behaviourNote(messagesFor('es'))).toEqual({
      kind: 'behaviour',
      text: 'No cambia la vista previa',
      detail: 'Actúa durante la sesión, sobre el juego'
    })
    expect(behaviourNote(messagesFor('en')).text).toBe('Not shown in the preview')
  })

  it('is on every option the preview cannot show', () => {
    expect(noted(WINDOW)).toEqual(['anchor', 'hideInPits', 'showOnSessionScreen', 'locked'])
    expect(WINDOW).toMatch(/<CheckGroup[^>]*:note="behaviour"/)
    expect(noted(BATTLE)).toEqual(['thresholdS', 'holdS'])
    expect(noted(ALERTS)).toEqual(['holdS'])
    expect(noted(TRAFFIC)).toEqual(['onlyMulticlass'])
    expect(noted(DELTA)).toEqual(['fallback'])
    expect(noted(FUEL)).toEqual(['avgLaps', 'marginLaps'])
  })
})
