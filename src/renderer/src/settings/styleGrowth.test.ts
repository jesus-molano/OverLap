import { describe, expect, it } from 'vitest'
import { planStyle } from '@shared/appearancePresets'
import { messagesFor } from '@shared/i18n'
import { applySettingsPatch, createDefaultSettings } from '@shared/settings'
import { styleChangeGroups } from './styleChanges'
import { WIDGET_DEFS } from '@shared/widgets'
import type { OverlaySettings } from '@shared/types'
import {
  defaultSizes,
  deltaBarsGrowth,
  deltaFit,
  freeGrowth,
  grownBounds,
  relativeFit,
  styleWindows
} from './styleGrowth'

describe('«Completo» grows the free windows instead of shrinking their text', () => {
  it('measures what the relative and the delta need, as the widgets do', () => {
    const s = createDefaultSettings()
    // 7 comfortable rows and today's header: 14 + 1.8; the default columns with makes and flags.
    expect(relativeFit(s).h).toBeCloseTo(15.8)
    // The top line, the bar and the sectors: today's 6; the hero, the info and the trend.
    expect(deltaFit(s)).toEqual({ h: 6, w: 26 })
  })

  it('keeps the text size: the window grows by what the new lines and columns need', () => {
    const fit0 = { h: 10, w: 20 }
    const fit1 = { h: 12, w: 25 }
    const b = { x: 100, y: 50, width: 400, height: 200 }
    // Text was min(200/10, 400/20) = 20 px: it needs 240 high and 500 wide.
    expect(grownBounds(b, fit0, fit1)).toEqual({ x: 100, y: 50, width: 500, height: 240 })
    // Already big enough: nothing to do; never smaller.
    expect(grownBounds(b, fit1, fit0)).toBeNull()
  })

  it('grows the relative and the delta of a new install, from the same corner', () => {
    const s = createDefaultSettings()
    const after = applySettingsPatch(s, planStyle(s, 'complete').patch)
    const grown = freeGrowth(s, after)
    for (const id of ['relative', 'delta'] as const) {
      const b = grown[id]
      expect(b, id).toBeDefined()
      expect(b?.x).toBe(after.widgets[id].bounds.x)
      expect(b?.y).toBe(after.widgets[id].bounds.y)
      expect(b!.height, id).toBeGreaterThan(after.widgets[id].bounds.height)
    }
    // Once complete, applying it again grows nothing.
    expect(freeGrowth(after, after)).toEqual({})
  })

  it('a look-only style never grows a window', () => {
    const s = createDefaultSettings()
    const after = applySettingsPatch(s, planStyle(s, 'clean').patch)
    expect(freeGrowth(s, after)).toEqual({})
  })

  it('the confirmation says so on the widget’s line', () => {
    const s = createDefaultSettings()
    const groups = styleChangeGroups(messagesFor('es'), planStyle(s, 'complete').changes, [
      'relative'
    ])
    const line = groups[1]?.lines.find((l) => l.text.startsWith('Relativo: '))
    expect(line?.text).toContain('ventana más grande para que el texto no encoja')
  })
})

describe('«OverLap» puts the windows «Completo» grew back to their default size', () => {
  type Free = 'relative' | 'delta'
  const FREE = ['relative', 'delta'] as const
  /** Completo applied, its windows grown and moved to (300, 40). */
  function completed(s: OverlaySettings): OverlaySettings {
    const complete = applySettingsPatch(s, planStyle(s, 'complete').patch)
    for (const [id, b] of Object.entries(freeGrowth(s, complete))) {
      complete.widgets[id as Free].bounds = { ...b, x: 300, y: 40 }
    }
    return complete
  }
  function overlap(s: OverlaySettings): OverlaySettings {
    return applySettingsPatch(s, planStyle(s, 'overlap').patch)
  }
  /** The text size a free window draws at (as grownBounds measures it). */
  function font(s: OverlaySettings, id: Free, b = s.widgets[id].bounds): number {
    const fit = id === 'relative' ? relativeFit(s) : deltaFit(s)
    return Math.min(b.height / fit.h, b.width / fit.w)
  }

  it('the relative and the delta, from the same corner, when their contents go back', () => {
    const complete = completed(createDefaultSettings())
    const sizes = defaultSizes(complete, overlap(complete))
    for (const id of FREE) {
      const { width, height } = WIDGET_DEFS[id].defaultBounds
      expect(sizes[id], id).toEqual({ x: 300, y: 40, width, height })
    }
  })

  it('never shrinks the text: more cars than the default keep a taller relative', () => {
    const s = createDefaultSettings()
    s.relative.carsAhead = 5
    s.relative.carsBehind = 5
    const complete = completed(s)
    const after = overlap(complete)
    expect(after.relative.carsAhead).toBe(5)
    const b = defaultSizes(complete, after).relative
    expect(b).toBeDefined()
    expect(b!.height).toBeGreaterThan(WIDGET_DEFS.relative.defaultBounds.height)
    expect(b!.width).toBeGreaterThanOrEqual(WIDGET_DEFS.relative.defaultBounds.width)
    // The text is drawn at the default install's size, not smaller.
    const def = createDefaultSettings()
    expect(font(after, 'relative', b)).toBeGreaterThanOrEqual(font(def, 'relative') - 1e-9)
  })

  it('leaves a window whose contents it does not touch, and one already at its size', () => {
    const s = createDefaultSettings()
    s.relative.columnHeads = !s.relative.columnHeads
    s.widgets.delta.bounds = { ...s.widgets.delta.bounds, width: 999 }
    // The relative's contents change, its size is already the default; the delta's do not.
    expect(defaultSizes(s, overlap(s))).toEqual({})
    // A look alone resizes nothing.
    expect(styleWindows('clean', s, applySettingsPatch(s, planStyle(s, 'clean').patch))).toEqual({
      resize: {},
      restore: {}
    })
  })

  it('"Deshacer" after OverLap puts back the sizes «Completo» had given them', () => {
    const complete = completed(createDefaultSettings())
    const { resize, restore } = styleWindows('overlap', complete, overlap(complete))
    for (const id of FREE) {
      expect(resize[id]?.height, id).toBe(WIDGET_DEFS[id].defaultBounds.height)
      expect(restore[id], id).toEqual(complete.widgets[id].bounds)
      expect(restore[id], id).not.toEqual(resize[id])
    }
  })

  it('"Deshacer" after Completo puts back the sizes it had before', () => {
    const s = createDefaultSettings()
    const after = applySettingsPatch(s, planStyle(s, 'complete').patch)
    const { resize, restore } = styleWindows('complete', s, after)
    expect(Object.keys(resize).sort()).toEqual(['delta', 'relative'])
    for (const id of FREE) expect(restore[id], id).toEqual(s.widgets[id].bounds)
  })
})

describe('Delta: showing the bars per reference from its page grows the window', () => {
  const withBars = (s: OverlaySettings, line: boolean, bars: number): OverlaySettings['delta'] => ({
    ...s.delta,
    rows: s.delta.rows.map((e) => (e.id === 'refs' ? { ...e, visible: line } : e)),
    refBars: s.delta.refBars.map((e, i) => ({ ...e, visible: i < bars }))
  })

  it('grows as «Completo» does, from the same corner, so every bar fits at the same text', () => {
    const s = createDefaultSettings()
    const delta = withBars(s, true, 3)
    const grown = deltaBarsGrowth(s, delta)
    const b = s.widgets.delta.bounds
    expect(grown).toEqual(grownBounds(b, deltaFit(s), deltaFit({ ...s, delta } as OverlaySettings)))
    expect(grown?.x).toBe(b.x)
    expect(grown?.y).toBe(b.y)
    expect(grown?.height ?? 0).toBeGreaterThan(b.height)
  })

  it('one row per reference: 400 x 80 grows to 106, 131, 156 and 182 px for 2 to 5', () => {
    const s = createDefaultSettings()
    // Two: your record next to the optimal the race uses; then the list's first ones.
    const pb = { ...withBars(s, true, 1) }
    expect(deltaBarsGrowth(s, pb)?.height).toBe(106)
    expect(deltaBarsGrowth(s, withBars(s, true, 3))?.height).toBe(131)
    expect(deltaBarsGrowth(s, withBars(s, true, 4))?.height).toBe(156)
    expect(deltaBarsGrowth(s, withBars(s, true, 5))?.height).toBe(182)
    expect(deltaBarsGrowth(s, withBars(s, true, 5))?.width).toBe(400)
  })

  it('grows when a session takes a reference that adds a row', () => {
    const s = createDefaultSettings()
    // Only the optimal shown: one row in qualifying and races, two in practice (your record).
    const optimal = withBars(s, true, 0)
    optimal.refBars = optimal.refBars.map((e) => ({ ...e, visible: e.id === 'optimal' }))
    const before = { ...s, delta: { ...optimal, referencePractice: 'optimal' } } as OverlaySettings
    // The text keeps the size it had with the optimal's small bar (7.5 em in 80 px): 7.9 em.
    expect(deltaBarsGrowth(before, { ...before.delta, referencePractice: 'pb' })?.height).toBe(85)
    expect(deltaBarsGrowth(before, { ...before.delta, referenceRace: 'optimal' })).toBeNull()
  })

  it('grows when a part of the top line brings back the line above the rows', () => {
    const s = createDefaultSettings()
    const rows = withBars(s, true, 3)
    const bare = { ...rows, top: rows.top.map((e) => ({ ...e, visible: false })) }
    const before = { ...s, delta: bare } as OverlaySettings
    // The predicted lap shown again: the line above the three rows, at the same text size.
    const top = bare.top.map((e) => ({ ...e, visible: e.id === 'predicted' }))
    const grown = deltaBarsGrowth(before, { ...bare, top })
    expect(grown?.height ?? 0).toBeGreaterThan(s.widgets.delta.bounds.height)
    expect(grown).toEqual(
      grownBounds(
        s.widgets.delta.bounds,
        deltaFit(before),
        deltaFit({ ...before, delta: { ...bare, top } })
      )
    )
    // «Estado» alone puts its chevrons on the rows: no line, nothing to grow.
    const state = bare.top.map((e) => ({ ...e, visible: e.id === 'state' }))
    expect(deltaBarsGrowth(before, { ...bare, top: state })).toBeNull()
  })

  it('never for fewer bars, the same bars, or a window that already fits', () => {
    const s = createDefaultSettings()
    const on = { ...s, delta: withBars(s, true, 3) } as OverlaySettings
    expect(deltaBarsGrowth(on, withBars(s, true, 2))).toBeNull()
    expect(deltaBarsGrowth(on, withBars(s, false, 3))).toBeNull()
    expect(deltaBarsGrowth(on, on.delta)).toBeNull()
    // The bars on but the line hidden: nothing drawn, nothing to grow.
    expect(deltaBarsGrowth(s, withBars(s, false, 5))).toBeNull()
    const tall = {
      ...s,
      widgets: {
        ...s.widgets,
        delta: { ...s.widgets.delta, bounds: { x: 0, y: 0, width: 800, height: 600 } }
      }
    } as OverlaySettings
    expect(deltaBarsGrowth(tall, withBars(s, true, 1))).toBeNull()
  })
})
