/**
 * The note under a background control when the preview's «Día» scene shows the widget hard to
 * read: over a bright sky, below DAY_READABLE_ALPHA the dim text and the reds fall under 3:1
 * whatever the halo does for the main text (a11y A1). Pure.
 */
import type { SettingsWindowOptions } from '@shared/types'

/** The lowest background opacity that keeps every text tier legible over the «Día» scene. */
export const DAY_READABLE_ALPHA = 0.6

/** Whether to warn: the preview is on «Día» and the background is below DAY_READABLE_ALPHA. */
export function dayUnreadable(scene: SettingsWindowOptions['stageScene'], alpha: number): boolean {
  return scene === 'light' && alpha < DAY_READABLE_ALPHA - 1e-9
}
