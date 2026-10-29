import { describe, expect, it } from 'vitest'
import { BRAND_IDS, type KnownBrandId } from '@shared/carBrands'
import SOURCE from './brandLogosColor.ts?raw'
import { BADGE_ONLY, COLOR_LOGOS, colorLogo, type ColorLogo } from './brandLogosColor'
import { brandDrawing, greyOf, luminance } from './brandDrawing'
import { brandLogo } from './brandLogos'

const LOGOS = Object.entries(COLOR_LOGOS) as [KnownBrandId, ColorLogo][]

/** Bytes of path data per logo, and for the whole set (it ships in every overlay window). */
const LOGO_BUDGET = 12_000
const TOTAL_BUDGET = 110_000

/** The dark glass (theme.css --ov-bg at full opacity). */
const PANEL = '#0c0e12'

const ARGS: Readonly<Record<string, number>> = {
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
 * Parses a whole path (any leftover character fails) into its segment ends in absolute
 * coordinates: every rendering passes through them.
 */
function segmentEnds(d: string): [number, number][] {
  const points: [number, number][] = []
  let i = 0
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let cmd = ''
  const skip = (): void => {
    while (i < d.length && /[\s,]/.test(d[i] ?? '')) i++
  }
  const num = (): number => {
    skip()
    const m = NUMBER.exec(d.slice(i))
    if (!m) throw new Error(`number expected at ${i}`)
    i += m[0].length
    return Number(m[0])
  }
  const flag = (): number => {
    skip()
    const c = d[i++]
    if (c !== '0' && c !== '1') throw new Error(`flag expected at ${i - 1}`)
    return Number(c)
  }
  for (skip(); i < d.length; skip()) {
    const c = d[i] ?? ''
    if (/[a-zA-Z]/.test(c)) {
      if (!(c.toUpperCase() in ARGS)) throw new Error(`unknown command ${c}`)
      cmd = c
      i++
    } else if (cmd === '' || /z/i.test(cmd)) throw new Error(`command expected at ${i}`)
    else if (cmd === 'M') cmd = 'L'
    else if (cmd === 'm') cmd = 'l'
    const up = cmd.toUpperCase()
    const rel = cmd !== up
    const a: number[] = []
    for (let k = 0; k < (ARGS[up] ?? 0); k++)
      a.push(up === 'A' && (k === 3 || k === 4) ? flag() : num())
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    if (up === 'Z') {
      x = sx
      y = sy
    } else if (up === 'H') x = (a[0] ?? 0) + ox
    else if (up === 'V') y = (a[0] ?? 0) + oy
    else {
      x = (a[a.length - 2] ?? 0) + ox
      y = (a[a.length - 1] ?? 0) + oy
      if (up === 'M') {
        sx = x
        sy = y
      }
    }
    points.push([x, y])
  }
  return points
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe('colour brand logos', () => {
  it('gives every brand of the table a colour logo, or a reason to be a badge', () => {
    for (const id of BRAND_IDS) {
      const reason = BADGE_ONLY[id]
      if (reason === undefined) expect(colorLogo(id), id).not.toBeNull()
      else {
        expect(colorLogo(id), id).toBeNull()
        expect(reason.length, id).toBeGreaterThan(10)
      }
    }
    for (const [id] of LOGOS) expect(BRAND_IDS).toContain(id)
    for (const id of Object.keys(BADGE_ONLY)) expect(BRAND_IDS).toContain(id)
    expect(colorLogo('unknown')).toBeNull()
  })

  it('says where every logo comes from, and whose trademark it is', () => {
    expect(SOURCE).toMatch(/trademarks of their owners/)
    for (const [id] of LOGOS) {
      expect(SOURCE, id).toMatch(new RegExp(`\\*   ${id}[ :(][^]*?\\n \\*     https://\\S+`))
    }
  })

  it.each(LOGOS)('%s: well-formed layers inside the view box', (id, logo) => {
    const box = logo.viewBox.split(' ').map(Number)
    expect(box).toHaveLength(4)
    const [x0 = NaN, y0 = NaN, w = NaN, h = NaN] = box
    expect([x0, y0]).toEqual([0, 0])
    expect(Math.max(w, h)).toBeCloseTo(48, 0)
    expect(Math.min(w, h)).toBeGreaterThan(4)
    expect(logo.layers.length).toBeGreaterThan(0)
    for (const layer of logo.layers) {
      expect(layer.fill).toMatch(/^#[0-9a-f]{6}$/)
      if (layer.onDark !== undefined) expect(layer.onDark).toMatch(/^#[0-9a-f]{6}$/)
      if (layer.opacity !== undefined) expect(layer.opacity).toBeGreaterThan(0)
      expect(layer.d).toMatch(/^M/)
      const ends = segmentEnds(layer.d)
      expect(ends.length, id).toBeGreaterThan(1)
      for (const [px, py] of ends) {
        expect(px, id).toBeGreaterThanOrEqual(-0.2)
        expect(px, id).toBeLessThanOrEqual(w + 0.2)
        expect(py, id).toBeGreaterThanOrEqual(-0.2)
        expect(py, id).toBeLessThanOrEqual(h + 0.2)
      }
    }
  })

  it('keeps every logo, and the set, under its size budget', () => {
    let total = 0
    for (const [id, logo] of LOGOS) {
      const bytes = logo.layers.reduce((s, l) => s + l.d.length, 0)
      expect(bytes, id).toBeLessThan(LOGO_BUDGET)
      total += bytes
    }
    expect(total).toBeLessThan(TOTAL_BUDGET)
  })

  it('reads on the dark glass: no logo is all dark ink there', () => {
    for (const [id, logo] of LOGOS) {
      const best = Math.max(...logo.layers.map((l) => contrast(l.onDark ?? l.fill, PANEL)))
      expect(best, id).toBeGreaterThan(3)
    }
  })

  it('rejects junk paths', () => {
    expect(segmentEnds('M1 1a1 1 0 011 1z')).toEqual([
      [1, 1],
      [2, 2],
      [1, 1]
    ])
    expect(() => segmentEnds('M1 1 L2')).toThrow()
    expect(() => segmentEnds('M1 1 X2 2')).toThrow()
    expect(() => segmentEnds('1 1')).toThrow()
  })
})

describe('brandDrawing', () => {
  it('draws the colour logo by default, with the dark-glass inks', () => {
    const audi = brandDrawing('audi', 'color')
    const rings = COLOR_LOGOS.audi?.layers[0]
    expect(audi?.colored).toBe(true)
    expect(audi?.viewBox).toBe(COLOR_LOGOS.audi?.viewBox)
    expect(audi?.paths[0]).toEqual({ d: rings?.d, fill: rings?.onDark })
    // On a light page the brand's own black.
    expect(brandDrawing('audi', 'color', 'light')?.paths[0]?.fill).toBe('#000000')
  })

  it('draws the Simple Icons path in currentColor for monochrome', () => {
    const porsche = brandDrawing('porsche', 'mono')
    expect(porsche).toEqual({
      viewBox: brandLogo('porsche')?.viewBox,
      paths: [{ d: brandLogo('porsche')?.d }],
      colored: false
    })
  })

  it('draws a make Simple Icons lacks in the greys of its colour logo', () => {
    const lotus = brandDrawing('lotus', 'mono')
    expect(lotus?.paths.length).toBe(COLOR_LOGOS.lotus?.layers.length)
    for (const p of lotus?.paths ?? []) expect(p.fill).toMatch(/^#([0-9a-f]{2})\1\1$/)
    expect(greyOf('#ffffff')).toBe('#ffffff')
    expect(greyOf('#000000')).toBe('#000000')
    expect(luminance(greyOf('#ff8000'))).toBeCloseTo(luminance('#ff8000'), 2)
  })

  it('draws a one-colour logo in the text ink, and keeps a badge two-tone, for monochrome', () => {
    expect(brandDrawing('mclaren', 'mono')?.paths.map((p) => p.fill)).toEqual([greyOf('#e8eaed')])
    expect(brandDrawing('mclaren', 'mono', 'light')?.paths.map((p) => p.fill)).toEqual([
      greyOf('#16181c')
    ])
    // Lotus: the yellow roundel becomes the ink, its black lettering stays black.
    const lotus = new Set(brandDrawing('lotus', 'mono')?.paths.map((p) => p.fill))
    expect(lotus).toEqual(new Set([greyOf('#e8eaed'), '#000000']))
  })

  it('has nothing for a badge-only or unknown make', () => {
    expect(brandDrawing('ray', 'color')).toBeNull()
    expect(brandDrawing('riley', 'mono')).toBeNull()
    expect(brandDrawing('unknown', 'color')).toBeNull()
  })

  it('builds each drawing once', () => {
    expect(brandDrawing('ferrari', 'color')).toBe(brandDrawing('ferrari', 'color'))
    expect(brandDrawing('ferrari', 'color')).not.toBe(brandDrawing('ferrari', 'mono'))
  })
})
