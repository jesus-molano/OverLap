/**
 * What each widget showed before «Completo» (Apariencia's style, R56), remembered in this
 * window's storage when the style is applied, so choosing another style later can offer to take
 * away what Completo added. A convenience: without it (another device, cleared storage) the
 * offer is not made and the page only says that Completo's contents stay.
 */
import type { AppearancePreset } from '@shared/appearancePresets'
import type { SettingsPatch } from '@shared/types'
import { browserStorage } from './nav'

export const COMPLETE_BEFORE_KEY = 'ov-settings:before-complete'

export function rememberBeforeComplete(patch: SettingsPatch): void {
  try {
    browserStorage()?.setItem(COMPLETE_BEFORE_KEY, JSON.stringify(patch))
  } catch {
    // Not worth surfacing.
  }
}

/** The patch remembered, or null (none, or not a patch). */
export function beforeComplete(): SettingsPatch | null {
  try {
    const raw = browserStorage()?.getItem(COMPLETE_BEFORE_KEY)
    if (raw == null) return null
    const v: unknown = JSON.parse(raw)
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as SettingsPatch) : null
  } catch {
    return null
  }
}

export function forgetBeforeComplete(): void {
  try {
    browserStorage()?.setItem(COMPLETE_BEFORE_KEY, 'null')
  } catch {
    // Not worth surfacing.
  }
}

/**
 * Notes style `p` being applied: «Completo» remembers `contents` (what the widgets showed before
 * it); «OverLap», which puts every content back as it comes, and a take-back forget it. Returns
 * how to put the memory back as it was, for "Deshacer" (undoing OverLap over Completo offers the
 * take-back again).
 */
export function noteStyleApplied(
  p: AppearancePreset,
  contents: SettingsPatch,
  tookBack: boolean
): () => void {
  const was = beforeComplete()
  if (p === 'complete') rememberBeforeComplete(contents)
  else if (p === 'overlap' || tookBack) forgetBeforeComplete()
  else return () => {}
  return () => {
    if (was === null) forgetBeforeComplete()
    else rememberBeforeComplete(was)
  }
}
