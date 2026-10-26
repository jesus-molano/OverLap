import { describe, expect, it } from 'vitest'
import { ENGINE_ICONS, ENGINE_ICON_NAMES, iconShapes, isEngineIcon } from './engineIcons'
import { ICONS, ICON_NAMES, type IconShape } from './icons'

const PATH_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/

describe('engine icons', () => {
  it('has the set the warning lights use', () => {
    for (const name of [
      'oil-pressure',
      'fuel-pressure',
      'engine',
      'water-temp',
      'oil-temp',
      'repair',
      'repair-optional',
      'pit-limiter',
      'rev-limiter'
    ]) {
      expect(ENGINE_ICON_NAMES).toContain(name)
    }
  })

  it('shares no name with the main set, so the two registries merge', () => {
    for (const name of ENGINE_ICON_NAMES) expect(ICON_NAMES as string[], name).not.toContain(name)
  })

  it('draws both registries through one lookup (Icon.vue)', () => {
    expect(iconShapes('oil-pressure')).toBe(ENGINE_ICONS['oil-pressure'])
    expect(iconShapes('pit')).toBe(ICONS.pit)
    expect(isEngineIcon('engine')).toBe(true)
    expect(isEngineIcon('pit')).toBe(false)
    expect(isEngineIcon('toString')).toBe(false)
  })

  it('draws in currentColor only, so a light takes its severity colour', () => {
    for (const name of ENGINE_ICON_NAMES) {
      const shapes: readonly IconShape[] = ENGINE_ICONS[name]
      for (const s of shapes) expect(s.tint, name).toBeUndefined()
    }
  })

  it('tells the two repair lights apart by their badge, on the same wrench', () => {
    const [wrench, badge] = ENGINE_ICONS.repair
    const [optionalWrench, optionalBadge] = ENGINE_ICONS['repair-optional']
    expect(optionalWrench.d).toBe(wrench.d)
    expect(optionalBadge.d).not.toBe(badge.d)
  })

  it('only holds well-formed paths inside the 16 x 16 box', () => {
    for (const name of ENGINE_ICON_NAMES) {
      const shapes: readonly IconShape[] = ENGINE_ICONS[name]
      expect(shapes.length).toBeGreaterThan(0)
      for (const s of shapes) {
        expect(s.d, name).toMatch(PATH_RE)
        expect(s.d.trimStart()[0], name).toMatch(/[Mm]/)
        // Absolute coordinates after M/L/H/V stay within the view box (with a 1 unit margin).
        for (const m of s.d.matchAll(/[MLHV]\s*(-?[\d.]+)/g)) {
          const v = Number(m[1])
          expect(v, name).toBeGreaterThanOrEqual(-1)
          expect(v, name).toBeLessThanOrEqual(17)
        }
      }
    }
  })
})
