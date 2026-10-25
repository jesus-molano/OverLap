import { describe, expect, it } from 'vitest'
import { FLAG_ORDER } from '@shared/alerts'
import { NBSP } from '@shared/format'
import { messagesFor } from '@shared/i18n'
import type { AlertsData, FlagKind } from '@shared/types'
import { ICON_NAMES } from '@renderer/ui/icons'
import { PREVIEW_ALERTS } from './preview'
import {
  MAX_CHIPS,
  SHOW_ALL,
  flagViews,
  hasAlerts,
  layoutKey,
  limiterHero,
  limiterView,
  previewFilter,
  shownFlags,
  speedView,
  toFlagsView,
  type AlertFilter,
  type LimiterView
} from './view'

const NB = NBSP
const ES = messagesFor('es')
const EN = messagesFor('en')
const FLAG_VIEWS = flagViews(ES)

function alerts(over: Partial<AlertsData> = {}): AlertsData {
  return {
    visible: true,
    flags: [],
    pitLimiter: null,
    speedKmh: 0,
    pitLimitKmh: 60,
    ...over
  }
}

const filter = (over: Partial<AlertFilter> = {}): AlertFilter => ({ ...SHOW_ALL, ...over })

describe('flag views', () => {
  it('has one view per flag, most important first', () => {
    expect(FLAG_ORDER).toEqual([
      'disqualified',
      'black',
      'meatball',
      'red',
      'caution',
      'yellow',
      'debris',
      'blue',
      'white',
      'checkered',
      'green'
    ])
    expect(Object.keys(FLAG_VIEWS).sort()).toEqual([...FLAG_ORDER].sort())
    for (const k of FLAG_ORDER) expect(FLAG_VIEWS[k].kind).toBe(k)
  })

  it('says each flag in Spanish', () => {
    const text = (k: FlagKind): string =>
      [FLAG_VIEWS[k].label, FLAG_VIEWS[k].note].filter(Boolean).join(' · ')
    expect(text('disqualified')).toBe('DESCALIFICADO')
    expect(text('black')).toBe('BANDERA NEGRA · entra en boxes')
    expect(text('meatball')).toBe('REPARACIÓN · entra en boxes')
    expect(text('red')).toBe('BANDERA ROJA · sesión detenida')
    expect(text('caution')).toBe('SAFETY CAR · no adelantes')
    expect(text('yellow')).toBe('AMARILLA · precaución')
    expect(text('debris')).toBe('RESTOS · en pista')
    expect(text('blue')).toBe('AZUL · déjale pasar')
    expect(text('white')).toBe('ÚLTIMA VUELTA')
    expect(text('checkered')).toBe('BANDERA A CUADROS')
    expect(text('green')).toBe('VERDE · pista libre')
  })

  it('says each flag in English', () => {
    const en = flagViews(EN)
    const text = (k: FlagKind): string => [en[k].label, en[k].note].filter(Boolean).join(' · ')
    expect(text('disqualified')).toBe('DISQUALIFIED')
    expect(text('black')).toBe('BLACK FLAG · pit now')
    expect(text('meatball')).toBe('MEATBALL · pit for repairs')
    expect(text('red')).toBe('RED FLAG · session stopped')
    expect(text('caution')).toBe('CAUTION · no overtaking')
    expect(text('yellow')).toBe('YELLOW FLAG · hazard ahead')
    expect(text('debris')).toBe('DEBRIS · on track')
    expect(text('blue')).toBe('BLUE FLAG · let them pass')
    expect(text('white')).toBe('LAST LAP')
    expect(text('checkered')).toBe('CHECKERED FLAG')
    expect(text('green')).toBe('GREEN FLAG · track clear')
    expect(en.blue.chip).toBe('BLUE')
    expect(en.checkered).toMatchObject({ short: 'CHECKERED', chip: 'CHECKERED' })
    // Same look in every language; the chip defaults to the label.
    for (const k of FLAG_ORDER) {
      expect(en[k]).toMatchObject({ kind: k, fill: FLAG_VIEWS[k].fill, mark: FLAG_VIEWS[k].mark })
      expect(en[k].chip, k).not.toBe('')
    }
    expect(toFlagsView(['white', 'blue'], SHOW_ALL, EN).primary).toBe(en.blue)
  })

  it('has a short label only where the long one does not fit a narrow window', () => {
    expect(FLAG_VIEWS.checkered.short).toBe('A CUADROS')
    for (const views of [FLAG_VIEWS, flagViews(EN)]) {
      for (const k of FLAG_ORDER) {
        const { label, short } = views[k]
        // 13 characters fit the narrowest window at the narrow font size.
        if (label.length > 13) expect(short.length, k).toBeGreaterThan(0)
        else expect(short, k).toBe('')
        expect(short.length, k).toBeLessThanOrEqual(13)
      }
    }
  })

  it('paints each flag in its own colour, with readable ink', () => {
    const fills = Object.fromEntries(FLAG_ORDER.map((k) => [k, FLAG_VIEWS[k].fill]))
    expect(fills).toEqual({
      disqualified: 'black',
      black: 'black',
      meatball: 'black',
      red: 'red',
      caution: 'yellow',
      yellow: 'yellow',
      debris: 'yellow',
      blue: 'blue',
      white: 'white',
      checkered: 'black',
      green: 'green'
    })
    for (const k of FLAG_ORDER) {
      const { fill, ink } = FLAG_VIEWS[k]
      expect(ink, k).toBe(['black', 'red', 'blue'].includes(fill) ? 'light' : 'dark')
    }
  })

  it('draws the special flags like the real ones', () => {
    expect(FLAG_VIEWS.meatball).toMatchObject({ fill: 'black', mark: 'disc' })
    expect(FLAG_VIEWS.checkered.mark).toBe('checker')
    expect(FLAG_VIEWS.disqualified.mark).toBe('cross')
    expect(FLAG_VIEWS.debris.mark).toBe('stripes')
    expect(FLAG_VIEWS.blue.mark).toBe('diagonal')
    expect(FLAG_VIEWS.caution.mark).toBe('hazard')
  })

  it('tells every flag apart without its colour (colour-blind palette)', () => {
    for (const views of [FLAG_VIEWS, flagViews(EN)]) {
      const labels = FLAG_ORDER.map((k) => views[k].label)
      const chips = FLAG_ORDER.map((k) => views[k].chip)
      expect(new Set(labels).size).toBe(FLAG_ORDER.length)
      expect(new Set(chips).size).toBe(FLAG_ORDER.length)
    }
    // Same colour: a different mark, so even the shape differs.
    const looks = FLAG_ORDER.map((k) => `${FLAG_VIEWS[k].fill}/${FLAG_VIEWS[k].mark}`)
    expect(new Set(looks).size).toBe(FLAG_ORDER.length)
  })

  it('keeps the views frozen and stable, one set per language', () => {
    expect(Object.isFrozen(FLAG_VIEWS.blue)).toBe(true)
    expect(flagViews(ES).blue).toBe(FLAG_VIEWS.blue)
    expect(flagViews(EN).blue).not.toBe(FLAG_VIEWS.blue)
    // A new language is a new pill, even for the same flags.
    const es = toFlagsView(['blue'], SHOW_ALL, ES)
    expect(toFlagsView(['blue'], SHOW_ALL, EN, es)).not.toBe(es)
  })
})

describe('shownFlags', () => {
  it('sorts by priority and drops repeats and unknown kinds', () => {
    const flags = ['white', 'blue', 'yellow', 'blue', 'bogus'] as FlagKind[]
    expect(shownFlags(flags, SHOW_ALL)).toEqual(['yellow', 'blue', 'white'])
  })

  it('applies the options', () => {
    const flags: FlagKind[] = ['blue', 'white']
    expect(shownFlags(flags, filter({ showBlue: false }))).toEqual(['white'])
    expect(shownFlags(flags, filter({ showFlags: false }))).toEqual([])
    expect(shownFlags([], SHOW_ALL)).toEqual([])
  })
})

describe('toFlagsView', () => {
  it('puts the most important flag in the pill and the next ones in chips', () => {
    const v = toFlagsView(['white', 'black', 'yellow'], SHOW_ALL, ES)
    expect(v.primary).toBe(FLAG_VIEWS.black)
    expect(v.secondary).toEqual([FLAG_VIEWS.yellow, FLAG_VIEWS.white])
  })

  it(`shows at most ${MAX_CHIPS} chips`, () => {
    const v = toFlagsView([...FLAG_ORDER], SHOW_ALL, ES)
    expect(v.primary?.kind).toBe('disqualified')
    expect(v.secondary.map((f) => f.kind)).toEqual(FLAG_ORDER.slice(1, 1 + MAX_CHIPS))
  })

  it('is empty without flags', () => {
    const v = toFlagsView([], SHOW_ALL, ES)
    expect(v).toEqual({ primary: null, secondary: [] })
    expect(toFlagsView(['blue'], filter({ showBlue: false }), ES)).toBe(v)
  })

  it('keeps the previous object while the same flags are shown', () => {
    const a = toFlagsView(['blue', 'white'], SHOW_ALL, ES)
    expect(toFlagsView(['white', 'blue'], SHOW_ALL, ES, a)).toBe(a)
    expect(toFlagsView(['blue'], SHOW_ALL, ES, a)).not.toBe(a)
    expect(toFlagsView(['yellow', 'white'], SHOW_ALL, ES, a)).not.toBe(a)
  })
})

describe('speedView', () => {
  const text = (v: { speed: string; unit: string }): string => `${v.speed}${NB}${v.unit}`

  it('shows the speed against the limit', () => {
    expect(speedView(58.4, 60, 'metric')).toEqual({ speed: `58${NB}/${NB}60`, unit: 'km/h' })
    expect(text(speedView(64, 60, 'metric', true))).toBe(`64${NB}/${NB}60${NB}km/h`)
  })

  it('converts to the chosen units', () => {
    expect(text(speedView(72.42, 72.42, 'imperial'))).toBe(`45${NB}/${NB}45${NB}mph`)
  })

  it('shows only the speed while the limit is unknown', () => {
    expect(text(speedView(58, null, 'metric'))).toBe(`58${NB}km/h`)
    expect(text(speedView(58, 0, 'metric'))).toBe(`58${NB}km/h`)
    expect(text(speedView(58, Number.NaN, 'imperial'))).toBe(`36${NB}mph`)
  })

  it('never reads under the limit while over it', () => {
    expect(speedView(60.3, 60, 'metric', true).speed).toBe(`61${NB}/${NB}60`)
    expect(speedView(60.3, 60, 'metric').speed).toBe(`60${NB}/${NB}60`)
  })

  it('shows 0 for unusable speeds', () => {
    expect(speedView(Number.NaN, 60, 'metric').speed).toBe(`0${NB}/${NB}60`)
    expect(speedView(-3, 60, 'metric').speed).toBe(`0${NB}/${NB}60`)
  })
})

describe('limiterView', () => {
  const d = (pitLimiter: AlertsData['pitLimiter'], speedKmh = 58): AlertsData =>
    alerts({ pitLimiter, speedKmh })

  it('says it in English', () => {
    expect(limiterView(d('on'), SHOW_ALL, 'metric', EN)?.label).toBe('PIT LIMITER')
    expect(limiterView(d('off', 71), SHOW_ALL, 'metric', EN)?.label).toBe('LIMITER OFF')
    expect(limiterView(d('speeding', 64), SHOW_ALL, 'imperial', EN)).toMatchObject({
      label: 'SPEEDING',
      unit: 'mph'
    })
  })

  it('says what the limiter is doing', () => {
    expect(limiterView(d('on'), SHOW_ALL, 'metric', ES)).toEqual({
      state: 'on',
      icon: 'check',
      label: 'LIMITADOR',
      speed: `58${NB}/${NB}60`,
      unit: 'km/h'
    })
    expect(limiterView(d('off', 71), SHOW_ALL, 'metric', ES)).toMatchObject({
      state: 'off',
      icon: 'warning',
      label: 'LIMITADOR OFF'
    })
    expect(limiterView(d('speeding', 64), SHOW_ALL, 'metric', ES)).toEqual({
      state: 'speeding',
      icon: 'alert',
      label: 'EXCESO',
      speed: `64${NB}/${NB}60`,
      unit: 'km/h'
    })
    expect(limiterView(d('on'), SHOW_ALL, 'imperial', ES)?.unit).toBe('mph')
  })

  it('uses icons of the kit', () => {
    for (const s of ['on', 'off', 'speeding'] as const) {
      expect(ICON_NAMES).toContain(limiterView(d(s), SHOW_ALL, 'metric', ES)?.icon)
    }
  })

  it('is null off pit road, when turned off or for an unknown state', () => {
    expect(limiterView(d(null), SHOW_ALL, 'metric', ES)).toBeNull()
    expect(limiterView(d('on'), filter({ showPitLimiter: false }), 'metric', ES)).toBeNull()
    const bogus = d('bogus' as AlertsData['pitLimiter'])
    expect(limiterView(bogus, SHOW_ALL, 'metric', ES)).toBeNull()
  })
})

describe('hasAlerts', () => {
  it('needs a visible payload with something the options show', () => {
    expect(hasAlerts(alerts({ flags: ['yellow'] }), SHOW_ALL)).toBe(true)
    expect(hasAlerts(alerts({ pitLimiter: 'off' }), SHOW_ALL)).toBe(true)
    expect(hasAlerts(alerts({ visible: false, flags: ['yellow'] }), SHOW_ALL)).toBe(false)
    expect(hasAlerts(alerts(), SHOW_ALL)).toBe(false)
  })

  it('applies the options', () => {
    expect(hasAlerts(alerts({ flags: ['blue'] }), filter({ showBlue: false }))).toBe(false)
    expect(hasAlerts(alerts({ flags: ['red'] }), filter({ showFlags: false }))).toBe(false)
    const pit = alerts({ pitLimiter: 'on' })
    expect(hasAlerts(pit, filter({ showPitLimiter: false }))).toBe(false)
    expect(hasAlerts(pit, filter({ showFlags: false }))).toBe(true)
  })
})

describe('limiter size and layout', () => {
  const lim = (s: AlertsData['pitLimiter']): LimiterView | null =>
    limiterView(alerts({ pitLimiter: s, speedKmh: 58 }), SHOW_ALL, 'metric', ES)
  const on = lim('on')
  const off = lim('off')
  const over = lim('speeding')
  const yellow = toFlagsView(['yellow'], SHOW_ALL, ES)
  const blue = toFlagsView(['blue'], SHOW_ALL, ES)
  const two = toFlagsView(['blue', 'white'], SHOW_ALL, ES)
  const none = toFlagsView([], SHOW_ALL, ES)

  it('draws the limiter as large as the pill alone or as an alarm', () => {
    expect(limiterHero(none, on)).toBe(true)
    expect(limiterHero(yellow, on)).toBe(false)
    expect(limiterHero(yellow, off)).toBe(true)
    expect(limiterHero(yellow, over)).toBe(true)
    expect(limiterHero(yellow, null)).toBe(false)
  })

  it('changes the layout key with the rows, not with what they say', () => {
    expect(layoutKey(yellow, null)).toBe(layoutKey(blue, null))
    expect(layoutKey(yellow, off)).toBe(layoutKey(blue, over))
    expect(layoutKey(none, on)).toBe(layoutKey(none, off))
    const keys = [
      layoutKey(yellow, null),
      layoutKey(two, null),
      layoutKey(yellow, on),
      layoutKey(yellow, off),
      layoutKey(none, on)
    ]
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('preview', () => {
  it('fills the pill, the chips and the limiter line', () => {
    const flags = toFlagsView(PREVIEW_ALERTS.flags, SHOW_ALL, ES)
    expect(flags.primary?.kind).toBe('yellow')
    expect(flags.secondary.map((f) => f.kind)).toEqual(['blue', 'white'])
    expect(limiterView(PREVIEW_ALERTS, SHOW_ALL, 'metric', ES)?.state).toBe('on')
    expect(Object.isFrozen(PREVIEW_ALERTS)).toBe(true)
  })

  it('follows the options, unless they hide everything', () => {
    const noBlue = filter({ showBlue: false })
    expect(previewFilter(PREVIEW_ALERTS, noBlue)).toBe(noBlue)
    expect(toFlagsView(PREVIEW_ALERTS.flags, noBlue, ES).secondary).toEqual([FLAG_VIEWS.white])
    const off = filter({ showFlags: false, showPitLimiter: false })
    expect(previewFilter(PREVIEW_ALERTS, off)).toBe(SHOW_ALL)
  })
})
