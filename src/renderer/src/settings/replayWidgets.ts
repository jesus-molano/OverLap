/** Words of the replay rule (settings.visibility.replays): which widgets a replay hides. Pure. */
import { widgetTitle, type Messages } from '@shared/i18n'
import type { VisibilityOptions } from '@shared/types'
import {
  WIDGET_IDS,
  followsCamera,
  inCarOnly,
  keepsLiveInReplay,
  type WidgetId
} from '@shared/widgets'

/**
 * 'Radar, Pedales, Avisos, Delta y Combustible': the widgets with your own car's data only (or
 * the track's seen from it), which hide in every replay and while the camera is on another car,
 * in sidebar order and joined the way `locale` lists things.
 */
export function liveOnlyWidgets(m: Messages, locale: string): string {
  const names = WIDGET_IDS.filter((id) => !followsCamera(id)).map((id) => widgetTitle(m, id))
  return new Intl.ListFormat(locale, { type: 'conjunction' }).format(names)
}

/**
 * The help line of Apariencia > Visibilidad > En repeticiones, for the current choices: with
 * replays hidden and the overlay only in the car, watching from out of it hides them too; with
 * the overlay always on, the live point stays live.
 */
export function replaysHelp(
  m: Messages,
  locale: string,
  v: Pick<VisibilityOptions, 'replays' | 'showWhen'>
): string {
  const h = m.settings.appearance.screen.replaysHelp
  if (v.replays === 'follow') return h.follow(liveOnlyWidgets(m, locale))
  return v.showWhen === 'always' ? h.hideAlways : h.hide
}

/** What one widget does while a replay plays, for its "Ventana" section. */
export function replayNote(
  m: Messages,
  id: WidgetId,
  v: Pick<VisibilityOptions, 'replays' | 'showWhen'>
): string {
  const r = m.settings.window.replay
  if (inCarOnly(id)) return r.inCarOnly
  if (!followsCamera(id)) return r.liveOnly
  if (v.replays === 'hide') return v.showWhen === 'always' ? r.hidden : r.hiddenOutOfCar
  return keepsLiveInReplay(id) ? r.keepsLive : r.follows
}

/**
 * The session-screen exception (WidgetSettings.showOnSessionScreen) changes something: the
 * session screen hides the others, or you are out of the car there with the overlay only for
 * the car. Otherwise every widget shows there anyway.
 */
export function sessionScreenRuleOn(
  v: Pick<VisibilityOptions, 'hideOnSessionScreen' | 'showWhen'>
): boolean {
  return v.hideOnSessionScreen || v.showWhen !== 'always'
}
