import { describe, expect, it } from 'vitest'
import { BRAND_IDS, type KnownBrandId } from '@shared/carBrands'
import SOURCE from './brandLogos.ts?raw'
import { BRAND_LOGOS, brandLogo, type BrandLogo } from './brandLogos'

const LOGOS = Object.entries(BRAND_LOGOS) as [KnownBrandId, BrandLogo][]

const PARAMS: Readonly<Record<string, number>> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0
}

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/

/**
 * Parses a whole path (any leftover character fails) and returns its on-curve points in
 * absolute coordinates: segment ends, which every rendering passes through.
 */
function onCurvePoints(d: string): [number, number][] {
  const points: [number, number][] = []
  let i = 0
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let cmd = ''
  const skip = (): void => {
    while (i < d.length && /[\s,]/.test(d.charAt(i))) i++
  }
  const num = (): number => {
    skip()
    const m = NUMBER.exec(d.slice(i))
    if (!m) throw new Error(`number expected at ${i}: '${d.slice(i, i + 12)}'`)
    i += m[0].length
    return Number(m[0])
  }
  /** Arc flags may be written without a separator ('a1 1 0 011 1'). */
  const flag = (): number => {
    skip()
    const c = d.charAt(i)
    if (c !== '0' && c !== '1') throw new Error(`arc flag expected at ${i}`)
    i++
    return Number(c)
  }
  for (;;) {
    skip()
    if (i >= d.length) break
    const c = d.charAt(i)
    if (/[MLHVCSQTAZ]/i.test(c)) {
      cmd = c
      i++
    } else if (cmd === '' || /z/i.test(cmd)) {
      throw new Error(`command expected at ${i}`)
    } else if (cmd === 'M') {
      cmd = 'L'
    } else if (cmd === 'm') {
      cmd = 'l'
    }
    const rel = cmd === cmd.toLowerCase()
    const upper = cmd.toUpperCase()
    const args: number[] = []
    for (let k = 0; k < (PARAMS[upper] ?? 0); k++) {
      args.push(upper === 'A' && (k === 3 || k === 4) ? flag() : num())
    }
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    if (upper === 'Z') {
      x = startX
      y = startY
    } else if (upper === 'H') {
      x = (args[0] ?? 0) + ox
    } else if (upper === 'V') {
      y = (args[0] ?? 0) + oy
    } else {
      x = (args[args.length - 2] ?? 0) + ox
      y = (args[args.length - 1] ?? 0) + oy
      if (upper === 'M') {
        startX = x
        startY = y
      }
    }
    points.push([x, y])
  }
  return points
}

describe('brand logos', () => {
  it('names Simple Icons and its CC0 licence', () => {
    expect(SOURCE).toMatch(/Simple Icons \(https:\/\/simpleicons\.org/)
    expect(SOURCE).toMatch(/CC0 1\.0/)
  })

  it('has logos for the main makes, and only for brands of the table', () => {
    for (const id of ['porsche', 'bmw', 'ferrari', 'mazda', 'ford', 'chevrolet', 'toyota']) {
      expect(brandLogo(id as KnownBrandId), id).not.toBeNull()
    }
    for (const [id] of LOGOS) expect(BRAND_IDS).toContain(id)
    expect(LOGOS.length).toBeGreaterThanOrEqual(15)
  })

  it('leaves the brands without a readable Simple Icon to the badge', () => {
    for (const id of ['dallara', 'ligier', 'lotus', 'mercedes-amg', 'mclaren', 'kia'] as const) {
      expect(brandLogo(id), id).toBeNull()
    }
    expect(brandLogo('unknown')).toBeNull()
  })

  it.each(LOGOS)('%s: a well-formed path inside its view box, inside the 24 grid', (id, logo) => {
    expect(logo.slug).toMatch(/^[a-z0-9]+$/)
    expect(logo.d).toMatch(/^[Mm]/)
    expect(logo.d).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+eE-]+$/)
    const box = logo.viewBox.split(' ').map(Number)
    expect(box).toHaveLength(4)
    const [x0 = NaN, y0 = NaN, w = NaN, h = NaN] = box
    expect(w).toBeGreaterThan(0)
    expect(h).toBeGreaterThan(0)
    expect(x0).toBeGreaterThanOrEqual(0)
    expect(y0).toBeGreaterThanOrEqual(0)
    expect(x0 + w).toBeLessThanOrEqual(24.001)
    expect(y0 + h).toBeLessThanOrEqual(24.001)
    const points = onCurvePoints(logo.d)
    expect(points.length, id).toBeGreaterThan(2)
    const EPS = 0.02
    for (const [px, py] of points) {
      expect(px, id).toBeGreaterThanOrEqual(x0 - EPS)
      expect(px, id).toBeLessThanOrEqual(x0 + w + EPS)
      expect(py, id).toBeGreaterThanOrEqual(y0 - EPS)
      expect(py, id).toBeLessThanOrEqual(y0 + h + EPS)
    }
  })

  it('parses compact arc flags and rejects junk', () => {
    expect(onCurvePoints('M1 1a1 1 0 011 1z')).toEqual([
      [1, 1],
      [2, 2],
      [1, 1]
    ])
    expect(() => onCurvePoints('M1 1 L2')).toThrow()
    expect(() => onCurvePoints('M1 1 X2 2')).toThrow()
  })
})
