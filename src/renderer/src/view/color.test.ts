import { describe, expect, it } from 'vitest'
import { relativeLuminance } from '@shared/colors'
import { INK_MIN_LUMINANCE, hexOr, inkOnDark } from './color'

describe('hexOr', () => {
  it('keeps valid #rrggbb in lower case', () => {
    expect(hexOr('#FFC400', '#000000')).toBe('#ffc400')
  })

  it('falls back on anything else', () => {
    for (const bad of [null, undefined, '', 'red', '#fff', '0xffffff', '#12345g']) {
      expect(hexOr(bad, '#4b5160')).toBe('#4b5160')
    }
  })
})

/** WCAG contrast of two relative luminances. */
const contrast = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
const lum = (hex: string): number => relativeLuminance(hex) ?? Number.NaN

/** The panel glass at its default opacity (.78) over a white sky and over dark asphalt. */
const SKY = lum('#414346')
const ASPHALT = lum('#13151a')
/** The lightest glass a licence sits on over the sky: your row's lift on an alternate stripe. */
const YOUR_STRIPE = lum('#505154')

describe('inkOnDark', () => {
  it('lifts dark licence colours until they read on the glass', () => {
    expect(inkOnDark('#0153db')).toBe('#80a9ed') // licence A
    expect(inkOnDark('#fc0706')).toBe('#fd7776') // licence R
    expect(inkOnDark('#000000')).toBe('#a6a6a6')
  })

  it('keeps bright colours as they are', () => {
    expect(inkOnDark('#ffda59')).toBe('#ffda59') // GT3
    expect(inkOnDark('#feec04')).toBe('#feec04') // licence C
    expect(inkOnDark('#00c702')).toBe('#00c702') // licence B
  })

  it('reads over a bright sky and over dark asphalt', () => {
    for (const c of ['#0153db', '#fc0706', '#000000', '#1f1f1f', '#8a909c', '#4b5160', '#ae6bff']) {
      const l = lum(inkOnDark(c))
      expect(l).toBeGreaterThanOrEqual(INK_MIN_LUMINANCE)
      expect(contrast(l, SKY)).toBeGreaterThanOrEqual(3.5)
      expect(contrast(l, YOUR_STRIPE)).toBeGreaterThanOrEqual(3)
      expect(contrast(l, ASPHALT)).toBeGreaterThanOrEqual(6.5)
    }
  })

  it('normalises case and passes anything else through', () => {
    expect(inkOnDark('#FEEC04')).toBe('#feec04')
    expect(inkOnDark('red')).toBe('red')
  })
})
