import { describe, expect, it } from 'vitest'
import {
  COMPUTED_INFO_ITEMS,
  INFO_BARS,
  INFO_BAR_SIZES,
  INFO_ITEMS,
  INFO_ITEM_GAP_EM,
  INFO_ITEM_IDS,
  barItems,
  fitInfoItems,
  infoItemShown,
  infoSources,
  sectionInfoItems
} from './infoBar'
import { createDefaultSettings } from './settings'
import type { ElementEntry, InfoBarEntryId, InfoItemId } from './types'

describe('the info item catalog', () => {
  it('describes every item once: a source, a priority, a width', () => {
    expect(new Set(INFO_ITEM_IDS).size).toBe(INFO_ITEM_IDS.length)
    expect(Object.keys(INFO_ITEMS).sort()).toEqual([...INFO_ITEM_IDS].sort())
    for (const id of INFO_ITEM_IDS) {
      const spec = INFO_ITEMS[id]
      expect(spec.priority, id).toBeGreaterThanOrEqual(1)
      expect(spec.em, id).toBeGreaterThan(2)
      expect(spec.em, id).toBeLessThan(18)
    }
    // The renderer's own: the name and the clock; everything else the telemetry computes.
    expect(INFO_ITEM_IDS.filter((id) => INFO_ITEMS[id].source === 'renderer')).toEqual([
      'title',
      'clock'
    ])
    expect(COMPUTED_INFO_ITEMS).toEqual(
      INFO_ITEM_IDS.filter((id) => id !== 'title' && id !== 'clock')
    )
  })

  it('keeps what is left, the session and the wet call longest; the rubber goes first', () => {
    const p = (id: InfoItemId): number => INFO_ITEMS[id].priority
    expect(p('session')).toBe(1)
    expect(p('remaining')).toBe(1)
    expect(p('wet')).toBeLessThan(p('wind'))
    expect(Math.max(...INFO_ITEM_IDS.map(p))).toBe(p('rubber'))
  })

  it('has the sizes in UI order, off first', () => {
    expect(INFO_BAR_SIZES).toEqual(['off', 'small', 'normal', 'large'])
  })
})

describe('reading the bars of a section', () => {
  const list = (
    ids: InfoBarEntryId[],
    hidden: InfoBarEntryId[] = []
  ): ElementEntry<InfoBarEntryId>[] => ids.map((id) => ({ id, visible: !hidden.includes(id) }))

  it('barItems: the shown items in order, no marker, none when off', () => {
    const l = list(['session', 'split', 'incidents', 'clock'], ['clock'])
    expect(barItems(l, 'normal')).toEqual(['session', 'incidents'])
    expect(barItems(l, 'off')).toEqual([])
    expect(barItems(undefined, 'normal')).toEqual([])
  })

  it("every section with bars: the defaults draw today's items", () => {
    const s = createDefaultSettings()
    expect(Object.keys(INFO_BARS)).toEqual(['relative', 'standings', 'fuel'])
    expect(sectionInfoItems('relative', s.relative)).toEqual(['title', 'session', 'incidents'])
    expect(sectionInfoItems('standings', s.standings)).toEqual([
      'session',
      'sof',
      'carCount',
      'incidents',
      'remaining',
      'iRating',
      'fastestLap',
      'safetyRating',
      'trackTemp',
      'wet',
      'wind',
      'airTemp',
      'rubber'
    ])
    // The fuel's header is off by default.
    expect(sectionInfoItems('fuel', s.fuel)).toEqual([])
    expect(infoItemShown('standings', s.standings, 'iRating')).toBe(true)
    expect(infoItemShown('relative', s.relative, 'trackTemp')).toBe(false)
  })

  it('is memoised per options object (the providers ask on every tick)', () => {
    const s = createDefaultSettings()
    const a = sectionInfoItems('relative', s.relative)
    expect(sectionInfoItems('relative', s.relative)).toBe(a)
    const other = { ...s.relative, footerBarSize: 'normal' as const }
    expect(sectionInfoItems('relative', other)).toContain('trackTemp')
    expect(Object.isFrozen(a)).toBe(true)
  })

  it('infoSources: what the telemetry must compute', () => {
    expect([...infoSources(['title', 'clock'])]).toEqual([])
    expect([...infoSources(['session', 'remaining', 'trackTemp', 'wind'])].sort()).toEqual([
      'conditions',
      'session'
    ])
    expect([...infoSources(['iRating', 'safetyRating', 'fuelLaps', 'sof'])].sort()).toEqual([
      'field',
      'fuel',
      'ratings'
    ])
  })
})

describe('fitInfoItems', () => {
  const width = (ids: readonly InfoItemId[]): number =>
    ids.reduce((sum, id, i) => sum + INFO_ITEMS[id].em + (i > 0 ? INFO_ITEM_GAP_EM : 0), 0)

  it('keeps everything while it fits, and before the bar is measured', () => {
    const ids: InfoItemId[] = ['session', 'incidents', 'remaining']
    expect(fitInfoItems(ids, width(ids))).toEqual(ids)
    expect(fitInfoItems(ids, 0)).toEqual(ids)
    expect(fitInfoItems(ids, Number.NaN)).toEqual(ids)
  })

  it('drops the least important first, the later of two equals, never a part of one', () => {
    const ids: InfoItemId[] = ['trackTemp', 'wet', 'wind', 'airTemp', 'rubber']
    // Room for all but the rubber (priority 7).
    expect(fitInfoItems(ids, width(ids) - 1)).toEqual(['trackTemp', 'wet', 'wind', 'airTemp'])
    // Then the air (6), then the wind (5).
    expect(fitInfoItems(ids, width(['trackTemp', 'wet', 'wind']))).toEqual([
      'trackTemp',
      'wet',
      'wind'
    ])
    // Equal priorities: the later goes first.
    expect(fitInfoItems(['iRating', 'safetyRating'], INFO_ITEMS.iRating.em)).toEqual(['iRating'])
    // One item that does not fit stays (the bar clips it): never an empty bar.
    expect(fitInfoItems(['rubber'], 1)).toEqual(['rubber'])
  })

  it('drops more when the bar measured an overflow, by the same rule, never the last one', () => {
    const ids: InfoItemId[] = ['session', 'iRating', 'fastestLap', 'safetyRating']
    // Everything fits by the estimates; one more drop takes the fastest lap (priority 4).
    expect(fitInfoItems(ids, 100, INFO_ITEM_GAP_EM, 1)).toEqual([
      'session',
      'iRating',
      'safetyRating'
    ])
    // Then the later of the two ratings (both 2).
    expect(fitInfoItems(ids, 100, INFO_ITEM_GAP_EM, 2)).toEqual(['session', 'iRating'])
    expect(fitInfoItems(ids, 100, INFO_ITEM_GAP_EM, 9)).toEqual(['session'])
    // Not measured yet: nothing to act on.
    expect(fitInfoItems(ids, 0, INFO_ITEM_GAP_EM, 2)).toEqual(ids)
  })

  it('each measured overflow drops one more beyond the estimates, so the bar converges', () => {
    // The review's bar: every Relative item at 31.6 em. Each step must change what is kept, down
    // to one item; the session type (priority 1) outlives the less important ones.
    const ids: InfoItemId[] = [
      'title',
      'session',
      'remaining',
      'sof',
      'carCount',
      'incidents',
      'iRating'
    ]
    const steps = [0, 1, 2, 3, 4, 5, 6].map((n) => fitInfoItems(ids, 31.6, 0.5, n))
    for (let n = 1; n < steps.length; n++) {
      const prev = steps[n - 1] ?? []
      const cur = steps[n] ?? []
      if (prev.length > 1) expect(cur.length, `step ${n}`).toBe(prev.length - 1)
    }
    expect(steps.at(-1)).toEqual(['session'])
    for (const s of steps) expect(s).toContain('session')
    // By the estimates alone the long iRating item is not left to overflow next to the rest.
    expect(width(steps[0] ?? [])).toBeLessThanOrEqual(31.6)
  })

  it('drops the ghosts of the settings preview before anything really shown', () => {
    const real: InfoItemId[] = ['session', 'rubber', 'incidents']
    // 'clock' and 'sof' are ghosts: the room is the real items' and one ghost's.
    const ids: InfoItemId[] = ['session', 'clock', 'rubber', 'sof', 'incidents']
    const ghosts = new Set<InfoItemId>(['clock', 'sof'])
    const room = width([...real, 'clock'])
    const out = fitInfoItems(ids, room, INFO_ITEM_GAP_EM, 0, ghosts)
    for (const id of real) expect(out).toContain(id)
    expect(out.filter((id) => ghosts.has(id))).toHaveLength(1)
    // With no room for any ghost, exactly what the bar draws without them.
    expect(fitInfoItems(ids, width(real), INFO_ITEM_GAP_EM, 0, ghosts)).toEqual(
      fitInfoItems(real, width(real))
    )
    // A measured overflow drops a ghost first too.
    expect(fitInfoItems(ids, 100, INFO_ITEM_GAP_EM, 2, ghosts)).toEqual(real)
  })

  it('returns a new list in the given order', () => {
    const ids: InfoItemId[] = ['remaining', 'session']
    const out = fitInfoItems(ids, 100)
    expect(out).toEqual(ids)
    expect(out).not.toBe(ids)
  })
})
