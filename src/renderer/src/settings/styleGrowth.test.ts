import { describe, expect, it } from 'vitest'
import { planStyle } from '@shared/appearancePresets'
import { messagesFor } from '@shared/i18n'
import { applySettingsPatch, createDefaultSettings } from '@shared/settings'
import { styleChangeGroups } from './styleChanges'
import { WIDGET_DEFS } from '@shared/widgets'
import { defaultSizes, deltaFit, freeGrowth, grownBounds, relativeFit } from './styleGrowth'

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
  it('the relative and the delta, from the same corner, when their contents go back', () => {
    const s = createDefaultSettings()
    const complete = applySettingsPatch(s, planStyle(s, 'complete').patch)
    for (const [id, b] of Object.entries(freeGrowth(s, complete))) {
      complete.widgets[id as 'relative' | 'delta'].bounds = { ...b, x: 300, y: 40 }
    }
    const sizes = defaultSizes(complete, planStyle(complete, 'overlap').patch)
    for (const id of ['relative', 'delta'] as const) {
      const { width, height } = WIDGET_DEFS[id].defaultBounds
      expect(sizes[id], id).toEqual({ x: 300, y: 40, width, height })
    }
  })

  it('leaves a window whose contents it does not touch, and one already at its size', () => {
    const s = createDefaultSettings()
    s.relative.columnHeads = !s.relative.columnHeads
    s.widgets.delta.bounds = { ...s.widgets.delta.bounds, width: 999 }
    // The relative's contents change, its size is already the default; the delta's do not.
    expect(defaultSizes(s, planStyle(s, 'overlap').patch)).toEqual({})
    // A look alone resizes nothing.
    expect(defaultSizes(s, planStyle(s, 'clean').patch)).toEqual({})
  })
})
