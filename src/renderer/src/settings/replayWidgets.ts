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
 * 'Radar, Pedales, Avisos, Delta y Condiciones': the widgets with your own car's data only (or
 * the track's seen from it), which hide in every replay and while the camera is on another car,
 * in sidebar order and joined the way `locale` lists things.
 */
export function liveOnlyWidgets(m: Messages, locale: string): string {
  const names = WIDGET_IDS.filter((id) => !followsCamera(id)).map((id) => widgetTitle(m, id))
  return new Intl.ListFormat(locale, { type: 'conjunction' }).format(names)
}

/** What one widget does while a replay plays, for its "Ventana" section. */
export function replayNote(
  m: Messages,
  id: WidgetId,
  replays: VisibilityOptions['replays']
): string {
  const r = m.settings.window.replay
  if (inCarOnly(id)) return r.inCarOnly
  if (!followsCamera(id)) return r.liveOnly
  if (replays === 'hide') return r.hidden
  return keepsLiveInReplay(id) ? r.keepsLive : r.follows
}
