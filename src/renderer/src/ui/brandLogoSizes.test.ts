import { describe, expect, it } from 'vitest'
import type { KnownBrandId } from '@shared/carBrands'
import { BRAND_LOGOS } from './brandLogos'
import { COLOR_LOGOS } from './brandLogosColor'
import { brandDrawing } from './brandDrawing'
import { SCALE_MAX, fitLogo, measureInk, outline, type InkShape } from './brandLogoInk'
import { LOGO_SCALE_COLOR, LOGO_SCALE_MONO } from './brandLogoSizes'

const COLOR = Object.entries(COLOR_LOGOS).map(([id, l]) => ({
  id: id as KnownBrandId,
  viewBox: l.viewBox,
  shapes: l.layers as readonly InkShape[]
}))
const MONO = Object.entries(BRAND_LOGOS).map(([id, l]) => ({
  id: id as KnownBrandId,
  viewBox: l.viewBox,
  shapes: [{ d: l.d }] as readonly InkShape[]
}))

const SETS = [
  ['colour', COLOR, LOGO_SCALE_COLOR],
  ['mono', MONO, LOGO_SCALE_MONO]
] as const

describe('logo sizes', () => {
  it.each(SETS)(
    '%s: a scale for every logo, and none for a logo that is gone',
    (_, logos, scales) => {
      // A new logo fails here until `npm run logo-sizes` measures it.
      for (const { id } of logos)
        expect(scales[id], `${id}: run npm run logo-sizes`).toBeTypeOf('number')
      expect(Object.keys(scales).sort()).toEqual(logos.map((l) => l.id).sort())
    }
  )

  it.each(SETS)(
    '%s: the scales are the ones the paths give (npm run logo-sizes)',
    (_, logos, scales) => {
      for (const { id, viewBox, shapes } of logos) {
        expect(scales[id], id).toBe(fitLogo(viewBox, measureInk(shapes)).scale)
      }
    }
  )

  it.each(SETS)(
    '%s: every logo within a quarter of the same size, none past the plate',
    (_, logos) => {
      const fits = logos.map(({ viewBox, shapes }) => fitLogo(viewBox, measureInk(shapes)))
      const spread = (k: 'before' | 'after'): number =>
        Math.max(...fits.map((f) => f[k])) / Math.min(...fits.map((f) => f[k]))
      expect(spread('after')).toBeLessThan(1.3)
      expect(spread('after')).toBeLessThan(spread('before'))
      for (const f of fits) {
        expect(f.scale).toBeGreaterThan(0.4)
        expect(f.scale).toBeLessThanOrEqual(SCALE_MAX)
      }
    }
  )

  it('shrinks the wide marks that filled the slot, and keeps the long wordmarks', () => {
    expect(LOGO_SCALE_COLOR.mclaren).toBeLessThan(0.8)
    expect(LOGO_SCALE_COLOR.hyundai).toBeLessThan(0.8)
    expect(LOGO_SCALE_COLOR.bmw).toBeLessThan(1)
    expect(LOGO_SCALE_COLOR.ferrari).toBeGreaterThan(1)
    expect(LOGO_SCALE_COLOR.dallara).toBe(1)
    expect(LOGO_SCALE_MONO['aston-martin']).toBe(1)
  })

  it('reaches BrandMark through the drawing, in both styles', () => {
    expect(brandDrawing('mclaren', 'color')?.scale).toBe(LOGO_SCALE_COLOR.mclaren)
    // McLaren has no Simple Icon: its greys keep the colour logo's scale.
    expect(brandDrawing('mclaren', 'mono')?.scale).toBe(LOGO_SCALE_COLOR.mclaren)
    expect(brandDrawing('porsche', 'mono')?.scale).toBe(LOGO_SCALE_MONO.porsche)
  })
})

describe('measureInk', () => {
  const close = (box: readonly number[], want: number[]): void =>
    box.forEach((v, i) => expect(v).toBeCloseTo(want[i] ?? NaN, 3))

  it('measures a rectangle, absolute and relative', () => {
    const abs = measureInk([{ d: 'M1 2H11V7H1Z' }])
    close(abs.box, [1, 2, 11, 7])
    expect(abs.area).toBeCloseTo(50, 1)
    const rel = measureInk([{ d: 'm1 2h10v5h-10z' }])
    close(rel.box, [1, 2, 11, 7])
    expect(rel.area).toBeCloseTo(50, 1)
  })

  it('bounds curves by their extremes, not their control points', () => {
    // Controls at y = 10, the curve only reaches 7.5; endpoints at x 0 and 10.
    close(outline('M0 0C0 10 10 10 10 0Z').box, [0, 0, 10, 7.5])
    // The quadratic reaches half way to its control point.
    close(outline('M0 0Q5 10 10 0Z').box, [0, 0, 10, 5])
    // T and S reflect the previous control point.
    close(outline('M0 0Q5 10 10 0T20 0').box, [0, -5, 20, 5])
    close(outline('M0 0C0 10 10 10 10 0S20 -10 20 0').box, [0, -7.5, 20, 7.5])
  })

  it('bounds and fills arcs, compact flags included', () => {
    const disc = measureInk([{ d: 'M0 5a5 5 0 1010 0a5 5 0 10-10 0z' }])
    close(disc.box, [0, 0, 10, 10])
    expect(disc.area).toBeCloseTo(25 * Math.PI, 0)
    // Half turns either way: the sweep flag picks the side.
    close(outline('M0 0A5 5 0 0 1 10 0').box, [0, -5, 10, 0])
    close(outline('M0 0A5 5 0 0 0 10 0').box, [0, 0, 10, 5])
    // A rotated ellipse: its turning points, which the flattened outline only approaches.
    const tilted = outline('M0 0A10 5 30 1 1 10 10')
    const pts = tilted.polygons.flat()
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const sampled = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    tilted.box.forEach((v, i) => {
      const s = sampled[i] ?? NaN
      expect(Math.abs(v - s)).toBeLessThan(0.05)
      // The exact box holds every point of the curve.
      expect(i < 2 ? v <= s + 1e-9 : v >= s - 1e-9).toBe(true)
    })
    expect(tilted.box[2] - tilted.box[0]).toBeGreaterThan(10)
  })

  it('cuts holes by the fill rule, and counts overlapping layers once', () => {
    const ring = 'M0 0H10V10H0Z M3 3H7V7H3Z'
    expect(measureInk([{ d: ring, evenOdd: true }]).area).toBeCloseTo(84, 1)
    // Both squares clockwise: nonzero fills the inner one too.
    expect(measureInk([{ d: ring }]).area).toBeCloseTo(100, 1)
    expect(measureInk([{ d: 'M0 0H10V10H0Z' }, { d: 'M5 0H15V10H5Z' }]).area).toBeCloseTo(150, 1)
  })

  it('rejects junk paths', () => {
    expect(() => outline('M1 1 L2')).toThrow()
    expect(() => outline('M1 1 X2 2')).toThrow()
    expect(() => outline('1 1')).toThrow()
  })
})
