import { describe, expect, it } from 'vitest'
import { planStyle } from '@shared/appearancePresets'
import { messagesFor } from '@shared/i18n'
import { applySettingsPatch, createDefaultSettings } from '@shared/settings'
import { styleChangeGroups } from './styleChanges'
import { WIDGET_DEFS } from '@shared/widgets'
import type { OverlaySettings } from '@shared/types'
import {
  defaultSizes,
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
