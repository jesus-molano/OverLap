import { computed, type ComputedRef } from 'vue'
import { clamp01, isFiniteNumber } from '@shared/num'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { AppearanceSettings } from '@shared/types'
import { WIDGET_DEFS, type WidgetId } from '@shared/widgets'
import { minTextPx, widgetFontPx } from '../view/appearance'
import type { InlineStyle } from '../view/styles'
import { useAppearance } from './useAppearance'
import { ownOptionsApply, useWidgetSettings } from './useWidgetSettings'
import { injectWidgetId } from './widgetContext'

/** Below this background opacity the text needs a dark halo to stay legible over the game. */
export const LOW_BG_ALPHA = 0.35

/**
 * Below this the 'auto' halo is on: a mid-opacity panel over a bright sky (a white sky at 50 %
 * puts the dim text at 1.2:1 and red at 1.3:1) needs it as much as a see-through one.
 */
export const HALO_AUTO_ALPHA = 0.65

/** Background opacity in [0, 1]; `fallback` for anything that is not a finite number. */
export function clampOpacity(a: unknown, fallback: number): number {
  return isFiniteNumber(a) ? clamp01(a) : fallback
}

/** The opacity a widget's panel uses: its own, or the global one for 'inherit'. */
export function widgetOpacity(own: unknown, global: unknown): number {
  const fallback = clampOpacity(global, DEFAULT_BG_ALPHA)
  return own === 'inherit' ? fallback : clampOpacity(own, fallback)
}

/** appearance.backgroundOpacity's default (every widget's since 2.3). */
const DEFAULT_BG_ALPHA = OPTION_SCHEMA.appearance.backgroundOpacity.default

/** Whether text gets the halo: forced on/off, or 'auto' = only over a see-through panel. */
export function haloOn(mode: AppearanceSettings['textHalo'], alpha: number): boolean {
  if (mode === 'on') return true
  if (mode === 'off') return false
  return alpha < HALO_AUTO_ALPHA
}

export interface WidgetSurface {
  /** Background opacity, 0..1. */
  bgAlpha: ComputedRef<number>
  /** The panel is see-through (below LOW_BG_ALPHA), whatever the halo option says. */
  lowBg: ComputedRef<boolean>
  /** Text halo on (appearance.textHalo applied): bind `ov-halo` on the panel. */
  halo: ComputedRef<boolean>
  /** Font (px) of an auto-height widget: 13 px x scale x global text scale. */
  fontPx: ComputedRef<number>
  /**
   * For the `.ov-surface` element (WidgetPanel's `surface` prop): `--ov-bg-alpha`, and `--ov-fs`
   * for auto-height widgets. The same object until one of them changes.
   */
  surfaceStyle: ComputedRef<InlineStyle>
}

/** Background opacity, halo and base font of a widget, from its settings and the appearance. */
export function useWidgetSurface(id: WidgetId = injectWidgetId()): WidgetSurface {
  const prefs = useWidgetSettings(id)
  const appearance = useAppearance()
  const def = WIDGET_DEFS[id]
  // Apariencia's sample draws «Fondo de los widgets», as its slider and «Día» note say.
  const own = ownOptionsApply()
  const bgAlpha = computed(() =>
    widgetOpacity(
      own ? prefs.value.backgroundOpacity : 'inherit',
      appearance.value.backgroundOpacity
    )
  )
  const lowBg = computed(() => bgAlpha.value < LOW_BG_ALPHA)
  const halo = computed(() => haloOn(appearance.value.textHalo, bgAlpha.value))
  const fontPx = computed(() =>
    widgetFontPx(prefs.value.scale, appearance.value.fontScale, minTextPx(appearance.value))
  )
  const autoHeight = def.sizeModel === 'auto-height'
  const surfaceStyle = computed<InlineStyle>(() => {
    const style: Record<string, string> = { '--ov-bg-alpha': String(bgAlpha.value) }
    if (autoHeight) style['--ov-fs'] = `${fontPx.value}px`
    return style
  })
  return { bgAlpha, lowBg, halo, fontPx, surfaceStyle }
}
