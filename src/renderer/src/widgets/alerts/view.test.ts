import { describe, expect, it } from 'vitest'
import { ALERT_ORDER, FLAG_ORDER, NOTICE_ORDER, OPTION_PARENT, showsNothing } from '@shared/alerts'
import { NBSP } from '@shared/format'
import { messagesFor } from '@shared/i18n'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { AlertNotice, AlertsData, FlagKind } from '@shared/types'
import { ICON_NAMES } from '@renderer/ui/icons'
import { incidentLineView } from './incident'
import { PREVIEW_ALERTS, PREVIEW_GALLERY } from './preview'
import {
  MAX_CHIPS,
  SHOW_ALL,
  alertFilter,
  flagViews,
  formatRise,
  formatTemp,
  hasAlerts,
  incidentHero,
  layoutKey,
  limiterHero,
  limiterView,
  noticeView,
  previewFilter,
  shownFlags,
  shownNotices,
  speedView,
  staticNoticeViews,
  toFlagsView,
  type AlertFilter,
  type FlagsView,
  type FlagView,
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
    notices: [],
    pitLimiter: null,
    speedKmh: 0,
    pitLimitKmh: 60,
    incident: null,
    ...over
  }
}

const filter = (over: Partial<AlertFilter> = {}): AlertFilter => ({ ...SHOW_ALL, ...over })

/** Flags only, metric, Spanish. */
const flagsView = (flags: FlagKind[], o: AlertFilter = SHOW_ALL, prev?: FlagsView): FlagsView =>
  toFlagsView({ flags }, o, 'metric', ES, prev)

/** One notice of each kind, with values. */
const EVERY_NOTICE: AlertNotice[] = [
  { kind: 'wrongWay' },
  { kind: 'pitEntry' },
  { kind: 'stalled' },
  { kind: 'oilPressure' },
  { kind: 'fuelPressure' },
  { kind: 'tow', seconds: 42 },
  { kind: 'water' },
  { kind: 'oilTemp' },
  { kind: 'lapsToGo', laps: 10 },
  { kind: 'engineTrend', fluid: 'water', tempC: 98, deltaC: 6, draft: true }
]

const text = (v: FlagView): string => [v.label, v.note].filter(Boolean).join(' · ')

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
      'furled',
      'blue',
      'white',
      'checkered',
      'green'
    ])
    expect(Object.keys(FLAG_VIEWS).sort()).toEqual([...FLAG_ORDER].sort())
    for (const k of FLAG_ORDER) expect(FLAG_VIEWS[k].kind).toBe(k)
  })

  it('says each flag in Spanish', () => {
    const t = (k: FlagKind): string => text(FLAG_VIEWS[k])
    expect(t('disqualified')).toBe('DESCALIFICADO')
    expect(t('black')).toBe('BANDERA NEGRA · entra en boxes')
    expect(t('meatball')).toBe('REPARACIÓN · entra en boxes')
    expect(t('red')).toBe('BANDERA ROJA · sesión detenida')
    expect(t('caution')).toBe('SAFETY CAR · no adelantes')
    expect(t('yellow')).toBe('AMARILLA · precaución')
    expect(t('debris')).toBe('RESTOS · en pista')
    // What the warning is for is not in the data; who gives it is, and it is no plain alert.
    expect(t('furled')).toBe('ADVERTENCIA · dirección de carrera')
    expect(t('blue')).toBe('AZUL · déjale pasar')
    expect(t('white')).toBe('ÚLTIMA VUELTA')
    expect(t('checkered')).toBe('BANDERA A CUADROS')
    expect(t('green')).toBe('VERDE · pista libre')
  })

  it('says each flag in English', () => {
    const en = flagViews(EN)
    const t = (k: FlagKind): string => text(en[k])
    expect(t('disqualified')).toBe('DISQUALIFIED')
    expect(t('black')).toBe('BLACK FLAG · pit now')
    expect(t('meatball')).toBe('MEATBALL · pit for repairs')
    expect(t('red')).toBe('RED FLAG · session stopped')
    expect(t('caution')).toBe('CAUTION · no overtaking')
    expect(t('yellow')).toBe('YELLOW FLAG · hazard ahead')
    expect(t('debris')).toBe('DEBRIS · on track')
    expect(t('furled')).toBe('WARNING · from race control')
    expect(t('blue')).toBe('BLUE FLAG · let them pass')
    expect(t('white')).toBe('LAST LAP')
    expect(t('checkered')).toBe('CHECKERED FLAG')
    expect(t('green')).toBe('GREEN FLAG · track clear')
    expect(en.blue.chip).toBe('BLUE')
    expect(en.checkered).toMatchObject({ short: 'CHECKERED', chip: 'CHECKERED' })
    // Same look in every language; the chip defaults to the label.
    for (const k of FLAG_ORDER) {
      expect(en[k]).toMatchObject({ kind: k, fill: FLAG_VIEWS[k].fill, mark: FLAG_VIEWS[k].mark })
      expect(en[k].chip, k).not.toBe('')
    }
    expect(toFlagsView({ flags: ['white', 'blue'] }, SHOW_ALL, 'metric', EN).primary).toBe(en.blue)
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
      furled: 'black',
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
    expect(FLAG_VIEWS.meatball).toMatchObject({ fill: 'black', mark: 'disc', icon: null })
    expect(FLAG_VIEWS.checkered.mark).toBe('checker')
    expect(FLAG_VIEWS.disqualified.mark).toBe('cross')
    expect(FLAG_VIEWS.debris.mark).toBe('stripes')
    expect(FLAG_VIEWS.furled.mark).toBe('halves')
    expect(FLAG_VIEWS.blue.mark).toBe('diagonal')
    expect(FLAG_VIEWS.caution.mark).toBe('hazard')
    // The plain ones carry the flag icon.
    expect(FLAG_VIEWS.black).toMatchObject({ mark: 'flag', icon: 'flag' })
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
    // A new language is a new band, even for the same flags.
    const es = flagsView(['blue'])
    expect(toFlagsView({ flags: ['blue'] }, SHOW_ALL, 'metric', EN, es)).not.toBe(es)
  })
})

describe('notice views', () => {
  const es = (n: AlertNotice): string => text(noticeView(n, 'metric', ES))
  const en = (n: AlertNotice): string => text(noticeView(n, 'metric', EN))

  it('says each alert in Spanish', () => {
    expect(EVERY_NOTICE.map(es)).toEqual([
      'SENTIDO CONTRARIO · da la vuelta',
      'PON LIMITADOR · entrada a boxes',
      'CALADO · arranca el motor',
      'PRESIÓN ACEITE · baja',
      'PRESIÓN GASOLINA · baja',
      `GRÚA${NB}0:42 · a boxes`,
      'TEMP. AGUA · alta',
      'TEMP. ACEITE · alta',
      `QUEDAN${NB}10${NB}V · para el final`,
      `AGUA 98${NB}°C ↑ · +6 vs tu media (¿rebufo?)`
    ])
  })

  it('says each alert in English', () => {
    expect(EVERY_NOTICE.map(en)).toEqual([
      'WRONG WAY · turn around',
      'LIMITER OFF · pit entry ahead',
      'STALLED · restart the engine',
      'OIL PRESSURE · low',
      'FUEL PRESSURE · low',
      `TOW${NB}0:42 · to the pits`,
      'WATER TEMP · too hot',
      'OIL TEMP · too hot',
      `10${NB}TO GO · laps left`,
      `WATER 98${NB}°C ↑ · +6 vs your average (slipstream?)`
    ])
  })

  it('words the engine trend in the chosen units, the hint only when it applies', () => {
    const trend: AlertNotice = {
      kind: 'engineTrend',
      fluid: 'oil',
      tempC: 121,
      deltaC: 7,
      draft: false
    }
    const v = noticeView(trend, 'metric', ES)
    expect(v).toMatchObject({
      label: `ACEITE 121${NB}°C ↑`,
      short: `ACEITE 121${NB}°C`,
      note: '+7 vs tu media',
      chip: `ACEITE +7${NB}°C`
    })
    expect(noticeView(trend, 'imperial', EN)).toMatchObject({
      label: `OIL 250${NB}°F ↑`,
      note: '+13 vs your average',
      chip: `OIL +13${NB}°F`
    })
    expect(formatTemp(98, 'metric')).toBe(`98${NB}°C`)
    expect(formatTemp(98, 'imperial')).toBe(`208${NB}°F`)
    expect(formatRise(-2, 'metric')).toBe('+0')
  })

  it('looks: alarms for what needs acting on now, quiet bands for the rest', () => {
    const looks = Object.fromEntries(
      EVERY_NOTICE.map((n) => [n.kind, noticeView(n, 'metric', ES).fill])
    )
    expect(looks).toEqual({
      wrongWay: 'alarm',
      pitEntry: 'alarm',
      stalled: 'alarm',
      oilPressure: 'alarm',
      water: 'alarm',
      oilTemp: 'alarm',
      fuelPressure: 'alarm',
      tow: 'warn',
      lapsToGo: 'info',
      engineTrend: 'warn'
    })
    for (const n of EVERY_NOTICE) {
      const v = noticeView(n, 'metric', ES)
      expect(v.mark).toBe('icon')
      expect(ICON_NAMES).toContain(v.icon)
      expect(v.ink).toBe(v.fill === 'alarm' ? 'alarm' : 'light')
    }
  })

  it('words what is meant even as a chip or without its note', () => {
    for (const m of [ES, EN]) {
      const chip = (n: AlertNotice): string => noticeView(n, 'metric', m).chip
      // The reminder to switch the limiter on never reads like the limiter-on line.
      expect(chip({ kind: 'pitEntry' })).not.toBe(m.widgets.alerts.limiterOn)
      expect(chip({ kind: 'pitEntry' })).not.toContain(`${m.widgets.alerts.limiterOn} `)
      // A temperature light is not the pressure one, nor the trend of the same fluid.
      const trend = (fluid: 'water' | 'oil'): string =>
        chip({ kind: 'engineTrend', fluid, tempC: 98, deltaC: 6, draft: false })
      for (const [light, fluid] of [
        ['water', 'water'],
        ['oilTemp', 'oil']
      ] as const) {
        const own = chip({ kind: light })
        expect(trend(fluid).startsWith(own), light).toBe(false)
        expect(chip({ kind: 'oilPressure' }).endsWith(own), light).toBe(false)
      }
    }
    // Laps to go says "to go" by itself (the note goes in chips and narrow windows).
    expect(noticeView({ kind: 'lapsToGo', laps: 5 }, 'metric', ES).chip).toBe(`QUEDAN${NB}5${NB}V`)
    expect(noticeView({ kind: 'lapsToGo', laps: 5 }, 'metric', EN).chip).toBe(`5${NB}TO GO`)
    // The furled flag says who warns, in a widget whose every line is an alert.
    expect(flagViews(ES).furled.label).not.toBe(ES.core.widgetTitles.alerts.toUpperCase())
    expect(flagViews(ES).furled.label).not.toBe('AVISO')
  })

  it('tells every alert apart by its words, in both languages, chips included', () => {
    for (const m of [ES, EN]) {
      const views = [
        ...FLAG_ORDER.map((k) => flagViews(m)[k]),
        ...EVERY_NOTICE.map((n) => noticeView(n, 'metric', m))
      ]
      expect(new Set(views.map((v) => v.label)).size).toBe(views.length)
      expect(new Set(views.map((v) => v.chip)).size).toBe(views.length)
      for (const v of views) {
        if (v.label.length > 13) expect(v.short.length, v.label).toBeGreaterThan(0)
        expect(v.short.length, v.label).toBeLessThanOrEqual(13)
      }
    }
  })

  it('keeps the views of the alerts without a value frozen, one set per language', () => {
    expect(noticeView({ kind: 'stalled' }, 'metric', ES)).toBe(staticNoticeViews(ES).stalled)
    expect(Object.isFrozen(staticNoticeViews(EN).water)).toBe(true)
  })
})

describe('alertFilter', () => {
  it('takes every on/off option and nothing else', () => {
    const toggles = Object.entries(OPTION_SCHEMA.alerts)
      .filter(([, s]) => s.kind === 'bool')
      .map(([k]) => k)
    expect(Object.keys(SHOW_ALL).sort()).toEqual(toggles.sort())
    const opts = { ...SHOW_ALL, showTow: false, holdS: 3 }
    expect(alertFilter(opts)).toEqual({ ...SHOW_ALL, showTow: false })
  })
})

describe('showsNothing', () => {
  const none = filter(
    Object.fromEntries(Object.keys(SHOW_ALL).map((k) => [k, false])) as Partial<AlertFilter>
  )

  it('is true with every option off, also with only the options that refine another on', () => {
    expect(showsNothing(none)).toBe(true)
    // The defaults of the greyed-out sub-options: still nothing to show.
    expect(
      showsNothing({ ...none, showBlue: true, showFurled: true, showPitOverspeed: true })
    ).toBe(true)
    expect(showsNothing(SHOW_ALL)).toBe(false)
  })

  it('is false with any option that shows something by itself', () => {
    for (const k of Object.keys(SHOW_ALL) as (keyof AlertFilter)[]) {
      const parent = OPTION_PARENT[k]
      expect(showsNothing({ ...none, [k]: true }), k).toBe(parent !== undefined)
      if (parent) expect(showsNothing({ ...none, [k]: true, [parent]: true }), k).toBe(false)
    }
    // Every sub-option is a greyed-out switch under the one it refines.
    expect(OPTION_PARENT).toEqual({
      showBlue: 'showFlags',
      showFurled: 'showFlags',
      showPitOverspeed: 'showPitLimiter'
    })
  })
})

describe('shownFlags', () => {
  it('sorts by priority and drops repeats and unknown kinds', () => {
    const flags = ['white', 'blue', 'yellow', 'blue', 'bogus'] as FlagKind[]
    expect(shownFlags(flags, SHOW_ALL)).toEqual(['yellow', 'blue', 'white'])
  })

  it('applies the options', () => {
    const flags: FlagKind[] = ['blue', 'white', 'furled']
    expect(shownFlags(flags, filter({ showBlue: false }))).toEqual(['furled', 'white'])
    expect(shownFlags(flags, filter({ showFurled: false }))).toEqual(['blue', 'white'])
    expect(shownFlags(flags, filter({ showFlags: false }))).toEqual([])
    expect(shownFlags([], SHOW_ALL)).toEqual([])
  })
})

describe('shownNotices', () => {
  it('sorts by priority, one per kind, and drops what it does not know', () => {
    const bogus = [
      { kind: 'bogus' },
      { kind: 'tow', seconds: Number.NaN },
      { kind: 'tow', seconds: 0 },
      { kind: 'lapsToGo', laps: 0 },
      { kind: 'engineTrend', fluid: 'fuel', tempC: 1, deltaC: 1, draft: false },
      null
    ] as unknown as AlertNotice[]
    expect(shownNotices(bogus, SHOW_ALL)).toEqual([])
    const sent: AlertNotice[] = [
      { kind: 'tow', seconds: 5 },
      { kind: 'water' },
      { kind: 'tow', seconds: 9 },
      { kind: 'wrongWay' }
    ]
    expect(shownNotices(sent, SHOW_ALL)).toEqual([
      { kind: 'wrongWay' },
      { kind: 'tow', seconds: 5 },
      { kind: 'water' }
    ])
    expect(shownNotices([...EVERY_NOTICE].reverse(), SHOW_ALL).map((n) => n.kind)).toEqual([
      ...NOTICE_ORDER
    ])
  })

  it('applies each option', () => {
    const off = (o: Partial<AlertFilter>): string[] =>
      shownNotices(EVERY_NOTICE, filter(o)).map((n) => n.kind)
    expect(off({ showWrongWay: false })).not.toContain('wrongWay')
    expect(off({ showPitEntry: false })).not.toContain('pitEntry')
    expect(off({ showStalled: false })).not.toContain('stalled')
    expect(off({ showTow: false })).not.toContain('tow')
    expect(off({ showLapsToGo: false })).not.toContain('lapsToGo')
    expect(off({ showEngineTrend: false })).not.toContain('engineTrend')
    expect(off({ showEngineWarnings: false })).toEqual([
      'wrongWay',
      'pitEntry',
      'stalled',
      'tow',
      'lapsToGo',
      'engineTrend'
    ])
    // The flags' option is not theirs.
    expect(off({ showFlags: false })).toHaveLength(EVERY_NOTICE.length)
  })
})

describe('toFlagsView', () => {
  it('puts the most important flag in the band and the next ones in chips', () => {
    const v = flagsView(['white', 'black', 'yellow'])
    expect(v.primary).toBe(FLAG_VIEWS.black)
    expect(v.secondary).toEqual([FLAG_VIEWS.yellow, FLAG_VIEWS.white])
  })

  it('ranks flags and notices together (ALERT_ORDER)', () => {
    const v = toFlagsView(
      {
        flags: ['yellow', 'black'],
        notices: [{ kind: 'wrongWay' }, { kind: 'lapsToGo', laps: 5 }]
      },
      SHOW_ALL,
      'metric',
      ES
    )
    expect(v.primary?.kind).toBe('wrongWay')
    expect(v.secondary.map((f) => f.kind)).toEqual(['black', 'yellow', 'lapsToGo'])
    // A temperature light can stay on for laps: the yellow and the blue flags keep the band.
    for (const m of [ES, EN]) {
      for (const [flag, light] of [
        ['yellow', 'water'],
        ['blue', 'oilTemp'],
        ['debris', 'water']
      ] as const) {
        const w = toFlagsView({ flags: [flag], notices: [{ kind: light }] }, SHOW_ALL, 'metric', m)
        expect([w.primary?.kind, ...w.secondary.map((f) => f.kind)]).toEqual([flag, light])
      }
      // The pressures (the engine about to fail) still come first.
      const p = toFlagsView(
        { flags: ['yellow'], notices: [{ kind: 'oilPressure' }] },
        SHOW_ALL,
        'metric',
        m
      )
      expect(p.primary?.kind).toBe('oilPressure')
    }
    const all = toFlagsView(
      { flags: [...FLAG_ORDER], notices: EVERY_NOTICE },
      SHOW_ALL,
      'metric',
      ES,
      undefined,
      Number.POSITIVE_INFINITY
    )
    // (Covering a flag by another is the provider's: here every kind sent is drawn.)
    expect([all.primary, ...all.secondary].map((f) => f?.kind)).toEqual([...ALERT_ORDER])
  })

  it(`shows at most ${MAX_CHIPS} chips`, () => {
    const v = flagsView([...FLAG_ORDER])
    expect(v.primary?.kind).toBe('disqualified')
    expect(v.secondary.map((f) => f.kind)).toEqual(FLAG_ORDER.slice(1, 1 + MAX_CHIPS))
  })

  it('is empty without alerts', () => {
    const v = flagsView([])
    expect(v).toEqual({ primary: null, secondary: [] })
    expect(flagsView(['blue'], filter({ showBlue: false }))).toBe(v)
  })

  it('keeps the previous object while the same alerts say the same', () => {
    const a = flagsView(['blue', 'white'])
    expect(flagsView(['white', 'blue'], SHOW_ALL, a)).toBe(a)
    expect(flagsView(['blue'], SHOW_ALL, a)).not.toBe(a)
    expect(flagsView(['yellow', 'white'], SHOW_ALL, a)).not.toBe(a)
    // A countdown is a new view each second, the same within it.
    const tow = (seconds: number, prev?: FlagsView): FlagsView =>
      toFlagsView({ flags: [], notices: [{ kind: 'tow', seconds }] }, SHOW_ALL, 'metric', ES, prev)
    const t42 = tow(42)
    expect(tow(42, t42)).toBe(t42)
    const t41 = tow(41, t42)
    expect(t41).not.toBe(t42)
    expect(t41.primary?.label).toBe(`GRÚA${NB}0:41`)
  })
})

describe('speedView', () => {
  const join = (v: { speed: string; unit: string }): string => `${v.speed}${NB}${v.unit}`

  it('shows the speed against the limit', () => {
    expect(speedView(58.4, 60, 'metric')).toEqual({ speed: `58${NB}/${NB}60`, unit: 'km/h' })
    expect(join(speedView(64, 60, 'metric', true))).toBe(`64${NB}/${NB}60${NB}km/h`)
  })

  it('converts to the chosen units', () => {
    expect(join(speedView(72.42, 72.42, 'imperial'))).toBe(`45${NB}/${NB}45${NB}mph`)
  })

  it('shows only the speed while the limit is unknown', () => {
    expect(join(speedView(58, null, 'metric'))).toBe(`58${NB}km/h`)
    expect(join(speedView(58, 0, 'metric'))).toBe(`58${NB}km/h`)
    expect(join(speedView(58, Number.NaN, 'imperial'))).toBe(`36${NB}mph`)
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
    expect(limiterView(d('offSpeeding', 68), SHOW_ALL, 'metric', EN)).toMatchObject({
      label: 'SPEEDING',
      note: 'LIMITER OFF'
    })
  })

  it('says what the limiter is doing', () => {
    expect(limiterView(d('on'), SHOW_ALL, 'metric', ES)).toEqual({
      state: 'on',
      icon: 'check',
      label: 'LIMITADOR',
      note: '',
      speed: `58${NB}/${NB}60`,
      unit: 'km/h'
    })
    expect(limiterView(d('off', 59), SHOW_ALL, 'metric', ES)).toMatchObject({
      state: 'off',
      icon: 'warning',
      label: 'LIMITADOR OFF',
      note: ''
    })
    expect(limiterView(d('speeding', 64), SHOW_ALL, 'metric', ES)).toEqual({
      state: 'speeding',
      icon: 'alert',
      label: 'EXCESO',
      note: '',
      speed: `64${NB}/${NB}60`,
      unit: 'km/h'
    })
    // 'EXCESO 68 / 60 · LIMITADOR OFF'.
    expect(limiterView(d('offSpeeding', 68), SHOW_ALL, 'metric', ES)).toEqual({
      state: 'offSpeeding',
      icon: 'warning',
      label: 'EXCESO',
      note: 'LIMITADOR OFF',
      speed: `68${NB}/${NB}60`,
      unit: 'km/h'
    })
    expect(limiterView(d('on'), SHOW_ALL, 'imperial', ES)?.unit).toBe('mph')
  })

  it('without its option, over the limit with the limiter off is just off', () => {
    expect(
      limiterView(d('offSpeeding', 68), filter({ showPitOverspeed: false }), 'metric', ES)
    ).toMatchObject({ state: 'off', label: 'LIMITADOR OFF', note: '' })
  })

  it('uses icons of the kit', () => {
    for (const s of ['on', 'off', 'offSpeeding', 'speeding'] as const) {
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
    expect(hasAlerts(alerts({ notices: [{ kind: 'stalled' }] }), SHOW_ALL)).toBe(true)
    expect(hasAlerts(alerts({ visible: false, flags: ['yellow'] }), SHOW_ALL)).toBe(false)
    expect(hasAlerts(alerts(), SHOW_ALL)).toBe(false)
  })

  it('applies the options', () => {
    expect(hasAlerts(alerts({ flags: ['blue'] }), filter({ showBlue: false }))).toBe(false)
    expect(hasAlerts(alerts({ flags: ['red'] }), filter({ showFlags: false }))).toBe(false)
    const pit = alerts({ pitLimiter: 'on' })
    expect(hasAlerts(pit, filter({ showPitLimiter: false }))).toBe(false)
    expect(hasAlerts(pit, filter({ showFlags: false }))).toBe(true)
    const tow = alerts({ notices: [{ kind: 'tow', seconds: 3 }] })
    expect(hasAlerts(tow, filter({ showTow: false }))).toBe(false)
  })
})

describe('limiter size and layout', () => {
  const lim = (s: AlertsData['pitLimiter']): LimiterView | null =>
    limiterView(alerts({ pitLimiter: s, speedKmh: 58 }), SHOW_ALL, 'metric', ES)
  const on = lim('on')
  const off = lim('off')
  const over = lim('speeding')
  const offOver = lim('offSpeeding')
  const yellow = flagsView(['yellow'])
  const blue = flagsView(['blue'])
  const two = flagsView(['blue', 'white'])
  const none = flagsView([])

  it('draws the limiter as large as the flag band alone or as an alarm', () => {
    expect(limiterHero(none, on)).toBe(true)
    expect(limiterHero(yellow, on)).toBe(false)
    expect(limiterHero(yellow, off)).toBe(true)
    expect(limiterHero(yellow, over)).toBe(true)
    expect(limiterHero(yellow, offOver)).toBe(true)
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
  it('fills the band, the chips, the incident line and the limiter line in edit mode', () => {
    const flags = toFlagsView(PREVIEW_ALERTS, SHOW_ALL, 'metric', ES)
    expect(flags.primary?.kind).toBe('yellow')
    // Not the last lap next to "5 laps to go": a sample that reads as possible.
    expect(flags.secondary.map((f) => f.kind)).toEqual(['blue', 'lapsToGo', 'engineTrend'])
    expect(limiterView(PREVIEW_ALERTS, SHOW_ALL, 'metric', ES)?.state).toBe('on')
    expect(PREVIEW_ALERTS.incident).toMatchObject({ points: 2, kind: 'loss-of-control' })
    expect(Object.isFrozen(PREVIEW_ALERTS)).toBe(true)
  })

  it('shows every alert in the settings sample, each with its option', () => {
    const all = toFlagsView(
      PREVIEW_GALLERY,
      SHOW_ALL,
      'metric',
      ES,
      undefined,
      Number.POSITIVE_INFINITY
    )
    const shown = [all.primary, ...all.secondary].map((f) => f?.kind)
    expect(new Set(shown)).toEqual(new Set([...NOTICE_ORDER, ...PREVIEW_GALLERY.flags]))
    expect(limiterView(PREVIEW_GALLERY, SHOW_ALL, 'metric', ES)).toMatchObject({
      state: 'offSpeeding',
      speed: `68${NB}/${NB}60`
    })
    expect(incidentLineView(PREVIEW_GALLERY.incident, true, ES)?.points).toBe('+2x')
    // Every on/off option takes something away from it.
    const allLimiter = limiterView(PREVIEW_GALLERY, SHOW_ALL, 'metric', ES)
    const allIncident = incidentLineView(PREVIEW_GALLERY.incident, true, ES)
    for (const k of Object.keys(SHOW_ALL) as (keyof AlertFilter)[]) {
      const o = filter({ [k]: false })
      const v = toFlagsView(PREVIEW_GALLERY, o, 'metric', ES, all, Number.POSITIVE_INFINITY)
      const l = limiterView(PREVIEW_GALLERY, o, 'metric', ES)
      const i = incidentLineView(PREVIEW_GALLERY.incident, o.showIncidents, ES)
      const same =
        v === all &&
        l?.state === 'offSpeeding' &&
        layoutKey(v, l, i) === layoutKey(all, allLimiter, allIncident)
      expect(same, k).toBe(false)
    }
  })

  it('follows the options, unless they hide everything', () => {
    const noBlue = filter({ showBlue: false })
    expect(previewFilter(PREVIEW_ALERTS, noBlue)).toBe(noBlue)
    expect(toFlagsView(PREVIEW_ALERTS, noBlue, 'metric', ES).secondary.map((f) => f.kind)).toEqual([
      'lapsToGo',
      'engineTrend'
    ])
    const off = filter(
      Object.fromEntries(Object.keys(SHOW_ALL).map((k) => [k, false])) as Partial<AlertFilter>
    )
    expect(previewFilter(PREVIEW_ALERTS, off)).toBe(SHOW_ALL)
    // The incident line alone is something to show.
    const incidentsOnly = { ...off, showIncidents: true }
    expect(previewFilter(PREVIEW_ALERTS, incidentsOnly)).toBe(incidentsOnly)
    // Only the notices on: the sample still shows them.
    const notices = filter({ showFlags: false, showPitLimiter: false })
    expect(previewFilter(PREVIEW_ALERTS, notices)).toBe(notices)
    expect(toFlagsView(PREVIEW_ALERTS, notices, 'metric', ES).primary?.kind).toBe('lapsToGo')
  })
})

describe('incident line', () => {
  const incident = {
    points: 2,
    kind: 'loss-of-control',
    lap: 5,
    sector: 3,
    surface: 'gravel'
  } as const
  const line = incidentLineView(incident, true, ES)

  it('counts as content only with its option on', () => {
    expect(hasAlerts(alerts({ incident }), filter())).toBe(true)
    expect(hasAlerts(alerts({ incident }), filter({ showIncidents: false }))).toBe(false)
    expect(hasAlerts(alerts({ incident: { ...incident, points: 0 } }), filter())).toBe(false)
    expect(hasAlerts(alerts({ incident, visible: false }), filter())).toBe(false)
  })

  it('is as large as a flag only when it is alone', () => {
    const flags = flagsView(['yellow'])
    const none = flagsView([])
    const on = limiterView(alerts({ pitLimiter: 'on' }), SHOW_ALL, 'metric', ES)
    expect(incidentHero(none, line, null)).toBe(true)
    expect(incidentHero(flags, line, null)).toBe(false)
    expect(incidentHero(none, line, on)).toBe(false)
    expect(incidentHero(none, null, null)).toBe(false)
  })

  it('changes the layout key: none, normal, hero', () => {
    const flags = flagsView(['yellow'])
    const none = flagsView([])
    const keys = [layoutKey(flags, null), layoutKey(flags, null, line), layoutKey(none, null, line)]
    expect(new Set(keys).size).toBe(3)
    expect(layoutKey(flags, null, null)).toBe(layoutKey(flags, null))
  })
})
