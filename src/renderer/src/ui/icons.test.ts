import { describe, expect, it } from 'vitest'
import { ICONS, ICON_NAMES, type IconShape } from './icons'

const PATH_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/

describe('icons', () => {
  it('has the set the widgets use', () => {
    for (const name of [
      'pit',
      'out',
      'flag',
      'meatball',
      'chequered',
      'lock',
      'warning',
      'alert',
      'check',
      'minus',
      'arrow-up',
      'arrow-down',
      'clock',
      'plug',
      'wheel',
      'eye-off'
    ]) {
      expect(ICON_NAMES).toContain(name)
    }
  })

  it('only holds well-formed paths inside the 16 x 16 box', () => {
    for (const name of ICON_NAMES) {
      const shapes: readonly IconShape[] = ICONS[name]
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
