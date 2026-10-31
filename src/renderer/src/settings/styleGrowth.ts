/**
 * «Completo» in the free-size widgets (R56): the relative and the delta fit their text to their
 * window, so what the style turns on (column heads, a footer, more columns, the lap times line)
 * would shrink their text instead of growing them. Their window grows instead, by just what
 * keeps the text at the size it had: the same rule as the auto-height widgets, whose height
 * follows their content. Pure: the fit of each, as the widgets compute it (relative/view.ts,
 * the delta's --dl-fit-h / --dl-fit-w).
 */
import type { AppearancePreset } from '@shared/appearancePresets'
import { brandMarksOn } from '@shared/carBrands'
import { driverBlock } from '@shared/driverBlock'
import { isElementVisible, visibleIds } from '@shared/elements'
import { deepEqual } from '@shared/equal'
import { INFO_BAR_SCALE } from '@shared/infoBar'
import { clampRelativeSlots } from '@shared/relative'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { OverlaySettings, Rect } from '@shared/types'
import { WIDGET_DEFS } from '@shared/widgets'
import {
  DELTA_FIT_TOP_EM,
  DELTA_REF_BARS_FIT_W,
  DELTA_ROW_FIT_EM,
  refBarsFitEm
} from '../widgets/delta/rows'
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
  const bars = isElementVisible(o.rows, 'refs') ? visibleIds(o.refBars).length : 0
  h += refBarsFitEm(bars)
  const info =
    isElementVisible(o.top, 'predicted') || isElementVisible(o.top, 'reference') ? 20 : 11.5
  const trend = isElementVisible(o.top, 'state') ? 6 : 0
  const laps = isElementVisible(o.rows, 'laps')
    ? (DELTA_LAPS_W[Math.min(4, visibleIds(o.laps).length)] ?? 0)
    : 0
  const refs = bars > 0 ? DELTA_REF_BARS_FIT_W : 0
  return { h: Math.round(h * 100) / 100, w: Math.max(info + trend, laps, refs) }
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

/**
 * «OverLap» after «Completo» (R56, «todo de serie»): the free widgets whose contents go back
 * from `before` to `after` go back to their default size too, from the same top-left corner (so
 * a window «Completo» grew shrinks again). The default size fits the default contents; what
 * OverLap keeps (how many cars, the rows' density, the names) can need more, so the window is the
 * default one grown by just what keeps the text at its default size (grownBounds): the text never
 * shrinks. Only those not already at that size.
 */
export function defaultSizes(
  before: Readonly<OverlaySettings>,
  after: Readonly<OverlaySettings>
): Partial<Record<GrowingWidget, Rect>> {
  const out: Partial<Record<GrowingWidget, Rect>> = {}
  for (const id of GROWING_WIDGETS) {
    if (deepEqual(before[id], after[id])) continue
    const bounds = after.widgets[id].bounds
    const { width, height } = WIDGET_DEFS[id].defaultBounds
    const def = { ...bounds, width, height }
    const base = { ...after, [id]: DEFAULT_SETTINGS[id] } as OverlaySettings
    const next = grownBounds(def, FITS[id](base), FITS[id](after)) ?? def
    if (next.width === bounds.width && next.height === bounds.height) continue
    out[id] = next
  }
  return out
}

/** The free windows a style resizes, and the sizes "Deshacer" puts them back to. */
export interface StyleWindows {
  readonly resize: Partial<Record<GrowingWidget, Rect>>
  readonly restore: Partial<Record<GrowingWidget, Rect>>
}

/**
 * The free windows style `p` resizes going from `before` to `after`: «Completo» grows those its
 * contents need (freeGrowth), «OverLap» puts those whose contents it resets back to their default
 * size (defaultSizes); the looks alone resize none. `restore`: each as it was before.
 */
export function styleWindows(
  p: AppearancePreset,
  before: Readonly<OverlaySettings>,
  after: Readonly<OverlaySettings>
): StyleWindows {
  const resize =
    p === 'complete'
      ? freeGrowth(before, after)
      : p === 'overlap'
        ? defaultSizes(before, after)
        : {}
  const restore: Partial<Record<GrowingWidget, Rect>> = {}
  for (const id of Object.keys(resize) as GrowingWidget[]) {
    restore[id] = { ...before.widgets[id].bounds }
  }
  return { resize, restore }
}
