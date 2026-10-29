/** Words of the replay rule (settings.visibility.replays): which widgets a replay hides. Pure. */
import { widgetTitle, type Messages } from '@shared/i18n'
import type { VisibilityOptions } from '@shared/types'
import {
  WIDGET_IDS,
  canShowOnSessionScreen,
  followsCamera,
  inCarOnly,
  keepsLiveInReplay,
  type WidgetId
} from '@shared/widgets'

/** Names in sidebar order, joined the way `locale` lists things. */
export function widgetList(m: Messages, locale: string, ids: readonly WidgetId[]): string {
  const names = ids.map((id) => widgetTitle(m, id))
  return new Intl.ListFormat(locale, { type: 'conjunction' }).format(names)
}

/**
 * 'Radar, Pedales, Avisos, Delta y Combustible': the widgets with your own car's data only (or
 * the track's seen from it), which hide in every replay and while the camera is on another car,
 * in sidebar order and joined the way `locale` lists things.
 */
export function liveOnlyWidgets(m: Messages, locale: string): string {
  const ids = WIDGET_IDS.filter((id) => !followsCamera(id))
  return widgetList(m, locale, ids)
}

/**
 * 'Relativo, Batalla, Tráfico y Avisos': the widgets besides the standings that have a
 * session-screen exception of their own (canShowOnSessionScreen), in their Ventana section.
 */
export function sessionScreenWidgets(m: Messages, locale: string): string {
  const ids = WIDGET_IDS.filter((id) => id !== 'standings' && canShowOnSessionScreen(id))
  return widgetList(m, locale, ids)
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
  // Nothing while the replay system is on: the session screen either (no switch for it).
  if (!canShowOnSessionScreen(id)) return r.noSessionScreen
  if (!followsCamera(id)) return r.liveOnly
  if (v.replays === 'hide') return v.showWhen === 'always' ? r.hidden : r.hiddenOutOfCar
  return keepsLiveInReplay(id) ? r.keepsLive : r.follows
}

/**
 * Out of the car the global rules already hide every widget on the session screen: the overlay
 * only for the car, and replays not followed (the session screen is the replay system's live
 * point, where following the camera keeps the widgets). Hiding there (hideOnSessionScreen) then
 * changes nothing; only each widget's exception does.
 */
export function outOfCarHidesSessionScreen(
  v: Pick<VisibilityOptions, 'replays' | 'showWhen'>
): boolean {
  return v.showWhen !== 'always' && v.replays !== 'follow'
}

/**
 * The session-screen exception (WidgetSettings.showOnSessionScreen) changes something: the
 * session screen hides the others, or you are out of the car there with the overlay only for
 * the car and replays hidden. Otherwise every widget shows there anyway.
 */
export function sessionScreenRuleOn(
  v: Pick<VisibilityOptions, 'hideOnSessionScreen' | 'replays' | 'showWhen'>
): boolean {
  return v.hideOnSessionScreen || outOfCarHidesSessionScreen(v)
}
