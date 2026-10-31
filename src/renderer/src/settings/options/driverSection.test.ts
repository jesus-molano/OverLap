/**
 * The «Piloto» block (R08): the four driver widgets change the driver cell the same way, in the
 * same place (right after Contenido) and order, and nothing of it is left elsewhere on a page.
 */
import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import BATTLE from './BattleSettings.vue?raw'
import BLOCK from './DriverSection.vue?raw'
import RELATIVE from './RelativeSettings.vue?raw'
import STANDINGS from './StandingsSettings.vue?raw'
import TRAFFIC from './TrafficSettings.vue?raw'
import {
  brandChoicesInherit,
  flagChoicesInherit,
  iRatingFormatChoicesInherit,
  fromFlagChoice,
  toFlagChoice
} from '../controls/choices'

const PAGES = { relative: RELATIVE, standings: STANDINGS, battle: BATTLE, traffic: TRAFFIC }

const templateOf = (sfc: string): string => /<template>([\s\S]*)<\/template>/.exec(sfc)?.[1] ?? ''

describe('DriverSection', () => {
  it('follows Contenido on each driver page, and nothing of it is left elsewhere', () => {
    for (const [id, src] of Object.entries(PAGES)) {
      const t = templateOf(src)
      const content = t.indexOf('t.settings.common.content')
      const block = t.indexOf(`<DriverSection section="${id}" />`)
      expect(content, id).toBeGreaterThan(-1)
      expect(block, id).toBeGreaterThan(content)
      expect(block, id).toBeLessThan(t.indexOf('<CustomizeSection>'))
      for (const field of [
        'nameFormat',
        'brandMarks',
        'countryFlags',
        'showFlags',
        'iRatingFormat',
        'iRatingColor'
      ]) {
        expect(t, `${id}.${field}`).not.toContain(`set('${field}')`)
      }
    }
  })

  it('has its rows in one order, each with its Global', () => {
    const t = templateOf(BLOCK)
    const at = (s: string): number => t.indexOf(s)
    const order = [
      at('t.settings.common.nameFormat'),
      at('t.settings.driverCell.brandMarks'),
      at('t.settings.driverCell.countryFlags'),
      at('t.settings.common.penaltyFlags'),
      at('t.settings.driverCell.iRatingFormat'),
      at('t.settings.driverCell.iRatingColor')
    ]
    expect(order.every((i) => i > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    const es = messagesFor('es')
    expect(flagChoicesInherit(es, true).map((c) => c.label)).toEqual(['Global (Sí)', 'Sí', 'No'])
    expect(brandChoicesInherit(es, 'auto').map((c) => c.label)).toEqual([
      'Global (Auto)',
      'Auto',
      'Siempre',
      'Nunca'
    ])
    // The iRating's format (request 10): each choice written as it reads, in each language.
    expect(iRatingFormatChoicesInherit(es, 'compact').map((c) => c.label)).toEqual([
      'Global (2.5k)',
      '2.5k',
      '2.520'
    ])
    expect(iRatingFormatChoicesInherit(messagesFor('en'), 'full').map((c) => c.label)).toEqual([
      'Global (2,520)',
      '2.5k',
      '2,520'
    ])
    expect([toFlagChoice('inherit'), toFlagChoice(true), toFlagChoice(false)]).toEqual([
      'inherit',
      'on',
      'off'
    ])
    expect([fromFlagChoice('inherit'), fromFlagChoice('on'), fromFlagChoice('off')]).toEqual([
      'inherit',
      true,
      false
    ])
  })
})
