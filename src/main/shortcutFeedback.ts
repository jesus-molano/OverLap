import { hiddenText, type Messages } from '@shared/i18n'
import type { OsdMessage, UsedShortcut } from '@shared/ipc'
import { widgetOfAction } from '@shared/shortcuts'
import type { HiddenReason, OverlaySettings } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import { widgetTitle } from '@shared/i18n'

/** The state just after a shortcut ran, as the confirmation needs it. */
export interface FeedbackState {
  overlayHidden: boolean
  editMode: boolean
  /** The one reason a rule hides every enabled widget now (tray.commonHiddenReason). */
  allHiddenBy: HiddenReason | undefined
  /** A session is running (the delta's cycle acts on it). */
  inSession: boolean
  /** The delta is on and no rule hides it now. */
  deltaShowing: boolean
  layoutCount: number
  /** The layout in use now (after the shortcut). */
  layoutName: string
  /**
   * A «Más acciones» shortcut's widget (R52), after it ran: its name, whether it is on, and what
   * keeps it off the screen while on (the overlay hidden by you, or a rule), null for nothing.
   */
  widget?: { name: string; visible: boolean; held: string | null }
}

/**
 * What the confirmation over the game says after `action` ran (R37), above all when it changed
 * nothing you can see: the overlay shown while a rule hides every widget, the delta's reference
 * changed with the delta hidden or out of a session, the next layout with only one. Null for
 * «Abrir los Ajustes» (the window says it). Pure.
 */
export function shortcutFeedback(
  m: Messages,
  action: UsedShortcut,
  s: FeedbackState
): OsdMessage | null {
  const t = m.core.osd
  switch (action) {
    case 'toggleOverlay':
      if (s.overlayHidden) return { text: t.overlayHidden, detail: '' }
      return s.allHiddenBy === undefined
        ? { text: t.overlayShown, detail: '' }
        : { text: t.overlayShownHeld(hiddenText(m, s.allHiddenBy)), detail: '' }
    case 'toggleEditMode':
      return { text: s.editMode ? t.editOn : t.editOff, detail: '' }
    // Esc, the fixed shortcut: it only ever leaves edit mode.
    case 'exitEdit':
      return { text: t.editOff, detail: '' }
    case 'cycleDeltaReference':
      if (!s.inSession) return { text: t.deltaNoSession, detail: t.deltaNoSessionDetail }
      if (!s.deltaShowing) return { text: t.deltaHidden, detail: t.deltaHiddenDetail }
      return { text: t.deltaNext, detail: t.deltaNextDetail }
    case 'nextLayout':
      if (s.layoutCount < 2) return { text: t.layoutOnlyOne, detail: t.layoutOnlyOneDetail }
      return { text: t.layout(s.layoutName), detail: '' }
    case 'openSettings':
      return null
    default: {
      const w = s.widget
      if (w === undefined) return null
      if (!w.visible) return { text: t.widgetHidden(w.name), detail: '' }
      return { text: t.widgetShown(w.name), detail: w.held ?? '' }
    }
  }
}

/** What main knows right after a shortcut ran, besides the settings. */
export interface LiveState {
  overlayHidden: boolean
  editMode: boolean
  /** tray.commonHiddenReason of the rules now. */
  allHiddenBy: HiddenReason | undefined
  /** A visibility rule hides the delta now. */
  deltaHeld: boolean
  inSession: boolean
  /** Every widget a rule hides now, and why (a «Más acciones» shortcut says it). */
  autoHidden?: Readonly<Partial<Record<WidgetId, HiddenReason | null>>>
}

/**
 * The confirmation over the game after `action` ran (main's afterShortcut): none with
 * «Confirmar sobre el juego» off; the layout named is the one in use after the shortcut. Pure.
 */
export function shortcutConfirmation(
  m: Messages,
  action: UsedShortcut,
  settings: OverlaySettings,
  live: LiveState
): OsdMessage | null {
  if (!settings.settingsWindow.shortcutToasts) return null
  const lib = settings.savedLayouts
  return shortcutFeedback(m, action, {
    overlayHidden: live.overlayHidden,
    editMode: live.editMode,
    allHiddenBy: live.allHiddenBy,
    inSession: live.inSession,
    deltaShowing: settings.widgets.delta.visible && !live.deltaHeld,
    layoutCount: lib.list.length,
    layoutName: lib.list.find((l) => l.id === lib.activeId)?.name ?? '',
    widget: widgetState(m, action, settings, live)
  })
}

/** A «Más acciones» shortcut's widget as the confirmation says it; undefined for another action. */
function widgetState(
  m: Messages,
  action: UsedShortcut,
  settings: OverlaySettings,
  live: LiveState
): FeedbackState['widget'] {
  const id = widgetOfAction(action)
  if (id === null) return undefined
  const visible = settings.widgets[id].visible
  const reason = live.overlayHidden ? null : (live.autoHidden?.[id] ?? null)
  const held = live.overlayHidden
    ? m.core.osd.widgetHeldByYou
    : reason === null
      ? null
      : hiddenText(m, reason)
  return { name: widgetTitle(m, id), visible, held }
}
