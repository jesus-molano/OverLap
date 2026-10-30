/**
 * «Completo» in the free-size widgets (R56): the relative and the delta fit their text to their
 * window, so what the style turns on (column heads, a footer, more columns, the lap times line)
 * would shrink their text instead of growing them. Their window grows instead, by just what
 * keeps the text at the size it had: the same rule as the auto-height widgets, whose height
 * follows their content. Pure: the fit of each, as the widgets compute it (relative/view.ts,
 * the delta's --dl-fit-h / --dl-fit-w).
 */
import { brandMarksOn } from '@shared/carBrands'
import { driverBlock } from '@shared/driverBlock'
import { isElementVisible, visibleIds } from '@shared/elements'
import { INFO_BAR_SCALE } from '@shared/infoBar'
import { clampRelativeSlots } from '@shared/relative'
import type { OverlaySettings, Rect } from '@shared/types'
import { DELTA_FIT_TOP_EM, DELTA_ROW_FIT_EM } from '../widgets/delta/rows'
import { chromeEm, relativeColumns, relativeRowEm } from '../widgets/relative/view'

/** A free widget's text fit: the em height and width its contents need. */
export interface Fit {
  readonly h: number
  readonly w: number
}

/** The free-size widgets whose text a style's contents change. */
export const GROWING_WIDGETS = ['relative', 'delta'] as const

export type GrowingWidget = (typeof GROWING_WIDGETS)[number]

function barScale(size: string): number | null {
  return size === 'off' ? null : (INFO_BAR_SCALE[size as keyof typeof INFO_BAR_SCALE] ?? 1)
}

/** The relative's fit (its rows, bars and heads high; its columns wide), a field of makes. */
export function relativeFit(s: Readonly<OverlaySettings>): Fit {
  const o = s.relative
  const block = driverBlock(o, s.appearance)
  const slots = clampRelativeSlots(o.carsAhead) + clampRelativeSlots(o.carsBehind) + 1
  const density = o.density === 'inherit' ? s.appearance.density : o.density
  const chrome = chromeEm({
    header: barScale(o.headerBarSize),
    heads: o.columnHeads,
    footer: barScale(o.footerBarSize)
  })
  const cols = relativeColumns(o.columns, {
    tyres: true,
    flags: block.showFlags,
    brand: brandMarksOn(block.brandMarks, true),
    country: block.countryFlags
  })
  return { h: slots * relativeRowEm(density) + chrome, w: cols.fitEm }
}

/** The delta's em width of the lap times line, by how many times it shows. */
const DELTA_LAPS_W = [0, 8, 15, 22, 29] as const

/** The delta's fit (DeltaWidget's --dl-fit-h and --dl-fit-w). */
export function deltaFit(s: Readonly<OverlaySettings>): Fit {
  const o = s.delta
  let h = DELTA_FIT_TOP_EM
  for (const row of ['bar', 'sectors', 'laps'] as const) {
    if (isElementVisible(o.rows, row)) h += DELTA_ROW_FIT_EM[row]
  }
  const info =
    isElementVisible(o.top, 'predicted') || isElementVisible(o.top, 'reference') ? 20 : 11.5
  const trend = isElementVisible(o.top, 'state') ? 6 : 0
  const laps = isElementVisible(o.rows, 'laps')
    ? (DELTA_LAPS_W[Math.min(4, visibleIds(o.laps).length)] ?? 0)
    : 0
  return { h: Math.round(h * 100) / 100, w: Math.max(info + trend, laps) }
}

const FITS: Readonly<Record<GrowingWidget, (s: Readonly<OverlaySettings>) => Fit>> = {
  relative: relativeFit,
  delta: deltaFit
}

/**
 * The window `bounds` must take for its text to stay the size it was when the contents go from
 * `before`'s fit to `after`'s: only ever bigger, from the same top-left corner; null when it
 * already fits.
 */
export function grownBounds(bounds: Readonly<Rect>, before: Fit, after: Fit): Rect | null {
  if (!(before.h > 0) || !(before.w > 0)) return null
  const font = Math.min(bounds.height / before.h, bounds.width / before.w)
  const width = Math.max(bounds.width, Math.ceil(font * after.w))
  const height = Math.max(bounds.height, Math.ceil(font * after.h))
  if (width === bounds.width && height === bounds.height) return null
  return { ...bounds, width, height }
}

/**
 * The free widgets' windows after a style changed their contents from `before` to `after`
 * (`after`'s bounds: the window as the change left it), only those that must grow.
 */
export function freeGrowth(
  before: Readonly<OverlaySettings>,
  after: Readonly<OverlaySettings>
): Partial<Record<GrowingWidget, Rect>> {
  const out: Partial<Record<GrowingWidget, Rect>> = {}
  for (const id of GROWING_WIDGETS) {
    // Only the contents count: the old contents under the new look (density, logos) give the
    // text size to keep, so a look never grows a window by itself.
    const base = { ...after, [id]: before[id] } as OverlaySettings
    const next = grownBounds(after.widgets[id].bounds, FITS[id](base), FITS[id](after))
    if (next !== null) out[id] = next
  }
  return out
}
