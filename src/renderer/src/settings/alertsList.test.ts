/**
 * R12: Contenido for behaviour (counts, ranges, thresholds, modes), Personalizar for what is
 * drawn (each zone's eye list, its look switches with it, an element's option on its row).
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import {
  ALERTS_SPEC,
  ALERT_GROUPS,
  ALERT_GROUP_HEADS,
  alertItems,
  SHARED_EVENTS,
  alertOfLight,
  alertPatch,
  allAlertItems,
  lightOfAlert,
  lightShown,
  lightsPatch
} from './alertsList'
import { LIGHT_ORDER } from '@shared/lights'
import ALERTS from './options/AlertsSettings.vue?raw'
import LIGHTS from './options/LightsSettings.vue?raw'
import STANDINGS from './options/StandingsSettings.vue?raw'

/** The Contenido section of a page's template. */
const contentOf = (sfc: string): string =>
  /<PageSection[^>]*t\.settings\.common\.content[\s\S]*?<\/PageSection>/.exec(sfc)?.[0] ?? ''

describe('Avisos as eye lists', () => {
  it('lists every alert switch once, in five groups, its default as its eye', () => {
    const ids = ALERT_GROUPS.flatMap((g) => g.spec.ids)
    const switches = Object.keys(OPTION_SCHEMA.alerts).filter(
      (k) =>
        k.startsWith('show') &&
        OPTION_SCHEMA.alerts[k as keyof typeof OPTION_SCHEMA.alerts].kind === 'bool'
    )
    expect([...ids].sort()).toEqual([...switches].sort())
    expect(ALERT_GROUPS.map((g) => g.key)).toEqual(['flags', 'pit', 'race', 'engine', 'fuel'])
    for (const g of ALERT_GROUPS) {
      expect(alertItems(g, DEFAULT_SETTINGS.alerts)).toEqual(g.spec.default)
    }
  })

  it('reads and writes the switches as they are stored', () => {
    const flags = ALERT_GROUPS[0]
    if (!flags) throw new Error('no group')
    const o = { ...DEFAULT_SETTINGS.alerts, showBlue: false }
    const items = alertItems(flags, o)
    expect(items).toContainEqual({ id: 'showBlue', visible: false })
    expect(alertPatch(items)).toEqual({ showFlags: true, showBlue: false, showFurled: true })
    // The blue and furled flags belong to the flags: their eye greys out with it.
    expect(flags.spec.parents).toEqual({ showBlue: 'showFlags', showFurled: 'showFlags' })
  })
})

describe('Avisos as one list (R12)', () => {
  it('lists the fifteen alerts in their groups, each group named above its first alert', () => {
    expect(ALERTS_SPEC.ids).toEqual(ALERT_GROUPS.flatMap((g) => g.spec.ids))
    expect(ALERTS_SPEC.fixedOrder).toBe(true)
    expect(ALERTS_SPEC.parents).toEqual({
      showBlue: 'showFlags',
      showFurled: 'showFlags',
      showPitOverspeed: 'showPitLimiter'
    })
    expect(ALERT_GROUP_HEADS).toEqual([
      ['showFlags', 'flags'],
      ['showPitLimiter', 'pit'],
      ['showLapsToGo', 'race'],
      ['showStalled', 'engine'],
      ['showBoxThisLap', 'fuel']
    ])
    expect(allAlertItems(DEFAULT_SETTINGS.alerts)).toEqual(ALERTS_SPEC.default)
  })
})

describe('the Contenido / Personalizar rule', () => {
  it('keeps the switches of what is drawn out of Contenido', () => {
    expect(contentOf(ALERTS)).not.toMatch(/set\('show/)
    // One list in groups: one reset, one help, a click on an alert in the preview hides it.
    expect(ALERTS).toMatch(
      /<AccordionSection[\s\S]*?:groups="groupHeads"[\s\S]*?preview-zone="alerts.alerts"/
    )
    expect(ALERTS.match(/<ElementEditor/g)).toHaveLength(2)
    const lights = contentOf(LIGHTS)
    for (const f of [
      'showTemps',
      'showRepairTime',
      'repairCrewTag',
      'repairRealTime',
      'labelSide'
    ]) {
      expect(lights, f).not.toContain(`'${f}'`)
      expect(LIGHTS, f).toContain(`'${f}'`)
    }
    // An element's option on its row: every row's stake on the stake column's.
    expect(contentOf(STANDINGS)).not.toContain('setDeltaAll')
    expect(STANDINGS).toMatch(/<template #extra="\{ id, visible \}">[\s\S]*?id === 'delta'/)
  })
})

describe('Avisos and Testigos: the events both have (R39)', () => {
  it("pairs each shared event's alert with its light, both ways", () => {
    expect(SHARED_EVENTS.map(([a]) => a)).toEqual([
      'showStalled',
      'showOilPressure',
      'showPitLimiter'
    ])
    for (const [alert, light] of SHARED_EVENTS) {
      expect(ALERTS_SPEC.ids).toContain(alert)
      expect(LIGHT_ORDER).toContain(light)
      expect(lightOfAlert(alert)).toBe(light)
      expect(alertOfLight(light)).toBe(alert)
    }
    // Only those: the flags have no light, the temperatures no alert.
    expect(lightOfAlert('showFlags')).toBeNull()
    expect(alertOfLight('water')).toBeNull()
  })

  it("turns a light on or off in Testigos' list, its place kept", () => {
    const lights = DEFAULT_SETTINGS.lights
    expect(lightShown(lights, 'pitLimiter')).toBe(false)
    const on = lightsPatch(lights, 'pitLimiter', true)
    expect(lightShown(on, 'pitLimiter')).toBe(true)
    expect(on.icons.map((e) => e.id)).toEqual(lights.icons.map((e) => e.id))
    expect(lightShown(lightsPatch(on, 'pitLimiter', false), 'pitLimiter')).toBe(false)
  })

  it('gives each page a box for the other on those rows, and a line with a button to it', () => {
    expect(ALERTS).toMatch(/<template #extra="\{ id \}">[\s\S]*?lightBox\(id\)/)
    expect(ALERTS).toMatch(/<SiblingLink[^>]*page="lights"/)
    expect(LIGHTS).toMatch(/<template #extra="\{ id \}">[\s\S]*?alertBox\(id\)/)
    expect(LIGHTS).toMatch(/<SiblingLink[^>]*page="alerts"/)
  })
})
