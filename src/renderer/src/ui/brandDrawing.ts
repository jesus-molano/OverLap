import type { BrandId } from '@shared/carBrands'
import type { AppearanceSettings } from '@shared/types'
import { brandLogo } from './brandLogos'
import { colorLogo, type ColorLayer } from './brandLogosColor'
import { LOGO_SCALE_COLOR, LOGO_SCALE_MONO } from './brandLogoSizes'

/** settings.appearance.brandLogos: each make in its colours, or all in one ink. */
export type BrandLogoStyle = AppearanceSettings['brandLogos']

/** What BrandMark sits on: the widgets' dark glass, or a light page (previews, docs). */
export type BrandSurface = 'dark' | 'light'

export interface BrandPath {
  readonly d: string
  /** Absent: currentColor (the monochrome Simple Icons path). */
  readonly fill?: string
  readonly fillRule?: 'evenodd'
  readonly opacity?: number
}

export interface BrandDrawing {
  readonly viewBox: string
  readonly paths: readonly BrandPath[]
  /** Drawn in the make's colours (or their greys), not in currentColor. */
  readonly colored: boolean
  /**
   * Its height in heights of BrandMark's slot, so every logo reads at about the same size
   * (brandLogoSizes.ts, generated from the paths).
   */
  readonly scale: number
}

/** Relative luminance (sRGB) of '#rrggbb'. */
export function luminance(hex: string): number {
  const lin = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5)
}

/** The grey of luminance `l` (0..1). */
export function greyOfLuminance(l: number): string {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055
  const v = Math.round(Math.min(1, Math.max(0, c)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `#${v}${v}${v}`
}

/** The grey of the same luminance as `hex`. */
export function greyOf(hex: string): string {
  return greyOfLuminance(luminance(hex))
}

/** The text inks of the dark glass and of a light page. */
const INK_ON_DARK = luminance('#e8eaed')
const INK_ON_LIGHT = luminance('#16181c')

/**
 * A colour logo in one ink: greys of its luminances, stretched so its lightest part is the text
 * ink on the glass (its darkest on a light page). A one-colour logo (McLaren's papaya) is then
 * drawn in the text ink, and a badge keeps its light and dark parts (Lotus' black on yellow).
 */
export function monoInks(inks: readonly string[], surface: BrandSurface): string[] {
  const ls = inks.map(luminance)
  if (surface === 'dark') {
    const max = Math.max(...ls)
    return ls.map((l) => greyOfLuminance(max > 0 ? (l * INK_ON_DARK) / max : INK_ON_DARK))
  }
  const min = Math.min(...ls)
  return ls.map((l) =>
    greyOfLuminance(min < 1 ? 1 - ((1 - l) * (1 - INK_ON_LIGHT)) / (1 - min) : INK_ON_LIGHT)
  )
}

function layerPath(l: ColorLayer, fill: string): BrandPath {
  return {
    d: l.d,
    fill,
    ...(l.evenOdd ? { fillRule: 'evenodd' as const } : {}),
    ...(l.opacity === undefined ? {} : { opacity: l.opacity })
  }
}

const cache = new Map<string, BrandDrawing | null>()

/**
 * The drawing of a make, null when it has none (its text badge then): the colour logo, or in
 * monochrome the Simple Icons path in currentColor (the colour logo in greys for a make Simple
 * Icons lacks). Built once per make, style and surface.
 */
export function brandDrawing(
  brand: BrandId,
  style: BrandLogoStyle,
  surface: BrandSurface = 'dark'
): BrandDrawing | null {
  const key = `${brand}|${style}|${surface}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const color = colorLogo(brand)
  const mono = brandLogo(brand)
  let out: BrandDrawing | null = null
  const known = brand === 'unknown' ? null : brand
  const monoScale = (known && LOGO_SCALE_MONO[known]) ?? 1
  if (style === 'mono' && mono) {
    out = { viewBox: mono.viewBox, paths: [{ d: mono.d }], colored: false, scale: monoScale }
  } else if (color) {
    const inks = color.layers.map((l) => (surface === 'dark' ? (l.onDark ?? l.fill) : l.fill))
    const fills = style === 'mono' ? monoInks(inks, surface) : inks
    out = {
      viewBox: color.viewBox,
      paths: color.layers.map((l, i) => layerPath(l, fills[i] ?? l.fill)),
      colored: true,
      scale: (known && LOGO_SCALE_COLOR[known]) ?? 1
    }
  } else if (mono) {
    out = { viewBox: mono.viewBox, paths: [{ d: mono.d }], colored: false, scale: monoScale }
  }
  cache.set(key, out)
  return out
}
