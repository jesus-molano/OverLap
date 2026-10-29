import { describe, expect, it } from 'vitest'
import { visibleIds } from '@shared/elements'
import { messagesFor } from '@shared/i18n'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { TrafficData, TrafficEntry } from '@shared/types'
import { reuseViews, shallowEqual } from '@renderer/view/reuse'
import { createDriverStyles } from '@renderer/view/styles'
import { PREVIEW_TRAFFIC, previewOptions } from './preview'
import {
  BLUE_BAD_S,
  BLUE_WARN_S,
  GROUP_ORDER,
  PASSING_ETA_S,
  PASSING_GAP_S,
  SOON_S,
  URGENT_S,
  blueUrgency,
  classLabel,
  etaParts,
  gapParts,
  groupCaption,
  hasClasses,
  hasSectors,
  hasTraffic,
  hazardTone,
  layoutKey,
  sectorLabel,
  toRowSlot,
  toSlots,
  showsPassingGap,
  urgency,
  visibleGroups,
  worseUrgency,
  type RowSlotView,
  type TrafficSlotView,
  type TrafficViewOptions
} from './view'

const ES = messagesFor('es')
const EN = messagesFor('en')

function entry(over: Partial<TrafficEntry> = {}): TrafficEntry {
  return {
    driver: {
      carIdx: 7,
      carNumber: '7',
      driverName: 'Ana López',
      classColor: '#ff5888',
      iRating: 3100,
      licString: 'A 2.50',
      licColor: '#0153db',
      brand: 'unknown',
      country: ''
    },
    kind: 'faster',
    className: 'GTP',
    gapS: -0.4,
    etaS: 6.3,
    meetPct: 0.4,
    meetSector: 2,
    lapping: false,
    passing: null,
    hazard: null,
    ...over
  }
}

function traffic(over: Partial<TrafficData> = {}): TrafficData {
  return { visible: true, faster: [], slower: [], hazards: [], info: null, ...over }
}

const OPTS: TrafficViewOptions = {
  groups: ['hazard', 'slower', 'faster'],
  captions: true,
  maxEntries: 3,
  nameFormat: 'abbr'
}

const rows = (slots: readonly TrafficSlotView[]): RowSlotView[] =>
  slots.filter((s): s is RowSlotView => s.kind === 'row')

describe('urgency', () => {
  it('bad under 3 s, warn under 8 s, idle when not converging', () => {
    expect(urgency(0)).toBe('bad')
    expect(urgency(URGENT_S - 0.01)).toBe('bad')
    expect(urgency(URGENT_S)).toBe('warn')
    expect(urgency(SOON_S - 0.01)).toBe('warn')
    expect(urgency(SOON_S)).toBe('normal')
    expect(urgency(42)).toBe('normal')
    expect(urgency(null)).toBe('idle')
    expect(urgency(NaN)).toBe('idle')
    expect(urgency(Infinity)).toBe('idle')
  })
})

describe('blueUrgency / worseUrgency', () => {
  it('by the gap to a car passing you: under 1 s bad, under 2 s warn', () => {
    expect(blueUrgency(0)).toBe('bad')
    expect(blueUrgency(-(BLUE_BAD_S - 0.1))).toBe('bad')
    expect(blueUrgency(-BLUE_BAD_S)).toBe('warn')
    expect(blueUrgency(-(BLUE_WARN_S - 0.1))).toBe('warn')
    expect(blueUrgency(-BLUE_WARN_S)).toBe('normal')
    expect(blueUrgency(NaN)).toBe('normal')
  })

  it('takes the more urgent', () => {
    expect(worseUrgency('normal', 'bad')).toBe('bad')
    expect(worseUrgency('warn', 'normal')).toBe('warn')
    expect(worseUrgency('idle', 'normal')).toBe('normal')
    expect(worseUrgency('bad', 'warn')).toBe('bad')
  })
})

describe('showsPassingGap', () => {
  it('a car passing you that is close or closing slowly reads its gap', () => {
    const at = (
      gapS: number,
      etaS: number | null,
      passing: 'lap' | 'blue' | null = 'lap'
    ): boolean => showsPassingGap({ passing, gapS, etaS })
    expect(at(-(PASSING_GAP_S - 0.1), 5)).toBe(true)
    expect(at(-PASSING_GAP_S, 5)).toBe(false)
    expect(at(-5, PASSING_ETA_S + 1)).toBe(true)
    expect(at(-5, PASSING_ETA_S)).toBe(false)
    expect(at(-5, null)).toBe(true)
    // Listed for its pace: always the ETA.
    expect(at(-0.3, 50, null)).toBe(false)
  })
})

describe('hazardTone', () => {
  it('is the worse of the ETA and the kind, never calmer than a warning', () => {
    expect(hazardTone('bad', 'warn')).toBe('bad')
    expect(hazardTone('warn', 'bad')).toBe('bad')
    expect(hazardTone('normal', 'bad')).toBe('bad')
    expect(hazardTone('idle', 'bad')).toBe('bad')
    expect(hazardTone('warn', 'warn')).toBe('warn')
    expect(hazardTone('normal', 'warn')).toBe('warn')
    expect(hazardTone('idle', 'warn')).toBe('warn')
  })
})

describe('etaParts / gapParts', () => {
  it('ETA in whole seconds rounded down, so the number agrees with its colour', () => {
    expect(etaParts(6.9)).toEqual({ num: '6', unit: 's' })
    expect(etaParts(2.99)).toEqual({ num: '2', unit: 's' })
    expect(etaParts(3)).toEqual({ num: '3', unit: 's' })
    expect(etaParts(1)).toEqual({ num: '1', unit: 's' })
    expect(etaParts(0.4)).toEqual({ num: '<1', unit: 's' })
    expect(etaParts(-2)).toEqual({ num: '<1', unit: 's' })
    expect(etaParts(59.9)).toEqual({ num: '59', unit: 's' })
    expect(etaParts(60)).toEqual({ num: '1', unit: 'min' })
    expect(etaParts(150)).toEqual({ num: '3', unit: 'min' })
  })

  it('distance: one decimal under 10 s, whole seconds, minutes', () => {
    expect(gapParts(3.24)).toEqual({ num: '3.2', unit: 's' })
    expect(gapParts(-0.25)).toEqual({ num: '0.3', unit: 's' })
    expect(gapParts(0)).toEqual({ num: '0.0', unit: 's' })
    expect(gapParts(9.96)).toEqual({ num: '10', unit: 's' })
    expect(gapParts(14.4)).toEqual({ num: '14', unit: 's' })
    expect(gapParts(59.4)).toEqual({ num: '59', unit: 's' })
    expect(gapParts(59.6)).toEqual({ num: '1', unit: 'min' })
    expect(gapParts(-125)).toEqual({ num: '2', unit: 'min' })
  })
})

describe('labels', () => {
  it('class name without a trailing "Class"', () => {
    expect(classLabel('GT3 Class')).toBe('GT3')
    expect(classLabel(' GT4 class ')).toBe('GT4')
    expect(classLabel('GTP')).toBe('GTP')
    expect(classLabel('Class')).toBe('Class')
    expect(classLabel('')).toBe('')
  })

  it('sector label', () => {
    expect(sectorLabel(2, ES)).toBe('S2')
    expect(sectorLabel(1, ES)).toBe('S1')
    expect(sectorLabel(1.6, EN)).toBe('S2')
    expect(sectorLabel(0, ES)).toBe('')
    expect(sectorLabel(null, EN)).toBe('')
    expect(sectorLabel(NaN, ES)).toBe('')
  })
})

describe('toRowSlot', () => {
  const styles = createDriverStyles()

  it('faster car: when it reaches you and where', () => {
    const s = toRowSlot(entry(), 'faster', 0, styles, 'abbr', ES)
    expect(s).toMatchObject({
      kind: 'row',
      group: 'faster',
      css: 'tr-row tr-row--faster is-warn ov-state',
      urgency: 'warn',
      cls: 'GTP',
      number: '7',
      name: 'A. López',
      lap: null,
      lapBadge: '',
      hazard: '',
      lead: 'te alcanza en',
      num: '6',
      unit: 's',
      sector: 'S2'
    })
    expect(s.clsStyle['--cls']).toBe('#ff5888')
    expect(s.nameUnknown).toBe(false)
  })

  it("names a car whose driver iRacing wrote as '?' by its number, dim, or by its team", () => {
    const unknown = entry({ driver: { ...entry().driver, driverName: '' } })
    expect(toRowSlot(unknown, 'faster', 0, styles, 'abbr', ES)).toMatchObject({
      name: 'Piloto #7',
      nameUnknown: true
    })
    expect(toRowSlot(unknown, 'faster', 0, styles, 'abbr', EN).name).toBe('Driver #7')
    const team = entry({ driver: { ...entry().driver, driverName: '', teamName: 'Apex Racing' } })
    expect(toRowSlot(team, 'faster', 0, styles, 'tv', ES).name).toBe('Apex Racing')
  })

  it('faster car lapping you: lap colour and "te dobla"', () => {
    const s = toRowSlot(entry({ lapping: true, etaS: 1.4 }), 'faster', 1, styles, 'full', ES)
    expect(s).toMatchObject({
      css: 'tr-row tr-row--faster is-alt is-bad ov-state',
      lap: 'ahead',
      lapBadge: 'Te dobla',
      lead: 'te alcanza en',
      num: '1',
      name: 'Ana López'
    })
  })

  // From the Lime Rock race: a same-class car a lap up sat 0-3 s behind for minutes, closing at
  // ~0 s/s: "te alcanza en 2 min" in a neutral tone, also under the blue flag.
  it('a car lapping you at your pace: how far behind, by its gap under the blue flag', () => {
    const lapping = (gapS: number, etaS: number | null, passing: 'lap' | 'blue'): RowSlotView =>
      toRowSlot(entry({ lapping: true, passing, gapS, etaS }), 'faster', 0, styles, 'abbr', ES)
    // Before the blue flag: 1 s behind, closing in over 2 minutes.
    expect(lapping(-1, 146, 'lap')).toMatchObject({
      urgency: 'normal',
      lead: 'a',
      num: '1.0',
      unit: 's',
      lapBadge: 'Te dobla'
    })
    // Under it, 1 s: warn; 0.3 s: bad; alongside, the ETA of the pass counts down: bad too.
    expect(lapping(-1, 146, 'blue')).toMatchObject({ urgency: 'warn', lead: 'a', num: '1.0' })
    expect(lapping(-0.3, 50.9, 'blue')).toMatchObject({
      css: 'tr-row tr-row--faster is-bad ov-state',
      urgency: 'bad',
      num: '0.3'
    })
    expect(lapping(0, 6.5, 'blue')).toMatchObject({ urgency: 'bad', lead: 'a', num: '0.0' })
    // Further back and closing fast enough: still when it gets to you.
    expect(lapping(-5, 12, 'blue')).toMatchObject({
      urgency: 'normal',
      lead: 'te alcanza en',
      num: '12'
    })
    expect(lapping(-4, 2.5, 'lap')).toMatchObject({ urgency: 'bad', num: '2' })
    // Not closing at all: its gap, quiet.
    expect(lapping(-5, null, 'lap')).toMatchObject({ urgency: 'idle', lead: 'a', num: '5.0' })
    expect(
      toRowSlot(
        entry({ lapping: true, passing: 'blue', gapS: -0.3, etaS: 50.9 }),
        'faster',
        0,
        styles,
        'abbr',
        EN
      )
    ).toMatchObject({ lead: 'at', urgency: 'bad' })
  })

  it('slower car: when you reach it, "doblado" when a lap down', () => {
    const e = entry({ kind: 'slower', className: 'GT4 Class', gapS: 1.2, etaS: 12.4 })
    expect(toRowSlot(e, 'slower', 0, styles, 'abbr', ES)).toMatchObject({
      css: 'tr-row tr-row--slower',
      urgency: 'normal',
      cls: 'GT4',
      lap: null,
      lead: 'le alcanzas en',
      num: '12',
      sector: 'S2'
    })
    expect(toRowSlot({ ...e, lapping: true }, 'slower', 0, styles, 'abbr', ES)).toMatchObject({
      lap: 'behind',
      lapBadge: 'Doblado'
    })
  })

  it('not converging: how far it is, quieter, no sector', () => {
    const s = toRowSlot(
      entry({ etaS: null, meetSector: null, gapS: -4.26 }),
      'faster',
      0,
      styles,
      'abbr',
      ES
    )
    expect(s).toMatchObject({
      css: 'tr-row tr-row--faster is-idle',
      urgency: 'idle',
      lead: 'a',
      num: '4.3',
      unit: 's',
      sector: ''
    })
  })

  it('hazards: kind badge and how far, no lap state', () => {
    const base = entry({ kind: 'hazard', gapS: 3.2, etaS: 5, lapping: true })
    expect(
      toRowSlot({ ...base, hazard: 'stopped' }, 'hazard', 0, styles, 'abbr', ES)
    ).toMatchObject({
      hazard: 'Parado',
      lead: 'a',
      num: '3.2',
      lap: null,
      lapBadge: ''
    })
    expect(toRowSlot({ ...base, hazard: 'slow' }, 'hazard', 0, styles, 'abbr', ES).hazard).toBe(
      'Lento'
    )
    expect(
      toRowSlot({ ...base, hazard: 'off-track' }, 'hazard', 0, styles, 'abbr', ES).hazard
    ).toBe('Fuera')
    // A hazard without a kind is still drawn, as a warning.
    expect(toRowSlot(base, 'hazard', 0, styles, 'abbr', ES)).toMatchObject({
      hazard: 'Peligro',
      hazardTone: 'warn'
    })
  })

  it('hazards: one tone for the whole line, the worse of the kind and the ETA', () => {
    const base = entry({ kind: 'hazard', gapS: 3.2, lapping: false })
    const line = (hazard: TrafficEntry['hazard'], etaS: number | null): RowSlotView =>
      toRowSlot({ ...base, hazard, etaS }, 'hazard', 0, styles, 'abbr', ES)
    // Stopped is red on rail, icon, number and tag, even 5 s away (the ETA alone says warn).
    expect(line('stopped', 5)).toMatchObject({
      css: 'tr-row tr-row--hazard is-bad ov-state',
      urgency: 'bad',
      hazardTone: 'bad'
    })
    // A slow car under 3 s: red everywhere, its tag included.
    expect(line('slow', 2.1)).toMatchObject({
      css: 'tr-row tr-row--hazard is-bad ov-state',
      urgency: 'bad',
      hazardTone: 'bad'
    })
    expect(line('slow', 5)).toMatchObject({ urgency: 'warn', hazardTone: 'warn' })
    // Far away, or with no ETA at all: still the warning rail, never idle.
    expect(line('slow', 20)).toMatchObject({ css: 'tr-row tr-row--hazard is-warn ov-state' })
    expect(line('off-track', null)).toMatchObject({
      css: 'tr-row tr-row--hazard is-warn ov-state',
      urgency: 'warn',
      hazardTone: 'warn'
    })
  })

  it('says every line in English', () => {
    expect(toRowSlot(entry(), 'faster', 0, styles, 'abbr', EN).lead).toBe('catches you in')
    expect(toRowSlot(entry({ lapping: true }), 'faster', 0, styles, 'abbr', EN).lapBadge).toBe(
      'Lapping'
    )
    const slower = entry({ kind: 'slower', gapS: 1.2, etaS: 12.4 })
    expect(toRowSlot(slower, 'slower', 0, styles, 'abbr', EN).lead).toBe('you catch it in')
    expect(toRowSlot({ ...slower, lapping: true }, 'slower', 0, styles, 'abbr', EN).lapBadge).toBe(
      'Lapped'
    )
    const hazard = entry({ kind: 'hazard', gapS: 3.2, etaS: 2.1 })
    const at = (h: TrafficEntry['hazard']): RowSlotView =>
      toRowSlot({ ...hazard, hazard: h }, 'hazard', 0, styles, 'abbr', EN)
    expect(at('stopped')).toMatchObject({ hazard: 'Stopped', lead: 'at', hazardTone: 'bad' })
    expect(at('slow').hazard).toBe('Slow')
    expect(at('off-track').hazard).toBe('Off track')
    expect(at(null).hazard).toBe('Hazard')
  })

  it('the group decides the line, whatever the entry says', () => {
    expect(toRowSlot(entry({ kind: 'slower' }), 'faster', 0, styles, 'abbr', ES).lead).toBe(
      'te alcanza en'
    )
  })

  it('falls back on unknown colours, numbers and gaps', () => {
    const s = toRowSlot(
      entry({
        driver: { ...entry().driver, carNumber: ' ', classColor: 'nope' },
        className: '',
        gapS: NaN,
        etaS: null
      }),
      'slower',
      0,
      styles,
      'tv',
      ES
    )
    expect(s).toMatchObject({ number: '', cls: '', num: '0.0', name: 'LOP' })
    expect(s.clsStyle['--cls']).toBe('#ffffff')
  })

  it('equal inputs give shallow-equal slots sharing their style object', () => {
    const a = toRowSlot(entry(), 'faster', 0, styles, 'abbr', ES)
    const b = toRowSlot(entry({ etaS: 6.8, gapS: -0.45 }), 'faster', 0, styles, 'abbr', ES)
    expect(a).not.toBe(b)
    expect(shallowEqual(a, b)).toBe(true)
    expect(a.clsStyle).toBe(b.clsStyle)
  })
})

describe('groups and slots', () => {
  const styles = createDriverStyles()
  const full = traffic({
    faster: [entry(), entry({ etaS: 9 }), entry({ etaS: 12 }), entry({ etaS: 15 })],
    slower: [entry({ kind: 'slower', etaS: 4 })],
    hazards: [entry({ kind: 'hazard', hazard: 'stopped', etaS: 2 })]
  })

  it('ahead first (hazards, slower), the faster cars behind last', () => {
    expect(GROUP_ORDER).toEqual(['hazard', 'slower', 'faster'])
    // The defaults draw today's widget: every group in that order, captions and title, every cell.
    const S = OPTION_SCHEMA.traffic
    expect(visibleIds(S.groups.default)).toEqual(GROUP_ORDER)
    expect(S.headerBarSize.default).toBe('normal')
    expect(visibleIds(S.headerBar.default)).toEqual(['title', 'split'])
    expect(S.captions.default).toBe(true)
    expect(visibleIds(S.parts.default)).toEqual([
      'icon',
      'cls',
      'driver',
      'lead',
      'value',
      'sector'
    ])
    expect(visibleGroups(full, OPTS).map((g) => g.group)).toEqual(['hazard', 'slower', 'faster'])
  })

  it('follows the group toggles and the entry limit', () => {
    const g = visibleGroups(full, { ...OPTS, groups: ['slower', 'faster'], maxEntries: 2 })
    expect(g.map((x) => x.group)).toEqual(['slower', 'faster'])
    expect(g[1]?.entries).toHaveLength(2)
    expect(visibleGroups(full, { ...OPTS, maxEntries: 0 })[2]?.entries).toHaveLength(1)
  })

  it('in the groups order (each once)', () => {
    const order = (groups: TrafficViewOptions['groups']): string[] =>
      visibleGroups(full, { ...OPTS, groups }).map((g) => g.group)
    expect(order(['faster', 'hazard', 'slower'])).toEqual(['faster', 'hazard', 'slower'])
    expect(order(['faster', 'faster', 'slower'])).toEqual(['faster', 'slower'])
    expect(order([])).toEqual([])
  })

  it('nothing to draw: hidden payload, empty groups or every group off', () => {
    expect(hasTraffic(full, OPTS)).toBe(true)
    expect(hasTraffic({ ...full, visible: false }, OPTS)).toBe(false)
    expect(hasTraffic(traffic(), OPTS)).toBe(false)
    const onlyFaster = traffic({ faster: [entry()] })
    expect(hasTraffic(onlyFaster, { ...OPTS, groups: ['hazard', 'slower'] })).toBe(false)
    expect(hasTraffic(onlyFaster, { ...OPTS, groups: ['faster'] })).toBe(true)
  })

  it('without captions: the lines only, a rule above each later group', () => {
    const slots = toSlots(full, { ...OPTS, captions: false }, styles, ES)
    expect(layoutKey(slots)).toBe('rrrrr')
    expect(rows(slots).map((r) => r.css.includes('is-break'))).toEqual([
      false,
      true,
      true,
      false,
      false
    ])
    // With captions the caption is the separator.
    expect(rows(toSlots(full, OPTS, styles, ES)).some((r) => r.css.includes('is-break'))).toBe(
      false
    )
  })

  it('a caption per group, then its cars; only the first caption has no separator', () => {
    const slots = toSlots(full, OPTS, styles, ES)
    expect(layoutKey(slots)).toBe('crcrcrrr')
    const captions = slots.filter((s) => s.kind === 'caption')
    expect(captions.map((c) => c.text)).toEqual(['PELIGRO', 'DELANTE', 'POR DETRÁS'])
    expect(captions.map((c) => c.css)).toEqual([
      'tr-cap tr-cap--hazard is-first',
      'tr-cap tr-cap--slower',
      'tr-cap tr-cap--faster'
    ])
    // Stripes restart in every group.
    expect(rows(slots).map((r) => r.css.includes('is-alt'))).toEqual([
      false,
      false,
      false,
      true,
      false
    ])
    expect(toSlots(traffic({ slower: [entry()] }), OPTS, styles, ES)[0]?.css).toBe(
      'tr-cap tr-cap--slower is-first'
    )
    expect(toSlots(traffic(), OPTS, styles, ES)).toEqual([])
  })

  it('unchanged slots keep their objects; captions are shared', () => {
    const a = toSlots(full, OPTS, styles, ES)
    const b = toSlots(full, OPTS, styles, ES)
    expect(b[0]).toBe(a[0])
    expect(reuseViews(a, b)).toBe(a)
    const moved = toSlots(
      { ...full, faster: [entry({ etaS: 1 }), ...full.faster.slice(1)] },
      OPTS,
      styles,
      ES
    )
    const next = reuseViews(a, moved)
    expect(next).not.toBe(a)
    expect(next.filter((s, i) => s === a[i])).toHaveLength(a.length - 1)
  })

  it('captions and words in English; captions are shared per language', () => {
    const slots = toSlots(full, OPTS, styles, EN)
    const captions = slots.filter((s) => s.kind === 'caption')
    expect(captions.map((c) => c.text)).toEqual(['HAZARD', 'AHEAD', 'BEHIND'])
    expect(toSlots(full, OPTS, styles, EN)[0]).toBe(slots[0])
    expect(toSlots(full, OPTS, styles, ES)[0]).not.toBe(slots[0])
    expect(groupCaption('faster', ES)).toBe('POR DETRÁS')
    expect(groupCaption('faster', EN)).toBe('BEHIND')
  })

  it('sector column only when a line has one', () => {
    expect(hasSectors(toSlots(full, OPTS, styles, ES))).toBe(true)
    const none = traffic({ faster: [entry({ meetSector: null })] })
    expect(hasSectors(toSlots(none, OPTS, styles, ES))).toBe(false)
    expect(hasSectors([])).toBe(false)
  })

  it('class column only when a line names a class (not in a single-class session)', () => {
    expect(hasClasses(toSlots(full, OPTS, styles, ES))).toBe(true)
    const oneClass = traffic({ faster: [entry({ className: '', lapping: true, passing: 'lap' })] })
    const slots = toSlots(oneClass, OPTS, styles, ES)
    expect(rows(slots)[0]?.cls).toBe('')
    expect(hasClasses(slots)).toBe(false)
    expect(hasClasses([])).toBe(false)
  })
})

describe('preview', () => {
  const styles = createDriverStyles()

  it('is frozen and draws every kind of line with the default options', () => {
    expect(Object.isFrozen(PREVIEW_TRAFFIC)).toBe(true)
    expect(Object.isFrozen(PREVIEW_TRAFFIC.faster)).toBe(true)
    expect(Object.isFrozen(PREVIEW_TRAFFIC.faster[0])).toBe(true)
    const r = rows(toSlots(PREVIEW_TRAFFIC, OPTS, styles, ES))
    expect(new Set(r.map((s) => s.group))).toEqual(new Set(['faster', 'slower', 'hazard']))
    expect(new Set(r.map((s) => s.urgency))).toEqual(new Set(['bad', 'warn', 'normal']))
    expect(r.some((s) => s.lap === 'ahead')).toBe(true)
    expect(r.some((s) => s.lap === 'behind')).toBe(true)
    expect(r.some((s) => s.hazard !== '')).toBe(true)
    expect(r.every((s) => s.sector !== '' && s.cls !== '' && s.number !== '')).toBe(true)
  })

  it('faster cars are behind, the rest ahead, with matching ETAs', () => {
    for (const e of PREVIEW_TRAFFIC.faster) expect(e.gapS).toBeLessThan(0)
    for (const e of [...PREVIEW_TRAFFIC.slower, ...PREVIEW_TRAFFIC.hazards]) {
      expect(e.gapS).toBeGreaterThan(0)
    }
    for (const e of [...PREVIEW_TRAFFIC.faster, ...PREVIEW_TRAFFIC.slower]) {
      expect(e.etaS ?? 0).toBeGreaterThan(Math.abs(e.gapS))
    }
  })

  it('follows the options; every group when all of them are off', () => {
    expect(previewOptions(OPTS)).toBe(OPTS)
    const some: TrafficViewOptions = { ...OPTS, groups: ['slower'] }
    expect(previewOptions(some)).toBe(some)
    expect(previewOptions({ ...OPTS, groups: [] })).toEqual(OPTS)
    // Every group, in the list's own order.
    expect(previewOptions({ ...OPTS, groups: [] }, ['faster', 'slower', 'hazard']).groups).toEqual([
      'faster',
      'slower',
      'hazard'
    ])
    const one = rows(toSlots(PREVIEW_TRAFFIC, { ...OPTS, maxEntries: 1 }, styles, ES))
    expect(one).toHaveLength(3)
  })
})
