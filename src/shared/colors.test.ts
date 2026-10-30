import { describe, it, expect } from 'vitest'
import {
  FOLLOW_ACCENT,
  classColorToCss,
  colorOrAccent,
  contrastText,
  irColorToCss,
  licenseChipColor,
  licenseColor,
  normalizeHexColor,
  relativeLuminance
} from './colors'

describe('colorOrAccent (R46)', () => {
  it('gives the accent for a colour that follows it, its own colour otherwise', () => {
    expect(colorOrAccent(FOLLOW_ACCENT, '#33ccff')).toBe('#33ccff')
    expect(colorOrAccent('#ff8800', '#33ccff')).toBe('#ff8800')
  })
})

describe('irColorToCss', () => {
  it('converts numbers as js-yaml parses them', () => {
    expect(irColorToCss(0xffda59)).toBe('#ffda59')
    expect(irColorToCss(16767577)).toBe('#ffda59')
    expect(irColorToCss(0x0153db)).toBe('#0153db')
    expect(irColorToCss(0)).toBe('#000000')
    expect(irColorToCss(0xffffff)).toBe('#ffffff')
  })

  it('accepts hex strings in several spellings', () => {
    expect(irColorToCss('0xffda59')).toBe('#ffda59')
    expect(irColorToCss('0XFFDA59')).toBe('#ffda59')
    expect(irColorToCss('0x153db')).toBe('#0153db')
    expect(irColorToCss('#FFDA59')).toBe('#ffda59')
    expect(irColorToCss('ffda59')).toBe('#ffda59')
    expect(irColorToCss(' #ffda59 ')).toBe('#ffda59')
  })

  it('returns the fallback for anything else', () => {
    const bad: unknown[] = [
      -1,
      0x1000000,
      1.5,
      Number.NaN,
      '',
      '0xundefined',
      '#fff',
      'ffda5',
      'ffda599',
      '#ggggggg',
      '0x',
      null,
      undefined,
      true,
      {},
      [0xffda59]
    ]
    for (const v of bad) expect(irColorToCss(v), String(v)).toBe('#ffffff')
    expect(irColorToCss('nope', '#123456')).toBe('#123456')
    expect(irColorToCss(undefined, '')).toBe('')
  })
})

describe('classColorToCss', () => {
  it('maps 0 (pace car class) to white', () => {
    expect(classColorToCss(0)).toBe('#ffffff')
    expect(classColorToCss('0x000000')).toBe('#ffffff')
  })

  it('converts other colours and falls back to white', () => {
    expect(classColorToCss(0xffda59)).toBe('#ffda59')
    expect(classColorToCss(0x33ceff)).toBe('#33ceff')
    expect(classColorToCss(0xffffff)).toBe('#ffffff')
    expect(classColorToCss(null)).toBe('#ffffff')
    expect(classColorToCss('garbage')).toBe('#ffffff')
  })
})

describe('licenseColor', () => {
  it('prefers a valid non-zero LicColor', () => {
    expect(licenseColor('A 4.60', 0x123456)).toBe('#123456')
    expect(licenseColor('', 0xfc8a27)).toBe('#fc8a27')
    expect(licenseColor('', '0x00c702')).toBe('#00c702')
  })

  it('falls back to the license letter', () => {
    expect(licenseColor('R 0.01', '0xundefined')).toBe('#fc0706')
    expect(licenseColor('D 2.50', 0)).toBe('#fc8a27')
    expect(licenseColor('C 3.00', null)).toBe('#feec04')
    expect(licenseColor('B 1.99', undefined)).toBe('#00c702')
    expect(licenseColor('A 4.60', -1)).toBe('#0153db')
    expect(licenseColor('P 4.99', undefined)).toBe('#1f1f1f')
    expect(licenseColor(' a 4.60', undefined)).toBe('#0153db')
  })

  it('returns null when nothing is known', () => {
    expect(licenseColor('', undefined)).toBeNull()
    expect(licenseColor('X 1.00', 0)).toBeNull()
    expect(licenseColor('   ', 'bad')).toBeNull()
  })
})

describe('contrastText', () => {
  it('uses black on light backgrounds', () => {
    expect(contrastText('#ffffff')).toBe('#000000')
    expect(contrastText('#ffda59')).toBe('#000000')
    expect(contrastText('#feec04')).toBe('#000000')
    expect(contrastText('#00c702')).toBe('#000000')
    expect(contrastText('#33ceff')).toBe('#000000')
  })

  it('uses white on dark backgrounds', () => {
    expect(contrastText('#000000')).toBe('#ffffff')
    expect(contrastText('#1f1f1f')).toBe('#ffffff')
    expect(contrastText('#0153db')).toBe('#ffffff')
    expect(contrastText('#6a0dad')).toBe('#ffffff')
  })

  it('switches around mid grey and treats garbage as white', () => {
    expect(contrastText('#767676')).toBe('#000000')
    expect(contrastText('#757575')).toBe('#ffffff')
    expect(contrastText('#FFFFFF')).toBe('#000000')
    expect(contrastText('not a colour')).toBe('#000000')
  })
})

describe('normalizeHexColor', () => {
  it('accepts #rrggbb and #rgb in any case, with or without #', () => {
    expect(normalizeHexColor('#FFC400')).toBe('#ffc400')
    expect(normalizeHexColor(' ffc400 ')).toBe('#ffc400')
    expect(normalizeHexColor('#f80')).toBe('#ff8800')
    expect(normalizeHexColor('ABC')).toBe('#aabbcc')
  })

  it('rejects anything else', () => {
    for (const v of ['', '#ffc40', '#ffc4000', '0xffc400', 'red', '#ggg', 0xffc400, null, {}]) {
      expect(normalizeHexColor(v)).toBeNull()
    }
  })
})

describe('relativeLuminance / licenseChipColor', () => {
  it('computes the WCAG luminance', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1)
    expect(relativeLuminance('nope')).toBeNull()
  })

  it('lifts near-black licence colours to a visible grey, keeps the rest', () => {
    expect(licenseChipColor('#1f1f1f')).toBe('#8a909c')
    expect(licenseChipColor('#0153db')).toBe('#0153db')
    expect(licenseChipColor('#fc0706')).toBe('#fc0706')
    expect(licenseChipColor(null)).toBeNull()
  })
})
